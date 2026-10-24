import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * DriverModel
 * Handles all data operations for `drivers` and `location_logs`,
 * as well as real-time driver location telemetry broadcasting.
 */
export const DriverModel = {
  /**
   * Fetch driver record by the user's profile ID.
   */
  async getByProfileId(profileId) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle();

    return { data, error };
  },

  /**
   * Upsert a driver profile record upon registration.
   */
  async upsertByProfileId({ profileId, vehicleNumber, vehicleType }) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from('drivers').upsert(
      {
        profile_id: profileId,
        vehicle_number: vehicleNumber || 'PENDING',
        vehicle_type: vehicleType || 'basic',
      },
      { onConflict: 'profile_id' }
    );

    return { data, error };
  },

  /**
   * Fetch all registered drivers with their profile information (for Admin).
   */
  async getAllWithProfiles() {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('drivers')
      .select(`
        *,
        profile:profiles(full_name, email:id, phone, role)
      `)
      .order('created_at', { ascending: false });

    return { data: data || [], error };
  },

  /**
   * Update a driver's online status.
   */
  async setOnlineStatus(driverId, isOnline) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('drivers')
      .update({ is_online: isOnline })
      .eq('id', driverId);

    return { error };
  },

  /**
   * Update a driver's busy flag.
   */
  async setBusyStatus(driverId, isBusy) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('drivers')
      .update({ is_busy: isBusy })
      .eq('id', driverId);

    return { error };
  },

  /**
   * Update a driver's current GPS coordinates.
   */
  async updateCoordinates(driverId, lat, lng, timestamp = new Date().toISOString()) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('drivers')
      .update({
        current_lat: lat,
        current_lng: lng,
        last_location_update: timestamp,
      })
      .eq('id', driverId);

    return { error };
  },

  /**
   * Insert a trip location history record into `location_logs`.
   */
  async insertLocationLog({ bookingId, driverId, latitude, longitude }) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from('location_logs').insert({
      booking_id: bookingId,
      driver_id: driverId,
      latitude,
      longitude,
    });

    return { error };
  },

  /**
   * Start broadcasting driver GPS location to a booking's realtime channel
   * and persisting updates to `drivers` and `location_logs`.
   */
  startLocationBroadcast(bookingId, driverId, intervalMs = 5000) {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`booking:${bookingId}`);

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
    });

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const locationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: new Date().toISOString(),
          driverId,
        };

        // Broadcast via Realtime channel
        channel.send({
          type: 'broadcast',
          event: 'location_update',
          payload: locationData,
        });

        // Update driver's current location in DB
        DriverModel.updateCoordinates(
          driverId,
          locationData.lat,
          locationData.lng,
          locationData.timestamp
        );

        // Log location for trip history
        DriverModel.insertLocationLog({
          bookingId,
          driverId,
          latitude: locationData.lat,
          longitude: locationData.lng,
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: intervalMs,
        timeout: intervalMs,
      }
    );

    return {
      stop: () => {
        navigator.geolocation.clearWatch(watchId);
        supabase.removeChannel(channel);
      },
      channel,
    };
  },

  /**
   * Subscribe to real-time driver location broadcasts for a booking (patient-side).
   */
  subscribeToLocationUpdates(bookingId, onLocationUpdate) {
    const supabase = getSupabaseBrowserClient();
    const topic = `booking:${bookingId}`;

    const existing = supabase
      .getChannels()
      .find((ch) => ch.topic === `realtime:${topic}` || ch.topic === topic);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase
      .channel(topic)
      .on('broadcast', { event: 'location_update' }, (message) => {
        onLocationUpdate(message.payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};

