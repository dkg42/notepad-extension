/**
 * @module ThemeProvider
 * @description Context provider that applies a light/dark theme to the document root via a data attribute and exposes a toggle; syncs when the initialTheme prop changes from storage.
 * @dependencies (none from src/ — self-contained React context)
 * @public ThemeProvider, ThemeContext
 */
import React, { createContext, useEffect, useState } from 'react';

interface ThemeContextValue {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

export function ThemeProvider({ children, initialTheme, onThemeChange }: ThemeProviderProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Sync when initialTheme prop changes (e.g. loaded from storage)
  useEffect(() => {
    setTheme(initialTheme);
  }, [initialTheme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      onThemeChange?.(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
