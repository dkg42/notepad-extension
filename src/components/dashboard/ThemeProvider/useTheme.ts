/**
 * @module useTheme
 * @description Convenience hook that reads the ThemeContext and throws a descriptive error when used outside a ThemeProvider. Provides a single import point for all components that need the current theme value.
 * @dependencies ./ThemeProvider
 * @public useTheme
 */
import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
