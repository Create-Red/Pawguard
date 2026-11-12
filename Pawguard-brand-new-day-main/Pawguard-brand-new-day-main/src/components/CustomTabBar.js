import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import Glass from './Glass';
import { colors, fonts } from '../Theme';

// Fallback icons/labels by route name. Tabs normally set their own with
// options={{ title: 'Home', tabBarIconName: 'home' }} in the navigator,
// so this list only matters for tabs that don't.
const TAB_CONFIG = {
  Dashboard: { icon: 'home', label: 'Home' },
  EventOrganizerDashboard: { icon: 'home', label: 'Home' },
  Home: { icon: 'home', label: 'Home' },
  History: { icon: 'analytics', label: 'History' },
  Events: { icon: 'calendar', label: 'Events' },
  Map: { icon: 'map', label: 'Map' },
  Notifications: { icon: 'notifications', label: 'Alerts' },
  Profile: { icon: 'person', label: 'Profile' },
  Settings: { icon: 'settings', label: 'Settings' },
};

// Icon + label for a tab: navigator options first, then the fallback list.
const getTabInfo = (route, options) => {
  const fallback = TAB_CONFIG[route.name] || {};

  const label =
    (typeof options.tabBarLabel === 'string' && options.tabBarLabel) ||
    options.title ||
    fallback.label ||
    route.name;

  const icon = options.tabBarIconName || fallback.icon || 'ellipse';

  return { icon, label };
};

// Floating glass bar. Screens need ~110px bottom padding so content can
// scroll underneath it without being hidden.
export default function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <Glass radius={32} intensity={60} style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const { icon, label } = getTabInfo(route, options);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel || label}
              style={[styles.item, focused && styles.itemActive]}
            >
              <Icon
                name={icon}
                size={21}
                color={focused ? colors.onAccent : 'rgba(47,45,41,0.55)'}
              />
              {focused && <Text style={styles.label}>{label}</Text>}
            </TouchableOpacity>
          );
        })}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 64,
    paddingHorizontal: 8,
  },
  item: {
    height: 42,
    minWidth: 42,
    paddingHorizontal: 12,
    borderRadius: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  itemActive: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.onAccent,
  },
});