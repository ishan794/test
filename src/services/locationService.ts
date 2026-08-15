import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import supabase from '../config/supabase';
import { ensureLocationPermission } from '../utils/permissions';

const LOCATION_TASK = 'safeyou-location-heartbeat';

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  try {
    const { locations } = data as { locations: Location.LocationObject[] };
    const loc = locations[0];
    if (!loc) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) return;

    await supabase.from('users').update({
      last_known_lat: loc.coords.latitude,
      last_known_lng: loc.coords.longitude,
      last_known_accuracy: loc.coords.accuracy ?? null,
      last_active_at: new Date().toISOString(),
    }).eq('id', uid);
  } catch (err) {
    console.warn('Location heartbeat update failed', err);
  }
});

export async function startLocationHeartbeat() {
  const granted = await ensureLocationPermission();
  if (!granted) return; // user already saw the Settings prompt — don't throw

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== 'granted') {
    console.warn('Background permission denied — heartbeat will only run while app is open.');
  }

  const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (alreadyRunning) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 60000,     // 60 seconds — matches your spec exactly
    distanceInterval: 0,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'SafeYou-Campus is tracking your safety',
      notificationBody: 'Your location updates every 60s so trusted contacts can find you if needed.',
    },
  });
}

export async function stopLocationHeartbeat() {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
}