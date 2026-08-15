import React, { useEffect } from 'react';
import supabase from '../config/supabase';
import { useAuthStore } from '../store/useAuthStore';
import SplashScreen from '../screens/splash/SplashScreen';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import { startLocationHeartbeat } from '../services/locationService';
import { registerPushToken } from '../services/notificationService';

export default function RootNavigator() {
  const { user, initializing, hasOnboarded, setUser, setInitializing, setHasOnboarded } = useAuthStore();

  useEffect(() => {
    // Fires immediately on app start with the restored session (if any) —
    // this is what lets the user skip the login screen on every future open.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        const { data } = await supabase.from('users').select('has_onboarded').eq('id', session.user.id).maybeSingle();
        setHasOnboarded(data?.has_onboarded ?? false);

        try {
          await startLocationHeartbeat();
        } catch (err) {
          console.warn('Location heartbeat could not start:', err);
        }
        try {
          await registerPushToken();
        } catch (err) {
          console.warn('Push token registration failed:', err);
        }
      }

      setInitializing(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (initializing) return <SplashScreen />;
  if (!user) return <AuthNavigator />;
  if (!hasOnboarded) return <OnboardingScreen />;
  return <MainTabNavigator />;
}