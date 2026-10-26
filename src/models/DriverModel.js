import { getSupabaseBrowserClient } from '@/lib/supabase/client';

function isValidLatLng(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return (
    Number.isFinite(nLat) &&
    Number.isFinite(nLng) &&
    Math.abs(nLat) <= 90 &&
    Math.abs(nLng) <= 180 &&
    (nLat !== 0 || nLng !== 0)
  );
}

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
   * Fetch driver record by driver ID.
   */
  async getById(driverId) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .maybeSingle();

    return { data, error };
  },

  /**
   * Upsert a driver profile record upon registration or self-healing login.
   */
  async upsertByProfileId({ profileId, vehicleNumber, vehicleType }) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('drivers')
      .upsert(
        {
          profile_id: profileId,
          vehicle_number: vehicleNumber || 'PENDING',
          vehicle_type: vehicleType || 'basic',
        },
        { onConflict: 'profile_id' }
      )
      .select('*')
      .maybeSingle();

    return { data, error };
  },

  /**
   * Fetch driver record by profile ID, auto-creating it if the user has role='driver'
   * and the row is missing.
   */
  async ensureByProfile(authUser) {
    if (!authUser?.id) return { data: null, error: null };

    const { data: existing, error } = await DriverModel.getByProfileId(authUser.id);
    if (existing) {
      return { data: existing, error: null };
    }

    if (error) {
      console.error('Failed to fetch driver record:', error.message);
      return { data: null, error };
    }

    const meta = authUser.user_metadata || {};
    return await DriverModel.upsertByProfileId({
      profileId: authUser.id,
      vehicleNumber: meta.vehicle_number || 'PENDING',
      vehicleType: meta.vehicle_type === 'icu' ? 'icu' : 'basic',
    });
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
    if (!driverId || !isValidLatLng(lat, lng)) return { error: null };
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('drivers')
      .update({
        current_lat: Number(lat),
        current_lng: Number(lng),
        last_location_update: timestamp,
      })
      .eq('id', driverId);

    return { error };
  },

  /**
   * Insert a trip location history record into `location_logs`.
   */
  async insertLocationLog({ bookingId, driverId, latitude, longitude }) {
    if (!bookingId || !driverId || !isValidLatLng(latitude, longitude)) {
      return { error: null };
    }
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from('location_logs').insert({
      booking_id: bookingId,
      driver_id: driverId,
      latitude: Number(latitude),
      longitude: Number(longitude),
    });

    return { error };
  },

  /**
   * Start broadcasting driver GPS location to a booking's realtime channel
   * and persisting throttled updates to `drivers` and `location_logs`.
   */
  startLocationBroadcast(bookingId, driverId, optionsOrInterval = 5000) {
    const intervalMs =
      typeof optionsOrInterval === 'number'
        ? optionsOrInterval
        : optionsOrInterval?.intervalMs || 5000;
    const onLocationChange =
      typeof optionsOrInterval === 'object' ? optionsOrInterval?.onLocationChange : null;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`booking:${bookingId}`, {
      config: {
        broadcast: { self: true },
      },
    });

    let isSubscribed = false;
    let isStopped = false;
    let latestLocation = null;
    let lastDbPersistAt = 0;

    const sendBroadcast = (locationData) => {
      if (!isSubscribed || isStopped || !locationData) return;
      channel.send({
        type: 'broadcast',
        event: 'location_update',
        payload: locationData,
      });
    };

    const persistToDatabase = (locationData, force = false) => {
      if (isStopped || !locationData) return;
      const now = Date.now();
      if (!force && now - lastDbPersistAt < intervalMs) return;
      lastDbPersistAt = now;

      DriverModel.updateCoordinates(
        driverId,
        locationData.lat,
        locationData.lng,
        locationData.timestamp
      );

      DriverModel.insertLocationLog({
        bookingId,
        driverId,
        latitude: locationData.lat,
        longitude: locationData.lng,
      });
    };

    const handlePosition = (position) => {
      if (isStopped || !position?.coords) return;
      const { latitude: lat, longitude: lng } = position.coords;
      if (!isValidLatLng(lat, lng)) return;

      const locationData = {
        lat: Number(lat),
        lng: Number(lng),
        timestamp: new Date().toISOString(),
        driverId,
      };

      const isFirstFix = !latestLocation;
      latestLocation = locationData;

      if (onLocationChange) {
        onLocationChange({ lat: locationData.lat, lng: locationData.lng });
      }

      sendBroadcast(locationData);
      persistToDatabase(locationData, isFirstFix);
    };

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true;
        if (latestLocation) {
          sendBroadcast(latestLocation);
        }
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        isSubscribed = false;
      }
    });

    let watchId = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      // Request an immediate GPS fix so stationary devices don't wait for movement
      navigator.geolocation.getCurrentPosition(
        handlePosition,
        (err) => console.warn('Initial GPS lock warning:', err.message),
        {
          enableHighAccuracy: true,
          maximumAge: intervalMs,
          timeout: 10000,
        }
      );

      watchId = navigator.geolocation.watchPosition(
        handlePosition,
        (error) => {
          console.warn('Geolocation watch warning:', error.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: intervalMs,
          timeout: 10000,
        }
      );
    }

    // Periodic heartbeat ensures patients opening/refreshing the tracking page
    // always receive live coordinates even when the ambulance is stationary.
    const heartbeatTimer = setInterval(() => {
      if (isStopped || !latestLocation) return;
      const refreshedLocation = {
        ...latestLocation,
        timestamp: new Date().toISOString(),
      };
      sendBroadcast(refreshedLocation);
      persistToDatabase(refreshedLocation, false);
    }, intervalMs);

    return {
      stop: () => {
        isStopped = true;
        isSubscribed = false;
        if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchId);
        }
        clearInterval(heartbeatTimer);
        supabase.removeChannel(channel);
      },
      channel,
    };
  },

  /**
   * Subscribe to real-time driver location updates for a booking (patient-side).
   * Combines low-latency WebSocket broadcast with Postgres Realtime fallback
   * (`public.drivers` and `public.location_logs`) for 100% reliability.
   */
  subscribeToLocationUpdates(bookingId, onLocationUpdate, driverId = null) {
    if (!bookingId) return () => {};
    const supabase = getSupabaseBrowserClient();

    const emitValidLocation = (lat, lng, timestamp = new Date().toISOString()) => {
      if (!isValidLatLng(lat, lng)) return;
      onLocationUpdate({
        lat: Number(lat),
        lng: Number(lng),
        timestamp,
      });
    };

    // 1. Low-latency Broadcast channel subscription
    const broadcastTopic = `booking:${bookingId}`;
    const broadcastChannel = supabase
      .channel(broadcastTopic, {
        config: {
          broadcast: { self: true },
        },
      })
      .on('broadcast', { event: 'location_update' }, (message) => {
        const payload = message?.payload;
        if (payload) {
          emitValidLocation(payload.lat, payload.lng, payload.timestamp);
        }
      })
      .subscribe();

    // 2. Postgres Realtime subscription on `location_logs` and `drivers`
    let dbChannel = supabase
      .channel(`booking-gps-db:${bookingId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_logs',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          const row = payload?.new;
          if (row) {
            emitValidLocation(row.latitude, row.longitude, row.recorded_at);
          }
        }
      );

    if (driverId) {
      dbChannel = dbChannel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'drivers',
          filter: `id=eq.${driverId}`,
        },
        (payload) => {
          const row = payload?.new;
          if (row) {
            emitValidLocation(
              row.current_lat,
              row.current_lng,
              row.last_location_update
            );
          }
        }
      );
    }

    dbChannel.subscribe();

    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(dbChannel);
    };
  },
};
