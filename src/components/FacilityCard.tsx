import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { FacilitySearchResult } from '../lib/api'
import { formatDistance, formatMoney } from '../lib/format'
import { colors, font, radius, space } from '../theme'
import { Badge } from './ui'

function FacilityCardBase({
  result,
  onSelect,
}: {
  result: FacilitySearchResult
  onSelect: (id: string) => void
}) {
  const availability = !result.available
    ? { label: 'Πλήρες', variant: 'error' as const }
    : result.remainingSlots <= 5
      ? { label: 'Περιορισμένο', variant: 'warning' as const }
      : { label: 'Διαθέσιμο', variant: 'success' as const }

  return (
    <Pressable
      onPress={() => onSelect(result.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.left}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {result.name}
          </Text>
          {result.isPromoted ? <Badge label="Προτεινόμενο" variant="neutral" /> : null}
        </View>
        <Text style={styles.address} numberOfLines={1}>
          {result.address}
        </Text>
        <View style={styles.metaRow}>
          <Badge label={availability.label} variant={availability.variant} />
          <Text style={styles.distance}>{formatDistance(result.distanceMeters)}</Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={styles.price}>
          {result.priceCents != null ? formatMoney(result.priceCents, result.currency) : '—'}
        </Text>
        <Text style={styles.priceLabel}>συνολικά</Text>
      </View>
    </Pressable>
  )
}

// Refreshes rebuild result objects, so compare by value to skip re-rendering
// rows whose displayed fields are unchanged.
export const FacilityCard = memo(
  FacilityCardBase,
  (a, b) =>
    a.onSelect === b.onSelect &&
    a.result.id === b.result.id &&
    a.result.name === b.result.name &&
    a.result.address === b.result.address &&
    a.result.available === b.result.available &&
    a.result.remainingSlots === b.result.remainingSlots &&
    a.result.distanceMeters === b.result.distanceMeters &&
    a.result.priceCents === b.result.priceCents &&
    a.result.currency === b.result.currency &&
    a.result.isPromoted === b.result.isPromoted,
)

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  left: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { fontSize: 17, fontWeight: '600', color: colors.textMain, flexShrink: 1 },
  address: { fontSize: font.small, color: colors.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  distance: { fontSize: font.tiny, color: colors.textSecondary },
  right: { alignItems: 'flex-end', justifyContent: 'center' },
  price: { fontSize: 18, fontWeight: '700', color: colors.primary },
  priceLabel: { fontSize: font.tiny, color: colors.textSecondary },
})
