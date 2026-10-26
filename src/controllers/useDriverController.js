'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BookingModel } from '@/models/BookingModel';
import { DriverModel } from '@/models/DriverModel';
import { useSessionController } from './useAuthController';
import { LOCATION_UPDATE_INTERVAL, BOOKING_STATUS } from '@/lib/constants';
import { isValidCoordinate } from '@/components/map/TrackingMap';

/**
 * Controller Hook: Manages pending booking requests feed and atomic driver acceptance.
 */
export function usePendingBookingsController() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingBookings = useCallback(async () => {
    const { data, error } = await BookingModel.getPending();
    if (!error) {
      setBookings(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPendingBookings();

    const unsubscribe = BookingModel.subscribeToAllBookings(
      `pending-bookings:${Date.now()}`,
      () => {
        fetchPendingBookings();
      }
    );

    const pollInterval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchPendingBookings();
      }
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [fetchPendingBookings]);

  const acceptBooking = useCallback(async (bookingId, driverId) => {
    return await BookingModel.acceptByDriver(bookingId, driverId);
  }, []);

  return { bookings, loading, refetch: fetchPendingBookings, acceptBooking };
}

/**
 * Controller Hook: Periodically updates the driver's GPS coordinates in the database
 * every 5 seconds while the driver is online and idle (not on an active trip).
 */
export function useDriverLocationController(driverId, isActive = false) {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const locationRef = useRef(null);

  const updateDriverLocation = useCallback(
    async (lat, lng) => {
      if (!driverId) return;
      await DriverModel.updateCoordinates(driverId, lat, lng);
    },
    [driverId]
  );

  useEffect(() => {
    if (!isActive || !driverId) return;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    const onPosition = (position) => {
      const loc = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      if (!isValidCoordinate(loc)) return;
      setCurrentLocation(loc);
      locationRef.current = loc;
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPosition(pos);
        updateDriverLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => setError(err.message),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: LOCATION_UPDATE_INTERVAL,
      }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: LOCATION_UPDATE_INTERVAL,
      }
    );

    intervalRef.current = setInterval(() => {
      const loc = locationRef.current;
      if (loc) {
        updateDriverLocation(loc.lat, loc.lng);
      }
    }, LOCATION_UPDATE_INTERVAL);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, driverId, updateDriverLocation]);

  return { currentLocation, error };
}

/**
 * Controller Hook: Orchestrates the Driver Console page (`/driver`).
 */
