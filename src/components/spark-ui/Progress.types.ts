import type { ReactNode } from 'react'

export interface ProgressBarProps {
  pct: number
  colorOverride?: string
}

export interface ProgressRingProps {
  pct: number
  size?: number
  strokeWidth?: number
  children?: ReactNode
}
