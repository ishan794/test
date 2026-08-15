import { create } from 'zustand';
import { User } from '@supabase/supabase-js';

type AuthState = {
  user: User | null;
  initializing: boolean;      // true while Supabase checks for a stored session
  hasOnboarded: boolean;      // true once the user has been through onboarding
  setUser: (user: User | null) => void;
  setInitializing: (v: boolean) => void;
  setHasOnboarded: (v: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initializing: true,
  hasOnboarded: false,
  setUser: (user) => set({ user }),
  setInitializing: (v) => set({ initializing: v }),
  setHasOnboarded: (v) => set({ hasOnboarded: v }),
}));