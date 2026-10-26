# E-Ambulance — Concurrency, Race Conditions & Runtime Bugs Audit

**Generated:** October 25, 2026  
**Scope:** Full repository (`src/models/`, `src/controllers/`, `src/views/`, `src/components/`, `src/lib/`, `supabase/migrations/`)

---

## Executive Summary

A deep review of the codebase, database triggers, Row-Level Security (RLS) policies, and real-time subscriptions identified **15 critical/high-impact bugs and race conditions** across four categories:

| Category | Count | Key Risks |
| :--- | :---: | :--- |
| **1. Concurrency & Race Conditions** | 6 | Ghost trips, resurrecting cancelled bookings, drivers stuck as `is_busy`, session kick loops, duplicate GPS watchers |
| **2. Database, RLS & State Desync** | 4 | Unhandled FK crash on hospital delete, silent UI state desync on failed toggles, incomplete admin filter |
| **3. Realtime Channels & UI Remounts** | 3 | Full-screen loading spinner unmounting Google Maps on status updates, unthrottled DB writes, channel races |
| **4. Auth & Middleware Edge Cases** | 2 | Unauthenticated `signUp` RLS failure when email verification is active, middleware role fallback redirect |

---

## 1. Concurrency & Race Conditions

### [RC-01] CRITICAL — Driver `is_busy` Pre-Update Race Condition in `acceptByDriver`
* **Files:**
  * `src/models/BookingModel.js` (lines 180–250, `acceptByDriver`)
  * `supabase/migrations/004_fix_security_and_triggers.sql` (lines 111–151, `sync_driver_busy_state`)
* **Timeline of the Race:**
  1. Driver A and Driver B both view the same `pending` booking and click **"Accept Dispatch Request"** at the same moment.
  2. Both clients execute `SELECT id, status, driver_id FROM bookings WHERE id = bookingId` and both see `status = 'pending'`.
  3. **Both clients execute `await DriverModel.setBusyStatus(driverId, true)` BEFORE attempting the atomic booking update.**
  4. Driver A wins the `UPDATE bookings SET driver_id = A, status = 'accepted' WHERE id = bookingId AND status = 'pending'`.
  5. Driver B's `UPDATE` matches 0 rows (or fails RLS). If Driver B's network drops, tab closes, or an exception occurs before the fallback `setBusyStatus(driverId, false)` runs, **Driver B is permanently stuck with `is_busy = true`** despite having no active booking.
* **Recommended Fix:**
  Remove the pre-update `await DriverModel.setBusyStatus(driverId, true)` call before the `bookings` update. Rely on the atomic `UPDATE bookings ... WHERE id = bookingId AND status = 'pending'` first, and only set `is_busy = true` after confirming the driver won the booking (or let the `sync_driver_busy_state` PostgreSQL trigger handle it atomically inside the same transaction).

---

### [RC-02] CRITICAL — Patient Cancellation vs. Driver Status Progression Race Condition
* **Files:**
  * `src/models/BookingModel.js` (`cancel` lines 113–129, `updateStatus` lines 269–285)
  * `src/controllers/useUserController.js` (`handleCancel` lines 257–262)
  * `supabase/migrations/004_fix_security_and_triggers.sql` (`guard_booking_update` lines 63–108)
