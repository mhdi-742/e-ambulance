'use client';

import Navbar from '@/components/layout/Navbar';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Toast from '@/components/ui/Toast';

/**
 * View: Driver Console Dashboard (`/driver`)
 */
export default function DriverDashboardView({
  driverData,
  authLoading,
  isOnline,
  activeTrip,
  pendingBookings,
  pendingLoading,
  toast,
  setToast,
  accepting,
  nextAction,
  toggleOnline,
  handleAccept,
  updateTripStatus,
  goToRegister,
}) {
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <LoadingSpinner size="lg" text="Loading driver portal..." />
      </div>
    );
  }

  if (!driverData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 text-white">
        <div className="text-center max-w-md p-8 rounded-xl border border-zinc-800 bg-zinc-900">
          <h2 className="text-xl font-bold mb-2">Driver Profile Not Found</h2>
          <p className="text-sm text-zinc-400 mb-6">
            Please register as a driver or log in with driver credentials.
          </p>
          <button
            onClick={goToRegister}
            className="px-6 py-2.5 rounded-lg bg-red-600 text-white font-bold text-sm cursor-pointer"
          >
            Register as Driver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-24 pb-12">
        {/* Header & Status Toggle */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Driver Console</h1>
            <p className="text-xs text-zinc-400 font-mono">
              {driverData.vehicle_number} •{' '}
              <span className="uppercase text-red-400">{driverData.vehicle_type}</span> Ambulance
            </p>
          </div>

          <button
            onClick={toggleOnline}
            disabled={!!activeTrip}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-colors ${
              isOnline
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white'
            } ${activeTrip ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isOnline ? '● Status: ONLINE' : '○ Status: OFFLINE'}
          </button>
        </div>

        {/* Active Trip Box */}
        {activeTrip && (
          <div className="mb-8 p-6 rounded-2xl border border-red-500/40 bg-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-red-500 uppercase tracking-wider">
                Active Dispatch Assignment
              </span>
              <StatusBadge status={activeTrip.status} />
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">
                    {activeTrip.user?.full_name || 'Patient'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Pickup: {activeTrip.pickup_address || 'GPS Coordinates'}
                  </p>
                </div>
                {activeTrip.user?.phone && (
                  <a
                    href={`tel:${activeTrip.user.phone}`}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                  >
                    Call Patient
                  </a>
                )}
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950">
                <p className="text-xs text-zinc-500 uppercase font-semibold">
                  Destination Hospital
                </p>
                <p className="font-semibold text-white mt-1">{activeTrip.hospital?.name}</p>
                <p className="text-xs text-zinc-400">{activeTrip.hospital?.address}</p>
              </div>
            </div>

            {nextAction && (
              <button
                onClick={() => updateTripStatus(nextAction.status)}
                className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors cursor-pointer"
              >
                {nextAction.label} →
              </button>
            )}
          </div>
        )}

        {/* Pending Dispatch Requests */}
        {isOnline && !activeTrip && (
          <div>
            <h2 className="text-lg font-bold text-white mb-4">Pending Requests in Raiganj</h2>

            {pendingLoading ? (
              <div className="py-8 text-center text-zinc-400 text-xs">
                <LoadingSpinner text="Checking for new dispatch calls..." />
              </div>
            ) : pendingBookings.length === 0 ? (
              <div className="text-center py-12 px-6 rounded-xl border border-zinc-800 bg-zinc-900">
                <p className="font-semibold text-white text-sm mb-1">No pending requests</p>
                <p className="text-xs text-zinc-400">
                  New emergency ambulance requests in your vicinity will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="p-5 rounded-xl border border-zinc-800 bg-zinc-900 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-white text-sm">
                          Patient: {booking.user?.full_name || 'Patient'}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Pickup: {booking.pickup_address || 'GPS Coordinates'}
                        </p>
                        <p className="text-xs text-red-400 mt-1">
                          Destination: {booking.hospital?.name}
                        </p>
                      </div>
                      <span className="text-xs text-zinc-500 font-mono">
                        {new Date(booking.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <button
                      onClick={() => handleAccept(booking.id)}
                      disabled={accepting === booking.id}
                      className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {accepting === booking.id ? 'Accepting...' : 'Accept Dispatch Request'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Offline Message */}
        {!isOnline && !activeTrip && (
          <div className="text-center py-16 px-6 rounded-2xl border border-zinc-800 bg-zinc-900">
            <h2 className="text-xl font-bold text-white mb-2">You are currently OFFLINE</h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-6">
              Switch status to ONLINE to begin receiving live ambulance dispatch requests.
            </p>
            <button
              onClick={toggleOnline}
              className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
            >
              Go Online Now
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

