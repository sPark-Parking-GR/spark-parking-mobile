// Dark theme — Electric Cerulean palette (colors.md). Deep navy canvas (main_bg),
// cerulean brand actions, warm cream text (white_text).
export const colors = {
  primary: '#1094d4',
  primaryAlt: '#32a5dc',
  primaryTint: 'rgba(16,148,212,0.16)',
  primaryTintBorder: 'rgba(16,148,212,0.4)',
  bg: '#020c14',
  surface: '#0c1a24',
  textMain: '#eae3d7',
  textSecondary: '#8a96a0',
  border: '#1f3340',
  success: '#22c55e',
  successBg: '#10271b',
  warning: '#fbbf24',
  warningBg: '#2a2410',
  error: '#f87171',
  errorBg: '#2a1518',
  neutralBg: '#15252f',
} as const

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const

export const radius = {
  sm: 12,
  md: 14,
  lg: 20,
} as const

export const font = {
  display: 28,
  heading: 20,
  body: 15,
  small: 13,
  tiny: 12,
} as const
