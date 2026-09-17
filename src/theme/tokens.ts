export const colors = {
  light: {
    bg: '#F4F6F9',
    sheet: '#FFFFFF',
    surface: '#FFFFFF',
    card2: '#F1F5F8',
    line: 'rgba(12,27,42,0.09)',
    ink: '#0C1B2A',
    muted: '#5E6B77',
    pri: '#1E88C7',
    pri2: '#0D6FA8',
    priSoft: 'rgba(30,136,199,0.10)',
    ok: '#1F9D55',
    okBg: 'rgba(31,157,85,0.13)',
    bad: '#E0574E',
    badBg: 'rgba(224,87,78,0.13)',
    warn: '#C77F1E',
    warnBg: 'rgba(217,137,40,0.14)',
    shadow: '0 4px 16px rgba(12,27,42,0.05)',
    faint: '#93A0AD',
    map: '#E6EBEF',
    mapLine: 'rgba(12,27,42,0.05)',
    road: 'rgba(12,27,42,0.08)',
    scrim: 'rgba(12,27,42,0.42)',
  },
  dark: {
    bg: '#0A0E14',
    sheet: '#111826',
    surface: '#131B29',
    card2: '#1B2536',
    line: 'rgba(255,255,255,0.08)',
    ink: '#EDF2F7',
    muted: '#8A9BB0',
    pri: '#249ED9',
    pri2: '#0D80B6',
    priSoft: 'rgba(36,158,217,0.16)',
    ok: '#33C77D',
    okBg: 'rgba(40,150,90,0.20)',
    bad: '#F4695E',
    badBg: 'rgba(224,74,74,0.18)',
    warn: '#E0B24C',
    warnBg: 'rgba(224,150,40,0.18)',
    shadow: 'none',
    faint: '#5E7085',
    map: '#0B0E12',
    mapLine: 'rgba(255,255,255,0.045)',
    road: 'rgba(255,255,255,0.07)',
    scrim: 'rgba(3,6,10,0.62)',
  },
} as const

export const spark = {
  cream: '#E7E0D4',
  navy: '#020C14',
} as const

export type ThemeMode = keyof typeof colors
export type ColorToken = keyof typeof colors.light

export const gradients = {
  brand: ['#0D6FA8', '#1E88C7', '#249ED9'] as const,
} as const

export const typography = {
  eyebrow: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  },
  caption: { fontSize: 12, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '600' as const },
  label: { fontSize: 15, fontWeight: '700' as const },
  heading: { fontSize: 18, fontWeight: '700' as const },
  display: { fontSize: 24, fontWeight: '800' as const },
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const

export const radii = {
  sm: 9,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const

export const shadows = {
  light: {
    card: '0 4px 16px rgba(12,27,42,0.05)',
    sheet: '0 16px 40px rgba(12,27,42,0.16)',
    glow: '0 12px 26px rgba(36,158,217,0.35)',
  },
  dark: {
    card: 'none',
    sheet: '0 16px 40px rgba(0,0,0,0.45)',
    glow: '0 12px 26px rgba(36,158,217,0.35)',
  },
} as const
