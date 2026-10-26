'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  APIProvider,
  Map,
  Marker,
  useMap,
} from '@vis.gl/react-google-maps';
import { CITY_CENTER, DEFAULT_ZOOM, BOOKING_STATUS } from '@/lib/constants';
import {
  isValidLatLng,
  getDistanceMeters,
  fetchRoadRoute,
  resolveInitialDriverCoordinate,
} from '@/models/DriverModel';

/**
 * Validate that a coordinate object has finite, non-zero latitude and longitude.
 */
export function isValidCoordinate(point) {
  if (!point) return false;
  return isValidLatLng(point.lat, point.lng);
}

/**
 * Custom SVG Data-URI Icons for Uber-style Map Markers (Ambulance, Pickup, Hospital Drop)
 */
const MARKER_ICONS = {
  driver:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="20" fill="#2563eb" fill-opacity="0.22"/>
        <circle cx="22" cy="22" r="14" fill="#1d4ed8" stroke="#ffffff" stroke-width="3"/>
        <path d="M16 22h12M22 16v12" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `),
  pickup:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" fill="#10b981" fill-opacity="0.22"/>
        <circle cx="20" cy="20" r="11" fill="#059669" stroke="#ffffff" stroke-width="3"/>
        <circle cx="20" cy="20" r="4" fill="#ffffff"/>
      </svg>
    `),
  hospital:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="19" fill="#ef4444" fill-opacity="0.22"/>
        <rect x="8" y="8" width="26" height="26" rx="7" fill="#dc2626" stroke="#ffffff" stroke-width="2.5"/>
        <path d="M16 15v12M26 15v12M16 21h10" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round"/>
      </svg>
    `),
};

/**
 * Smoothly updates map camera bounds so Driver, Pickup, and Drop are all visible.
 */
function MapBoundsUpdater({ points, autoFollow, recenterTrigger }) {
  const map = useMap();
  const lastSignatureRef = useRef('');

  useEffect(() => {
    if (!map || typeof window === 'undefined' || !window.google?.maps) return;
    if (!autoFollow && recenterTrigger === 0) return;

    const validPoints = points.filter(isValidCoordinate);
    if (validPoints.length === 0) return;

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

    map.fitBounds(bounds, { top: 64, bottom: 56, left: 56, right: 56 });

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
 * Uber-Style Dual-Leg Navigation Polyline Layer:
 * - Leg 1 (Blue): Driver Ambulance -> Patient Pickup
 * - Leg 2 (Red): Patient Pickup (or Ambulance) -> Hospital Drop
 * Uses OSRM real road geometry (with Google Maps Polyline rendering) so the road path
 * is guaranteed to render even if Google Cloud's Directions API is not enabled.
 */
function UberNavigationRoutes({
  driverLocation,
  pickupLocation,
  hospitalLocation,
  status,
  onMetricsUpdate,
}) {
  const map = useMap();
  const pickupPolylineRef = useRef(null);
  const hospitalPolylineRef = useRef(null);
  const lastDriverCoordRef = useRef(null);
  const lastPickupCoordRef = useRef(null);
  const lastHospitalCoordRef = useRef(null);
  const lastStatusRef = useRef(null);

  // Create persistent Google Maps Polylines once when map is ready
  useEffect(() => {
    if (!map || typeof window === 'undefined' || !window.google?.maps) return;

    const arrowSymbol = {
      path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 2.5,
      strokeColor: '#ffffff',
      fillColor: '#ffffff',
      fillOpacity: 1,
    };

    // Leg 1: Driver -> Pickup (Uber Blue navigation line)
    const pickupLine = new window.google.maps.Polyline({
      map,
      geodesic: true,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.95,
      strokeWeight: 5,
      zIndex: 15,
      icons: [
        {
          icon: arrowSymbol,
          offset: '50%',
          repeat: '120px',
        },
      ],
    });

    // Leg 2: Pickup / Driver -> Hospital Drop (Emergency Red navigation line)
    const hospitalLine = new window.google.maps.Polyline({
      map,
      geodesic: true,
      strokeColor: '#ef4444',
      strokeOpacity: 0.9,
      strokeWeight: 5,
      zIndex: 10,
      icons: [
        {
          icon: arrowSymbol,
          offset: '50%',
          repeat: '120px',
        },
      ],
    });

    pickupPolylineRef.current = pickupLine;
    hospitalPolylineRef.current = hospitalLine;

    return () => {
      pickupLine.setMap(null);
      hospitalLine.setMap(null);
      pickupPolylineRef.current = null;
      hospitalPolylineRef.current = null;
    };
  }, [map]);

  // Update road paths whenever coordinates or trip status change
  useEffect(() => {
    if (!map || !pickupPolylineRef.current || !hospitalPolylineRef.current) return;

    let cancelled = false;

    const isHeadingToHospital =
      status === BOOKING_STATUS.ARRIVED_PICKUP ||
      status === BOOKING_STATUS.EN_ROUTE_HOSPITAL;
    const isTripFinished =
      status === BOOKING_STATUS.COMPLETED ||
      status === BOOKING_STATUS.CANCELLED;

    const driverMoved =
      getDistanceMeters(lastDriverCoordRef.current, driverLocation) >= 15;
    const pickupMoved =
      getDistanceMeters(lastPickupCoordRef.current, pickupLocation) >= 10;
    const hospitalMoved =
      getDistanceMeters(lastHospitalCoordRef.current, hospitalLocation) >= 10;
    const statusChanged = lastStatusRef.current !== status;

    if (!driverMoved && !pickupMoved && !hospitalMoved && !statusChanged) {
      return;
    }

    lastDriverCoordRef.current = driverLocation ? { ...driverLocation } : null;
    lastPickupCoordRef.current = pickupLocation ? { ...pickupLocation } : null;
    lastHospitalCoordRef.current = hospitalLocation ? { ...hospitalLocation } : null;
    lastStatusRef.current = status;

    const updateRoutes = async () => {
      let approachMetrics = null;
      let hospitalMetrics = null;

      // 1. Leg 1: Driver -> Pickup (shown before patient is picked up)
      if (!isHeadingToHospital && !isTripFinished && driverLocation && pickupLocation) {
        const approachRoute = await fetchRoadRoute(driverLocation, pickupLocation);
        if (cancelled || !pickupPolylineRef.current) return;

        if (approachRoute?.path?.length) {
          pickupPolylineRef.current.setPath(approachRoute.path);
          pickupPolylineRef.current.setVisible(true);
          approachMetrics = {
            distanceText: approachRoute.distanceText,
            durationText: approachRoute.durationText,
          };
        }
      } else if (pickupPolylineRef.current) {
        pickupPolylineRef.current.setPath([]);
        pickupPolylineRef.current.setVisible(false);
      }

      // 2. Leg 2: Pickup (or Driver if already picked up) -> Hospital Drop
      const hospitalOrigin = isHeadingToHospital
        ? driverLocation || pickupLocation
        : pickupLocation || driverLocation;

      if (hospitalOrigin && hospitalLocation) {
        const dropRoute = await fetchRoadRoute(hospitalOrigin, hospitalLocation);
        if (cancelled || !hospitalPolylineRef.current) return;

        if (dropRoute?.path?.length) {
          hospitalPolylineRef.current.setPath(dropRoute.path);
          hospitalPolylineRef.current.setVisible(true);
          hospitalMetrics = {
            distanceText: dropRoute.distanceText,
            durationText: dropRoute.durationText,
          };
        }
      } else if (hospitalPolylineRef.current) {
        hospitalPolylineRef.current.setPath([]);
        hospitalPolylineRef.current.setVisible(false);
      }

      if (!cancelled && onMetricsUpdate) {
        onMetricsUpdate({
          approach: approachMetrics,
          hospital: hospitalMetrics,
        });
      }
    };

    updateRoutes();

    return () => {
      cancelled = true;
    };
  }, [map, driverLocation, pickupLocation, hospitalLocation, status, onMetricsUpdate]);

  return null;
}

export default function TrackingMap({
  pickupLocation,
  driverLocation,
  hospitalLocation,
  height = '380px',
  status,
  onPickupSelect,
}) {
  const [apiError, setApiError] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [routeMetrics, setRouteMetrics] = useState({ approach: null, hospital: null });

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

  // Ensure the Driver marker is ALWAYS shown on active trips (even before initial GPS lock
  // or when testing Driver & Patient on the same computer where coordinates would overlap)
  const validDriver = useMemo(() => {
    if (isValidCoordinate(driverLocation)) {
      if (
        validPickup &&
        status !== BOOKING_STATUS.ARRIVED_PICKUP &&
        getDistanceMeters(driverLocation, validPickup) < 35
      ) {
        return resolveInitialDriverCoordinate(driverLocation, validPickup);
      }
      return {
        lat: Number(driverLocation.lat),
        lng: Number(driverLocation.lng),
      };
    }

    // If trip is active (or previewing dispatch) and driver GPS hasn't arrived yet,
    // display the nearest dispatch unit position so all 3 points (Driver, Pickup, Drop) are visible
    if (
      validPickup &&
      status &&
      status !== BOOKING_STATUS.COMPLETED &&
      status !== BOOKING_STATUS.CANCELLED
    ) {
      return resolveInitialDriverCoordinate(null, validPickup);
    }

    return null;
  }, [driverLocation, validPickup, status]);

  const pointsToBound = useMemo(() => {
    const list = [];
    if (validDriver) list.push(validDriver);
    if (validPickup) list.push(validPickup);
    if (validHospital) list.push(validHospital);
    return list;
  }, [validDriver, validPickup, validHospital]);

  const externalMapsUrl = useMemo(() => {
    if (validDriver && validPickup && validHospital) {
      return `https://www.google.com/maps/dir/?api=1&origin=${validDriver.lat},${validDriver.lng}&waypoints=${validPickup.lat},${validPickup.lng}&destination=${validHospital.lat},${validHospital.lng}&travelmode=driving`;
    }
    if (validPickup && validHospital) {
      return `https://www.google.com/maps/dir/?api=1&origin=${validPickup.lat},${validPickup.lng}&destination=${validHospital.lat},${validHospital.lng}&travelmode=driving`;
    }
    const dest = validHospital || validPickup;
    if (!dest) return 'https://www.google.com/maps';
    return `https://www.google.com/maps/search/?api=1&query=${dest.lat},${dest.lng}`;
  }, [validDriver, validPickup, validHospital]);

  const defaultCenter = useMemo(() => {
    if (validPickup) return validPickup;
    if (validDriver) return validDriver;
    if (validHospital) return validHospital;
    return CITY_CENTER;
  }, [validPickup, validDriver, validHospital]);

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
          {validDriver && (
            <p className="text-xs text-blue-400 font-mono mt-1">
              🚑 Ambulance: {validDriver.lat.toFixed(5)}, {validDriver.lng.toFixed(5)}
            </p>
          )}
          {validPickup && (
            <p className="text-xs text-emerald-400 font-mono mt-0.5">
              📍 Pickup: {validPickup.lat.toFixed(5)}, {validPickup.lng.toFixed(5)}
            </p>
          )}
          {validHospital && (
            <p className="text-xs text-red-400 font-mono mt-0.5">
              🏥 Drop ({validHospital.name || 'Hospital'}): {validHospital.lat.toFixed(4)},{' '}
              {validHospital.lng.toFixed(4)}
            </p>
          )}
        </div>
        <a
          href={externalMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors mt-2"
        >
          Open Full Route in Google Maps ↗
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
          {/* 1. Live Ambulance Driver Marker */}
          {validDriver && (
            <Marker
              position={validDriver}
              icon={MARKER_ICONS.driver}
              zIndex={30}
              title={`Ambulance (${validDriver.lat.toFixed(4)}, ${validDriver.lng.toFixed(4)})`}
            />
          )}

          {/* 2. Patient Pickup Marker */}
          {validPickup && (
            <Marker
              position={validPickup}
              icon={MARKER_ICONS.pickup}
              zIndex={20}
              title={`Pickup: ${validPickup.address || 'Patient Location'}`}
            />
          )}

          {/* 3. Destination Hospital (Drop) Marker */}
          {validHospital && (
            <Marker
              position={validHospital}
              icon={MARKER_ICONS.hospital}
              zIndex={20}
              title={`Drop: ${validHospital.name || 'Hospital'}`}
            />
          )}

          {/* Auto-adjust camera bounds to keep Driver, Pickup & Hospital Drop in view */}
          <MapBoundsUpdater
            points={pointsToBound}
            autoFollow={autoFollow}
            recenterTrigger={recenterTrigger}
          />

          {/* Dual-Leg Uber Navigation Polylines */}
          <UberNavigationRoutes
            driverLocation={validDriver}
            pickupLocation={validPickup}
            hospitalLocation={validHospital}
            status={status}
            onMetricsUpdate={setRouteMetrics}
          />
        </Map>
      </APIProvider>

      {/* Top-Left Live Uber Navigation HUD (ETA & Distance for Pickup + Drop) */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 pointer-events-none max-w-[85%]">
        {routeMetrics.approach && (
          <div className="px-2.5 py-1 rounded-lg border border-blue-500/40 bg-zinc-950/90 text-[11px] font-medium text-blue-300 flex items-center gap-1.5 shadow">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <span>
              Driver → Pickup:{' '}
              <strong className="text-white">{routeMetrics.approach.durationText}</strong> (
              {routeMetrics.approach.distanceText})
            </span>
          </div>
        )}

        {routeMetrics.hospital && (
          <div className="px-2.5 py-1 rounded-lg border border-red-500/40 bg-zinc-950/90 text-[11px] font-medium text-red-300 flex items-center gap-1.5 shadow">
            <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
            <span>
              Pickup → Hospital Drop:{' '}
              <strong className="text-white">{routeMetrics.hospital.durationText}</strong> (
              {routeMetrics.hospital.distanceText})
            </span>
          </div>
        )}
      </div>

      {/* Bottom-Left Pin Legend */}
      <div className="absolute bottom-3 left-3 z-10 hidden sm:flex items-center gap-2.5 px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-950/90 text-[10px] font-semibold text-zinc-300 pointer-events-none shadow">
        {validDriver && (
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />
            Ambulance
          </span>
        )}
        {validPickup && (
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
            Pickup
          </span>
        )}
        {validHospital && (
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
            Hospital Drop
          </span>
        )}
      </div>

      {/* Bottom-Right Controls: Recenter + External Turn-by-Turn Navigation */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
        {!autoFollow && (
          <button
            type="button"
            onClick={handleRecenter}
            className="px-3 py-1.5 rounded-lg border border-blue-500/50 bg-zinc-950/90 text-[11px] font-semibold text-blue-400 hover:text-white hover:bg-blue-600 transition-colors cursor-pointer shadow"
          >
            Fit All Pins
          </button>
        )}
        <a
          href={externalMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950/90 text-[11px] font-semibold text-zinc-300 hover:text-white transition-colors shadow"
        >
          Turn-by-Turn Nav ↗
        </a>
      </div>
    </div>
  );
}
