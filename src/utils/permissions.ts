import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';

/**
 * Requests foreground location permission. If the user already permanently
 * denied it (iOS won't show the native prompt again after "Don't Allow"),
 * this shows an alert with a button that jumps straight to the app's
 * Settings page instead of failing silently.
 * Returns true only if permission is actually granted.
 */
export async function ensureLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') return true;

  if (current.canAskAgain) {
    const requested = await Location.requestForegroundPermissionsAsync();
    if (requested.status === 'granted') return true;
  }

  Alert.alert(
    'Location permission needed',
    'SafeYou-Campus needs location access for SOS, Walk With Me, and incident reports to work. Enable it in Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  );
  return false;
}