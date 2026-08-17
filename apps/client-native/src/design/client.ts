import { Platform } from 'react-native';

export const colors = {
  brand: '#40BE89',
  brandDark: '#079B61',
  brandSoft: '#EAF7F1',
  surface: '#F7FAF8',
  card: '#FFFFFF',
  ink: '#050505',
  text: '#1F2924',
  muted: '#626A66',
  subtle: '#9AA8A1',
  line: '#E3EEE9',
  black: '#050505',
  blue: '#2563EB',
  blueSoft: '#EAF1FF',
  amber: '#F5B84B',
  red: '#EF3B2D',
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 20,
    },
    android: { elevation: 2 },
    default: {},
  }),
  float: Platform.select({
    ios: {
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 28,
    },
    android: { elevation: 6 },
    default: {},
  }),
  brand: Platform.select({
    ios: {
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.28,
      shadowRadius: 18,
    },
    android: { elevation: 7 },
    default: {},
  }),
};

export const typography = {
  brand: {
    fontSize: 22,
    fontWeight: '900' as const,
    letterSpacing: -0.4,
  },
  h1: {
    fontSize: 28,
    fontWeight: '900' as const,
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  h2: {
    fontSize: 18,
    fontWeight: '900' as const,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
};

export const screen = {
  gutter: 16,
  maxWidth: 480,
};
