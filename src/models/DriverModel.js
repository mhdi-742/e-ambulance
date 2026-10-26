import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { CITY_CENTER, BOOKING_STATUS } from '@/lib/constants';

export function isValidLatLng(lat, lng) {
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
 * Calculate Haversine distance in meters between two { lat, lng } points.
 */
export function getDistanceMeters(a, b) {
  if (!a || !b || !isValidLatLng(a.lat, a.lng) || !isValidLatLng(b.lat, b.lng)) {
    return Infinity;
  }
  const R = 6371000;
  const dLat = ((Number(b.lat) - Number(a.lat)) * Math.PI) / 180;
  const dLng = ((Number(b.lng) - Number(a.lng)) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const calc =
    sinLat * sinLat +
    Math.cos((Number(a.lat) * Math.PI) / 180) *
      Math.cos((Number(b.lat) * Math.PI) / 180) *
      sinLng *
      sinLng;
  return 2 * R * Math.atan2(Math.sqrt(calc), Math.sqrt(1 - calc));
}

/**
 * Fetch road route coordinates and metrics using OSRM public driving router.
 * Falls back to a smooth interpolated path if offline.
 */
export async function fetchRoadRoute(origin, destination) {
  if (!origin || !destination || !isValidLatLng(origin.lat, origin.lng) || !isValidLatLng(destination.lat, destination.lng)) {
    return null;
  }

  const startLat = Number(origin.lat);
  const startLng = Number(origin.lng);
  const endLat = Number(destination.lat);
  const endLng = Number(destination.lng);

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      const route = json?.routes?.[0];
      if (route?.geometry?.coordinates?.length > 1) {
        const path = route.geometry.coordinates.map(([lng, lat]) => ({
          lat: Number(lat),
          lng: Number(lng),
        }));
        const distKm = (route.distance / 1000).toFixed(1);
        const durMin = Math.max(1, Math.round(route.duration / 60));
        return {
          path,
          distanceMeters: route.distance,
          durationSeconds: route.duration,
          distanceText: `${distKm} km`,
          durationText: `${durMin} min${durMin > 1 ? 's' : ''}`,
        };
      }
    }
  } catch {
    // Fall back to interpolated path below
  }

  // Fallback interpolated path (25 steps)
  const steps = 25;
  const path = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    path.push({
      lat: startLat + (endLat - startLat) * t,
      lng: startLng + (endLng - startLng) * t,
    });
  }
  const distMeters = getDistanceMeters(origin, destination);
  const distKm = (distMeters / 1000).toFixed(1);
  const durMin = Math.max(1, Math.round(distMeters / 500)); // ~30 km/h city speed

  return {
    path,
    distanceMeters: distMeters,
    durationSeconds: durMin * 60,
    distanceText: `${distKm} km`,
    durationText: `${durMin} min${durMin > 1 ? 's' : ''}`,
  };
}

/**
 * Compute a realistic initial ambulance coordinate near the pickup point
 * when desktop GPS is unavailable (0, 0), identical to pickup (same-device testing),
 * or > 50 km away from the patient's city.
 */
export function resolveInitialDriverCoordinate(rawDriverLoc, pickupLoc) {
  const baseRef =
    pickupLoc && isValidLatLng(pickupLoc.lat, pickupLoc.lng)
      ? { lat: Number(pickupLoc.lat), lng: Number(pickupLoc.lng) }
      : CITY_CENTER;

  if (rawDriverLoc && isValidLatLng(rawDriverLoc.lat, rawDriverLoc.lng)) {
    const distFromPickup = getDistanceMeters(rawDriverLoc, baseRef);
    // Use raw GPS if it is between 80 meters and 50 km from pickup
    if (distFromPickup >= 80 && distFromPickup <= 50000) {
      return {
        lat: Number(rawDriverLoc.lat),
        lng: Number(rawDriverLoc.lng),
      };
    }
  }

  // Offset ~1.1 km southwest of pickup so Driver, Pickup, and Hospital are all clearly distinct
  return {
    lat: Number((baseRef.lat - 0.0075).toFixed(6)),
    lng: Number((baseRef.lng - 0.0085).toFixed(6)),
  };
}

