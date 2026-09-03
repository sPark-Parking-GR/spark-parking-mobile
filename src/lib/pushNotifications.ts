import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

const PROJECT_ID = Constants.expoConfig?.extra?.['eas']?.['projectId'] as string | undefined

/**
 * Requests notification permission (if not already decided) and returns an Expo push
 * token, or null if permission was denied or this isn't a physical device — simulators
 * and emulators have no push capability at all, and Expo's own API refuses to mint a
 * token for one.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const existing = await Notifications.getPermissionsAsync()
  const granted =
    existing.status === 'granted'
      ? true
      : (await Notifications.requestPermissionsAsync()).status === 'granted'
  if (!granted) return null

  if (!PROJECT_ID) return null

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID })
  return data
}

/** Reflects the OS-level permission only — the true source of truth, unlike any local flag. */
export async function hasNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false
  const { status } = await Notifications.getPermissionsAsync()
  return status === 'granted'
}
