'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AuthModel } from '@/models/AuthModel';
import { BookingModel, TRIP_STATUS_FLOW } from '@/models/BookingModel';
import { HospitalModel } from '@/models/HospitalModel';
import { DriverModel } from '@/models/DriverModel';
import { useSessionController } from './useAuthController';
import { useLocation } from '@/hooks/useLocation';
import { CITY_CENTER, BOOKING_STATUS } from '@/lib/constants';
import { isValidCoordinate } from '@/components/map/TrackingMap';

/**
 * Controller Hook: Manages a single booking state with real-time DB updates.
 * Uses silent background refreshes on Realtime events so `<TrackingMap />` never unmounts.
 */
export function useBookingController(bookingId) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedOnceRef = useRef(false);

  const fetchBooking = useCallback(
    async ({ silent = false } = {}) => {
      if (!bookingId) return;

      if (!silent && !hasLoadedOnceRef.current) {
        setLoading(true);
      }

      const { data, error: fetchError } = await BookingModel.getById(bookingId);

      if (fetchError) {
        setError(fetchError.message);
      } else if (data) {
        setBooking(data);
        setError(null);
        hasLoadedOnceRef.current = true;
      }

      setLoading(false);
    },
    [bookingId]
  );

  useEffect(() => {
    if (!bookingId) return;
    hasLoadedOnceRef.current = false;

    fetchBooking({ silent: false });

    const unsubscribe = BookingModel.subscribeToBookingById(bookingId, (updatedRow) => {
      setBooking((prev) => (prev ? { ...prev, ...updatedRow } : updatedRow));
      fetchBooking({ silent: true });
    });

    // Polling fallback every 3s ensures immediate updates even if WebSockets reconnect
    const pollInterval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchBooking({ silent: true });
      }
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [bookingId, fetchBooking]);

  return { booking, loading, error, refetch: fetchBooking };
}

/**
 * Controller Hook: Fetches and subscribes in real-time to all bookings for the signed-in patient.
 */
