import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import supabase from '../config/supabase';

export async function registerPushToken() {
  if (!Device.isDevice) return; // push tokens require a real device, not a simulator

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (uid) {
    const { error } = await supabase.from('users').update({ push_token: tokenData.data }).eq('id', uid);
    if (error) console.warn('Failed to persist push token', error.message);
  }
}