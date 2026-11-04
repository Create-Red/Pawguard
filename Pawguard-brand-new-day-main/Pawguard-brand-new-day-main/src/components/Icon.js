// src/components/Icon.js
// One place that decides which icon set the app uses.
// Screens call <Icon name="..." /> with the same names they used before,
// and this maps them to Lucide (rounded line icons like the reference).
import React from 'react';
import {
  Activity,
  ArrowLeftRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  House,
  Link as LinkIcon,
  Map as MapIcon,
  MapPin,
  PawPrint,
  Pencil,
  Plus,
  Settings,
  User,
} from 'lucide-react-native';

const ICONS = {
  paw: PawPrint,
  notifications: Bell,
  'notifications-outline': Bell,
  add: Plus,
  'chevron-forward': ChevronRight,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  location: MapPin,
  'location-outline': MapPin,
  calendar: CalendarDays,
  'calendar-outline': CalendarDays,
  'create-outline': Pencil,
  home: House,
  'home-outline': House,
  analytics: Activity,
  'analytics-outline': Activity,
  settings: Settings,
  'settings-outline': Settings,
  map: MapIcon,
  'map-outline': MapIcon,
  person: User,
  'person-outline': User,
  'swap-horizontal': ArrowLeftRight,
  'link-outline': LinkIcon,
  ellipse: Circle,
  'ellipse-outline': Circle,
};

export default function Icon({ name, size = 24, color = '#2b2416', strokeWidth = 1.8, style }) {
  const Glyph = ICONS[name] || Circle;
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} style={style} />;
}