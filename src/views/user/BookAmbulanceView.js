'use client';

import Navbar from '@/components/layout/Navbar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Toast from '@/components/ui/Toast';
import TrackingMap from '@/components/map/TrackingMap';

/**
 * View: 3-Step Ambulance Booking Wizard (`/user/book`)
 */
export default function BookAmbulanceView({
  step,
  setStep,
  hospitals,
  selectedHospital,
  setSelectedHospital,
  pickupAddress,
  setPickupAddress,
  location,
  locationError,
  locationLoading,
  effectiveLocation,
  useCityCenterFallback,
  bookingLoading,
  toast,
  setToast,
  getDistance,
  handleBooking,
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-24 pb-12">
        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-8">
          {['1. Location', '2. Hospital', '3. Confirm'].map((label, i) => (
            <div
              key={label}
              className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg border ${
                step === i + 1
                  ? 'border-red-500 bg-red-500/10 text-red-400'
                  : step > i + 1
                  ? 'border-emerald-600 bg-emerald-950 text-emerald-400'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-500'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Step 1: Location Detection */}
        {step === 1 && (
          <div className="text-center py-16 p-8 rounded-2xl border border-zinc-800 bg-zinc-900">
            <h2 className="text-2xl font-bold text-white mb-2">Detecting Your GPS Location</h2>
            <p className="text-sm text-zinc-400 mb-6">
              Please allow location permission in your browser so the dispatch driver can locate you.
            </p>
            {locationLoading && <LoadingSpinner text="Locating..." />}
            {locationError && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs mt-4">
                {locationError}. Please enable location services in your browser settings.
              </div>
            )}
            <div className="mt-6">
              <button
                type="button"
                onClick={useCityCenterFallback}
                className="text-xs text-red-400 hover:underline cursor-pointer"
              >
                Or proceed using Raiganj Center coordinates →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select Destination Hospital */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Select Hospital</h2>
              <p className="text-xs text-zinc-400">Choose your destination medical center</p>
            </div>

            {/* Custom Pickup Address */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Pickup Address (optional, defaults to GPS)
              </label>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="e.g. Near Raiganj Bus Stand, Ward 12"
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
              {location && (
                <p className="text-xs text-zinc-500 mt-1 font-mono">
                  GPS: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </p>
              )}
            </div>

            {/* Hospital Options */}
            <div className="space-y-3">
              {hospitals.map((hospital) => {
                const distance = getDistance(hospital);
                const isSelected = selectedHospital?.id === hospital.id;
                return (
                  <button
                    key={hospital.id}
                    onClick={() => setSelectedHospital(hospital)}
                    className={`w-full text-left p-4 rounded-xl border text-sm transition-colors cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-red-500 bg-red-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-white">{hospital.name}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{hospital.address}</p>
                    </div>
                    {distance && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 ml-4 shrink-0">
                        {distance} km
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => selectedHospital && setStep(3)}
              disabled={!selectedHospital}
              className="w-full py-3.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors disabled:opacity-40 cursor-pointer"
            >
              Continue to Confirmation →
            </button>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && selectedHospital && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Confirm Booking</h2>
              <p className="text-xs text-zinc-400">Review trip details before dispatch</p>
            </div>

            <div className="space-y-4 p-6 rounded-xl border border-zinc-800 bg-zinc-900">
              <div>
                <p className="text-xs text-zinc-400 font-semibold uppercase">Pickup Location</p>
                <p className="text-sm font-semibold text-white mt-1">
                  {pickupAddress || 'Current GPS Location'}
                </p>
                {location && (
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">
                    {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-800">
                <p className="text-xs text-zinc-400 font-semibold uppercase">Destination Hospital</p>
                <p className="text-sm font-semibold text-white mt-1">{selectedHospital.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{selectedHospital.address}</p>
              </div>

              <div className="pt-3 border-t border-zinc-800 text-xs text-zinc-400">
                Payment: Settled directly with the ambulance driver upon pickup/arrival.
              </div>
            </div>

            {/* Map Preview */}
            <div className="rounded-xl overflow-hidden border border-zinc-800">
              <TrackingMap
                pickupLocation={
                  effectiveLocation
                    ? { lat: effectiveLocation.lat, lng: effectiveLocation.lng, address: pickupAddress }
                    : null
                }
                hospitalLocation={
                  selectedHospital
                    ? {
                        lat: Number(selectedHospital.latitude || selectedHospital.lat),
                        lng: Number(selectedHospital.longitude || selectedHospital.lng),
                        name: selectedHospital.name,
                      }
                    : null
                }
                height="260px"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold text-sm cursor-pointer"
              >
                ← Back
              </button>
              <button
                onClick={handleBooking}
                disabled={bookingLoading}
                className="flex-[2] py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {bookingLoading ? <LoadingSpinner size="sm" text="" /> : 'Confirm Dispatch Request'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

