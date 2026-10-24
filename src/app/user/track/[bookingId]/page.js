'use client';

import { use } from 'react';
import { useTrackBookingController } from '@/controllers/useUserController';
import TrackBookingView from '@/views/user/TrackBookingView';

export default function TrackingPage({ params }) {
  const { bookingId } = use(params);
  const controller = useTrackBookingController(bookingId);
  return <TrackBookingView {...controller} />;
}
