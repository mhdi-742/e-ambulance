'use client';

import {
  useBookingController,
  useUserBookingsController,
  useCreateBookingController,
} from '@/controllers/useUserController';

export const useBooking = useBookingController;
export const useUserBookings = useUserBookingsController;
export const useCreateBooking = useCreateBookingController;
