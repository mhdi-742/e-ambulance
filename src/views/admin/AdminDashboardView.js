'use client';

import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StatusBadge from '@/components/ui/StatusBadge';

/**
 * View: Admin Overview Dashboard (`/admin`)
 */
export default function AdminDashboardView({
  loading,
  statCards,
  recentBookings,
}) {
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <LoadingSpinner size="lg" text="Loading admin console..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-12">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Admin Dashboard</h1>
            <p className="text-xs text-zinc-400">
              System overview &amp; live telemetry — auto-refreshes every 30s
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <Link
              href="/admin/bookings"
              className="px-3.5 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:text-white"
            >
              All Bookings
            </Link>
            <Link
              href="/admin/drivers"
              className="px-3.5 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:text-white"
            >
              Manage Drivers
            </Link>
            <Link
              href="/admin/hospitals"
              className="px-3.5 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:text-white"
            >
              Manage Hospitals
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900"
            >
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-zinc-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Recent Bookings Table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Recent Ambulance Calls</h2>
            <Link href="/admin/bookings" className="text-xs text-red-400 hover:underline">
              View All →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-4">Patient</th>
                  <th className="p-4">Hospital Destination</th>
                  <th className="p-4">Assigned Driver</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {recentBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-zinc-800/40">
                    <td className="p-4 font-medium text-white">
                      {booking.user?.full_name || 'N/A'}
                    </td>
                    <td className="p-4 text-zinc-300">{booking.hospital?.name || 'N/A'}</td>
                    <td className="p-4 text-zinc-300">
                      {booking.driver?.profile?.full_name || '—'}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="p-4 text-zinc-500 font-mono">
                      {new Date(booking.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
                {recentBookings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-zinc-500">
                      No ambulance dispatches logged yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

