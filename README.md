# E-Ambulance | Raiganj Emergency Dispatch System

A 24/7 emergency ambulance booking, dispatch, and real-time GPS telemetry tracking platform for Raiganj, West Bengal, built with **Next.js 16 (App Router)**, **React 19**, **Supabase (Auth, PostgreSQL, Realtime)**, **Tailwind CSS v4**, and **Google Maps**.

---

## MVC Architecture Overview

The codebase is structured using the **Model–View–Controller (MVC)** pattern for clear separation of concerns, testability, and readability:

```text
src/
├── models/                        # MODEL LAYER: Data access, Supabase queries, realtime channels & domain rules
│   ├── AuthModel.js               # Supabase Auth & single-device session token operations
│   ├── ProfileModel.js            # User profile queries (profiles table)
│   ├── BookingModel.js            # Booking CRUD, atomic accept, status transitions & realtime subscriptions
│   ├── DriverModel.js             # Driver fleet CRUD, online/busy state, GPS coordinates & location_logs
│   ├── HospitalModel.js           # Hospital CRUD, active list & Haversine distance calculation
│   └── index.js                   # Barrel export for all models
│
├── controllers/                   # CONTROLLER LAYER: Application state, business logic & event handlers
│   ├── useAuthController.js       # Session, Login, Registration & Password Reset controllers
│   ├── useUserController.js       # Patient Dashboard, 3-Step Booking Wizard & Live Tracking controllers
│   ├── useDriverController.js     # Driver Console (online toggle, accept, status flow, GPS) & History controllers
│   ├── useAdminController.js      # Admin Dashboard, Bookings feed, Drivers & Hospitals CRUD controllers
│   └── index.js                   # Barrel export for all controllers
│
├── views/                         # VIEW LAYER: Pure presentation components (zero direct DB queries)
│   ├── landing/
│   │   └── LandingView.js         # Public landing page composition
│   ├── auth/
│   │   ├── LoginView.js           # Sign-in form & portal switcher UI
│   │   ├── RegisterView.js        # Registration form with role & vehicle fields UI
│   │   └── ResetPasswordView.js   # Password recovery UI
│   ├── user/
│   │   ├── UserDashboardView.js   # Patient portal dashboard UI
│   │   ├── BookAmbulanceView.js   # 3-step ambulance booking wizard UI
│   │   └── TrackBookingView.js    # Live map tracking, step indicator & cancel modal UI
│   ├── driver/
│   │   ├── DriverDashboardView.js # Driver console, active dispatch & pending feed UI
│   │   └── DriverHistoryView.js   # Driver past trips & stats UI
│   ├── admin/
│   │   ├── AdminDashboardView.js  # Admin overview metrics & recent calls table UI
│   │   ├── AdminBookingsView.js   # Filterable live bookings table UI
│   │   ├── AdminDriversView.js    # Driver fleet management UI
│   │   └── AdminHospitalsView.js  # Hospital network CRUD & modal UI
│   └── index.js                   # Barrel export for all views
│
├── components/                    # SHARED VIEW PARTIALS: Reusable UI widgets, layout, map & landing sections
│   ├── landing/                   # Landing page sections (Hero, Fleet, Hospitals, HowItWorks, etc.)
│   ├── layout/                    # Navbar with role-based navigation & SOS 108 button
│   ├── map/                       # TrackingMap (Google Maps + DirectionsRenderer)
│   └── ui/                        # LoadingSpinner, Modal, StatusBadge, Toast
│
├── app/                           # NEXT.JS APP ROUTER: Thin route entry points binding Controllers to Views
│   ├── page.js                    # /
│   ├── auth/login/page.js         # /auth/login
│   ├── auth/register/page.js      # /auth/register
│   ├── auth/reset-password/page.js# /auth/reset-password
│   ├── user/page.js               # /user
│   ├── user/book/page.js          # /user/book
│   ├── user/track/[bookingId]/page.js # /user/track/:bookingId
│   ├── driver/page.js             # /driver
│   ├── driver/history/page.js     # /driver/history
│   ├── admin/page.js              # /admin
│   ├── admin/bookings/page.js     # /admin/bookings
│   ├── admin/drivers/page.js      # /admin/drivers
│   └── admin/hospitals/page.js    # /admin/hospitals
│
├── hooks/                         # Re-exports delegating to Controllers & geolocation hooks
└── lib/                           # Supabase client/server/middleware config & app constants
```

---

## Core Portals & Workflows

1. **Patient Portal (`/user`)**
   - **3-Step Booking Wizard (`/user/book`)**: Auto-detects GPS coordinates (with Raiganj city center fallback), calculates Haversine distance to active hospitals, and dispatches a pending request.
   - **Live Telemetry Tracking (`/user/track/[bookingId]`)**: Subscribes to real-time booking status updates and live ambulance GPS coordinates (`booking:<id>` broadcast channel) with Google Maps route rendering.
2. **Driver Console (`/driver`)**
   - **Online/Offline Toggle & GPS Telemetry**: Broadcasts live coordinates every 5 seconds while on an active trip and logs route history in `location_logs`.
   - **Atomic Dispatch Acceptance**: Prevents race conditions when multiple drivers accept the same pending request.
   - **Trip Progression**: Advances trips through `accepted` → `en_route_pickup` → `arrived_pickup` → `en_route_hospital` → `completed`.
3. **Admin Portal (`/admin`)**
   - **System Telemetry**: Live overview of active dispatches, completed runs, online fleet ratio, and hospital count.
   - **Fleet & Hospital Management**: Manage driver online states and perform full CRUD on network hospitals.

---

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
