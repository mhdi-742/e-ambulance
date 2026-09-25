'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useSession } from '@/hooks/useSession';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function DriverHistoryPage() {
  const { driverData, loading: authLoading } = useSession();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!driverData) return;

    const fetchHistory = async () => {
      const { data } = await supabase
        .from('bookings')
        .select(`
          *,
          hospital:hospitals(name, address),
          user:profiles!bookings_user_id_fkey(full_name, phone)
        `)
        .eq('driver_id', driverData.id)
        .in('status', ['completed', 'cancelled'])
        .order('created_at', { ascending: false });

      setBookings(data || []);
      setLoading(false);
    };

    fetchHistory();
  }, [driverData, supabase]);

  const completed = bookings.filter((b) => b.status === 'completed').length;
  const cancelled = bookings.filter((b) => b.status === 'cancelled').length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <LoadingSpinner size="lg" text="Loading history..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Trip History</h1>
          <p className="text-xs text-zinc-400">Past completed and cancelled ambulance runs</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900">
            <p className="text-2xl font-bold text-emerald-400">{completed}</p>
            <p className="text-xs text-zinc-400 mt-1">Completed Dispatches</p>
          </div>
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900">
            <p className="text-2xl font-bold text-zinc-400">{cancelled}</p>
            <p className="text-xs text-zinc-400 mt-1">Cancelled Calls</p>
          </div>
        </div>

        {/* List */}
        <div>
          {loading ? (
            <div className="py-12 text-center text-zinc-400 text-xs">
              <LoadingSpinner text="Loading trips..." />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12 px-6 rounded-xl border border-zinc-800 bg-zinc-900">
              <p className="text-sm font-semibold text-white mb-1">No past trips recorded</p>
              <p className="text-xs text-zinc-400">Completed dispatch calls will show up here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-between flex-wrap gap-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{booking.hospital?.name || 'Hospital'}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Patient: {booking.user?.full_name || 'Patient'}
                    </p>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">
                      {new Date(booking.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
