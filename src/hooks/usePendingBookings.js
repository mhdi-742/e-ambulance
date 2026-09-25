'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Hook for drivers to see and manage pending booking requests
 */
export function usePendingBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();

  const fetchPendingBookings = useCallback(async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        hospital:hospitals(name, address, latitude, longitude),
        user:profiles!bookings_user_id_fkey(full_name, phone)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (!error) {
      setBookings(data || []);
    }
    setLoading(false);
  }, [supabase]);

  // Subscribe to real-time changes on bookings table
  useEffect(() => {
    fetchPendingBookings();

    const channel = supabase
      .channel(`pending-bookings:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        () => {
          // Re-fetch on any booking change
          fetchPendingBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchPendingBookings]);

  // Accept a booking
  const acceptBooking = useCallback(async (bookingId, driverId) => {
    // First, mark driver as busy
    await supabase
      .from('drivers')
      .update({ is_busy: true })
      .eq('id', driverId);

    // Then update the booking
    const { data, error } = await supabase
      .from('bookings')
      .update({
        driver_id: driverId,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .eq('status', 'pending') // Only if still pending (prevents race condition)
      .select()
      .single();

    if (error) {
      // Revert driver status if booking update failed
      await supabase
        .from('drivers')
        .update({ is_busy: false })
        .eq('id', driverId);
      return { error };
    }

    return { data };
  }, [supabase]);

  return { bookings, loading, refetch: fetchPendingBookings, acceptBooking };
}
