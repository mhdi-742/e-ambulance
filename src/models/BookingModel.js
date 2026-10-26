import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { BOOKING_STATUS } from '@/lib/constants';
import { DriverModel } from './DriverModel';

export const ACTIVE_BOOKING_STATUSES = [
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.ACCEPTED,
  BOOKING_STATUS.EN_ROUTE_PICKUP,
  BOOKING_STATUS.ARRIVED_PICKUP,
  BOOKING_STATUS.EN_ROUTE_HOSPITAL,
];

export const DRIVER_ASSIGNED_ACTIVE_STATUSES = [
  BOOKING_STATUS.ACCEPTED,
  BOOKING_STATUS.EN_ROUTE_PICKUP,
  BOOKING_STATUS.ARRIVED_PICKUP,
  BOOKING_STATUS.EN_ROUTE_HOSPITAL,
];

export const TRIP_STATUS_FLOW = [
  { key: BOOKING_STATUS.PENDING, label: 'Finding Ambulance' },
  { key: BOOKING_STATUS.ACCEPTED, label: 'Driver Assigned' },
  { key: BOOKING_STATUS.EN_ROUTE_PICKUP, label: 'Ambulance On the Way' },
  { key: BOOKING_STATUS.ARRIVED_PICKUP, label: 'Ambulance Arrived at Pickup' },
  { key: BOOKING_STATUS.EN_ROUTE_HOSPITAL, label: 'Heading to Hospital' },
  { key: BOOKING_STATUS.COMPLETED, label: 'Trip Complete' },
];

const DRIVER_TRIP_SELECT = `
  *,
  hospital:hospitals(id, name, address, latitude, longitude),
  user:profiles!bookings_user_id_fkey(full_name, phone)
`;

/**
 * BookingModel
 * Handles all database queries, real-time subscriptions, and domain rules for `bookings`.
 */
