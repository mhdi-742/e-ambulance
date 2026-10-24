'use client';

import Navbar from '@/components/layout/Navbar';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

/**
 * View: Driver Trip History Page (`/driver/history`)
 */
export default function DriverHistoryView({
  authLoading,
  loading,
  bookings,
  completed,
  cancelled,
}) {
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
                    <p className="text-sm font-semibold text-white">
                      {booking.hospital?.name || 'Hospital'}
                    </p>
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

