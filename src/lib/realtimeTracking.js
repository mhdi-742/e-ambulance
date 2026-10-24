import { DriverModel } from '@/models/DriverModel';

/**
 * Start broadcasting driver location to a booking's realtime channel.
 * Delegates to DriverModel.startLocationBroadcast.
 */
export function startLocationBroadcast(bookingId, driverId, intervalMs = 5000) {
  return DriverModel.startLocationBroadcast(bookingId, driverId, intervalMs);
}

/**
 * Subscribe to driver location updates for a booking (user-side).
 * Delegates to DriverModel.subscribeToLocationUpdates.
 */
export function subscribeToLocationUpdates(bookingId, onLocationUpdate) {
  return DriverModel.subscribeToLocationUpdates(bookingId, onLocationUpdate);
}
