import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts } from '../theme';

// Map YOUR tab route names to icons + labels. Edit to match your navigator.
const TAB_CONFIG = {
  Home: { icon: 'home', outline: 'home-outline', label: 'Home' },
  Dashboard: { icon: 'home', outline: 'home-outline', label: 'Home' },
  Map: { icon: 'location', outline: 'location-outline', label: 'Map' },
  Notifications: { icon: 'notifications', outline: 'notifications-outline', label: 'Alerts' },
  Profile: { icon: 'person', outline: 'person-outline', label: 'Profile' },
  Settings: { icon: 'settings', outline: 'settings-outline', label: 'Settings' },
};

export default function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const cfg = TAB_CONFIG[route.name] || {
            icon: 'ellipse',
            outline: 'ellipse-outline',
            label: route.name,
          };

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
              accessibilityLabel={descriptors[route.key].options.tabBarAccessibilityLabel}
              style={[styles.item, focused && styles.itemActive]}
            >
              <Ionicons
                name={focused ? cfg.icon : cfg.outline}
                size={21}
                color={focused ? colors.ink : '#a0a0a8'}
              />
              {focused && <Text style={styles.label}>{cfg.label}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.ink,
    paddingHorizontal: 10,
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
    backgroundColor: colors.white,
    paddingHorizontal: 16,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
  },
});

// Usage:
//   <Tab.Navigator tabBar={(p) => <CustomTabBar {...p} />} screenOptions={{ headerShown: false }}>