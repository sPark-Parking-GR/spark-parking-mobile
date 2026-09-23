export interface SegmentedControlOption {
  value: string
  label: string
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onChange: (next: string) => void
  size?: 'sm' | 'md'
  variant?: 'compact' | 'spaced'
}
