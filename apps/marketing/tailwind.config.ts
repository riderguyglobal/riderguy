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
      spacing: {
        '13': '3.25rem',
      },
      colors: {
        'brand-green': '#22c55e',
      },
    },
  },
  plugins: [],
};

export default config;
