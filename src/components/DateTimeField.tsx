import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import {
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { formatDateTimeShort } from '../lib/format'
import { colors, font, radius, space } from '../theme'
import { Button } from './ui'

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
const MINUTE_STEP = 5
const STEPS_PER_HOUR = 60 / MINUTE_STEP
const ITEM_H = 44
const VISIBLE = 5

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

// Round a date up to the next MINUTE_STEP boundary (drops seconds).
function snapUp(date: Date): Date {
  const d = new Date(date)
  d.setSeconds(0, 0)
  const r = d.getMinutes() % MINUTE_STEP
  if (r) d.setMinutes(d.getMinutes() + (MINUTE_STEP - r))
  return d
}

function Wheel({
  items,
  index,
  onSelect,
  flex,
}: {
  items: string[]
  index: number
  onSelect: (i: number) => void
  flex: number
}) {
  const ref = useRef<ScrollView>(null)
  const locked = items.length <= 1
  const first = useRef(true)
  const momentum = useRef(false)
  const centeredRef = useRef(index)
  const [centered, setCentered] = useState(index)

  function setCenter(i: number) {
    const clamped = Math.max(0, Math.min(items.length - 1, i))
    if (clamped !== centeredRef.current) {
      centeredRef.current = clamped
      setCentered(clamped)
    }
  }

  // Keep the scroll position in sync when the index changes from outside
  // (e.g. the day clamps after a month change). Instant on first paint.
  useEffect(() => {
    const animated = !first.current
    first.current = false
    setCenter(index)
    const id = requestAnimationFrame(() =>
      ref.current?.scrollTo({ y: index * ITEM_H, animated }),
    )
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setCenter(Math.round(e.nativeEvent.contentOffset.y / ITEM_H))
  }

  function commit() {
    if (centeredRef.current !== index) onSelect(centeredRef.current)
    else ref.current?.scrollTo({ y: index * ITEM_H, animated: true })
  }

  function tap(i: number) {
    setCenter(i)
    ref.current?.scrollTo({ y: i * ITEM_H, animated: true })
    if (i !== index) onSelect(i)
  }

  return (
    <View style={[styles.wheel, { flex }]}>
      <ScrollView
        ref={ref}
        scrollEnabled={!locked}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="normal"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          momentum.current = false
        }}
        onMomentumScrollBegin={() => {
          momentum.current = true
        }}
        onMomentumScrollEnd={commit}
        onScrollEndDrag={() => {
          requestAnimationFrame(() => {
            if (!momentum.current) commit()
          })
        }}
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
      >
        {items.map((label, i) => (
          <Pressable key={label} style={styles.item} onPress={() => tap(i)}>
            <Text style={[styles.itemText, i === centered && styles.itemTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View pointerEvents="none" style={styles.selection} />
    </View>
  )
}

export function DateTimeField({
  label,
  icon,
  value,
  minimumDate,
  onChange,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  value: Date
  minimumDate?: Date
  onChange: (date: Date) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [tab, setTab] = useState<'date' | 'time'>('date')

  const now = new Date()
  const min = snapUp(minimumDate && minimumDate > now ? minimumDate : now)
  // Input is bound to the current month/year.
  const curYear = min.getFullYear()
  const curMonth = min.getMonth()

  function openPicker() {
    setDraft(draftFor(value < min ? min : value))
    setTab('date')
    setOpen(true)
  }

  // Snap an incoming value onto the allowed grid (current month/year, minute step).
  function draftFor(d: Date): Date {
    const snapped = snapUp(d)
    return new Date(curYear, curMonth, snapped.getDate(), snapped.getHours(), snapped.getMinutes())
  }

  function confirm() {
    onChange(draft)
    setOpen(false)
  }

  // Day range: today → end of the current month.
  const minDay = min.getDate()
  const dayValues = range(minDay, daysInMonth(curYear, curMonth))
  const day = Math.min(Math.max(draft.getDate(), minDay), dayValues[dayValues.length - 1]!)

  // Hours: bounded by the floor only on the earliest selectable day.
  const onMinDay = day === minDay
  const minHour = onMinDay ? min.getHours() : 0
  const hourValues = range(minHour, 23)
  const hour = Math.min(Math.max(draft.getHours(), minHour), 23)

  // Minutes: bounded by the floor only at the earliest selectable hour.
  const onMinHour = onMinDay && hour === min.getHours()
  const minStep = onMinHour ? Math.ceil(min.getMinutes() / MINUTE_STEP) : 0
  const minuteValues = range(minStep, STEPS_PER_HOUR - 1).map((s) => s * MINUTE_STEP)
  const minuteIdx = Math.min(
    Math.max(Math.round(draft.getMinutes() / MINUTE_STEP), minStep),
    STEPS_PER_HOUR - 1,
  )
  const minute = minuteIdx * MINUTE_STEP

  function build(parts: { d?: number; h?: number; mi?: number }): void {
    const next = new Date(
      curYear,
      curMonth,
      parts.d ?? day,
      parts.h ?? hour,
      parts.mi ?? minute,
    )
    setDraft(next < min ? new Date(min) : next)
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

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.grip} />
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
                  <Wheel items={[MONTHS[curMonth]!]} index={0} onSelect={() => {}} flex={1.6} />
                  <Wheel
                    items={dayValues.map(String)}
                    index={day - minDay}
                    onSelect={(i) => build({ d: dayValues[i] })}
                    flex={1}
                  />
                  <Wheel items={[String(curYear)]} index={0} onSelect={() => {}} flex={1.2} />
                </>
              ) : (
                <>
                  <Wheel
                    items={hourValues.map(pad)}
                    index={hour - minHour}
                    onSelect={(i) => build({ h: hourValues[i] })}
                    flex={1}
                  />
                  <Text style={styles.colon}>:</Text>
                  <Wheel
                    items={minuteValues.map(pad)}
                    index={minuteIdx - minStep}
                    onSelect={(i) => build({ mi: minuteValues[i] })}
                    flex={1}
                  />
                </>
              )}
            </View>

            <View style={styles.footer}>
              <View style={styles.footerBtn}>
                <Button label="Άκυρο" variant="secondary" onPress={() => setOpen(false)} />
              </View>
              <View style={styles.footerBtn}>
                <Button label="Επιβεβαίωση" icon="checkmark" onPress={confirm} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  chipPressed: { borderColor: colors.primary, backgroundColor: '#f4fbfb' },
  chipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eaf7f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  label: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' },
  value: { fontSize: font.small, color: colors.textMain, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: space.md,
  },
  grip: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
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
  wheel: { height: ITEM_H * VISIBLE },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: font.body, color: colors.textSecondary },
  itemTextActive: { fontSize: font.heading, fontWeight: '700', color: colors.textMain },
  selection: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: ITEM_H * Math.floor(VISIBLE / 2),
    height: ITEM_H,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(18,163,160,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(18,163,160,0.35)',
  },
  colon: { fontSize: font.heading, fontWeight: '700', color: colors.textMain, paddingHorizontal: 4 },

  footer: { flexDirection: 'row', gap: space.sm },
  footerBtn: { flex: 1 },
})
