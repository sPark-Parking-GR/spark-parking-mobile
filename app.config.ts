import type { ConfigContext, ExpoConfig } from 'expo/config'

const googleMapsApiKey = process.env['EXPO_PUBLIC_GOOGLE_MAPS_KEY']

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    [
      'react-native-maps',
      {
        iosGoogleMapsApiKey: googleMapsApiKey,
        androidGoogleMapsApiKey: googleMapsApiKey,
      },
    ],
  ],
})
