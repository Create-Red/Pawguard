// src/Theme.js
// Calm, natural palette: warm neutrals + ONE accent (deep sage).
// Change `accent` / `onAccent` here and every button, active chip and
// the tab bar follows.
export const colors = {
  white: '#fcfaf6',      // warm off-white (screen background, easier on the eyes than pure white)
  ink: '#2f2d29',        // warm charcoal text (softer than black)
  muted: '#8a867d',      // secondary text
  line: '#e9e5dc',       // outlines and hairlines
  pill: '#f0ede6',       // header pill, soft buttons
  tile: '#eef1ea',       // quiet sage-grey info tiles
  tileLabel: '#8a867d',

  accent: '#5b7a65',     // deep sage: buttons, active chips, highlights
  onAccent: '#fcfaf6',   // text / icons that sit on the accent
  accentDeep: '#4a6652', // sage for small text or links

  danger: '#c4574b',     // softened red
};

// Card tones. All muted so nothing glares.
//   brand = default card (neutral sand)
//   green / amber / salmon = low / moderate / high risk
//   beige = offline or not paired (cool grey-stone)
export const tones = {
  brand:  { bg: '#ebe5d9', sub: '#8d8168', text: '#3b362b', pill: '#f6f2ea', pillText: '#6f6450' },
  green:  { bg: '#d5e4cd', sub: '#6f8a64', text: '#2f4029', pill: '#e8f1e2', pillText: '#527046' },
  amber:  { bg: '#f0dcb4', sub: '#9a7a35', text: '#4a3a16', pill: '#f8ecd3', pillText: '#7c5f1c' },
  salmon: { bg: '#eec5bc', sub: '#b5655a', text: '#4a2b26', pill: '#f7dfd9', pillText: '#9a4538' },
  beige:  { bg: '#e6e6e1', sub: '#8b8b82', text: '#3d3d38', pill: '#f3f3ef', pillText: '#6b6b63' },
};

// Urbanist: closest free match to the reference's rounded geometric type.
//   npx expo install expo-font @expo-google-fonts/urbanist
export const fonts = {
  regular: 'Urbanist_400Regular',
  medium: 'Urbanist_500Medium',
  semibold: 'Urbanist_600SemiBold',
  bold: 'Urbanist_700Bold',
};