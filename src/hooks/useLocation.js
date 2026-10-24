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

  const requestPosition = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

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

  const getLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }
    setLoading(true);
    requestPosition();
  }, [requestPosition]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const id = setTimeout(() => {
        setError('Geolocation is not supported by your browser');
        setLoading(false);
      }, 0);
      return () => clearTimeout(id);
    }

    requestPosition();

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
  }, [requestPosition, watch, enableHighAccuracy]);

  return { location, error, loading, refresh: getLocation };
}
