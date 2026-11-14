import { Platform } from 'react-native';

export const color = {
  navy: '#0B2537',
  navyActive: '#214358',
  gold: '#E7BB7C',
  goldHover: '#F1CD98',
  goldInteractive: '#854D0E',
  body: '#52616B',
  paper: '#F5F5F1',
  white: '#FFFFFF',
  hairline: '#D3DADD',
  darkRule: 'rgba(255,255,255,0.19)',
  lightOnNavy: '#C2D0D6',
  error: '#9D3026',
  success: '#1D654E',
} as const;

export const font = {
  display: 'Jakarta500',
  heading: 'Jakarta600',
  regular: 'Inter400',
  medium: 'Inter500',
  strong: 'Inter600',
} as const;

export const spacing = { compact: 20, wide: 36, max: 1256, split: 850 };
export const focusRing = Platform.OS === 'web' ? {
  outlineColor: color.goldInteractive,
  outlineStyle: 'solid' as const,
  outlineWidth: 2,
  outlineOffset: 3,
} : {};
