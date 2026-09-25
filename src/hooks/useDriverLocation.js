'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { LOCATION_UPDATE_INTERVAL } from '@/lib/constants';

/**
 * Hook for driver location broadcasting
 * Sends location updates every 5 seconds when driver is on an active trip
 */
export function useDriverLocation(driverId, isActive = false) {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const supabase = getSupabaseBrowserClient();

  const updateDriverLocation = useCallback(async (lat, lng) => {
    if (!driverId) return;

    await supabase
      .from('drivers')
      .update({
        current_lat: lat,
        current_lng: lng,
        last_location_update: new Date().toISOString(),
      })
      .eq('id', driverId);
  }, [driverId, supabase]);

  useEffect(() => {
    if (!isActive || !driverId) return;

    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    // Watch position for continuous updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentLocation(loc);
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: LOCATION_UPDATE_INTERVAL,
      }
    );

    // Update DB every 5 seconds
    intervalRef.current = setInterval(() => {
      if (currentLocation) {
        updateDriverLocation(currentLocation.lat, currentLocation.lng);
      }
    }, LOCATION_UPDATE_INTERVAL);

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, driverId, currentLocation, updateDriverLocation]);

  return { currentLocation, error };
}
