// src/theme.js
export const colors = {
  ink: '#1c1c1e',     // black pills, buttons, titles
  white: '#ffffff',
  muted: '#8e8e96',
  line: '#e8e8ec',    // outline chips
  pill: '#f1f2f4',    // header icon pill
  tile: '#eef4f8',    // info tiles
  tileLabel: '#7b8794',
  danger: '#ef4444',
};

// Pastel card tones (green / salmon / beige / amber)
export const tones = {
  green:  { bg: '#c8dcbc', sub: '#7f9a74', text: '#3f4a3a', pill: '#dcebd3', pillText: '#6b8461' },
  salmon: { bg: '#fbbcb4', sub: '#cf6b5f', text: '#4a3330', pill: '#fde3df', pillText: '#a2402f' },
  beige:  { bg: '#ede4d8', sub: '#b99a7a', text: '#4a4036', pill: '#faf5ee', pillText: '#8a5a22' },
  amber:  { bg: '#f6e3b0', sub: '#b58a2a', text: '#4a3f22', pill: '#fcf2d3', pillText: '#8a6414' },
};

// Poppins (same font as the reference). Install with:
//   npx expo install expo-font @expo-google-fonts/poppins
export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};