import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPreferences {
  layoutDensity: 'compact' | 'comfortable';
  defaultCurrency: string;
  enableSoundEffects: boolean;
  sidebarPosition: 'left' | 'right';
  defaultLandingPage: string;
  dateFormat: string;
}

interface PreferenceState {
  preferences: UserPreferences;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
}

const defaultPreferences: UserPreferences = {
  layoutDensity: 'comfortable',
  defaultCurrency: 'USD',
  enableSoundEffects: false,
  sidebarPosition: 'left',
  defaultLandingPage: '/overview',
  dateFormat: 'yyyy-MM-dd',
};

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      updatePreferences: (prefs) =>
        set((state) => ({ preferences: { ...state.preferences, ...prefs } })),
      resetPreferences: () => set({ preferences: defaultPreferences }),
    }),
    {
      name: 'cfo-preference-store',
    }
  )
);