* **Timeline of the Race:**
  * **Case A — Driver overwrites a Patient's cancellation (Resurrected Booking):**
    1. A booking is in `accepted` state.
    2. Patient clicks **"Yes, Cancel"** → DB updates `status` to `'cancelled'` and sets `drivers.is_busy = false`.
    3. 200ms later (before the driver notices or because the driver console doesn't subscribe to `activeTrip` updates — see `[RC-03]`), the driver clicks **"Start Route to Pickup"**.
    4. `BookingModel.updateStatus(bookingId, 'en_route_pickup')` runs `UPDATE bookings SET status = 'en_route_pickup' WHERE id = bookingId`.
    5. Because `bookings.driver_id` still equals the driver's ID and neither `BookingModel.updateStatus` nor `guard_booking_update()` checks `OLD.status NOT IN ('cancelled', 'completed')`, **the cancelled booking is resurrected back to `'en_route_pickup'`**!
  * **Case B — Patient cancels right after Driver starts route (Silent Failure):**
    1. Driver clicks **"Start Route to Pickup"** → DB updates `status` to `'en_route_pickup'`.
    2. 200ms later, Patient clicks **"Yes, Cancel"**.
    3. The DB trigger `guard_booking_update()` rejects the update (`RAISE EXCEPTION 'Patients can only cancel pending or accepted bookings'`).
    4. However, `handleCancel()` in `src/controllers/useUserController.js` **ignores the `{ error }` return value and redirects the patient to `/user`**, leaving the patient believing the ambulance was cancelled while the driver is still en route.
* **Recommended Fix:**
  1. In `BookingModel.updateStatus`, add `.neq('status', 'cancelled').neq('status', 'completed')`.
  2. In `guard_booking_update()` SQL trigger, forbid any transition out of `'cancelled'` or `'completed'`.
  3. In `useTrackBookingController.handleCancel`, check `const { error } = await BookingModel.cancel(...)` and show an error toast instead of redirecting if the cancellation was rejected.

---

### [RC-03] CRITICAL — Driver Console Never Subscribes to Realtime Updates for `activeTrip` (Ghost Trip)
* **Files:**
  * `src/controllers/useDriverController.js` (`useDriverDashboardController`, lines 142–164)
* **Problem:**
  When a driver has an `activeTrip`, `useDriverDashboardController` stores `activeTrip` in local state and starts broadcasting GPS via `DriverModel.startLocationBroadcast`. However, it **never subscribes to `postgres_changes` for `activeTrip.id`**.
  * If the patient (or an admin) cancels the booking while `status === 'accepted'`, the driver's screen **never updates**:
    * The "Active Dispatch Assignment" card remains stuck on the driver's screen.
    * The driver's Online/Offline button remains disabled (`disabled={!!activeTrip}`).
    * The browser continues streaming the driver's GPS coordinates into `location_logs` for a cancelled booking.
* **Recommended Fix:**
  Subscribe to `BookingModel.subscribeToBookingById(activeTrip.id, ...)` inside `useDriverDashboardController`. When `updatedRow.status === 'cancelled'`, stop `broadcastRef.current`, clear `activeTrip`, and display a warning toast (`"Patient cancelled the dispatch request"`).

---

### [RC-04] HIGH — Duplicate `useSessionController` Mounts Tearing Down Realtime Session Channels
* **Files:**
  * `src/components/layout/Navbar.js` (line 10)
  * `src/controllers/useAuthController.js` (`useSessionController`, lines 13–86)
  * `src/models/AuthModel.js` (`subscribeToSessionChanges`, lines 122–162)
* **Timeline of the Bug:**
  1. Every authenticated view renders `<Navbar />` (which calls `useSession()`) **and** the page controller itself also calls `useSessionController()` (e.g., `useUserDashboardController`, `useDriverDashboardController`, `useAdminDashboardController`).
  2. Because state is not shared via a React Context Provider, **two independent instances of `useSessionController` run simultaneously on every page**:
     * Both instances fire duplicate `auth.getUser()`, `profiles` select, and `drivers` select requests.
     * Both instances call `AuthModel.subscribeToSessionChanges(user.id, kickUserOut)`.
  3. Look at `AuthModel.subscribeToSessionChanges` (lines 126–131):
     ```js
     const existing = supabase
       .getChannels()
       .find((ch) => ch.topic === `realtime:${channelName}` || ch.topic === channelName);
     if (existing) {
       supabase.removeChannel(existing);
     }
     ```
     Instance #2 immediately **destroys the Realtime channel created by Instance #1**, and when either component unmounts or re-renders, its cleanup function removes the channel from the singleton Supabase client, leaving the session enforcer disconnected.
* **Recommended Fix:**
  Wrap the application (or authenticated layouts) in a single `SessionProvider` React Context, or reference-count the channel instead of calling `supabase.removeChannel(existing)` when another hook instance is already listening.

---

### [RC-05] HIGH — Dual Geolocation Watchers & Unthrottled Database Writes on Active Driver Trips
* **Files:**
  * `src/controllers/useDriverController.js` (lines 138, 148, 196)
  * `src/models/DriverModel.js` (`startLocationBroadcast`, lines 104–156)
* **Problem:**
  When a driver is online and on an active trip, **two separate `navigator.geolocation.watchPosition` watchers run at the same time**:
  1. `useDriverLocationController(driverData?.id, isOnline)` watches GPS and updates `drivers.current_lat / current_lng` every 5 seconds.
  2. `DriverModel.startLocationBroadcast(trip.id, driverData.id)` starts a **second** `watchPosition` that updates `drivers.current_lat / current_lng` AND inserts a row into `location_logs` on **every single OS geolocation callback without any time/distance throttling**.
  * On mobile devices where `watchPosition` fires at 1 Hz (every second), `startLocationBroadcast` fires 2 database queries per second (120 queries/minute per ambulance) and races with `useDriverLocationController`'s 5-second interval.
* **Recommended Fix:**
  1. Pause `useDriverLocationController` while `activeTrip` is present (`useDriverLocationController(driverData?.id, isOnline && !activeTrip)`), or unify both into a single location service.
  2. Throttle DB writes (`updateCoordinates` and `insertLocationLog`) inside `startLocationBroadcast` to at most once every `intervalMs` (5000ms).

---

### [RC-06] HIGH — TOCTOU Race on Booking Creation (`hasActiveBooking` vs `create`)
* **Files:**
  * `src/controllers/useUserController.js` (`useCreateBookingController`, lines 93–133)
  * `supabase/migrations/004_fix_security_and_triggers.sql` (lines 166–173)
* **Timeline of the Race:**
  1. Patient on a slow mobile connection double-taps **"Confirm Dispatch Request"** (or submits from two tabs).
  2. Request 1 and Request 2 both run `BookingModel.hasActiveBooking(user.id)` before either `INSERT` commits; both see `hasActive: false`.
  3. If Migration 004 (`idx_unique_active_booking_per_user`) has **not** been applied to the database, **two active bookings are created for the same patient**.
  4. If Migration 004 **has** been applied, Request 2 fails with Postgres error code `23505` (`duplicate key value violates unique constraint "idx_unique_active_booking_per_user"`), which is displayed as a raw database error in the toast.
* **Recommended Fix:**
  Map PostgreSQL error code `23505` in `BookingModel.create` to a friendly message (`"You already have an active booking in progress."`), and guard `handleBooking` with a synchronous `useRef` lock (`isSubmittingRef.current`) in addition to React `bookingLoading` state.

---

## 2. Database, RLS & State Desynchronization Bugs

### [DB-01] HIGH — Deleting a Hospital with Past/Active Bookings Fails Silently with Green Success Toast
* **Files:**
  * `supabase/migrations/001_schema.sql` (line 78: `hospital_id UUID NOT NULL REFERENCES public.hospitals(id)`)
  * `src/controllers/useAdminController.js` (`deleteHospital`, lines 223–227)
* **Problem:**
  1. `bookings.hospital_id` has a strict foreign key constraint (`ON DELETE RESTRICT` by default) referencing `hospitals(id)`. Any hospital that has ever been used in a booking cannot be deleted from `public.hospitals` unless those bookings are deleted first.
  2. In `useAdminHospitalsController.js`:
     ```js
     const deleteHospital = async (id) => {
       await HospitalModel.remove(id);
       setToast({ message: 'Hospital deleted', type: 'success' });
       fetchHospitals();
     };
     ```
     `deleteHospital` **does not check `{ error }` from `HospitalModel.remove(id)`**. When PostgreSQL blocks the delete due to existing bookings, the UI still shows a green `"Hospital deleted"` toast, and the hospital immediately reappears in the list.
* **Recommended Fix:**
  Check `const { error } = await HospitalModel.remove(id);` in `useAdminHospitalsController`. If an error occurs (e.g., FK constraint `23503`), show an error toast explaining that hospitals with existing booking history cannot be deleted and should be set to **Inactive** instead.

---

### [DB-02] MEDIUM — Unchecked Database Errors on Online/Offline & Hospital Active Toggles
* **Files:**
  * `src/controllers/useDriverController.js` (`toggleOnline`, lines 166–179)
  * `src/controllers/useAdminController.js` (`toggleOnline` lines 142–146, `toggleActive` lines 214–221)
* **Problem:**
  In `useDriverDashboardController.toggleOnline`:
  ```js
  const newStatus = !isOnline;
  setOnlineOverride(newStatus);
  await DriverModel.setOnlineStatus(driverData.id, newStatus);
  setToast({ message: newStatus ? 'You are now ONLINE' : 'You are now OFFLINE', ... });
  ```
  If `DriverModel.setOnlineStatus` returns an `{ error }` (e.g., network loss or expired JWT), the UI state `onlineOverride` remains `true` and displays `"You are now ONLINE"`, while the database still has `is_online = false`.
* **Recommended Fix:**
  Check `{ error }` from `DriverModel.setOnlineStatus` / `HospitalModel.toggleActive`. On error, revert `setOnlineOverride(!newStatus)` and show an error toast.

---

### [DB-03] MEDIUM — Admin Bookings "Active Dispatch" Filter Only Shows `status = 'accepted'`
* **Files:**
  * `src/controllers/useAdminController.js` (line 101)
  * `src/models/BookingModel.js` (`getAdminList`, lines 290–310)
* **Problem:**
  In `useAdminBookingsController`, the filter button labeled **"Active Dispatch"** passes `filter = 'accepted'`. `BookingModel.getAdminList` executes `query.eq('status', 'accepted')`, which **excludes** active ambulances in `en_route_pickup`, `arrived_pickup`, and `en_route_hospital` states.
* **Recommended Fix:**
  In `BookingModel.getAdminList`, when `filter === 'accepted'` (or `'active'`), use `query.in('status', ACTIVE_BOOKING_STATUSES)` (or `DRIVER_ASSIGNED_ACTIVE_STATUSES`) so all in-progress dispatches are shown.

---

### [DB-04] MEDIUM — Admin Dashboard Counts Queries Not Atomic / Can Drift During High Traffic
* **Files:**
  * `src/models/BookingModel.js` (`getAdminDashboardSummary`, lines 316–354)
* **Problem:**
  `getAdminDashboardSummary` fires 7 separate HTTP `HEAD` / `SELECT` requests in `Promise.all`. Under heavy load or transient connection limits, if any one of the 7 requests fails, `res.count` evaluates to `undefined` and silently resets that metric card to `0` without surfacing an error.

---

## 3. Realtime Channel & UI Remount Bugs

### [RT-01] HIGH — Full-Screen Loading Spinner Unmounts `<TrackingMap />` on Every Realtime Booking Update
* **Files:**
  * `src/controllers/useUserController.js` (`useBookingController`, lines 18–50)
  * `src/views/user/TrackBookingView.js` (lines 28–34)
* **Timeline of the Bug:**
  1. Patient is viewing `/user/track/[bookingId]` with the live Google Map rendered.
  2. Driver advances the trip status (e.g., from `accepted` → `en_route_pickup`).
  3. The Realtime subscription in `useBookingController` receives the `UPDATE` event and calls `fetchBooking()` to refresh joined relations.
  4. `fetchBooking()` sets `setLoading(true)` before awaiting `BookingModel.getById(bookingId)`.
  5. Because `TrackBookingView` renders `<LoadingSpinner />` whenever `loading === true`, **the entire page and `<TrackingMap />` unmount and remount on every status transition**, destroying the Google Map instance, flashing a black loading screen, and re-billing a new Google Maps JS + Directions API load.
* **Recommended Fix:**
  Only set `loading = true` on the initial load (when `booking === null`), or pass `{ silent: true }` to `fetchBooking({ silent: true })` during background Realtime refreshes so the existing view and map stay mounted.

---

### [RT-02] MEDIUM — `DriverModel.startLocationBroadcast` Sends Broadcasts Before Channel Is Subscribed
* **Files:**
  * `src/models/DriverModel.js` (`startLocationBroadcast`, lines 104–129)
* **Problem:**
  ```js
  const channel = supabase.channel(`booking:${bookingId}`);
  channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return;
  });
  const watchId = navigator.geolocation.watchPosition((position) => {
    channel.send({ type: 'broadcast', event: 'location_update', payload: locationData });
    ...
  });
  ```
  `watchPosition` fires immediately (often within 50ms from cached GPS), before the WebSocket `channel.subscribe()` handshake reaches `'SUBSCRIBED'`. Calling `channel.send()` before `'SUBSCRIBED'` either drops the initial GPS packet or falls back to deprecated REST broadcast warnings.
* **Recommended Fix:**
  Track `let isSubscribed = false;` inside the `channel.subscribe((status) => { isSubscribed = status === 'SUBSCRIBED'; })` callback, and only call `channel.send(...)` when `isSubscribed` is `true`.

---

### [RT-03] MEDIUM — Channel Topic Collision When Testing Driver & Patient in the Same Browser Session
* **Files:**
  * `src/models/DriverModel.js` (`startLocationBroadcast` line 106, `subscribeToLocationUpdates` line 161)
* **Problem:**
  Both functions use the topic `booking:${bookingId}` on the shared browser client. If a developer or user navigates between `/driver` and `/user/track/[bookingId]` within the same SPA session, `subscribeToLocationUpdates` removes any existing `booking:${bookingId}` channel (`supabase.removeChannel(existing)`), which can tear down an active broadcast channel.

---

## 4. Authentication & Middleware Edge Cases

### [AUTH-01] MEDIUM — Registration Crash / RLS Failure When Supabase Email Confirmation Is Enabled
* **Files:**
  * `src/controllers/useAuthController.js` (`handleRegister`, lines 186–224)
* **Problem:**
  When `AuthModel.signUp(...)` succeeds in a Supabase project where **Confirm Email** is enabled:
  * `data.session` is `null` (the user is not yet authenticated).
  * `AuthModel.createSession(data.user.id)` attempts `UPDATE profiles SET session_token = ... WHERE id = user.id`, which **fails RLS** because `auth.uid()` is `null`.
  * `DriverModel.upsertByProfileId(...)` also **fails RLS** because `auth.uid()` is `null`.
  * Finally, `router.push('/driver')` or `router.push('/user')` is immediately intercepted by `middleware.js` (which sees `!user`) and redirected to `/auth/login` without telling the user to check their email inbox.
* **Recommended Fix:**
  After `AuthModel.signUp`, check if `data.session` is `null`. If `!data.session`, display a confirmation message (`"Account created! Please check your email to verify your account before signing in."`) instead of calling authenticated profile/driver updates and redirecting to protected routes.

---

### [AUTH-02] MEDIUM — Middleware Silently Redirects Drivers/Admins to `/user` on Transient Profile Query Failure
* **Files:**
  * `src/lib/supabase/middleware.js` (lines 56–75)
* **Problem:**
  ```js
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'user';
  ```
  If the `profiles` lookup fails transiently or if a newly registered user's `on_auth_user_created` trigger has not yet committed, `profile` is `null`, `role` defaults to `'user'`, and a Driver or Admin requesting `/driver` or `/admin` is redirected to `/user` (the Patient Portal).

---

## Priority Action Plan

1. **Immediate (P0 — Concurrency & Data Integrity):**
   * Fix **[RC-01]** (`acceptByDriver` pre-update `is_busy` race).
   * Fix **[RC-02]** & **[RC-03]** (Prevent cancelled bookings from being updated by drivers, check `{ error }` on patient cancel, and subscribe `DriverDashboardController` to `activeTrip` changes).
   * Fix **[RT-01]** (Prevent `fetchBooking` from setting `loading = true` on Realtime updates so `<TrackingMap />` never unmounts mid-trip).
2. **High Priority (P1 — Resource Leaks & UX Correctness):**
   * Fix **[RC-04]** (Introduce a shared `SessionContext` so `<Navbar />` and page controllers share a single `useSessionController` instance and Realtime channel).
   * Fix **[RC-05]** (Deduplicate GPS watchers and throttle `location_logs` inserts).
   * Fix **[DB-01]**, **[DB-02]**, and **[DB-03]** (Handle hospital delete FK errors, check toggle errors, and include all active statuses in the Admin filter).
3. **Medium Priority (P2 — Hardening):**
   * Fix **[RC-06]**, **[RT-02]**, **[AUTH-01]**, and **[AUTH-02]**.

