'use client';

import Navbar from '@/components/layout/Navbar';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

/**
 * View: Admin Live Bookings Feed (`/admin/bookings`)
 */
export default function AdminBookingsView({
  bookings,
  loading,
  filter,
  setFilter,
  filters,
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-12">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Ambulance Bookings</h1>
          <p className="text-xs text-zinc-400">
            Real-time feed of all emergency requests in Raiganj
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                filter === f.value
                  ? 'bg-red-600 text-white'
                  : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Bookings Table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-xs text-zinc-400">
              <LoadingSpinner text="Fetching bookings..." />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-16 px-6">
              <p className="font-semibold text-white text-sm mb-1">
                No bookings match this filter
              </p>
              <p className="text-xs text-zinc-500">New requests will appear dynamically.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="p-4">Patient</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Hospital Destination</th>
                    <th className="p-4">Assigned Vehicle</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-zinc-800/40">
                      <td className="p-4 font-medium text-white">
                        {booking.user?.full_name || 'N/A'}
                      </td>
                      <td className="p-4 text-zinc-400 font-mono">
                        {booking.user?.phone || '—'}
                      </td>
                      <td className="p-4 text-zinc-300">{booking.hospital?.name || 'N/A'}</td>
                      <td className="p-4 text-zinc-400 font-mono">
                        {booking.driver ? (
                          <>
                            {booking.driver.vehicle_number}
                            <span className="block text-[10px] text-zinc-500">
                              {booking.driver.profile?.full_name}
                            </span>
                          </>
                        ) : (
                          'Unassigned'
                        )}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={booking.status} />
                      </td>
                      <td className="p-4 text-zinc-500 font-mono">
                        {new Date(booking.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

