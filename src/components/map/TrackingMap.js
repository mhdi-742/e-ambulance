'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  APIProvider,
  Map,
  Marker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { CITY_CENTER, DEFAULT_ZOOM, BOOKING_STATUS } from '@/lib/constants';

/**
 * Validate that a coordinate object has finite, non-zero latitude and longitude.
 * Prevents default database (0, 0) coordinates from plotting in the Atlantic Ocean.
 */
export function isValidCoordinate(point) {
  if (!point) return false;
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    (lat !== 0 || lng !== 0)
  );
}

/**
 * Calculate Haversine distance in meters between two valid coordinates.
 */
function calculateDistanceMeters(a, b) {
  if (!isValidCoordinate(a) || !isValidCoordinate(b)) return Infinity;
  const R = 6371000; // Earth radius in meters
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const calc =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng *
      sinLng;
  return 2 * R * Math.atan2(Math.sqrt(calc), Math.sqrt(1 - calc));
}

/**
 * Smoothly updates map camera bounds when key coordinates change or when recenter is triggered.
 */
function MapBoundsUpdater({ points, autoFollow, recenterTrigger }) {
  const map = useMap();
  const lastSignatureRef = useRef('');

  useEffect(() => {
    if (!map || typeof window === 'undefined' || !window.google?.maps) return;
    if (!autoFollow && recenterTrigger === 0) return;

    const validPoints = points.filter(isValidCoordinate);
    if (validPoints.length === 0) return;

    // Round to ~11m precision so tiny GPS jitter doesn't constantly snap the camera
    const signature = `${recenterTrigger}:${validPoints
      .map((p) => `${Number(p.lat).toFixed(4)},${Number(p.lng).toFixed(4)}`)
      .join('|')}`;

    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    if (validPoints.length === 1) {
      map.panTo({ lat: Number(validPoints[0].lat), lng: Number(validPoints[0].lng) });
      if ((map.getZoom() || DEFAULT_ZOOM) < 14) {
        map.setZoom(15);
      }
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    validPoints.forEach((p) =>
      bounds.extend({ lat: Number(p.lat), lng: Number(p.lng) })
    );

    map.fitBounds(bounds, { top: 48, bottom: 48, left: 48, right: 48 });

    // Prevent excessive street-level zoom if two markers are right on top of each other
    const listener = window.google.maps.event.addListenerOnce(map, 'idle', () => {
      if (map.getZoom() > 16) {
        map.setZoom(16);
      }
    });

    return () => {
      if (listener && window.google?.maps?.event) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, [map, points, autoFollow, recenterTrigger]);

  return null;
}

/**
 * Persistent DirectionsRenderer that updates routes in-place without flickering
 * or resetting the user's map viewport on every GPS tick.
 */
function DirectionsPath({ origin, destination, onRouteMetrics }) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const rendererRef = useRef(null);
  const serviceRef = useRef(null);
  const lastRoutedOriginRef = useRef(null);
  const lastRoutedDestRef = useRef(null);
  const requestIdRef = useRef(0);

  // Initialize a single DirectionsRenderer instance per map mount
  useEffect(() => {
    if (!routesLib || !map) return;

    const renderer = new routesLib.DirectionsRenderer({
      map,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: '#dc2626',
        strokeWeight: 5,
        strokeOpacity: 0.85,
      },
    });

    rendererRef.current = renderer;
    serviceRef.current = new routesLib.DirectionsService();

    return () => {
      renderer.setMap(null);
      rendererRef.current = null;
      serviceRef.current = null;
    };
  }, [routesLib, map]);

  // Request new directions only when origin/destination move by >= 25 meters
  useEffect(() => {
    const renderer = rendererRef.current;
    const service = serviceRef.current;
    if (!renderer || !service) return;

    if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
      return;
    }

    const originMovedMeters = calculateDistanceMeters(lastRoutedOriginRef.current, origin);
    const destMovedMeters = calculateDistanceMeters(lastRoutedDestRef.current, destination);

    if (originMovedMeters < 25 && destMovedMeters < 25) {
      return;
    }

    lastRoutedOriginRef.current = { lat: Number(origin.lat), lng: Number(origin.lng) };
    lastRoutedDestRef.current = { lat: Number(destination.lat), lng: Number(destination.lng) };

    const currentRequestId = ++requestIdRef.current;

    service.route(
      {
        origin: { lat: Number(origin.lat), lng: Number(origin.lng) },
        destination: { lat: Number(destination.lat), lng: Number(destination.lng) },
        travelMode: window.google?.maps?.TravelMode?.DRIVING || 'DRIVING',
      },
      (result, status) => {
        if (currentRequestId !== requestIdRef.current) return;

        if (status === 'OK' && result && rendererRef.current) {
          rendererRef.current.setDirections(result);
          const leg = result.routes?.[0]?.legs?.[0];
          if (leg && onRouteMetrics) {
            onRouteMetrics({
              distanceText: leg.distance?.text || null,
              durationText: leg.duration?.text || null,
            });
          }
        }
      }
    );
  }, [origin, destination, routesLib, map, onRouteMetrics]);

  return null;
}

