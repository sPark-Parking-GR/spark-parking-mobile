import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { CITY_PRESETS, VEHICLE_TYPES } from '../lib/constants'
import { colors, radius, space } from '../theme'
import { DateTimeField } from './DateTimeField'
import { PickerField } from './PickerField'
import { SegmentedControl, type Segment } from './SegmentedControl'
import { Button } from './ui'

export interface AppliedQuery {
  lat: number
  lng: number
  startsAt: string
  endsAt: string
  vehicleType: string
  place: string
}

const ME = 'me'
const MIN_DURATION_MS = 60 * 60_000

const VEHICLE_ICONS: Record<string, Segment['icon']> = {
  CAR: 'car',
  MOTORCYCLE: 'motorbike',
  VAN: 'van-passenger',
  TRUCK: 'truck',
}
const VEHICLE_SEGMENTS: Segment[] = VEHICLE_TYPES.map((vt) => ({
  value: vt.value,
  label: vt.label,
  icon: VEHICLE_ICONS[vt.value] ?? 'car',
}))

function defaultStart(): Date {
  const d = new Date(Date.now() + 60 * 60_000)
  d.setMinutes(0, 0, 0)
  return d
}

export function SearchPanel({
  onSearch,
  userCoords,
}: {
  onSearch: (query: AppliedQuery) => void
  userCoords: { lat: number; lng: number } | null
}) {
  const [dest, setDest] = useState('0')
  const [touchedDest, setTouchedDest] = useState(false)
  const [vehicleType, setVehicleType] = useState('CAR')
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(() => new Date(defaultStart().getTime() + 3 * 60 * 60_000))

  const destOptions = useMemo(
    () => [
      ...(userCoords ? [{ label: 'Η τοποθεσία μου', value: ME }] : []),
      ...CITY_PRESETS.map((p, i) => ({ label: p.label, value: String(i) })),
    ],
    [userCoords],
  )

  function resolve(value: string) {
    if (value === ME && userCoords) {
      return { lat: userCoords.lat, lng: userCoords.lng, place: 'Η τοποθεσία μου' }
    }
    const preset = CITY_PRESETS[Number(value)] ?? CITY_PRESETS[0]!
    return { lat: preset.lat, lng: preset.lng, place: preset.label }
  }

  function emit(value: string, s: Date, e: Date, vehicle: string) {
    const r = resolve(value)
    onSearch({
      lat: r.lat,
      lng: r.lng,
      startsAt: s.toISOString(),
      endsAt: e.toISOString(),
      vehicleType: vehicle,
      place: r.place,
    })
  }

  useEffect(() => {
    emit(dest, start, end, vehicleType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reflect the user's location as the chosen destination once available,
  // unless they've already picked one manually.
  useEffect(() => {
    if (userCoords && !touchedDest) setDest(ME)
  }, [userCoords, touchedDest])

  function changeStart(next: Date) {
    const floor = Date.now()
    const s = next.getTime() < floor ? new Date(floor) : next
    setStart(s)
    if (end.getTime() < s.getTime() + MIN_DURATION_MS) {
      setEnd(new Date(s.getTime() + 3 * 60 * 60_000))
    }
  }

  function changeEnd(next: Date) {
    const min = start.getTime() + MIN_DURATION_MS
    setEnd(next.getTime() < min ? new Date(min) : next)
  }

  return (
    <View style={styles.card}>
      <PickerField
        label="Προορισμός"
        icon="location"
        options={destOptions}
        value={dest}
        onChange={(v) => {
          setTouchedDest(true)
          setDest(v)
        }}
      />

      <View style={styles.row}>
        <DateTimeField
          label="Άφιξη"
          icon="calendar-outline"
          value={start}
          minimumDate={new Date()}
          onChange={changeStart}
        />
        <DateTimeField
          label="Αναχώρηση"
          icon="time-outline"
          value={end}
          minimumDate={new Date(start.getTime() + MIN_DURATION_MS)}
          onChange={changeEnd}
        />
      </View>

      <SegmentedControl segments={VEHICLE_SEGMENTS} value={vehicleType} onChange={setVehicleType} />

      <Button
        label="Αναζήτηση"
        icon="search"
        onPress={() => emit(dest, start, end, vehicleType)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  row: { flexDirection: 'row', gap: space.sm },
})
