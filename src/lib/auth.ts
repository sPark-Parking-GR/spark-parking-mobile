import { createAuthContext } from '@spark/auth'
import type { AuthProviderConfig } from '@spark/auth'

const PROVIDER = (process.env['EXPO_PUBLIC_AUTH_PROVIDER'] ?? 'firebase') as AuthProviderConfig['provider']

function getAuthConfig(): AuthProviderConfig {
  switch (PROVIDER) {
    case 'firebase':
      return {
        provider: 'firebase',
        config: {
          projectId: process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID']!,
          clientEmail: '',
          privateKey: '',
        },
      }
    case 'clerk':
      return {
        provider: 'clerk',
        config: {
          secretKey: '',
          publishableKey: process.env['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY']!,
        },
      }
    default:
      return {
        provider: 'firebase',
        config: {
          projectId: process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID']!,
          clientEmail: '',
          privateKey: '',
        },
      }
  }
}

export const auth = createAuthContext(getAuthConfig())
