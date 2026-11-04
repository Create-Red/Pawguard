// src/components/Icon.js
// One place that decides which icon set the app uses.
// Screens call <Icon name="..." /> and this maps the name to a Lucide icon.
import React from 'react';
import {
  Activity,
  ArrowLeftRight,
  Battery,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  House,
  Link as LinkIcon,
  LogOut,
  Map as MapIcon,
  MapPin,
  Navigation,
  PawPrint,
  Pencil,
  Plus,
  Settings,
  User,
  Users,
  X,
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
  'people-outline': Users,
  'swap-horizontal': ArrowLeftRight,
  'link-outline': LinkIcon,
  'time-outline': Clock,
  battery: Battery,
  checkmark: Check,
  close: X,
  'log-out-outline': LogOut,
  'navigate-outline': Navigation,
  ellipse: Circle,
  'ellipse-outline': Circle,
};

export default function Icon({ name, size = 24, color = '#2f2d29', strokeWidth = 1.8, style }) {
  const Glyph = ICONS[name] || Circle;
  return <Glyph size={size} color={color} strokeWidth={strokeWidth} style={style} />;
}