// smsService.ts — emergency SMS fallback. When the backend is unreachable
// (no internet), the app can still alert the selected trusted contact through
// the device's own SMS app via expo-sms. Uses the OS messaging UI so the user
// stays in control of actually sending the message.

import * as SMS from 'expo-sms';

export interface SosSmsContent {
  name: string;
  incidentType: string;
  lat: number;
  lng: number;
}

export function buildSosMessage({ name, incidentType, lat, lng }: SosSmsContent): string {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const mapLink = `https://maps.google.com/?q=${lat},${lng}`;
  return [
    `SOS Alert: ${name || 'A student'} may need immediate assistance.`,
    `Incident Type: ${incidentType}`,
    `Time: ${time}`,
    `Location: ${lat}, ${lng}`,
    `Map: ${mapLink}`,
    `Please contact the user or campus security if necessary.`,
  ].join('\n');
}

export async function smsAvailable(): Promise<boolean> {
  try {
    return await SMS.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Returns true if the user sent/scheduled the message (false if unavailable or cancelled). */
export async function sendSosSms(phone: string, content: SosSmsContent): Promise<boolean> {
  const available = await smsAvailable();
  if (!available) return false;
  const { result } = await SMS.sendSMSAsync([phone], buildSosMessage(content));
  return result === 'sent' || result === 'unknown'; // Android always reports 'unknown'
}
