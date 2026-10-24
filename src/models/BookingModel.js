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
        hospital:hospitals(name, address),
        driver:drivers(vehicle_number, profile:profiles(full_name, phone))
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
      .select('id')
      .eq('user_id', userId)
      .in('status', ACTIVE_BOOKING_STATUSES);

    return {
      hasActive: Boolean(data && data.length > 0),
      activeBookings: data || [],
      error,
    };
  },

  /**
   * Create a new pending emergency booking.
   */
  async create({ userId, hospitalId, pickupLat, pickupLng, pickupAddress }) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        user_id: userId,
        hospital_id: hospitalId,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        pickup_address: pickupAddress || '',
        status: BOOKING_STATUS.PENDING,
      })
      .select()
      .single();

    return { data, error };
  },

  /**
   * Cancel a booking and release the assigned driver if any.
   */
  async cancel(bookingId, driverId = null, reason = 'Cancelled by user') {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('bookings')
      .update({
        status: BOOKING_STATUS.CANCELLED,
        cancel_reason: reason,
      })
      .eq('id', bookingId);

    if (driverId) {
      await DriverModel.setBusyStatus(driverId, false);
    }

    return { error };
  },

  /**
   * Fetch all pending bookings (for online drivers).
   */
  async getPending() {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        hospital:hospitals(name, address, latitude, longitude),
        user:profiles!bookings_user_id_fkey(full_name, phone)
      `)
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
      .select(`
        *,
        hospital:hospitals(name, address),
        user:profiles!bookings_user_id_fkey(full_name, phone)
      `)
      .eq('driver_id', driverId)
      .in('status', DRIVER_ASSIGNED_ACTIVE_STATUSES)
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
      .select(`
        *,
        hospital:hospitals(name, address),
        user:profiles!bookings_user_id_fkey(full_name, phone)
      `)
      .eq('driver_id', driverId)
      .in('status', [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED])
      .order('created_at', { ascending: false });

    return { data: data || [], error };
  },

  /**
   * Atomically accept a pending booking for a driver.
   */
  async acceptByDriver(bookingId, driverId) {
    const supabase = getSupabaseBrowserClient();

    // 1. Check current status of the booking
    const { data: currentBooking, error: checkError } = await supabase
      .from('bookings')
      .select('id, status, driver_id')
      .eq('id', bookingId)
      .maybeSingle();

    if (checkError) {
      return { error: checkError.message };
    }

    if (!currentBooking) {
      return { error: 'Booking no longer exists' };
    }

    if (currentBooking.status !== BOOKING_STATUS.PENDING) {
      if (currentBooking.driver_id === driverId) {
        await DriverModel.setBusyStatus(driverId, true);
        return { data: currentBooking };
      }
      return { error: 'Booking already taken by another driver' };
    }

    // 2. Mark driver as busy
    await DriverModel.setBusyStatus(driverId, true);

    // 3. Update the booking (atomic check status = 'pending')
    const { data, error } = await supabase
      .from('bookings')
      .update({
        driver_id: driverId,
        status: BOOKING_STATUS.ACCEPTED,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .eq('status', BOOKING_STATUS.PENDING)
      .select(`
        *,
        hospital:hospitals(name, address),
        user:profiles!bookings_user_id_fkey(full_name, phone)
      `)
      .maybeSingle();

    if (error) {
      await DriverModel.setBusyStatus(driverId, false);
      return { error: error.message };
    }

    if (!data) {
      const { data: verifyBooking } = await supabase
        .from('bookings')
        .select(`
          *,
          hospital:hospitals(name, address),
          user:profiles!bookings_user_id_fkey(full_name, phone)
        `)
        .eq('id', bookingId)
        .maybeSingle();

      if (verifyBooking && verifyBooking.driver_id === driverId) {
        return { data: verifyBooking };
      }

      await DriverModel.setBusyStatus(driverId, false);
      return { error: 'Booking already taken by another driver' };
    }

    return { data };
  },

  /**
   * Fetch a booking with hospital and patient details for the driver console.
   */
  async getDriverTripDetails(bookingId) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        hospital:hospitals(name, address),
        user:profiles!bookings_user_id_fkey(full_name, phone)
      `)
      .eq('id', bookingId)
      .maybeSingle();

    return { data, error };
  },

  /**
   * Update a booking's status (and release driver if completed/cancelled).
   */
  async updateStatus(bookingId, newStatus, driverId = null) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', bookingId);

    if (
      !error &&
      driverId &&
      (newStatus === BOOKING_STATUS.COMPLETED || newStatus === BOOKING_STATUS.CANCELLED)
    ) {
      await DriverModel.setBusyStatus(driverId, false);
    }

    return { error };
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

    if (filter !== 'all') {
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

