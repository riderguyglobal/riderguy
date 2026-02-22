import type { Config } from 'tailwindcss';
import riderguyPreset from '@riderguy/config/tailwind';

const config: Config = {
  presets: [riderguyPreset],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
