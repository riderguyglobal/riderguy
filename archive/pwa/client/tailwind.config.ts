import type { Config } from 'tailwindcss';
import riderguyPreset from '@riderguy/config/tailwind';

const config: Config = {
  darkMode: 'class',
  presets: [riderguyPreset],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
      },
      borderRadius: {
        '2.5xl': '20px',
        '3xl':   '24px',
        '4xl':   '28px',
        '5xl':   '32px',
      },
      boxShadow: {
        'float':   '0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
        'card':    '0 1px 4px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.06)',
        'active':  '0 6px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)',
        'wallet':  '0 8px 32px rgba(0,0,0,0.20), 0 2px 8px rgba(0,0,0,0.12)',
        'brand':   '0 4px 14px rgba(34,197,94,0.22)',
        'search':  '0 2px 12px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.06)',
        'map-btn': '0 2px 10px rgba(0,0,0,0.12), 0 0 1px rgba(0,0,0,0.08)',
        'pill':    '0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
        'cta':     '0 4px 20px rgba(0,0,0,0.15)',
        'sheet':   '0 -8px 40px rgba(0,0,0,0.10), 0 -1px 4px rgba(0,0,0,0.05)',
      },
      height: {
        'cta':   '60px',
        'input': '54px',
        'nav':   '68px',
        'tab':   '44px',
      },
      fontSize: {
        'section': ['11px', { fontWeight: '700', letterSpacing: '0.4px', lineHeight: '1' }],
        'badge':   ['11px', { fontWeight: '700', letterSpacing: '0.3px', lineHeight: '1' }],
        'nav-lbl': ['11px', { fontWeight: '700', lineHeight: '1' }],
      },
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
};

export default config;
