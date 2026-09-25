'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  APIProvider,
  Map,
  Marker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { CITY_CENTER, DEFAULT_ZOOM } from '@/lib/constants';

function MapBoundsUpdater({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof window === 'undefined' || !window.google?.maps) return;

    const validPoints = points.filter(
      (p) => p && typeof p.lat === 'number' && typeof p.lng === 'number'
    );

    if (validPoints.length === 0) return;

    if (validPoints.length === 1) {
      map.setCenter(validPoints[0]);
      map.setZoom(14);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    validPoints.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
  }, [map, points]);

  return null;
}

function DirectionsPath({ origin, destination }) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const [directionsRenderer, setDirectionsRenderer] = useState(null);

  useEffect(() => {
    if (!routesLib || !map) return;

    const renderer = new routesLib.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#dc2626',
        strokeWeight: 4,
        strokeOpacity: 0.8,
      },
    });

    setDirectionsRenderer(renderer);

    return () => {
      renderer.setMap(null);
    };
  }, [routesLib, map]);

  useEffect(() => {
    if (!routesLib || !directionsRenderer || !origin || !destination) return;

    const directionsService = new routesLib.DirectionsService();

    directionsService.route(
      {
        origin,
        destination,
        travelMode: window.google?.maps?.TravelMode?.DRIVING || 'DRIVING',
      },
      (result, status) => {
        if (status === 'OK' && result) {
          directionsRenderer.setDirections(result);
        }
      }
    );
  }, [routesLib, directionsRenderer, origin, destination]);

  return null;
}

export default function TrackingMap({
  pickupLocation,
  driverLocation,
  hospitalLocation,
  height = '360px',
  status,
}) {
  const [apiError, setApiError] = useState(false);
  const rawKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const apiKey = rawKey.startsWith('YAIza') ? rawKey.slice(1) : rawKey;

  const pointsToBound = useMemo(() => {
    const list = [];
    if (pickupLocation?.lat && pickupLocation?.lng) list.push(pickupLocation);
    if (driverLocation?.lat && driverLocation?.lng) list.push(driverLocation);
    if (hospitalLocation?.lat && hospitalLocation?.lng) list.push(hospitalLocation);
    return list;
  }, [pickupLocation, driverLocation, hospitalLocation]);

  // Determine route origin and destination based on trip stage
  const { routeOrigin, routeDestination } = useMemo(() => {
    // If en route to pickup: driver -> pickup
    if (status === 'en_route_pickup' || status === 'accepted') {
      return {
        routeOrigin: driverLocation || null,
        routeDestination: pickupLocation || null,
      };
    }
    // If heading to hospital: pickup (or driver) -> hospital
    if (status === 'en_route_hospital' || status === 'arrived_pickup') {
      return {
        routeOrigin: driverLocation || pickupLocation || null,
        routeDestination: hospitalLocation || null,
      };
    }
    // Default fallback
    return {
      routeOrigin: driverLocation || pickupLocation || null,
      routeDestination: hospitalLocation || null,
    };
  }, [status, driverLocation, pickupLocation, hospitalLocation]);

  // External Google Maps directions URL for fallback or direct navigation
  const externalMapsUrl = useMemo(() => {
    const dest = hospitalLocation || pickupLocation;
    if (!dest) return 'https://www.google.com/maps';
    if (driverLocation) {
      return `https://www.google.com/maps/dir/?api=1&origin=${driverLocation.lat},${driverLocation.lng}&destination=${dest.lat},${dest.lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${dest.lat},${dest.lng}`;
  }, [driverLocation, pickupLocation, hospitalLocation]);

  const defaultCenter = useMemo(() => {
    if (driverLocation?.lat) return driverLocation;
    if (pickupLocation?.lat) return pickupLocation;
    if (hospitalLocation?.lat) return hospitalLocation;
    return CITY_CENTER;
  }, [driverLocation, pickupLocation, hospitalLocation]);

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
            {driverLocation
              ? `Driver Location: ${driverLocation.lat.toFixed(4)}, ${driverLocation.lng.toFixed(4)}`
              : 'Waiting for driver GPS signal...'}
          </p>
          {pickupLocation && (
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Pickup Point: {pickupLocation.lat.toFixed(4)}, {pickupLocation.lng.toFixed(4)}
            </p>
          )}
          {hospitalLocation && (
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Hospital: {hospitalLocation.name || `${hospitalLocation.lat.toFixed(4)}, ${hospitalLocation.lng.toFixed(4)}`}
            </p>
          )}
        </div>
        <a
          href={externalMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors mt-2"
        >
          Open in Google Maps ↗
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
          style={{ width: '100%', height: '100%' }}
        >
          {/* Pickup Marker */}
          {pickupLocation?.lat && pickupLocation?.lng && (
            <Marker
              position={pickupLocation}
              title={`Pickup: ${pickupLocation.address || 'Patient Location'}`}
              label="P"
            />
          )}

          {/* Driver Marker */}
          {driverLocation?.lat && driverLocation?.lng && (
            <Marker
              position={driverLocation}
              title="Ambulance (Driver)"
              label="🚑"
            />
          )}

          {/* Hospital Marker */}
          {hospitalLocation?.lat && hospitalLocation?.lng && (
            <Marker
              position={hospitalLocation}
              title={hospitalLocation.name || 'Hospital'}
              label="H"
            />
          )}

          {/* Auto adjust bounds */}
          <MapBoundsUpdater points={pointsToBound} />

          {/* Draw directions route if available */}
          {routeOrigin && routeDestination && (
            <DirectionsPath origin={routeOrigin} destination={routeDestination} />
          )}
        </Map>
      </APIProvider>

      {/* Clean external map shortcut button */}
      <div className="absolute bottom-3 right-3 z-10">
        <a
          href={externalMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950/90 text-[11px] font-semibold text-zinc-300 hover:text-white transition-colors"
        >
          External Route ↗
        </a>
      </div>
    </div>
  );
}
