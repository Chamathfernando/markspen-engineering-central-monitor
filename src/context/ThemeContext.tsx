import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeMode } from '../types';
import { api } from '../services/api';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => Promise<void>;
  isAppearanceModalOpen: boolean;
  openAppearanceModal: () => void;
  closeAppearanceModal: () => void;
  isSaving: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'markspen_theme_mode';

function applyThemeToDOM(mode: ThemeMode) {
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);

  if (mode === 'dark') {
    root.classList.add('dark');
    root.classList.remove('colorful');
  } else if (mode === 'colorful') {
    root.classList.add('colorful');
    root.classList.remove('dark');
  } else {
    root.classList.remove('dark', 'colorful');
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize from localStorage or default 'light'
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const cached = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
    if (cached === 'light' || cached === 'dark' || cached === 'colorful') {
      applyThemeToDOM(cached);
      return cached;
    }
    return 'light';
  });

  const [isAppearanceModalOpen, setIsAppearanceModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync settings from server JSON file on startup
  useEffect(() => {
    let isMounted = true;
    api.getSettings()
      .then(settings => {
        if (!isMounted) return;
        if (settings && settings.theme) {
          setThemeState(settings.theme);
          applyThemeToDOM(settings.theme);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, settings.theme);
          } catch {}
        }
      })
      .catch(err => {
        console.warn('[Theme] Could not load settings from backend:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setTheme = async (mode: ThemeMode) => {
    setThemeState(mode);
    applyThemeToDOM(mode);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, mode);
    } catch {}

    setIsSaving(true);
    try {
      await api.updateSettings({ theme: mode });
    } catch (err) {
      console.error('[Theme] Failed to persist settings to settings.json:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const openAppearanceModal = () => setIsAppearanceModalOpen(true);
  const closeAppearanceModal = () => setIsAppearanceModalOpen(false);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        isAppearanceModalOpen,
        openAppearanceModal,
        closeAppearanceModal,
        isSaving
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
