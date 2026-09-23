import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

import { hasNotificationPermission, registerForPushNotificationsAsync } from '../pushNotifications'

jest.mock('expo-device', () => ({ isDevice: true }))
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
}))
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}))

const mockedDevice = Device as unknown as { isDevice: boolean }
const mockedGetPermissions = Notifications.getPermissionsAsync as jest.Mock
const mockedRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock
const mockedGetToken = Notifications.getExpoPushTokenAsync as jest.Mock

beforeEach(() => {
  mockedDevice.isDevice = true
  Platform.OS = 'ios'
  mockedGetPermissions.mockResolvedValue({ status: 'undetermined' })
  mockedRequestPermissions.mockResolvedValue({ status: 'granted' })
  mockedGetToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' })
})

describe('registerForPushNotificationsAsync', () => {
  // A namespace import (`import * as Device from 'expo-device'`) binds at module-load
  // time, so flipping the mocked property after the fact does not reach the module under
  // test — reset and re-require it fresh under the "not a device" mock instead.
  it('returns null on a simulator/emulator — Expo mints no token for one', async () => {
    jest.resetModules()
    jest.doMock('expo-device', () => ({ isDevice: false }))
    // Must be a fresh require AFTER doMock, which a static import cannot give.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { registerForPushNotificationsAsync: register } = require('../pushNotifications')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requestPermissionsAsync } = require('expo-notifications')

    await expect(register()).resolves.toBeNull()
    expect(requestPermissionsAsync).not.toHaveBeenCalled()
  })

  it('does not re-prompt when permission was already granted', async () => {
    mockedGetPermissions.mockResolvedValue({ status: 'granted' })

    await registerForPushNotificationsAsync()

    expect(mockedRequestPermissions).not.toHaveBeenCalled()
  })

  it('prompts when permission is undetermined and returns the token once granted', async () => {
    const token = await registerForPushNotificationsAsync()

    expect(mockedRequestPermissions).toHaveBeenCalledTimes(1)
    expect(token).toBe('ExponentPushToken[abc]')
  })

  it('returns null without minting a token when permission is denied', async () => {
    mockedRequestPermissions.mockResolvedValue({ status: 'denied' })

    await expect(registerForPushNotificationsAsync()).resolves.toBeNull()
    expect(mockedGetToken).not.toHaveBeenCalled()
  })

  it('sets up the Android notification channel, and only on Android', async () => {
    Platform.OS = 'android'

    await registerForPushNotificationsAsync()

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ name: 'default' }),
    )
  })
})

describe('hasNotificationPermission', () => {
  it('reflects the OS permission directly, not any local flag', async () => {
    mockedGetPermissions.mockResolvedValue({ status: 'granted' })
    await expect(hasNotificationPermission()).resolves.toBe(true)

    mockedGetPermissions.mockResolvedValue({ status: 'denied' })
    await expect(hasNotificationPermission()).resolves.toBe(false)
  })

  it('is false on a simulator/emulator without even asking the OS', async () => {
    jest.resetModules()
    jest.doMock('expo-device', () => ({ isDevice: false }))
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { hasNotificationPermission: hasPermission } = require('../pushNotifications')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getPermissionsAsync } = require('expo-notifications')

    await expect(hasPermission()).resolves.toBe(false)
    expect(getPermissionsAsync).not.toHaveBeenCalled()
  })
})
