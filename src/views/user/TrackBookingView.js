'use client';

import Navbar from '@/components/layout/Navbar';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import TrackingMap from '@/components/map/TrackingMap';

/**
 * View: Live Trip Tracking Page (`/user/track/[bookingId]`)
 */
export default function TrackBookingView({
  bookingId,
  booking,
  loading,
  isActive,
  canCancel,
  statusFlow,
  currentIndex,
  pickupLocation,
  hospitalLocation,
  activeDriverLocation,
  showCancelModal,
  setShowCancelModal,
  cancelling,
  handleCancel,
  goToDashboard,
}) {
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <LoadingSpinner size="lg" text="Loading trip details..." />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 text-white">
        <div className="text-center max-w-md p-8 rounded-xl border border-zinc-800 bg-zinc-900">
          <p className="font-bold text-lg mb-2">Booking Not Found</p>
          <button
            onClick={goToDashboard}
            className="mt-4 px-6 py-2 rounded-lg bg-red-600 text-white font-bold text-sm cursor-pointer"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-24 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
          <div>
            <h1 className="text-2xl font-bold text-white mb-0.5">
              {isActive ? 'Live Trip Tracking' : 'Trip Summary'}
            </h1>
            <p className="text-xs text-zinc-500 font-mono">
              ID: {bookingId.slice(0, 8)}
            </p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        {/* Live Interactive Map */}
        <div className="mb-6">
          <TrackingMap
            pickupLocation={pickupLocation}
            driverLocation={activeDriverLocation}
            hospitalLocation={hospitalLocation}
            status={booking.status}
            height="360px"
          />
        </div>

        {/* Driver Card */}
        {booking.driver && (
          <div className="mb-6 p-5 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Assigned Driver
              </span>
              <p className="font-bold text-white">{booking.driver.profile?.full_name || 'Driver'}</p>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                {booking.driver.vehicle_number} •{' '}
                <span className="uppercase text-red-400">{booking.driver.vehicle_type}</span>
              </p>
            </div>
            {booking.driver.profile?.phone && (
              <a
                href={`tel:${booking.driver.profile.phone}`}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Call Driver
              </a>
            )}
          </div>
        )}

        {/* Trip Progress Steps */}
        <div className="mb-6 p-5 rounded-xl border border-zinc-800 bg-zinc-900">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">
            Trip Progression
          </p>
          <div className="space-y-3">
            {statusFlow.map((step, i) => {
              const isPast = i < currentIndex;
              const isCurrent = i === currentIndex;
              return (
                <div key={step.key} className="flex items-center gap-3 text-sm">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isPast
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-600'
                        : isCurrent
                        ? 'bg-red-600 text-white'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {isPast ? '✓' : i + 1}
                  </div>
                  <span
                    className={`${
                      isCurrent ? 'font-bold text-white' : isPast ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trip Details Box */}
        <div className="mb-6 p-5 rounded-xl border border-zinc-800 bg-zinc-900 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-400">Pickup Location:</span>
            <span className="font-medium text-white">{booking.pickup_address || 'GPS Location'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Destination Hospital:</span>
            <span className="font-medium text-white">{booking.hospital?.name || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Time Requested:</span>
            <span className="font-medium text-white">
              {new Date(booking.created_at).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Cancel Button */}
        {canCancel && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="w-full py-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel Dispatch Request
          </button>
        )}

        {/* Modal */}
        <Modal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          title="Cancel Booking?"
        >
          <p className="text-zinc-300 text-sm mb-6">
            Are you sure you want to cancel this ambulance request?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCancelModal(false)}
              className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
            >
              Keep Request
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
            </button>
          </div>
        </Modal>
      </main>
    </div>
  );
}

