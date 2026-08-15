// geocodingService.ts — resolves a destination name to real coordinates and
// estimates a walking ETA, replacing the previous fabricated "loc + 0.01°" data.
// Uses OpenStreetMap's Nominatim (no API key). Nominatim's public instance has a
// usage policy (max 1 req/sec, attribution required); for production traffic,
// point GEOCODING_ENDPOINT at a self-hosted Nominatim or a paid geocoder.

import { distanceMeters } from '../utils/distance';

const GEOCODING_ENDPOINT =
  process.env.EXPO_PUBLIC_GEOCODING_ENDPOINT ??
  'https://nominatim.openstreetmap.org/search';

// ~5 km/h average walking speed.
const WALK_SPEED_MPS = 1.4;

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export async function geocodeDestination(query: string): Promise<GeocodeResult> {
  const q = query.trim();
  if (!q) throw new Error('Enter a destination first.');

  const url = `${GEOCODING_ENDPOINT}?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'SafeYou-Campus/1.0 (campus safety app)',
      'Accept-Language': 'en',
    },
  });
  if (!res.ok) throw new Error('Could not reach the map service. Check your connection.');

  const results: Array<{ lat: string; lon: string; display_name: string }> = await res.json();
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`Couldn't find "${q}". Try a nearby landmark or street.`);
  }

  const r = results[0];
  return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), displayName: r.display_name };
}

export function estimateEtaMinutes(
  start: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): number {
  const meters = distanceMeters(start, dest);
  const seconds = meters / WALK_SPEED_MPS;
  return Math.max(1, Math.round(seconds / 60));
}
