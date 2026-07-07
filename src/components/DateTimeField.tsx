import { Ionicons } from '@expo/vector-icons'
import { typography, useTheme } from '@spark/ui'
import { useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { WheelPicker } from 'react-native-infinite-wheel-picker'

import { Sheet } from './Sheet'
import { useLanguage } from '../i18n/LanguageProvider'
import type { Locale } from '../i18n/messages'
import { formatDateTimeShort } from '../lib/format'

function monthName(month: number, locale: Locale): string {
  const intlLocale = locale === 'en' ? 'en-US' : 'el-GR'
  return new Intl.DateTimeFormat(intlLocale, { month: 'long' }).format(new Date(2020, month, 1))
}

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
  const { colors, radii } = useTheme()
  const { locale, t } = useLanguage()
  const selectionStyle = {
    backgroundColor: colors.priSoft,
    borderWidth: 1,
    borderColor: colors.pri,
    borderRadius: radii.sm,
  }
  const itemTextStyle = {
    fontSize: typography.body.fontSize,
    fontWeight: '600' as const,
    color: colors.ink,
  }
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

  const monthData = useMemo(
    () => range(minMonth, 11).map((m) => monthName(m, locale)),
    [minMonth, locale],
  )
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
        style={({ pressed }) => [
          styles.chip,
          { borderColor: colors.line, borderRadius: radii.sm, backgroundColor: colors.surface },
          pressed && { borderColor: colors.pri, backgroundColor: colors.priSoft },
        ]}
      >
        <View style={[styles.chipIcon, { backgroundColor: colors.priSoft }]}>
          <Ionicons name={icon} size={16} color={colors.pri} />
        </View>
        <View style={styles.text}>
          <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
          <Text
            style={[styles.value, { fontSize: typography.body.fontSize, color: colors.ink }]}
            numberOfLines={1}
          >
            {formatDateTimeShort(value.toISOString(), locale)}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </Pressable>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <View style={styles.header}>
          <Text style={[styles.headerLabel, { color: colors.muted }]}>{label}</Text>
          <Text
            style={[
              styles.headerValue,
              { fontSize: typography.heading.fontSize, color: colors.ink },
            ]}
          >
            {formatDateTimeShort(draft.toISOString(), locale)}
          </Text>
        </View>

        <View style={[styles.toggle, { backgroundColor: colors.card2, borderRadius: radii.sm }]}>
          {(['date', 'time'] as const).map((tabKey) => {
            const active = tab === tabKey
            return (
              <Pressable
                key={tabKey}
                onPress={() => setTab(tabKey)}
                style={[
                  styles.toggleBtn,
                  { borderRadius: radii.sm - 3 },
                  active && { backgroundColor: colors.pri, ...styles.toggleBtnActive },
                ]}
              >
                <Ionicons
                  name={tabKey === 'date' ? 'calendar-outline' : 'time-outline'}
                  size={16}
                  color={active ? '#fff' : colors.muted}
                />
                <Text
                  style={[
                    styles.toggleText,
                    { fontSize: typography.body.fontSize, color: colors.muted },
                    active && styles.toggleTextActive,
                  ]}
                >
                  {tabKey === 'date' ? t('dateTabLabel') : t('timeTabLabel')}
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
                selectedLayoutStyle={selectionStyle}
                elementTextStyle={itemTextStyle}
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
                selectedLayoutStyle={selectionStyle}
                elementTextStyle={itemTextStyle}
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
                selectedLayoutStyle={selectionStyle}
                elementTextStyle={itemTextStyle}
                elementContainerStyle={styles.itemContainer}
              />
              <Text
                style={[styles.colon, { fontSize: typography.heading.fontSize, color: colors.ink }]}
              >
                :
              </Text>
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
                selectedLayoutStyle={selectionStyle}
                elementTextStyle={itemTextStyle}
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
  },
  chipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  value: { fontWeight: '600' },

  header: { alignItems: 'center', gap: 2 },
  headerLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerValue: { fontWeight: '700' },

  toggle: {
    flexDirection: 'row',
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
  },
  toggleBtnActive: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleText: { fontWeight: '600' },
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
  colon: {
    fontWeight: '700',
    paddingHorizontal: 4,
  },
})