export function useDriverDashboardController() {
  const router = useRouter();
  const { driverData, loading: authLoading, refetchProfile } = useSessionController();
  const {
    bookings: pendingBookings,
    loading: pendingLoading,
    refetch: refetchPending,
    acceptBooking,
  } = usePendingBookingsController();

  const [isOnline, setIsOnline] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [liveTripLocation, setLiveTripLocation] = useState(null);
  const [toast, setToast] = useState(null);
  const [accepting, setAccepting] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const broadcastRef = useRef(null);
  const activeStatusRef = useRef(null);

  useEffect(() => {
    activeStatusRef.current = activeTrip?.status || null;
  }, [activeTrip?.status]);

  // Only run idle GPS watcher when online and NOT on an active trip
  const { currentLocation: idleLocation } = useDriverLocationController(
    driverData?.id,
    isOnline && !activeTrip
  );

  const stopBroadcast = useCallback(() => {
    if (broadcastRef.current) {
      broadcastRef.current.stop();
      broadcastRef.current = null;
    }
  }, []);

  const startBroadcastForTrip = useCallback(
    (trip, driverId) => {
      if (!trip?.id || !driverId) return;
      stopBroadcast();
      activeStatusRef.current = trip.status;

      const tripPickup =
        trip.pickup_lat != null && trip.pickup_lng != null
          ? { lat: Number(trip.pickup_lat), lng: Number(trip.pickup_lng) }
          : null;

      const rawHospLat = trip.hospital?.latitude ?? trip.hospital?.lat;
      const rawHospLng = trip.hospital?.longitude ?? trip.hospital?.lng;
      const tripHospital =
        rawHospLat != null && rawHospLng != null
          ? { lat: Number(rawHospLat), lng: Number(rawHospLng) }
          : null;

      const initialDriverLoc =
        idleLocation ||
        (driverData?.current_lat && driverData?.current_lng
          ? { lat: Number(driverData.current_lat), lng: Number(driverData.current_lng) }
          : null);

      broadcastRef.current = DriverModel.startLocationBroadcast(trip.id, driverId, {
        intervalMs: 2500,
        pickupLocation: tripPickup,
        hospitalLocation: tripHospital,
        initialDriverLocation: initialDriverLoc,
        getStatus: () => activeStatusRef.current,
        onLocationChange: (loc) => setLiveTripLocation(loc),
      });
    },
    [stopBroadcast, idleLocation, driverData?.current_lat, driverData?.current_lng]
  );

  useEffect(() => {
    if (driverData) {
      setIsOnline(Boolean(driverData.is_online));
    }
  }, [driverData]);

  // Load any existing active trip for this driver on mount
  useEffect(() => {
    if (!driverData?.id) return;
    let active = true;

    const fetchActiveTrip = async () => {
      const { data } = await BookingModel.getActiveTripForDriver(driverData.id);
      if (!active) return;

      if (data) {
        setActiveTrip(data);
        setIsOnline(true);
        startBroadcastForTrip(data, driverData.id);
      }
    };

    fetchActiveTrip();

    return () => {
      active = false;
      stopBroadcast();
    };
  }, [driverData?.id, startBroadcastForTrip, stopBroadcast]);

  // Subscribe to real-time updates on the active trip (plus 3s poll fallback)
  // so patient/admin cancellations immediately clear the driver's screen
  useEffect(() => {
    if (!activeTrip?.id || !driverData?.id) return;

    const handleRowUpdate = (updatedRow) => {
      if (!updatedRow) return;

      if (updatedRow.status === BOOKING_STATUS.CANCELLED) {
        stopBroadcast();
        setActiveTrip(null);
        setLiveTripLocation(null);
        refetchPending();
        setToast({
          message: 'The patient cancelled this dispatch request.',
          type: 'info',
        });
        return;
      }

      if (updatedRow.status === BOOKING_STATUS.COMPLETED) {
        stopBroadcast();
        setActiveTrip(null);
        setLiveTripLocation(null);
        refetchPending();
        return;
      }

      activeStatusRef.current = updatedRow.status;
      setActiveTrip((prev) => (prev ? { ...prev, ...updatedRow } : prev));
    };

    const unsubscribe = BookingModel.subscribeToBookingById(
      activeTrip.id,
      handleRowUpdate
    );

    const pollInterval = setInterval(async () => {
      const { data } = await BookingModel.getDriverTripDetails(activeTrip.id);
      if (data && data.status !== activeStatusRef.current) {
        handleRowUpdate(data);
      }
    }, 3500);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [activeTrip?.id, driverData?.id, stopBroadcast, refetchPending]);

  const toggleOnline = async () => {
    if (!driverData || activeTrip) return;

    const newStatus = !isOnline;
    setIsOnline(newStatus);

    const { error } = await DriverModel.setOnlineStatus(driverData.id, newStatus);
    if (error) {
      setIsOnline(!newStatus);
      setToast({
        message: error.message || 'Failed to update online status.',
        type: 'error',
      });
      return;
    }

    setToast({
      message: newStatus ? 'You are now ONLINE' : 'You are now OFFLINE',
      type: newStatus ? 'success' : 'info',
    });
  };

  const handleAccept = async (bookingId) => {
    if (!driverData || accepting) return;
    setAccepting(bookingId);

    const result = await acceptBooking(bookingId, driverData.id);

    if (result.error) {
      setToast({ message: result.error, type: 'error' });
      refetchPending();
    } else {
      setToast({ message: 'Booking accepted! Starting route navigation.', type: 'success' });
      let trip = result.data;

      if (!trip?.hospital?.latitude) {
        const { data } = await BookingModel.getDriverTripDetails(bookingId);
        if (data) trip = data;
      }

      if (trip) {
        setActiveTrip(trip);
        startBroadcastForTrip(trip, driverData.id);
      }
      refetchPending();
    }
    setAccepting(null);
  };

  const updateTripStatus = async (newStatus) => {
    if (!activeTrip || updatingStatus) return;
    setUpdatingStatus(true);

    const { error } = await BookingModel.updateStatus(
      activeTrip.id,
      newStatus,
      driverData?.id
    );

    setUpdatingStatus(false);

    if (error) {
      setToast({ message: error.message, type: 'error' });
      const { data: currentTrip } = await BookingModel.getActiveTripForDriver(driverData.id);
      if (!currentTrip) {
        stopBroadcast();
        setActiveTrip(null);
        setLiveTripLocation(null);
        refetchPending();
      } else {
        activeStatusRef.current = currentTrip.status;
        setActiveTrip(currentTrip);
      }
    } else {
      activeStatusRef.current = newStatus;
      setToast({
        message:
          newStatus === BOOKING_STATUS.COMPLETED
            ? 'Trip completed! You are now available for new dispatches.'
            : 'Trip status updated',
        type: 'success',
      });

      if (
        newStatus === BOOKING_STATUS.COMPLETED ||
        newStatus === BOOKING_STATUS.CANCELLED
      ) {
        stopBroadcast();
        setActiveTrip(null);
        setLiveTripLocation(null);
        refetchPending();
      } else {
        setActiveTrip((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    }
  };

  const pickupLocation = useMemo(() => {
    if (!activeTrip || activeTrip.pickup_lat == null || activeTrip.pickup_lng == null) {
      return null;
    }
    const pt = {
      lat: Number(activeTrip.pickup_lat),
      lng: Number(activeTrip.pickup_lng),
      address: activeTrip.pickup_address,
    };
    return isValidCoordinate(pt) ? pt : null;
  }, [activeTrip]);

  const hospitalLocation = useMemo(() => {
    const rawLat = activeTrip?.hospital?.latitude ?? activeTrip?.hospital?.lat;
    const rawLng = activeTrip?.hospital?.longitude ?? activeTrip?.hospital?.lng;
    if (rawLat == null || rawLng == null) return null;
    const pt = {
      lat: Number(rawLat),
      lng: Number(rawLng),
      name: activeTrip?.hospital?.name,
    };
    return isValidCoordinate(pt) ? pt : null;
  }, [activeTrip]);

  const activeDriverLocation = useMemo(() => {
    if (liveTripLocation && isValidCoordinate(liveTripLocation)) {
      return liveTripLocation;
    }
    if (idleLocation && isValidCoordinate(idleLocation)) {
      return idleLocation;
    }
    if (
      driverData?.current_lat != null &&
      driverData?.current_lng != null &&
      isValidCoordinate({ lat: driverData.current_lat, lng: driverData.current_lng })
    ) {
      return {
        lat: Number(driverData.current_lat),
        lng: Number(driverData.current_lng),
      };
    }
    return null;
  }, [liveTripLocation, idleLocation, driverData?.current_lat, driverData?.current_lng]);

  const goToRegister = () => router.push('/auth/register');
  const nextAction = activeTrip ? BookingModel.getNextDriverAction(activeTrip.status) : null;

  return {
    driverData,
    authLoading,
    isOnline,
    activeTrip,
    pickupLocation,
    hospitalLocation,
    activeDriverLocation,
    pendingBookings,
    pendingLoading,
    toast,
    setToast,
    accepting,
    updatingStatus,
    nextAction,
    toggleOnline,
    handleAccept,
    updateTripStatus,
    goToRegister,
    refetchProfile,
  };
}

/**
 * Controller Hook: Orchestrates the Driver Trip History page (`/driver/history`).
 */
export function useDriverHistoryController() {
  const { driverData, loading: authLoading } = useSessionController();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverData) return;

    const fetchHistory = async () => {
      const { data } = await BookingModel.getHistoryForDriver(driverData.id);
      setBookings(data);
      setLoading(false);
    };

    fetchHistory();
  }, [driverData]);

  const completed = bookings.filter((b) => b.status === BOOKING_STATUS.COMPLETED).length;
  const cancelled = bookings.filter((b) => b.status === BOOKING_STATUS.CANCELLED).length;

  return {
    authLoading,
    loading,
    bookings,
    completed,
    cancelled,
  };
}
