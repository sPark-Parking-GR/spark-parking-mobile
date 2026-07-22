import { Ionicons } from '@expo/vector-icons'
import { spacing, typography, useTheme } from '@spark/ui'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { SegmentedControl, type Segment } from './SegmentedControl'
import { useLanguage } from '../i18n/LanguageProvider'
import { VEHICLE_ICONS, VEHICLE_TYPES } from '../lib/constants'

export interface BookingValue {
  startsAt: string
  endsAt: string
  vehicleType: string
}

const MIN_DURATION_MIN = 30
const MAX_DURATION_MIN = 24 * 60
const HOUR_STEP_MIN = 60
const MINUTE_STEP_MIN = 15

const DURATION_PRESETS = [
  { minutes: 30, labelKey: 'duration30m' },
  { minutes: 60, labelKey: 'duration1h' },
  { minutes: 120, labelKey: 'duration2h' },
  { minutes: 240, labelKey: 'duration4h' },
  { minutes: 1440, labelKey: 'durationAllDay' },
] as const

// The next closest full hour — the earliest selectable arrival.
export function defaultStart(): Date {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d
}

export function defaultEnd(start: Date): Date {
  return new Date(start.getTime() + MIN_DURATION_MIN * 60_000)
}

function durationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000)
}

function clampMinutes(minutes: number): number {
  return Math.min(MAX_DURATION_MIN, Math.max(MIN_DURATION_MIN, minutes))
}

export function BookingForm({
  initial,
  onChange,
  showVehicleSelector = true,
}: {
  initial?: Partial<BookingValue>
  onChange: (value: BookingValue) => void
  showVehicleSelector?: boolean
}) {
  const { colors, radii } = useTheme()
  const { t } = useLanguage()

  const start = useMemo(
    () => (initial?.startsAt ? new Date(initial.startsAt) : defaultStart()),
    [initial?.startsAt],
  )
  const seedMinutes = useMemo(() => {
    const seedEnd = initial?.endsAt ? new Date(initial.endsAt) : defaultEnd(start)
    return clampMinutes(durationMinutes(start, seedEnd))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, initial?.endsAt])

  const [vehicleType, setVehicleType] = useState(initial?.vehicleType ?? 'CAR')
  const [minutes, setMinutes] = useState(seedMinutes)
  const [customOpen, setCustomOpen] = useState(
    () => !DURATION_PRESETS.some((preset) => preset.minutes === seedMinutes),
  )

  const vehicleSegments = useMemo<Segment[]>(
    () =>
      VEHICLE_TYPES.map((vt) => ({
        value: vt.value,
        label: t(vt.labelKey),
        icon: VEHICLE_ICONS[vt.value] ?? 'car',
      })),
    [t],
  )

  useEffect(() => {
    const end = new Date(start.getTime() + minutes * 60_000)
    onChange({ startsAt: start.toISOString(), endsAt: end.toISOString(), vehicleType })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, minutes, vehicleType])

  function selectPreset(value: number) {
    setCustomOpen(false)
    setMinutes(value)
  }

  function adjustCustom(deltaMinutes: number) {
    setMinutes((prev) => clampMinutes(prev + deltaMinutes))
  }

  const customHours = Math.floor(minutes / 60)
  const customMins = minutes % 60

  return (
    <View style={styles.form}>
      <Text style={[styles.eyebrow, { color: colors.muted }]}>{t('bookingDuration')}</Text>
      <View style={styles.chipRow}>
        {DURATION_PRESETS.map((preset) => {
          const active = !customOpen && minutes === preset.minutes
          return (
            <Pressable
              key={preset.minutes}
              onPress={() => selectPreset(preset.minutes)}
              style={[
                styles.chip,
                { borderRadius: radii.md, borderColor: colors.line, backgroundColor: colors.card2 },
                active && { backgroundColor: colors.pri, borderColor: colors.pri },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? '#fff' : colors.ink }]}>
                {t(preset.labelKey)}
              </Text>
            </Pressable>
          )
        })}
        <Pressable
          onPress={() => setCustomOpen(true)}
          style={[
            styles.chip,
            { borderRadius: radii.md, borderColor: colors.line, backgroundColor: colors.card2 },
            customOpen && { backgroundColor: colors.pri, borderColor: colors.pri },
          ]}
        >
          <Text style={[styles.chipText, { color: customOpen ? '#fff' : colors.ink }]}>
            {t('durationCustom')}
          </Text>
        </Pressable>
      </View>

      {customOpen && (
        <View
          style={[
            styles.customRow,
            { borderColor: colors.line, backgroundColor: colors.card2, borderRadius: radii.md },
          ]}
        >
          <Stepper
            label={t('durationHours')}
            value={customHours}
            onDecrement={() => adjustCustom(-HOUR_STEP_MIN)}
            onIncrement={() => adjustCustom(HOUR_STEP_MIN)}
          />
          <Stepper
            label={t('durationMinutes')}
            value={customMins}
            onDecrement={() => adjustCustom(-MINUTE_STEP_MIN)}
            onIncrement={() => adjustCustom(MINUTE_STEP_MIN)}
          />
        </View>
      )}

      {showVehicleSelector && (
        <>
          <Text style={[styles.eyebrow, { color: colors.muted, marginTop: spacing.sm }]}>
            {t('bookingVehicle')}
          </Text>
          <SegmentedControl
            segments={vehicleSegments}
            value={vehicleType}
            onChange={setVehicleType}
          />
        </>
      )}
    </View>
  )
}

function Stepper({
  label,
  value,
  onDecrement,
  onIncrement,
}: {
  label: string
  value: number
  onDecrement: () => void
  onIncrement: () => void
}) {
  const { colors, radii } = useTheme()
  return (
    <View style={styles.stepper}>
      <Text style={[styles.stepperLabel, { color: colors.muted }]}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          onPress={onDecrement}
          style={[styles.stepperBtn, { borderColor: colors.line, borderRadius: radii.sm }]}
        >
          <Ionicons name="remove" size={16} color={colors.ink} />
        </Pressable>
        <Text style={[styles.stepperValue, { color: colors.ink }]}>
          {String(value).padStart(2, '0')}
        </Text>
        <Pressable
          onPress={onIncrement}
          style={[styles.stepperBtn, { borderColor: colors.line, borderRadius: radii.sm }]}
        >
          <Ionicons name="add" size={16} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm },
  eyebrow: {
    fontSize: typography.eyebrow.fontSize,
    fontWeight: typography.eyebrow.fontWeight,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingVertical: 11, paddingHorizontal: 16, borderWidth: 1 },
  chipText: { fontSize: typography.body.fontSize, fontWeight: '700' },
  customRow: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.lg,
  },
  stepper: { flex: 1, alignItems: 'center', gap: spacing.xs },
  stepperLabel: { fontSize: typography.caption.fontSize, fontWeight: '600' },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperBtn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
})
