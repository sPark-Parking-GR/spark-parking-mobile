import type { ConfigContext, ExpoConfig } from 'expo/config'

const googleMapsApiKey = process.env['EXPO_PUBLIC_GOOGLE_MAPS_KEY']

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    "expo-font",
    [
      'react-native-maps',
      {
        iosGoogleMapsApiKey: googleMapsApiKey,
        androidGoogleMapsApiKey: googleMapsApiKey,
      },
    ],
    [
      '@stripe/stripe-react-native',
      {
        // Must match the Apple Pay merchant ID registered on the Apple developer account.
        merchantIdentifier: 'merchant.com.spark.app',
        enableGooglePay: true,
      },
    ],
  ],
})
