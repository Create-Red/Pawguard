// config/supabase.js
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// A clear message if this build was made without the EAS environment values
if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase settings in this build: ' +
      [!supabaseUrl && 'EXPO_PUBLIC_SUPABASE_URL', !supabasePublishableKey && 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
        .filter(Boolean)
        .join(', ') +
      '. Check the EAS environment variables and rebuild.'
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});