export default function TrackingMap({
  pickupLocation,
  driverLocation,
  hospitalLocation,
  height = '360px',
  status,
  onPickupSelect,
}) {
  const [apiError, setApiError] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [routeMetrics, setRouteMetrics] = useState(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const validPickup = useMemo(
    () =>
      isValidCoordinate(pickupLocation)
        ? {
            lat: Number(pickupLocation.lat),
            lng: Number(pickupLocation.lng),
            address: pickupLocation.address,
          }
        : null,
    [pickupLocation?.lat, pickupLocation?.lng, pickupLocation?.address]
  );

  const validDriver = useMemo(
    () =>
      isValidCoordinate(driverLocation)
        ? {
            lat: Number(driverLocation.lat),
            lng: Number(driverLocation.lng),
          }
        : null,
    [driverLocation?.lat, driverLocation?.lng]
  );

  const validHospital = useMemo(
    () =>
      isValidCoordinate(hospitalLocation)
        ? {
            lat: Number(hospitalLocation.lat),
            lng: Number(hospitalLocation.lng),
            name: hospitalLocation.name,
          }
        : null,
    [hospitalLocation?.lat, hospitalLocation?.lng, hospitalLocation?.name]
  );

  const pointsToBound = useMemo(() => {
    const list = [];
    if (validPickup) list.push(validPickup);
    if (validDriver) list.push(validDriver);
    if (validHospital) list.push(validHospital);
    return list;
  }, [validPickup, validDriver, validHospital]);

  // Determine active route origin and destination based on trip status and available coordinates
  const { routeOrigin, routeDestination, routeLabel } = useMemo(() => {
    if (
      (status === BOOKING_STATUS.ACCEPTED || status === BOOKING_STATUS.EN_ROUTE_PICKUP) &&
      validDriver &&
      validPickup
    ) {
      return {
        routeOrigin: validDriver,
        routeDestination: validPickup,
        routeLabel: 'Driver → Pickup',
      };
    }

    if (
      (status === BOOKING_STATUS.ARRIVED_PICKUP || status === BOOKING_STATUS.EN_ROUTE_HOSPITAL) &&
      (validDriver || validPickup) &&
      validHospital
    ) {
      return {
        routeOrigin: validDriver || validPickup,
        routeDestination: validHospital,
        routeLabel: 'Ambulance → Hospital',
      };
    }

    // Fallback (pending booking preview or before driver GPS lock): Pickup -> Hospital
    return {
      routeOrigin: validDriver || validPickup || null,
      routeDestination: validHospital || validPickup || null,
      routeLabel: validPickup && validHospital ? 'Pickup → Hospital' : null,
    };
  }, [status, validDriver, validPickup, validHospital]);

  const externalMapsUrl = useMemo(() => {
    const dest =
      status === BOOKING_STATUS.ACCEPTED || status === BOOKING_STATUS.EN_ROUTE_PICKUP
        ? validPickup || validHospital
        : validHospital || validPickup;

    if (!dest) return 'https://www.google.com/maps';
    if (validDriver) {
      return `https://www.google.com/maps/dir/?api=1&origin=${validDriver.lat},${validDriver.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`;
    }
    if (validPickup && validHospital && dest === validHospital) {
      return `https://www.google.com/maps/dir/?api=1&origin=${validPickup.lat},${validPickup.lng}&destination=${validHospital.lat},${validHospital.lng}&travelmode=driving`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${dest.lat},${dest.lng}`;
  }, [status, validDriver, validPickup, validHospital]);

  const defaultCenter = useMemo(() => {
    if (validDriver) return validDriver;
    if (validPickup) return validPickup;
    if (validHospital) return validHospital;
    return CITY_CENTER;
  }, [validDriver, validPickup, validHospital]);

  const handleRecenter = useCallback(() => {
    setAutoFollow(true);
    setRecenterTrigger((prev) => prev + 1);
  }, []);

  const handleMapClick = useCallback(
    (event) => {
      if (!onPickupSelect) return;
      const latLng = event?.detail?.latLng;
      if (latLng && typeof latLng.lat === 'number' && typeof latLng.lng === 'number') {
        onPickupSelect({ lat: latLng.lat, lng: latLng.lng });
      }
    },
    [onPickupSelect]
  );

  if (!apiKey || apiError) {
    return (
      <div
        style={{ height }}
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col items-center justify-center text-center gap-3"
      >
        <div className="w-10 h-10 rounded-lg border border-zinc-700 bg-zinc-950 flex items-center justify-center text-xs font-bold text-red-500">
          GPS
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Live Telemetry Coordinates</p>
          <p className="text-xs text-zinc-400 mt-1">
            {validDriver
              ? `Ambulance GPS: ${validDriver.lat.toFixed(5)}, ${validDriver.lng.toFixed(5)}`
              : 'Waiting for ambulance GPS signal...'}
          </p>
          {validPickup && (
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Pickup Point: {validPickup.lat.toFixed(5)}, {validPickup.lng.toFixed(5)}
            </p>
          )}
          {validHospital && (
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Hospital: {validHospital.name || `${validHospital.lat.toFixed(4)}, ${validHospital.lng.toFixed(4)}`}
            </p>
          )}
        </div>
        <a
          href={externalMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors mt-2"
        >
          Open Route in Google Maps ↗
        </a>
      </div>
    );
  }

  return (
    <div
      style={{ height }}
      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden relative"
    >
      <APIProvider apiKey={apiKey} onError={() => setApiError(true)}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI={false}
          onDragstart={() => setAutoFollow(false)}
          onClick={handleMapClick}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Pickup Marker */}
          {validPickup && (
            <Marker
              position={validPickup}
              title={`Pickup: ${validPickup.address || 'Patient Location'}`}
              label="P"
            />
          )}

          {/* Live Ambulance Driver Marker */}
          {validDriver && (
            <Marker
              position={validDriver}
              title="Ambulance (Live GPS)"
              label="🚑"
            />
          )}

          {/* Destination Hospital Marker */}
          {validHospital && (
            <Marker
              position={validHospital}
              title={validHospital.name || 'Hospital'}
              label="H"
            />
          )}

          {/* Auto-adjust camera bounds */}
          <MapBoundsUpdater
            points={pointsToBound}
            autoFollow={autoFollow}
            recenterTrigger={recenterTrigger}
          />

          {/* Live Directions Polyline */}
          {routeOrigin && routeDestination && (
            <DirectionsPath
              origin={routeOrigin}
              destination={routeDestination}
              onRouteMetrics={setRouteMetrics}
            />
          )}
        </Map>
      </APIProvider>

      {/* Top-left Live Route & Telemetry HUD */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
        {validDriver && (
          <div className="px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-zinc-950/90 text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5 shadow">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live GPS Active</span>
          </div>
        )}
        {routeMetrics?.distanceText && routeMetrics?.durationText && (
          <div className="px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-950/90 text-[11px] font-semibold text-zinc-200 shadow">
            {routeLabel ? `${routeLabel}: ` : ''}
            <span className="text-white font-bold">{routeMetrics.durationText}</span> (
            {routeMetrics.distanceText})
          </div>
        )}
      </div>

      {/* Bottom controls: Recenter + External Route */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
        {!autoFollow && (
          <button
            type="button"
            onClick={handleRecenter}
            className="px-3 py-1.5 rounded-lg border border-red-500/50 bg-zinc-950/90 text-[11px] font-semibold text-red-400 hover:text-white hover:bg-red-600 transition-colors cursor-pointer shadow"
          >
            Recenter Map
          </button>
        )}
        <a
          href={externalMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950/90 text-[11px] font-semibold text-zinc-300 hover:text-white transition-colors shadow"
        >
          External Route ↗
        </a>
      </div>
    </div>
  );
}
