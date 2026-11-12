// navigation/navOptions.js
// Shared look for every navigator (pet owner + event organizer),
// so both sides of the app always match.

import { colors, fonts } from '../Theme';

// Stack headers: flat, white, Urbanist title
export const stackScreenOptions = {
  headerShadowVisible: false,
  headerTintColor: colors.ink,
  headerStyle: { backgroundColor: colors.white },
  headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17 },
  contentStyle: { backgroundColor: colors.white },
};

// Tabs: no header (each screen draws its own title)
export const tabScreenOptions = {
  headerShown: false,
};