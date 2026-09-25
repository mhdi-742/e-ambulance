'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Hook to manage booking state with real-time updates
 */
export function useBooking(bookingId) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const supabase = getSupabaseBrowserClient();

  // Fetch booking data
  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;

    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        *,
        hospital:hospitals(*),
        driver:drivers(*, profile:profiles(*))
      `)
      .eq('id', bookingId)
      .single();

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setBooking(data);
    }
    setLoading(false);
  }, [bookingId, supabase]);

  // Subscribe to real-time changes
  useEffect(() => {
    if (!bookingId) return;

    fetchBooking();

    const channel = supabase
      .channel(`booking-updates:${bookingId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`,
        },
        (payload) => {
          setBooking((prev) => ({ ...prev, ...payload.new }));
          // Re-fetch to get joined data
          fetchBooking();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, supabase, fetchBooking]);

  return { booking, loading, error, refetch: fetchBooking };
}

/**
 * Hook to get all bookings for the current user
 */
export function useUserBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();

  const fetchBookings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        hospital:hospitals(name, address),
        driver:drivers(vehicle_number, profile:profiles(full_name, phone))
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) {
      setBookings(data || []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return { bookings, loading, refetch: fetchBookings };
}

/**
 * Hook to create a new booking
 */
export function useCreateBooking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const supabase = getSupabaseBrowserClient();

  const createBooking = useCallback(async ({ hospitalId, pickupLat, pickupLng, pickupAddress }) => {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return null;
    }

    // Check if user already has an active booking
    const { data: activeBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['pending', 'accepted', 'en_route_pickup', 'arrived_pickup', 'en_route_hospital']);

    if (activeBookings && activeBookings.length > 0) {
      setError('You already have an active booking');
      setLoading(false);
      return null;
    }

    const { data, error: insertError } = await supabase
      .from('bookings')
      .insert({
        user_id: user.id,
        hospital_id: hospitalId,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        pickup_address: pickupAddress || '',
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return null;
    }

    setLoading(false);
    return data;
  }, [supabase]);

  return { createBooking, loading, error };
}