export const BookingModel = {
  /**
   * Fetch a single booking by ID with joined hospital, driver, and driver profile.
   */
  async getById(bookingId) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        hospital:hospitals(*),
        driver:drivers(*, profile:profiles(*))
      `)
      .eq('id', bookingId)
      .single();

    return { data, error };
  },

  /**
   * Fetch all bookings for a specific patient user.
   */
  async getByUserId(userId) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        hospital:hospitals(id, name, address, latitude, longitude),
        driver:drivers(id, vehicle_number, vehicle_type, profile:profiles(full_name, phone))
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return { data: data || [], error };
  },

  /**
   * Check if a user currently has any active booking.
   */
  async hasActiveBooking(userId) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('user_id', userId)
      .in('status', ACTIVE_BOOKING_STATUSES)
      .order('created_at', { ascending: false });

    return {
      hasActive: Boolean(data && data.length > 0),
      activeBookings: data || [],
      error,
    };
  },

  /**
   * Create a new pending emergency booking with validation and duplicate protection.
   */
  async create({ userId, hospitalId, pickupLat, pickupLng, pickupAddress }) {
    if (!userId) {
      return { data: null, error: { message: 'You must be signed in to book an ambulance.' } };
    }
    if (!hospitalId) {
      return { data: null, error: { message: 'Please select a destination hospital.' } };
    }

    const lat = Number(pickupLat);
    const lng = Number(pickupLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      return {
        data: null,
        error: { message: 'Valid GPS pickup coordinates are required.' },
      };
    }

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        user_id: userId,
        hospital_id: hospitalId,
        pickup_lat: lat,
        pickup_lng: lng,
        pickup_address: (pickupAddress || '').trim() || 'Location detected via GPS',
        status: BOOKING_STATUS.PENDING,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          data: null,
          error: {
            ...error,
            message: 'You already have an active ambulance booking in progress.',
          },
        };
      }
      return { data: null, error };
    }

    return { data, error: null };
  },

  /**
   * Cancel a booking (only when pending or accepted) and release the assigned driver if any.
   */
  async cancel(bookingId, driverId = null, reason = 'Cancelled by user') {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('bookings')
      .update({
        status: BOOKING_STATUS.CANCELLED,
        cancel_reason: reason,
      })
      .eq('id', bookingId)
      .in('status', [BOOKING_STATUS.PENDING, BOOKING_STATUS.ACCEPTED])
      .select('id, status, driver_id')
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }

    if (!data) {
      return {
        data: null,
        error: {
          message:
            'This booking can no longer be cancelled because the ambulance is already en route or the trip has ended.',
        },
      };
    }

    const targetDriverId = driverId || data.driver_id;
    if (targetDriverId) {
      await DriverModel.setBusyStatus(targetDriverId, false);
    }

    return { data, error: null };
  },

  /**
   * Fetch all pending bookings (for online drivers).
   */
  async getPending() {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('bookings')
      .select(DRIVER_TRIP_SELECT)
      .eq('status', BOOKING_STATUS.PENDING)
      .order('created_at', { ascending: true });

    return { data: data || [], error };
  },

  /**
   * Fetch the currently active trip assigned to a driver.
   */
  async getActiveTripForDriver(driverId) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('bookings')
      .select(DRIVER_TRIP_SELECT)
      .eq('driver_id', driverId)
      .in('status', DRIVER_ASSIGNED_ACTIVE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return { data, error };
  },

  /**
   * Fetch completed and cancelled trip history for a driver.
   */
  async getHistoryForDriver(driverId) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('bookings')
      .select(DRIVER_TRIP_SELECT)
      .eq('driver_id', driverId)
      .in('status', [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED])
      .order('created_at', { ascending: false });

    return { data: data || [], error };
  },

  /**
   * Atomically accept a pending booking for a driver without pre-update race conditions.
   */
  async acceptByDriver(bookingId, driverId) {
    if (!bookingId || !driverId) {
      return { error: 'Invalid booking or driver identifier.' };
    }

    const supabase = getSupabaseBrowserClient();

    // 1. Check if this driver already has an active trip assigned
    const { data: existingActiveTrip } = await BookingModel.getActiveTripForDriver(driverId);
    if (existingActiveTrip) {
      if (existingActiveTrip.id === bookingId) {
        await DriverModel.setBusyStatus(driverId, true);
        return { data: existingActiveTrip };
      }
      return {
        error:
          'You already have an active dispatch assignment. Please complete it before accepting another request.',
      };
    }

    // 2. Check current status of the target booking
    const { data: currentBooking, error: checkError } = await supabase
      .from('bookings')
      .select('id, status, driver_id')
      .eq('id', bookingId)
      .maybeSingle();

    if (checkError) {
      return { error: checkError.message };
    }

    if (!currentBooking) {
      return { error: 'Booking no longer exists.' };
    }

    if (currentBooking.status !== BOOKING_STATUS.PENDING) {
      if (currentBooking.driver_id === driverId) {
        await DriverModel.setBusyStatus(driverId, true);
        const { data: fullTrip } = await BookingModel.getDriverTripDetails(bookingId);
        return { data: fullTrip || currentBooking };
      }
      if (currentBooking.status === BOOKING_STATUS.CANCELLED) {
        return { error: 'This request was cancelled by the patient.' };
      }
      return { error: 'Booking already accepted by another driver.' };
    }

    // 3. Perform atomic conditional update FIRST (where status = 'pending')
    const { data, error } = await supabase
      .from('bookings')
      .update({
        driver_id: driverId,
        status: BOOKING_STATUS.ACCEPTED,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .eq('status', BOOKING_STATUS.PENDING)
      .select(DRIVER_TRIP_SELECT)
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return { error: 'You already have an active trip in progress.' };
      }
      return { error: error.message };
    }

    if (!data) {
      // Verify whether this driver won or another driver/cancellation occurred concurrently
      const { data: verifyBooking } = await BookingModel.getDriverTripDetails(bookingId);
      if (verifyBooking && verifyBooking.driver_id === driverId) {
        await DriverModel.setBusyStatus(driverId, true);
        return { data: verifyBooking };
      }
      return { error: 'Booking already taken by another driver or cancelled.' };
    }

    // 4. Mark driver as busy AFTER winning the atomic booking update
    await DriverModel.setBusyStatus(driverId, true);

    return { data };
  },

  /**
   * Fetch a booking with hospital and patient details for the driver console.
   */
  async getDriverTripDetails(bookingId) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('bookings')
      .select(DRIVER_TRIP_SELECT)
      .eq('id', bookingId)
      .maybeSingle();

    return { data, error };
  },

  /**
   * Update a booking's status safely (forbidding transitions out of completed/cancelled)
   * and release the driver when completed or cancelled.
   */
  async updateStatus(bookingId, newStatus, driverId = null) {
    const supabase = getSupabaseBrowserClient();

    const updatePayload = { status: newStatus };
    if (newStatus === BOOKING_STATUS.COMPLETED) {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', bookingId)
      .neq('status', BOOKING_STATUS.CANCELLED)
      .neq('status', BOOKING_STATUS.COMPLETED)
      .select('id, status, driver_id')
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }

    if (!data) {
      return {
        data: null,
        error: {
          message: 'This trip was already cancelled by the patient or completed.',
        },
      };
    }

    const targetDriverId = driverId || data.driver_id;
    if (
      targetDriverId &&
      (newStatus === BOOKING_STATUS.COMPLETED || newStatus === BOOKING_STATUS.CANCELLED)
    ) {
      await DriverModel.setBusyStatus(targetDriverId, false);
    }

    return { data, error: null };
  },

  /**
   * Fetch bookings for the Admin portal with optional status filter.
   */
  async getAdminList({ filter = 'all', limit = 50 } = {}) {
    const supabase = getSupabaseBrowserClient();
    let query = supabase
      .from('bookings')
      .select(`
        *,
        hospital:hospitals(name),
        driver:drivers(vehicle_number, profile:profiles(full_name)),
        user:profiles!bookings_user_id_fkey(full_name, phone)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (filter === 'accepted' || filter === 'active') {
      query = query.in('status', DRIVER_ASSIGNED_ACTIVE_STATUSES);
    } else if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    return { data: data || [], error };
  },

  /**
   * Fetch aggregate system metrics and recent bookings for the Admin Dashboard.
   */
  async getAdminDashboardSummary() {
    const supabase = getSupabaseBrowserClient();

    const [
      bookingsRes,
      driversRes,
      hospitalsRes,
      onlineRes,
      activeRes,
      completedRes,
      recentRes,
    ] = await Promise.all([
      supabase.from('bookings').select('id', { count: 'exact', head: true }),
      supabase.from('drivers').select('id', { count: 'exact', head: true }),
      supabase.from('hospitals').select('id', { count: 'exact', head: true }),
      supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('is_online', true),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .in('status', ACTIVE_BOOKING_STATUSES),
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', BOOKING_STATUS.COMPLETED),
      supabase
        .from('bookings')
        .select(
          `*, hospital:hospitals(name), driver:drivers(vehicle_number, profile:profiles(full_name)), user:profiles!bookings_user_id_fkey(full_name)`
        )
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    return {
      stats: {
        totalBookings: bookingsRes.count || 0,
        activeBookings: activeRes.count || 0,
        completedBookings: completedRes.count || 0,
        onlineDrivers: onlineRes.count || 0,
        totalDrivers: driversRes.count || 0,
        totalHospitals: hospitalsRes.count || 0,
      },
      recentBookings: recentRes.data || [],
    };
  },

  /**
   * Subscribe to real-time updates for a single booking row.
   */
  subscribeToBookingById(bookingId, onUpdate) {
    if (!bookingId) return () => {};
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`booking-updates:${bookingId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`,
        },
        (payload) => {
          onUpdate(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Subscribe to real-time changes for a specific patient user's bookings.
   */
  subscribeToUserBookings(userId, onChange) {
    if (!userId) return () => {};
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`user-bookings:${userId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          onChange();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Subscribe to real-time changes across the entire bookings table.
   */
  subscribeToAllBookings(channelName, onChange) {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        () => {
          onChange();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Domain helper: Determine the next status action for a driver's active trip.
   */
  getNextDriverAction(status) {
    switch (status) {
      case BOOKING_STATUS.ACCEPTED:
        return { label: 'Start Route to Pickup', status: BOOKING_STATUS.EN_ROUTE_PICKUP };
      case BOOKING_STATUS.EN_ROUTE_PICKUP:
        return { label: 'Mark Arrived at Pickup', status: BOOKING_STATUS.ARRIVED_PICKUP };
      case BOOKING_STATUS.ARRIVED_PICKUP:
        return { label: 'Start Route to Hospital', status: BOOKING_STATUS.EN_ROUTE_HOSPITAL };
      case BOOKING_STATUS.EN_ROUTE_HOSPITAL:
        return { label: 'Complete Trip', status: BOOKING_STATUS.COMPLETED };
      default:
        return null;
    }
  },

  /**
   * Domain helper: Check if a booking status represents an active trip.
   */
  isActiveStatus(status) {
    return ![BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED].includes(status);
  },

  /**
   * Domain helper: Check if a booking can still be cancelled by the patient.
   */
  canPatientCancel(status) {
    return [BOOKING_STATUS.PENDING, BOOKING_STATUS.ACCEPTED].includes(status);
  },
};
