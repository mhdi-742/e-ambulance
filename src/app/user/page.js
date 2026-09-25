'use client';

import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useSession } from '@/hooks/useSession';
import { useUserBookings } from '@/hooks/useBooking';
import { BOOKING_STATUS } from '@/lib/constants';

export default function UserDashboard() {
  const { profile, loading: authLoading } = useSession();
  const { bookings, loading: bookingsLoading } = useUserBookings();

  const activeBooking = bookings.find(
    (b) =>
      b.status !== BOOKING_STATUS.COMPLETED &&
      b.status !== BOOKING_STATUS.CANCELLED
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading patient portal..." />
      </div>
    );
  }

  const quickStats = [
    { label: 'Total Trips', value: bookings.length },
    { label: 'Completed', value: bookings.filter((b) => b.status === 'completed').length },
    { label: 'Cancelled', value: bookings.filter((b) => b.status === 'cancelled').length },
    { label: 'Active', value: activeBooking ? 1 : 0 },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-12">
        {/* Welcome Header */}
        <div className="mb-8">
          <div className="inline-block px-3 py-1 mb-2 rounded-full text-xs font-semibold border border-zinc-800 bg-zinc-900 text-zinc-300">
            Patient Portal
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">
            Hello, {profile?.full_name || 'User'}
          </h1>
          <p className="text-sm text-zinc-400">
            Raiganj 24/7 emergency dispatch and trip management.
          </p>
        </div>

        {/* Active Booking Banner */}
        {activeBooking && (
          <div className="mb-8 p-6 rounded-xl border border-red-500/40 bg-zinc-900 flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-xs font-bold text-red-500 uppercase tracking-wider block mb-1">
                Active Trip in Progress
              </span>
              <p className="text-lg font-bold text-white">
                {activeBooking.hospital?.name || 'Hospital Destination'}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Pickup: {activeBooking.pickup_address || 'Current Location'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={activeBooking.status} />
              <Link
                href={`/user/track/${activeBooking.id}`}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors"
              >
                Track Live →
              </Link>
            </div>
          </div>
        )}

        {/* Book Ambulance CTA */}
        {!activeBooking && (
          <div className="mb-8">
            <Link
              href="/user/book"
              className="block p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900 hover:border-red-500 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    Book Ambulance Now →
                  </h2>
                  <p className="text-sm text-zinc-400">
                    Tap here to request an immediate emergency ambulance to your exact GPS location
                  </p>
                </div>
                <div className="hidden sm:block text-xs font-bold text-red-400">
                  Instant Dispatch
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {quickStats.map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-900"
            >
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-zinc-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Booking History */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Recent Bookings</h2>

          {bookingsLoading ? (
            <div className="py-12 text-center text-zinc-400 text-sm">
              <LoadingSpinner text="Loading bookings..." />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12 px-6 rounded-xl border border-zinc-800 bg-zinc-900">
              <p className="text-white font-semibold mb-1">No bookings yet</p>
              <p className="text-xs text-zinc-400">
                Your emergency booking and dispatch history will appear here once requested.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.slice(0, 10).map((booking) => (
                <div
                  key={booking.id}
                  className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-between flex-wrap gap-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {booking.hospital?.name || 'Hospital Destination'}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {new Date(booking.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={booking.status} />
                    {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                      <Link
                        href={`/user/track/${booking.id}`}
                        className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-xs font-semibold text-zinc-300"
                      >
                        Track
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
