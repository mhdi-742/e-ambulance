'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to get and watch the user's current location
 */
export function useLocation(options = {}) {
  const { enableHighAccuracy = true, watch = false } = options;

  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      {
        enableHighAccuracy,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, [enableHighAccuracy]);

  useEffect(() => {
    getLocation();

    if (watch) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
          setError(null);
        },
        (err) => {
          setError(err.message);
        },
        {
          enableHighAccuracy,
          timeout: 10000,
          maximumAge: 5000,
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [getLocation, watch, enableHighAccuracy]);

  return { location, error, loading, refresh: getLocation };
}