export function useUserBookingsController() {
  const { user } = useSessionController();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(
    async ({ silent = false } = {}) => {
      let currentUserId = user?.id;
      if (!currentUserId) {
        const { user: fetchedUser } = await AuthModel.getCurrentUser();
        currentUserId = fetchedUser?.id;
      }

      if (!currentUserId) {
        setLoading(false);
        return;
      }

      if (!silent) {
        setLoading(true);
      }

      const { data, error } = await BookingModel.getByUserId(currentUserId);
      if (!error) {
        setBookings(data);
      }
      setLoading(false);
    },
    [user?.id]
  );

  useEffect(() => {
    fetchBookings();

    if (!user?.id) return;
    const unsubscribe = BookingModel.subscribeToUserBookings(user.id, () => {
      fetchBookings({ silent: true });
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id, fetchBookings]);

  return { bookings, loading, refetch: fetchBookings };
}

/**
 * Controller Hook: Handles creating a new ambulance booking with active-trip validation
 * and synchronous double-submission protection.
 */
export function useCreateBookingController() {
  const { user: sessionUser } = useSessionController();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isSubmittingRef = useRef(false);

  const createBooking = useCallback(
    async ({ hospitalId, pickupLat, pickupLng, pickupAddress }) => {
      if (isSubmittingRef.current) {
        return { data: null, error: 'Booking request already in progress...' };
      }

      isSubmittingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        let activeUser = sessionUser;
        if (!activeUser?.id) {
          const { user: fetchedUser } = await AuthModel.getCurrentUser();
          activeUser = fetchedUser;
        }

        if (!activeUser?.id) {
          const msg = 'You must be signed in to request an ambulance.';
          setError(msg);
          return { data: null, error: msg };
        }

        const { hasActive, activeBookings } = await BookingModel.hasActiveBooking(activeUser.id);
        if (hasActive) {
          const msg = 'You already have an active ambulance booking in progress.';
          setError(msg);
          return {
            data: null,
            error: msg,
            activeBookingId: activeBookings[0]?.id || null,
          };
        }

        const { data, error: insertError } = await BookingModel.create({
          userId: activeUser.id,
          hospitalId,
          pickupLat,
          pickupLng,
          pickupAddress,
        });

        if (insertError) {
          const msg = insertError.message || 'Failed to create ambulance booking.';
          setError(msg);

          if (insertError.code === '23505') {
            const { activeBookings: currentActive } = await BookingModel.hasActiveBooking(
              activeUser.id
            );
            return {
              data: null,
              error: msg,
              activeBookingId: currentActive[0]?.id || null,
            };
          }

          return { data: null, error: msg };
        }

        return { data, error: null };
      } finally {
        isSubmittingRef.current = false;
        setLoading(false);
      }
    },
    [sessionUser]
  );

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
    {
      label: 'Completed',
      value: bookings.filter((b) => b.status === BOOKING_STATUS.COMPLETED).length,
    },
    {
      label: 'Cancelled',
      value: bookings.filter((b) => b.status === BOOKING_STATUS.CANCELLED).length,
    },
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
  const { user } = useSessionController();
  const {
    location,
    error: locationError,
    loading: locationLoading,
    refresh: refreshLocation,
  } = useLocation();
  const { createBooking, loading: bookingLoading } = useCreateBookingController();

  const [selectedHospital, setSelectedHospital] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [manualLocation, setManualLocation] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [step, setStep] = useState(1); // 1: location, 2: select hospital, 3: confirm
  const hasAutoAdvancedRef = useRef(false);

  // Manual pin or city-center override takes precedence over raw GPS if selected
  const effectiveLocation = manualLocation || location;

  // Check if user already has an active trip when opening the wizard
  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    BookingModel.hasActiveBooking(user.id).then(({ hasActive, activeBookings }) => {
      if (!active) return;
      if (hasActive && activeBookings[0]?.id) {
        setToast({
          message: 'Redirecting to your active ambulance dispatch...',
          type: 'info',
        });
        router.replace(`/user/track/${activeBookings[0].id}`);
      }
    });

    return () => {
      active = false;
    };
  }, [user?.id, router]);

  // Load active hospitals from database
  useEffect(() => {
    let active = true;
    const loadHospitals = async () => {
      setHospitalsLoading(true);
      const { data, error } = await HospitalModel.getActive();
      if (!active) return;

      if (error) {
        setToast({
          message: 'Unable to load hospitals. Please check your connection.',
          type: 'error',
        });
      }
      setHospitals(data || []);
      setHospitalsLoading(false);
    };
    loadHospitals();
    return () => {
      active = false;
    };
  }, []);

  // Auto-advance from Step 1 to Step 2 once initial GPS location is acquired
  useEffect(() => {
    if (effectiveLocation && step === 1 && !hasAutoAdvancedRef.current) {
      hasAutoAdvancedRef.current = true;
      setStep(2);
    }
  }, [effectiveLocation, step]);

  const useCityCenterFallback = useCallback(() => {
    hasAutoAdvancedRef.current = true;
    setManualLocation(CITY_CENTER);
    setPickupAddress((prev) => prev || 'Raiganj City Center');
    setStep(2);
  }, []);

  const handlePickupSelect = useCallback((coords) => {
    if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
      setManualLocation({ lat: coords.lat, lng: coords.lng });
    }
  }, []);

  const getDistance = useCallback(
    (hospital) => HospitalModel.calculateDistanceKm(effectiveLocation, hospital),
    [effectiveLocation]
  );

  // Sort hospitals by proximity when effectiveLocation is available
  const sortedHospitals = useMemo(() => {
    if (!effectiveLocation) return hospitals;
    return [...hospitals].sort((a, b) => {
      const distA = parseFloat(HospitalModel.calculateDistanceKm(effectiveLocation, a) ?? '9999');
      const distB = parseFloat(HospitalModel.calculateDistanceKm(effectiveLocation, b) ?? '9999');
      return distA - distB;
    });
  }, [hospitals, effectiveLocation]);

  const handleBooking = async () => {
    if (!selectedHospital) {
      setToast({ message: 'Please select a destination hospital.', type: 'error' });
      return;
    }
    if (!effectiveLocation) {
      setToast({
        message: 'Pickup GPS location is missing. Please enable GPS or use City Center.',
        type: 'error',
      });
      setStep(1);
      return;
    }

    const result = await createBooking({
      hospitalId: selectedHospital.id,
      pickupLat: effectiveLocation.lat,
      pickupLng: effectiveLocation.lng,
      pickupAddress: pickupAddress.trim() || 'Location detected via GPS',
    });

    if (result?.data?.id) {
      router.push(`/user/track/${result.data.id}`);
    } else if (result?.activeBookingId) {
      setToast({
        message: result.error || 'Redirecting to your active booking...',
        type: 'info',
      });
      setTimeout(() => {
        router.push(`/user/track/${result.activeBookingId}`);
      }, 1000);
    } else if (result?.error) {
      setToast({ message: result.error, type: 'error' });
    }
  };

  return {
    step,
    setStep,
    hospitals: sortedHospitals,
    hospitalsLoading,
    selectedHospital,
    setSelectedHospital,
    pickupAddress,
    setPickupAddress,
    location,
    locationError,
    locationLoading,
    refreshLocation,
    effectiveLocation,
    useCityCenterFallback,
    handlePickupSelect,
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
  const { booking, loading, refetch } = useBookingController(bookingId);

  const [driverLocation, setDriverLocation] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState(null);

  const assignedDriverId = booking?.driver_id || booking?.driver?.id || null;

  // Subscribe to both WebSocket broadcast and Postgres driver/location_logs updates
  useEffect(() => {
    if (!bookingId) return;
    return DriverModel.subscribeToLocationUpdates(
      bookingId,
      (location) => {
        setDriverLocation(location);
      },
      assignedDriverId
    );
  }, [bookingId, assignedDriverId]);

  const handleCancel = async () => {
    if (!bookingId || cancelling) return;
    setCancelling(true);

    const { error } = await BookingModel.cancel(
      bookingId,
      assignedDriverId,
      'Cancelled by user'
    );

    setCancelling(false);
    setShowCancelModal(false);

    if (error) {
      setToast({
        message: error.message || 'Could not cancel booking.',
        type: 'error',
      });
      refetch({ silent: true });
      return;
    }

    router.push('/user');
  };

  const goToDashboard = useCallback(() => router.push('/user'), [router]);

  const isActive = booking ? BookingModel.isActiveStatus(booking.status) : false;
  const canCancel = booking ? BookingModel.canPatientCancel(booking.status) : false;
  const statusFlow = TRIP_STATUS_FLOW;
  const currentIndex = booking
    ? statusFlow.findIndex((s) => s.key === booking.status)
    : -1;

  const pickupLocation = useMemo(() => {
    if (booking?.pickup_lat == null || booking?.pickup_lng == null) return null;
    const pt = {
      lat: Number(booking.pickup_lat),
      lng: Number(booking.pickup_lng),
      address: booking.pickup_address,
    };
    return isValidCoordinate(pt) ? pt : null;
  }, [booking?.pickup_lat, booking?.pickup_lng, booking?.pickup_address]);

  const hospitalLocation = useMemo(() => {
    const rawLat = booking?.hospital?.latitude ?? booking?.hospital?.lat;
    const rawLng = booking?.hospital?.longitude ?? booking?.hospital?.lng;
    if (rawLat == null || rawLng == null) return null;
    const pt = {
      lat: Number(rawLat),
      lng: Number(rawLng),
      name: booking?.hospital?.name,
    };
    return isValidCoordinate(pt) ? pt : null;
  }, [
    booking?.hospital?.latitude,
    booking?.hospital?.lat,
    booking?.hospital?.longitude,
    booking?.hospital?.lng,
    booking?.hospital?.name,
  ]);

  const activeDriverLocation = useMemo(() => {
    if (driverLocation && isValidCoordinate(driverLocation)) {
      return { lat: Number(driverLocation.lat), lng: Number(driverLocation.lng) };
    }
    const dbLat = booking?.driver?.current_lat;
    const dbLng = booking?.driver?.current_lng;
    if (dbLat != null && dbLng != null && isValidCoordinate({ lat: dbLat, lng: dbLng })) {
      return { lat: Number(dbLat), lng: Number(dbLng) };
    }
    return null;
  }, [driverLocation, booking?.driver?.current_lat, booking?.driver?.current_lng]);

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
    toast,
    setToast,
    handleCancel,
    goToDashboard,
  };
}
