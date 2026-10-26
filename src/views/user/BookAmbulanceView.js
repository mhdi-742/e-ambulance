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
  hospitalsLoading,
  selectedHospital,
  setSelectedHospital,
  pickupAddress,
  setPickupAddress,
  locationError,
  locationLoading,
  refreshLocation,
  effectiveLocation,
  useCityCenterFallback,
  handlePickupSelect,
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
          {['1. Location', '2. Hospital', '3. Confirm'].map((label, i) => {
            const targetStep = i + 1;
            const canNavigate =
              targetStep === 1 ||
              (targetStep === 2 && Boolean(effectiveLocation)) ||
              (targetStep === 3 && Boolean(effectiveLocation && selectedHospital));

            return (
              <button
                key={label}
                type="button"
                disabled={!canNavigate}
                onClick={() => canNavigate && setStep(targetStep)}
                className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg border transition-colors ${
                  step === targetStep
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : step > targetStep
                    ? 'border-emerald-600 bg-emerald-950 text-emerald-400 cursor-pointer'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                } ${canNavigate ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Step 1: Location Detection */}
        {step === 1 && (
          <div className="text-center py-14 p-8 rounded-2xl border border-zinc-800 bg-zinc-900">
            <h2 className="text-2xl font-bold text-white mb-2">Detecting Your GPS Location</h2>
            <p className="text-sm text-zinc-400 mb-6">
              Please allow location permission in your browser so the dispatch driver can locate you.
            </p>
            {locationLoading && <LoadingSpinner text="Locating your coordinates..." />}
            {locationError && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs mt-4">
                <p>{locationError}. Please enable location services or use the fallback below.</p>
                {refreshLocation && (
                  <button
                    type="button"
                    onClick={refreshLocation}
                    className="mt-2.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
                  >
                    Retry GPS Detection
                  </button>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col items-center gap-3">
              {effectiveLocation && (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
                >
                  Continue with Detected Location ({effectiveLocation.lat.toFixed(4)},{' '}
                  {effectiveLocation.lng.toFixed(4)}) →
                </button>
              )}
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
              <p className="text-xs text-zinc-400">
                Choose your destination medical center (sorted by nearest distance)
              </p>
            </div>

            {/* Custom Pickup Address */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Pickup Address / Landmark (optional, defaults to GPS)
              </label>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="e.g. Near Raiganj Bus Stand, Ward 12"
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
              {effectiveLocation && (
                <p className="text-xs text-zinc-500 mt-1 font-mono">
                  Pickup Coordinates: {effectiveLocation.lat.toFixed(5)},{' '}
                  {effectiveLocation.lng.toFixed(5)}
                </p>
              )}
            </div>

            {/* Hospital Options */}
            {hospitalsLoading ? (
              <div className="py-10 text-center">
                <LoadingSpinner text="Loading active hospitals..." />
              </div>
            ) : hospitals.length === 0 ? (
              <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900 text-center text-sm text-zinc-400">
                No active hospitals available right now. Please contact emergency services (108).
              </div>
            ) : (
              <div className="space-y-3">
                {hospitals.map((hospital) => {
                  const distance = getDistance(hospital);
                  const isSelected = selectedHospital?.id === hospital.id;
                  return (
                    <button
                      key={hospital.id}
                      type="button"
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
            )}

            <button
              type="button"
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
                {effectiveLocation && (
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">
                    {effectiveLocation.lat.toFixed(5)}, {effectiveLocation.lng.toFixed(5)}
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

            {/* Interactive Map Preview */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-zinc-400">Route Preview</span>
                <span className="text-[11px] text-zinc-500">
                  Tap on the map to adjust your exact pickup pin
                </span>
              </div>
              <div className="rounded-xl overflow-hidden border border-zinc-800">
                <TrackingMap
                  pickupLocation={
                    effectiveLocation
                      ? {
                          lat: effectiveLocation.lat,
                          lng: effectiveLocation.lng,
                          address: pickupAddress,
                        }
                      : null
                  }
                  hospitalLocation={
                    selectedHospital
                      ? {
                          lat: Number(selectedHospital.latitude ?? selectedHospital.lat),
                          lng: Number(selectedHospital.longitude ?? selectedHospital.lng),
                          name: selectedHospital.name,
                        }
                      : null
                  }
                  onPickupSelect={handlePickupSelect}
                  height="280px"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-semibold text-sm cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleBooking}
                disabled={bookingLoading}
                className="flex-[2] py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {bookingLoading ? (
                  <LoadingSpinner size="sm" text="" />
                ) : (
                  'Confirm Dispatch Request'
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
