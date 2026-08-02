import { createContext, createElement, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';

export const themeTokens = {
  colors: {
    bgPrimary: '#0B0C0F',
    bgSecondary: '#15171C',
    bgTertiary: '#1E2028',
    accentPrimary: '#E8A93F',
    accentSecondary: '#D9534F',
    accentTertiary: '#4ADE80',
    textPrimary: '#F3F4F6',
    textSecondary: '#9CA3AF',
    textInverse: '#0B0C0F',
    borderSubtle: 'rgba(255,255,255,0.06)',
    borderGlow: 'rgba(232,169,63,0.15)'
  },
  radii: {
    card: '20px',
    button: '14px',
    input: '12px',
    modal: '24px',
    pill: '999px'
  },
  motion: {
    ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
    fast: 0.25,
    normal: 0.4,
    slow: 0.6
  },
  shadows: {
    elevated: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
    glow: '0 0 40px rgba(232,169,63,0.12)'
  }
};

const ThemeContext = createContext(themeTokens);

export function ThemeProvider({ children }) {
  const value = useMemo(() => themeTokens, []);
  return createElement(ThemeContext.Provider, { value }, children);
}

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export function useTheme() {
  return useContext(ThemeContext);
}