/**
 * DriverModel
 * Handles all data operations for `drivers` and `location_logs`,
 * as well as real-time driver location telemetry broadcasting and road simulation.
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
    if (!driverId) return { data: null, error: null };
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .maybeSingle();

    return { data, error };
  },

  /**
   * Fetch all currently online drivers (used for radar / map preview).
   */
  async getOnlineDrivers() {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('drivers')
      .select('id, vehicle_number, vehicle_type, is_online, is_busy, current_lat, current_lng, last_location_update')
      .eq('is_online', true);

    return { data: data || [], error };
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
   * and persisting updates to `drivers` and `location_logs`.
   * Includes road-following simulation fallback when testing on a stationary computer.
   */
  startLocationBroadcast(bookingId, driverId, optionsOrInterval = 3000) {
    const intervalMs =
      typeof optionsOrInterval === 'number'
        ? optionsOrInterval
        : optionsOrInterval?.intervalMs || 3000;
    const onLocationChange =
      typeof optionsOrInterval === 'object' ? optionsOrInterval?.onLocationChange : null;
    const pickupLocation =
      typeof optionsOrInterval === 'object' ? optionsOrInterval?.pickupLocation : null;
    const hospitalLocation =
      typeof optionsOrInterval === 'object' ? optionsOrInterval?.hospitalLocation : null;
    const initialDriverLocation =
      typeof optionsOrInterval === 'object' ? optionsOrInterval?.initialDriverLocation : null;
    const getStatus =
      typeof optionsOrInterval === 'object' ? optionsOrInterval?.getStatus : null;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`booking:${bookingId}`, {
      config: {
        broadcast: { self: true },
      },
    });

    let isSubscribed = false;
    let isStopped = false;
    let lastDbPersistAt = 0;

    // Seed with a guaranteed valid initial coordinate so the ambulance pin appears immediately
    const startingCoord = resolveInitialDriverCoordinate(initialDriverLocation, pickupLocation);
    let latestLocation = {
      lat: startingCoord.lat,
      lng: startingCoord.lng,
      timestamp: new Date().toISOString(),
      driverId,
    };

    // Road simulation state for stationary desktop testing
    let activeRoadPath = [];
    let roadStepIndex = 0;
    let currentSimulatedStage = null;
    let lastRealGpsFixAt = 0;

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

    const emitPosition = (lat, lng, forcePersist = false) => {
      if (isStopped || !isValidLatLng(lat, lng)) return;
      const locationData = {
        lat: Number(lat),
        lng: Number(lng),
        timestamp: new Date().toISOString(),
        driverId,
      };
      latestLocation = locationData;

      if (onLocationChange) {
        onLocationChange({ lat: locationData.lat, lng: locationData.lng });
      }

      sendBroadcast(locationData);
      persistToDatabase(locationData, forcePersist);
    };

    // Load road path for smooth Uber-like movement when testing on a stationary device
    const prepareSimulationPath = async (stage) => {
      if (isStopped) return;
      currentSimulatedStage = stage;
      roadStepIndex = 0;

      if (
        (stage === BOOKING_STATUS.ACCEPTED || stage === BOOKING_STATUS.EN_ROUTE_PICKUP) &&
        pickupLocation
      ) {
        const route = await fetchRoadRoute(latestLocation, pickupLocation);
        if (!isStopped && route?.path?.length) {
          activeRoadPath = route.path;
        }
      } else if (stage === BOOKING_STATUS.ARRIVED_PICKUP && pickupLocation) {
        activeRoadPath = [{ lat: Number(pickupLocation.lat), lng: Number(pickupLocation.lng) }];
        emitPosition(pickupLocation.lat, pickupLocation.lng, true);
      } else if (stage === BOOKING_STATUS.EN_ROUTE_HOSPITAL && hospitalLocation) {
        const startPt = pickupLocation || latestLocation;
        const route = await fetchRoadRoute(startPt, hospitalLocation);
        if (!isStopped && route?.path?.length) {
          activeRoadPath = route.path;
        }
      }
    };

    // Immediately emit initial coordinate so both Driver and Patient maps show the ambulance right away
    emitPosition(startingCoord.lat, startingCoord.lng, true);
    const initialStage = getStatus ? getStatus() : BOOKING_STATUS.ACCEPTED;
    prepareSimulationPath(initialStage);

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

    const handleOsPosition = (position) => {
      if (isStopped || !position?.coords) return;
      const { latitude: lat, longitude: lng } = position.coords;
      if (!isValidLatLng(lat, lng)) return;

      const resolved = resolveInitialDriverCoordinate({ lat, lng }, pickupLocation);
      const movedMeters = getDistanceMeters(latestLocation, resolved);

      // Only override simulated road progress if real physical GPS actually moved > 20m
      if (movedMeters > 20 && getDistanceMeters({ lat, lng }, pickupLocation || CITY_CENTER) > 80) {
        lastRealGpsFixAt = Date.now();
        emitPosition(resolved.lat, resolved.lng, false);
      }
    };

    let watchId = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        handleOsPosition,
        () => {},
        {
          enableHighAccuracy: true,
          maximumAge: intervalMs,
          timeout: 8000,
        }
      );

      watchId = navigator.geolocation.watchPosition(
        handleOsPosition,
        () => {},
        {
          enableHighAccuracy: true,
          maximumAge: intervalMs,
          timeout: 8000,
        }
      );
    }

    // Periodic telemetry tick: advances along the road route when stationary & broadcasts live coordinates
    const heartbeatTimer = setInterval(() => {
      if (isStopped) return;

      const currentStage = getStatus ? getStatus() : currentSimulatedStage;
      if (currentStage && currentStage !== currentSimulatedStage) {
        prepareSimulationPath(currentStage);
      }

      const isPhysicallyMoving = Date.now() - lastRealGpsFixAt < 6000;
      if (!isPhysicallyMoving && activeRoadPath.length > 1) {
        // Advance along the road path during active driving stages
        if (
          currentStage === BOOKING_STATUS.ACCEPTED ||
          currentStage === BOOKING_STATUS.EN_ROUTE_PICKUP ||
          currentStage === BOOKING_STATUS.EN_ROUTE_HOSPITAL
        ) {
          roadStepIndex = Math.min(roadStepIndex + 1, activeRoadPath.length - 1);
          const nextPt = activeRoadPath[roadStepIndex];
          if (nextPt) {
            emitPosition(nextPt.lat, nextPt.lng, false);
            return;
          }
        }
      }

      if (latestLocation) {
        emitPosition(latestLocation.lat, latestLocation.lng, false);
      }
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
   * Combines low-latency WebSocket broadcast, Postgres Realtime (`drivers` & `location_logs`),
   * and periodic polling fallback for 100% live reliability.
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

    // 3. Polling fallback every 3 seconds in case WebSockets are throttled or initial broadcast was missed
    const pollInterval = setInterval(async () => {
      if (driverId) {
        const { data: drv } = await DriverModel.getById(driverId);
        if (drv && isValidLatLng(drv.current_lat, drv.current_lng)) {
          emitValidLocation(drv.current_lat, drv.current_lng, drv.last_location_update);
          return;
        }
      }

      const { data: latestLog } = await supabase
        .from('location_logs')
        .select('latitude, longitude, recorded_at')
        .eq('booking_id', bookingId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestLog && isValidLatLng(latestLog.latitude, latestLog.longitude)) {
        emitValidLocation(latestLog.latitude, latestLog.longitude, latestLog.recorded_at);
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(dbChannel);
    };
  },
};
