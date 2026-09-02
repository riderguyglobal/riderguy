import type { Config } from 'tailwindcss';
import riderguyPreset from '@riderguy/config/tailwind';

const config: Config = {
  presets: [riderguyPreset],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F3FBF7',
          100: '#EAF7F1',
          200: '#CDEEDD',
          300: '#9DDFC1',
          400: '#68CEA2',
          500: '#40BE89',
          600: '#16AA72',
          700: '#087B50',
          800: '#086342',
          900: '#075C3D',
          950: '#043823',
        },
        ink: {
          DEFAULT: '#050505',
          soft: '#111814',
        },
        mist: '#F3FBF7',
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        premium: '0 18px 55px -28px rgba(5, 31, 20, 0.28)',
        float: '0 14px 38px -24px rgba(5, 31, 20, 0.22)',
      },
    },
  },
  plugins: [],
};

export default config;
