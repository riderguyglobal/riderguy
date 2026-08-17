import type { Config } from 'tailwindcss';
import riderguyPreset from '@riderguy/config/tailwind';

const config: Config = {
  presets: [riderguyPreset],
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Page background — usable for bg-, border-, ring-, from-, to-
        page: 'var(--color-page)',
        shimmer: 'var(--shimmer-via)',
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        subtle: 'var(--text-subtle)',
      },
      backgroundColor: {
        page: 'var(--color-page)',
        'page-alt': 'var(--color-page-alt)',
        card: 'var(--color-card)',
        'card-elevated': 'var(--color-card-elevated)',
        'card-strong': 'var(--color-card-strong)',
        'input-themed': 'var(--color-input)',
        'hover-themed': 'var(--color-hover)',
        'active-themed': 'var(--color-active)',
        overlay: 'var(--color-overlay)',
        nav: 'var(--color-nav)',
        skeleton: 'var(--color-skeleton)',
      },
      borderColor: {
        themed: {
          DEFAULT: 'var(--color-border)',
          subtle: 'var(--color-border-subtle)',
          strong: 'var(--color-border-strong)',
        },
      },
      divideColor: {
        themed: {
          DEFAULT: 'var(--color-border)',
          subtle: 'var(--color-border-subtle)',
        },
      },
      ringColor: {
        page: 'var(--color-page)',
      },
      boxShadow: {
        'theme-sm': 'var(--shadow-sm)',
        'theme-card': 'var(--shadow-card)',
        'theme-elevated': 'var(--shadow-elevated)',
        'theme-float': 'var(--shadow-float)',
      },
    },
  },
  plugins: [],
};

export default config;
