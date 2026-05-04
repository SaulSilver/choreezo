import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  notifyDaily: boolean;
  notifyWeekly: boolean;
  setNotifyDaily: (value: boolean) => void;
  setNotifyWeekly: (value: boolean) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  notifyDaily: true,
  notifyWeekly: true,
  setNotifyDaily: (notifyDaily) => {
    set({ notifyDaily });
    get().saveSettings();
  },
  setNotifyWeekly: (notifyWeekly) => {
    set({ notifyWeekly });
    get().saveSettings();
  },
  loadSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem('settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        set(parsed);
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  },
  saveSettings: async () => {
    try {
      const { notifyDaily, notifyWeekly } = get();
      await AsyncStorage.setItem('settings', JSON.stringify({ notifyDaily, notifyWeekly }));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  },
}));
