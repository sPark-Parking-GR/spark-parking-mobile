export type StepperSize = 'sm' | 'md'

export interface StepperProps {
  value: number
  onChange: (next: number) => void
  step?: number
  min?: number
  max?: number
  formatValue?: (v: number) => string
  disabled?: boolean
  size?: StepperSize
}
