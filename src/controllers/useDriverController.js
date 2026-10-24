'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BookingModel } from '@/models/BookingModel';
import { DriverModel } from '@/models/DriverModel';
import { useSessionController } from './useAuthController';
import { LOCATION_UPDATE_INTERVAL, BOOKING_STATUS } from '@/lib/constants';

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

    return () => {
      unsubscribe();
    };
  }, [fetchPendingBookings]);

  const acceptBooking = useCallback(async (bookingId, driverId) => {
    return await BookingModel.acceptByDriver(bookingId, driverId);
  }, []);

  return { bookings, loading, refetch: fetchPendingBookings, acceptBooking };
}

/**
 * Controller Hook: Periodically updates the driver's GPS coordinates in the database
 * every 5 seconds while the driver is online.
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

    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentLocation(loc);
        locationRef.current = loc;
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

    intervalRef.current = setInterval(() => {
      const loc = locationRef.current;
      if (loc) {
        updateDriverLocation(loc.lat, loc.lng);
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
  }, [isActive, driverId, updateDriverLocation]);

  return { currentLocation, error };
}

/**
 * Controller Hook: Orchestrates the Driver Console page (`/driver`).
 */
export function useDriverDashboardController() {
  const router = useRouter();
  const { driverData, loading: authLoading } = useSessionController();
  const {
    bookings: pendingBookings,
    loading: pendingLoading,
    refetch: refetchPending,
    acceptBooking,
  } = usePendingBookingsController();

  const [isOnline, setIsOnline] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [toast, setToast] = useState(null);
  const [accepting, setAccepting] = useState(null);
  const broadcastRef = useRef(null);

  useDriverLocationController(driverData?.id, isOnline);

  useEffect(() => {
    if (driverData) {
      setIsOnline(driverData.is_online);
    }
  }, [driverData]);

  useEffect(() => {
    if (!driverData) return;

    const fetchActiveTrip = async () => {
      const { data } = await BookingModel.getActiveTripForDriver(driverData.id);
      if (data) {
        setActiveTrip(data);
        if (broadcastRef.current) broadcastRef.current.stop();
        broadcastRef.current = DriverModel.startLocationBroadcast(data.id, driverData.id);
      }
    };

    fetchActiveTrip();

    return () => {
      if (broadcastRef.current) {
        broadcastRef.current.stop();
        broadcastRef.current = null;
      }
    };
  }, [driverData]);

  const toggleOnline = async () => {
    if (!driverData) return;

    const newStatus = !isOnline;
    setIsOnline(newStatus);

    await DriverModel.setOnlineStatus(driverData.id, newStatus);

    setToast({
      message: newStatus ? 'You are now ONLINE' : 'You are now OFFLINE',
      type: newStatus ? 'success' : 'info',
    });
  };

  const handleAccept = async (bookingId) => {
    if (!driverData) return;
    setAccepting(bookingId);

    const result = await acceptBooking(bookingId, driverData.id);

    if (result.error) {
      setToast({ message: result.error, type: 'error' });
      refetchPending();
    } else {
      setToast({ message: 'Booking accepted!', type: 'success' });
      let trip = result.data;

      if (!trip?.hospital) {
        const { data } = await BookingModel.getDriverTripDetails(bookingId);
        if (data) trip = data;
      }

      if (trip) {
        setActiveTrip(trip);
        if (broadcastRef.current) broadcastRef.current.stop();
        broadcastRef.current = DriverModel.startLocationBroadcast(trip.id, driverData.id);
      }
      refetchPending();
    }
    setAccepting(null);
  };

  const updateTripStatus = async (newStatus) => {
    if (!activeTrip) return;

    const { error } = await BookingModel.updateStatus(
      activeTrip.id,
      newStatus,
      driverData?.id
    );

    if (error) {
      setToast({ message: error.message, type: 'error' });
    } else {
      setToast({ message: `Status updated to ${newStatus}`, type: 'success' });

      if (
        newStatus === BOOKING_STATUS.COMPLETED ||
        newStatus === BOOKING_STATUS.CANCELLED
      ) {
        if (broadcastRef.current) {
          broadcastRef.current.stop();
          broadcastRef.current = null;
        }
        setActiveTrip(null);
      } else {
        setActiveTrip((prev) => ({ ...prev, status: newStatus }));
      }
    }
  };

  const goToRegister = () => router.push('/auth/register');
  const nextAction = activeTrip ? BookingModel.getNextDriverAction(activeTrip.status) : null;

  return {
    driverData,
    authLoading,
    isOnline,
    activeTrip,
    pendingBookings,
    pendingLoading,
    toast,
    setToast,
    accepting,
    nextAction,
    toggleOnline,
    handleAccept,
    updateTripStatus,
    goToRegister,
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

