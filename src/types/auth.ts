export type UserRole =
  'guest' | 'user' | 'operator_staff' | 'operator_admin' | 'platform_admin' | 'super_admin'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  emailVerified: boolean
  displayName?: string
  avatarUrl?: string
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: AuthUser
}

export interface SignInCredentials {
  email: string
  password: string
}

export interface SignUpData {
  email: string
  password: string
  displayName?: string
  role?: Extract<UserRole, 'user' | 'operator_staff' | 'operator_admin' | 'platform_admin'>
}

export interface AuthResult {
  session: AuthSession
}

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128
