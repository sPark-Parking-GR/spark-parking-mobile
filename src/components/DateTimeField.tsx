import { Ionicons } from '@expo/vector-icons'
import { useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { WheelPicker } from 'react-native-infinite-wheel-picker'

import { formatDateTimeShort } from '../lib/format'
import { colors, font, radius } from '../theme'
import { Sheet } from './Sheet'

const MONTHS = [
  'Ιανουαρίου',
  'Φεβρουαρίου',
  'Μαρτίου',
  'Απριλίου',
  'Μαΐου',
  'Ιουνίου',
  'Ιουλίου',
  'Αυγούστου',
  'Σεπτεμβρίου',
  'Οκτωβρίου',
  'Νοεμβρίου',
  'Δεκεμβρίου',
]
const ITEM_H = 44
const VISIBLE = 5
const REST = 2
const FUTURE_DAY_OFFSET_H = 12
// Render the whole batch up front so a remount (e.g. the day list changing with
// the month) never paints blank waiting on an async scroll-to-index.
const LIST_PROPS = { initialNumToRender: 40, onScrollToIndexFailed: () => {} }

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

// Round a date up to the next whole minute (drops seconds).
function snapUp(date: Date): Date {
  const d = new Date(date)
  const sub = d.getSeconds() !== 0 || d.getMilliseconds() !== 0
  d.setSeconds(0, 0)
  if (sub) d.setMinutes(d.getMinutes() + 1)
  return d
}

export function DateTimeField({
  label,
  icon,
  value,
  minimumDate,
  anchor,
  onChange,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  value: Date
  minimumDate?: Date
  anchor?: Date
  onChange: (date: Date) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [tab, setTab] = useState<'date' | 'time'>('date')
  // The floor is frozen when the sheet opens so the wheels keep stable data
  // (the library copies `data` once at mount and never updates it).
  const [minDate, setMinDate] = useState<Date>(() => snapUp(value))

  // Handlers fire on a 100ms timer inside the library, so read live state here.
  const draftRef = useRef(draft)
  draftRef.current = draft

  const min = minDate
  const curYear = min.getFullYear()
  const minMonth = min.getMonth()

  function openPicker() {
    const m = snapUp(minimumDate && minimumDate > new Date() ? minimumDate : new Date())
    const s = snapUp(value < m ? m : value)
    const mo = Math.min(Math.max(s.getMonth(), m.getMonth()), 11)
    setMinDate(m)
    setDraft(new Date(m.getFullYear(), mo, s.getDate(), s.getHours(), s.getMinutes()))
    setTab('date')
    setOpen(true)
  }

  // Month range: current month → December. Day range: the floor day of the
  // selected month → its last day. Hour/minute are floored only on the very
  // earliest selectable day/hour.
  const month = Math.min(Math.max(draft.getMonth(), minMonth), 11)
  const onMinMonth = month === minMonth
  const minDay = onMinMonth ? min.getDate() : 1
  const monthLast = daysInMonth(curYear, month)
  const day = Math.min(Math.max(draft.getDate(), minDay), monthLast)

  const onMinDay = onMinMonth && day === min.getDate()
  const minHour = onMinDay ? min.getHours() : 0
  const hour = Math.min(Math.max(draft.getHours(), minHour), 23)

  const onMinHour = onMinDay && hour === min.getHours()
  const minMinute = onMinHour ? min.getMinutes() : 0
  const minute = Math.min(Math.max(draft.getMinutes(), minMinute), 59)

  const monthData = useMemo(() => range(minMonth, 11).map((m) => MONTHS[m]!), [minMonth])
  const dayData = useMemo(() => range(minDay, monthLast).map(String), [minDay, monthLast])
  const hourData = useMemo(() => range(minHour, 23).map(pad), [minHour])
  const minuteData = useMemo(() => range(minMinute, 59).map(pad), [minMinute])

  function commitDate(mo: number, d: number): void {
    const cur = draftRef.current
    let h = cur.getHours()
    let mi = cur.getMinutes()
    // Leaving the earliest day onto a later one seeds the time with anchor + 12h
    // (depart selector) so it never strands at the floor. Further date tweaks keep
    // whatever time the user has since set.
    if (anchor) {
      const targetEarliest = mo === minMonth && d === min.getDate()
      const curEarliest = cur.getMonth() === minMonth && cur.getDate() === min.getDate()
      if (!targetEarliest && curEarliest) {
        h = (anchor.getHours() + FUTURE_DAY_OFFSET_H) % 24
        mi = anchor.getMinutes()
      }
    }
    let next = new Date(curYear, mo, d, h, mi)
    if (next < min) next = new Date(min)
    setDraft(next)
    onChange(next)
  }

  function onMonth(index: number): void {
    const newMonth = minMonth + index
    const cur = draftRef.current
    if (newMonth === cur.getMonth()) return
    const floorDay = newMonth === minMonth ? min.getDate() : 1
    const d = Math.min(Math.max(cur.getDate(), floorDay), daysInMonth(curYear, newMonth))
    commitDate(newMonth, d)
  }

  function onDay(index: number): void {
    const cur = draftRef.current
    const floorDay = cur.getMonth() === minMonth ? min.getDate() : 1
    const newDay = floorDay + index
    if (newDay === cur.getDate()) return
    commitDate(cur.getMonth(), newDay)
  }

  function onHour(index: number): void {
    const cur = draftRef.current
    const floorHour =
      cur.getMonth() === minMonth && cur.getDate() === min.getDate() ? min.getHours() : 0
    const newHour = floorHour + index
    if (newHour === cur.getHours()) return
    let next = new Date(curYear, cur.getMonth(), cur.getDate(), newHour, cur.getMinutes())
    if (next < min) next = new Date(min)
    setDraft(next)
    onChange(next)
  }

  function onMinute(index: number): void {
    const cur = draftRef.current
    const onEarliestHour =
      cur.getMonth() === minMonth &&
      cur.getDate() === min.getDate() &&
      cur.getHours() === min.getHours()
    const floorMinute = onEarliestHour ? min.getMinutes() : 0
    const newMinute = floorMinute + index
    if (newMinute === cur.getMinutes()) return
    let next = new Date(curYear, cur.getMonth(), cur.getDate(), cur.getHours(), newMinute)
    if (next < min) next = new Date(min)
    setDraft(next)
    onChange(next)
  }

  return (
    <>
      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      >
        <View style={styles.chipIcon}>
          <Ionicons name={icon} size={16} color={colors.primary} />
        </View>
        <View style={styles.text}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value} numberOfLines={1}>
            {formatDateTimeShort(value.toISOString())}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>{label}</Text>
          <Text style={styles.headerValue}>{formatDateTimeShort(draft.toISOString())}</Text>
        </View>

        <View style={styles.toggle}>
          {(['date', 'time'] as const).map((t) => {
            const active = tab === t
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[styles.toggleBtn, active && styles.toggleBtnActive]}
              >
                <Ionicons
                  name={t === 'date' ? 'calendar-outline' : 'time-outline'}
                  size={16}
                  color={active ? '#fff' : colors.textSecondary}
                />
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                  {t === 'date' ? 'Ημερομηνία' : 'Ώρα'}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.wheels}>
          {tab === 'date' ? (
            <>
              <WheelPicker
                key="month"
                data={monthData}
                selectedIndex={month - minMonth}
                initialSelectedIndex={month - minMonth}
                infiniteScroll={false}
                onChangeValue={onMonth}
                elementHeight={ITEM_H}
                restElements={REST}
                decelerationRate="normal"
                flatListProps={LIST_PROPS}
                containerStyle={[styles.wheel, styles.wheelWide]}
                selectedLayoutStyle={styles.selection}
                elementTextStyle={styles.itemText}
                elementContainerStyle={styles.itemContainer}
              />
              <WheelPicker
                key={`day-${minDay}-${monthLast}`}
                data={dayData}
                selectedIndex={day - minDay}
                initialSelectedIndex={day - minDay}
                infiniteScroll={false}
                onChangeValue={onDay}
                elementHeight={ITEM_H}
                restElements={REST}
                decelerationRate="normal"
                flatListProps={LIST_PROPS}
                containerStyle={styles.wheel}
                selectedLayoutStyle={styles.selection}
                elementTextStyle={styles.itemText}
                elementContainerStyle={styles.itemContainer}
              />
            </>
          ) : (
            <>
              <WheelPicker
                key="hour"
                data={hourData}
                selectedIndex={hour - minHour}
                initialSelectedIndex={hour - minHour}
                infiniteScroll={false}
                onChangeValue={onHour}
                elementHeight={ITEM_H}
                restElements={REST}
                decelerationRate="normal"
                flatListProps={LIST_PROPS}
                containerStyle={styles.wheel}
                selectedLayoutStyle={styles.selection}
                elementTextStyle={styles.itemText}
                elementContainerStyle={styles.itemContainer}
              />
              <Text style={styles.colon}>:</Text>
              <WheelPicker
                key={`min-${minMinute}`}
                data={minuteData}
                selectedIndex={minute - minMinute}
                initialSelectedIndex={minute - minMinute}
                infiniteScroll={false}
                onChangeValue={onMinute}
                elementHeight={ITEM_H}
                restElements={REST}
                decelerationRate="normal"
                flatListProps={LIST_PROPS}
                containerStyle={styles.wheel}
                selectedLayoutStyle={styles.selection}
                elementTextStyle={styles.itemText}
                elementContainerStyle={styles.itemContainer}
              />
            </>
          )}
        </View>
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  chipPressed: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  chipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  value: { fontSize: font.small, color: colors.textMain, fontWeight: '600' },

  header: { alignItems: 'center', gap: 2 },
  headerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  headerValue: { fontSize: font.heading, fontWeight: '700', color: colors.textMain },

  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.neutralBg,
    borderRadius: radius.sm,
    padding: 3,
    gap: 3,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.sm - 3,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleText: { fontSize: font.small, fontWeight: '600', color: colors.textSecondary },
  toggleTextActive: { color: '#fff' },

  wheels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: ITEM_H * VISIBLE,
  },
  wheel: { flex: 1 },
  wheelWide: { flex: 1.8 },
  itemContainer: { paddingHorizontal: 4 },
  itemText: { fontSize: font.body, fontWeight: '600', color: colors.textMain },
  selection: {
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primaryTintBorder,
    borderRadius: radius.sm,
  },
  colon: {
    fontSize: font.heading,
    fontWeight: '700',
    color: colors.textMain,
    paddingHorizontal: 4,
  },
})
