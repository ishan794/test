import { create } from 'zustand';

type AppState = {
  activeJourneyId: string | null;
  setActiveJourneyId: (id: string | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeJourneyId: null,
  setActiveJourneyId: (id) => set({ activeJourneyId: id }),
}));
