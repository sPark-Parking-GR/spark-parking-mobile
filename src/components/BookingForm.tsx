import { spacing } from '@spark/ui'
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { DateTimeField } from './DateTimeField'
import { SegmentedControl, type Segment } from './SegmentedControl'
import { useLanguage } from '../i18n/LanguageProvider'
import { VEHICLE_TYPES } from '../lib/constants'

export interface BookingValue {
  startsAt: string
  endsAt: string
  vehicleType: string
}

const MIN_DURATION_MS = 30 * 60_000

const VEHICLE_ICONS: Record<string, Segment['icon']> = {
  CAR: 'car',
  MOTORCYCLE: 'motorbike',
  VAN: 'van-passenger',
  TRUCK: 'truck',
}

// The next closest full hour — the earliest selectable arrival.
export function defaultStart(): Date {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d
}

export function defaultEnd(start: Date): Date {
  return new Date(start.getTime() + MIN_DURATION_MS)
}

export function BookingForm({
  initial,
  onChange,
}: {
  initial?: Partial<BookingValue>
  onChange: (value: BookingValue) => void
}) {
  const { t } = useLanguage()
  const seedStart = initial?.startsAt ? new Date(initial.startsAt) : defaultStart()
  const seedEnd = initial?.endsAt ? new Date(initial.endsAt) : defaultEnd(seedStart)

  const [vehicleType, setVehicleType] = useState(initial?.vehicleType ?? 'CAR')
  const [start, setStart] = useState(seedStart)
  const [end, setEnd] = useState(seedEnd)

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
    onChange({ startsAt: start.toISOString(), endsAt: end.toISOString(), vehicleType })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, vehicleType])

  function changeStart(next: Date) {
    const floor = Date.now()
    const s = next.getTime() < floor ? new Date(floor) : next
    setStart(s)
    if (end.getTime() < s.getTime() + MIN_DURATION_MS) {
      setEnd(defaultEnd(s))
    }
  }

  function changeEnd(next: Date) {
    const min = start.getTime() + MIN_DURATION_MS
    setEnd(next.getTime() < min ? new Date(min) : next)
  }

  return (
    <View style={styles.form}>
      <View style={styles.row}>
        <DateTimeField
          label={t('arrivalLabel')}
          icon="calendar-outline"
          value={start}
          minimumDate={defaultStart()}
          onChange={changeStart}
        />
        <DateTimeField
          label={t('departureLabel')}
          icon="time-outline"
          value={end}
          minimumDate={new Date(start.getTime() + MIN_DURATION_MS)}
          anchor={start}
          onChange={changeEnd}
        />
      </View>

      <SegmentedControl segments={vehicleSegments} value={vehicleType} onChange={setVehicleType} />
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
})
