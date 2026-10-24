'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AuthModel } from '@/models/AuthModel';
import { BookingModel, TRIP_STATUS_FLOW } from '@/models/BookingModel';
import { HospitalModel } from '@/models/HospitalModel';
import { DriverModel } from '@/models/DriverModel';
import { useSessionController } from './useAuthController';
import { useLocation } from '@/hooks/useLocation';
import { CITY_CENTER, BOOKING_STATUS } from '@/lib/constants';

/**
 * Controller Hook: Manages a single booking state with real-time DB updates.
 */
export function useBookingController(bookingId) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;

    setLoading(true);
    const { data, error: fetchError } = await BookingModel.getById(bookingId);

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setBooking(data);
    }
    setLoading(false);
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;

    fetchBooking();

    const unsubscribe = BookingModel.subscribeToBookingById(bookingId, (updatedRow) => {
      setBooking((prev) => ({ ...prev, ...updatedRow }));
      fetchBooking();
    });

    return () => {
      unsubscribe();
    };
  }, [bookingId, fetchBooking]);

  return { booking, loading, error, refetch: fetchBooking };
}

/**
 * Controller Hook: Fetches all bookings for the currently signed-in patient.
 */
export function useUserBookingsController() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    const { user } = await AuthModel.getCurrentUser();
    if (!user) return;

    const { data, error } = await BookingModel.getByUserId(user.id);
    if (!error) {
      setBookings(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return { bookings, loading, refetch: fetchBookings };
}

/**
 * Controller Hook: Handles creating a new ambulance booking with active-trip validation.
 */
export function useCreateBookingController() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createBooking = useCallback(async ({ hospitalId, pickupLat, pickupLng, pickupAddress }) => {
    setLoading(true);
    setError(null);

    const { user } = await AuthModel.getCurrentUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return null;
    }

    const { hasActive } = await BookingModel.hasActiveBooking(user.id);
    if (hasActive) {
      setError('You already have an active booking');
      setLoading(false);
      return null;
    }

    const { data, error: insertError } = await BookingModel.create({
      userId: user.id,
      hospitalId,
      pickupLat,
      pickupLng,
      pickupAddress,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return null;
    }

    setLoading(false);
    return data;
  }, []);

  return { createBooking, loading, error };
}

/**
 * Controller Hook: Orchestrates the Patient Dashboard page (`/user`).
 */
export function useUserDashboardController() {
  const { profile, loading: authLoading } = useSessionController();
  const { bookings, loading: bookingsLoading } = useUserBookingsController();

  const activeBooking = bookings.find((b) => BookingModel.isActiveStatus(b.status));

  const quickStats = [
    { label: 'Total Trips', value: bookings.length },
    { label: 'Completed', value: bookings.filter((b) => b.status === BOOKING_STATUS.COMPLETED).length },
    { label: 'Cancelled', value: bookings.filter((b) => b.status === BOOKING_STATUS.CANCELLED).length },
    { label: 'Active', value: activeBooking ? 1 : 0 },
  ];

  return {
    profile,
    bookings,
    activeBooking,
    quickStats,
    authLoading,
    bookingsLoading,
  };
}

/**
 * Controller Hook: Orchestrates the 3-Step Ambulance Booking Wizard (`/user/book`).
 */
export function useBookAmbulanceController() {
  const router = useRouter();
  const { location, error: locationError, loading: locationLoading } = useLocation();
  const { createBooking, loading: bookingLoading, error: bookingError } = useCreateBookingController();

  const [selectedHospital, setSelectedHospital] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [manualLocation, setManualLocation] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [toast, setToast] = useState(null);
  const [step, setStep] = useState(1); // 1: location, 2: select hospital, 3: confirm

  const effectiveLocation = location || manualLocation;

  useEffect(() => {
    const loadHospitals = async () => {
      const { data, error } = await HospitalModel.getActive();
      if (error) {
        console.error('Failed to load active hospitals from database:', error);
      }
      setHospitals(data);
    };
    loadHospitals();
  }, []);

  useEffect(() => {
    if (effectiveLocation && step === 1) {
      setStep(2);
    }
  }, [effectiveLocation, step]);

  const useCityCenterFallback = useCallback(() => {
    setManualLocation(CITY_CENTER);
    setStep(2);
  }, []);

  const getDistance = useCallback(
    (hospital) => HospitalModel.calculateDistanceKm(location, hospital),
    [location]
  );

  const handleBooking = async () => {
    if (!selectedHospital || !effectiveLocation) return;

    const booking = await createBooking({
      hospitalId: selectedHospital.id,
      pickupLat: effectiveLocation.lat,
      pickupLng: effectiveLocation.lng,
      pickupAddress: pickupAddress || 'Location detected via GPS',
    });

    if (booking) {
      router.push(`/user/track/${booking.id}`);
    } else if (bookingError) {
      setToast({ message: bookingError, type: 'error' });
    }
  };

  return {
    step,
    setStep,
    hospitals,
    selectedHospital,
    setSelectedHospital,
    pickupAddress,
    setPickupAddress,
    location,
    locationError,
    locationLoading,
    effectiveLocation,
    useCityCenterFallback,
    bookingLoading,
    toast,
    setToast,
    getDistance,
    handleBooking,
  };
}

/**
 * Controller Hook: Orchestrates the Live Trip Tracking page (`/user/track/[bookingId]`).
 */
export function useTrackBookingController(bookingId) {
  const router = useRouter();
  const { booking, loading } = useBookingController(bookingId);

  const [driverLocation, setDriverLocation] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!bookingId) return;
    return DriverModel.subscribeToLocationUpdates(bookingId, (location) => {
      setDriverLocation(location);
    });
  }, [bookingId]);

  const handleCancel = async () => {
    setCancelling(true);
    await BookingModel.cancel(bookingId, booking?.driver_id, 'Cancelled by user');
    setCancelling(false);
    router.push('/user');
  };

  const goToDashboard = () => router.push('/user');

  const isActive = booking ? BookingModel.isActiveStatus(booking.status) : false;
  const canCancel = booking ? BookingModel.canPatientCancel(booking.status) : false;
  const statusFlow = TRIP_STATUS_FLOW;
  const currentIndex = booking
    ? statusFlow.findIndex((s) => s.key === booking.status)
    : -1;

  const pickupLocation =
    booking?.pickup_lat && booking?.pickup_lng
      ? {
          lat: Number(booking.pickup_lat),
          lng: Number(booking.pickup_lng),
          address: booking.pickup_address,
        }
      : null;

  const hospitalLocation =
    (booking?.hospital?.latitude || booking?.hospital?.lat) &&
    (booking?.hospital?.longitude || booking?.hospital?.lng)
      ? {
          lat: Number(booking.hospital.latitude || booking.hospital.lat),
          lng: Number(booking.hospital.longitude || booking.hospital.lng),
          name: booking.hospital.name,
        }
      : null;

  const activeDriverLocation = driverLocation
    ? { lat: Number(driverLocation.lat), lng: Number(driverLocation.lng) }
    : booking?.driver?.current_lat && booking?.driver?.current_lng
    ? { lat: Number(booking.driver.current_lat), lng: Number(booking.driver.current_lng) }
    : null;

  return {
    bookingId,
    booking,
    loading,
    isActive,
    canCancel,
    statusFlow,
    currentIndex,
    pickupLocation,
    hospitalLocation,
    activeDriverLocation,
    showCancelModal,
    setShowCancelModal,
    cancelling,
    handleCancel,
    goToDashboard,
  };
}

