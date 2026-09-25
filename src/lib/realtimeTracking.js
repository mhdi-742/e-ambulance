import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Start broadcasting driver location to a booking's realtime channel.
 * Also updates the drivers table with current coordinates.
 */
export function startLocationBroadcast(bookingId, driverId, intervalMs = 5000) {
  const supabase = getSupabaseBrowserClient();
  const channel = supabase.channel(`booking:${bookingId}`);

  // Subscribe to the channel first
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
      supabase
        .from('drivers')
        .update({
          current_lat: locationData.lat,
          current_lng: locationData.lng,
          last_location_update: locationData.timestamp,
        })
        .eq('id', driverId)
        .then(() => {});

      // Log location for trip history
      supabase
        .from('location_logs')
        .insert({
          booking_id: bookingId,
          driver_id: driverId,
          latitude: locationData.lat,
          longitude: locationData.lng,
        })
        .then(() => {});
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
}

/**
 * Subscribe to driver location updates for a booking (user-side).
 */
export function subscribeToLocationUpdates(bookingId, onLocationUpdate) {
  const supabase = getSupabaseBrowserClient();
  const topic = `booking:${bookingId}`;

  // Clean up any lingering channel with this topic first
  const existing = supabase.getChannels().find((ch) => ch.topic === `realtime:${topic}` || ch.topic === topic);
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
}
