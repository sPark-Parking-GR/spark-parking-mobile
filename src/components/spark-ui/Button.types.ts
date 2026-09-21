import type { ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  disabled?: boolean
  onPress: () => void
  children: ReactNode
}
