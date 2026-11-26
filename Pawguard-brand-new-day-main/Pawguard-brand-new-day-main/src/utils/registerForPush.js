import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../config/supabase';

// This phone's own token, remembered so logout only removes THIS phone
const TOKEN_KEY = 'pawguard.pushToken';

// Show notifications as a banner even when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for permission, gets this phone's Expo push token,
 * and saves it to the logged-in user's profile.
 * The same token is removed from any other account, so a shared phone
 * only gets alerts for whoever is logged in now.
 * Returns the token, or null if it could not be set up.
 */
export async function registerForPushNotifications(userId) {
  if (!userId) return null;

  // The iPhone simulator can't get push. The Android emulator can,
  // if it has Google Play.
  if (!Device.isDevice && Platform.OS === 'ios') {
    console.log('Push notifications need a real iPhone.');
    return null;
  }

  // Only Expo Go itself can't get Android push. (expoGoConfig is also set in
  // our own APK, so it can't be used for this check.)
  if (
    Platform.OS === 'android' &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ) {
    console.log('Remote push notifications require an Android development build.');
    return null;
  }

  try {
    // Android needs a notification channel before requesting push permissions.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'PawGuard alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission was not granted.');
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.log('Missing EAS projectId. Run `eas init` first.');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    // Saves on MY profile and removes it from any other account
    const { error } = await supabase.rpc('set_my_push_token', {
      p_token: token,
    });

    if (error) {
      console.log('Saving push token failed:', error.message);
      return null;
    }

    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch {}

    return token;
  } catch (error) {
    console.warn('Push notification registration failed:', error);
    return null;
  }
}

/**
 * Call BEFORE signing out (the user must still be logged in).
 * Stops this account's alerts from going to THIS phone. If the account's
 * token belongs to another phone, it is left alone.
 */
export async function unregisterPushNotifications() {
  try {
    let token = null;
    try {
      token = await AsyncStorage.getItem(TOKEN_KEY);
    } catch {}
    if (!token) return; // this phone never registered

    const { error } = await supabase.rpc('clear_my_push_token', { p_token: token });
    if (error) console.log('Clearing push token failed:', error.message);
  } catch (error) {
    console.log('Clearing push token failed:', error);
  }
}