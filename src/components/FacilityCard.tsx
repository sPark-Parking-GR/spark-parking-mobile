import { spacing, typography, useTheme } from '@spark/ui'
import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Badge } from './ui'
import { useLanguage } from '../i18n/LanguageProvider'
import type { FacilitySearchResult } from '../lib/api'
import { formatDistance, formatMoney } from '../lib/format'

function FacilityCardBase({
  result,
  isCheapest,
  onSelect,
}: {
  result: FacilitySearchResult
  isCheapest?: boolean
  onSelect: (id: string) => void
}) {
  const { colors } = useTheme()
  const { locale, t } = useLanguage()
  const isBusiness = result.kind === 'BUSINESS'
  const availability = !isBusiness
    ? { label: t('badgeInfoOnly'), variant: 'neutral' as const }
    : !result.available
      ? { label: t('badgeFull'), variant: 'error' as const }
      : result.remainingSlots <= 5
        ? { label: t('badgeLimited'), variant: 'warning' as const }
        : { label: t('badgeAvailable'), variant: 'success' as const }

  return (
    <Pressable
      onPress={() => onSelect(result.id)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.left}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
            {result.name}
          </Text>
          {isCheapest ? (
            <Text
              style={[styles.cheapestTag, { color: colors.pri, backgroundColor: colors.priSoft }]}
            >
              {t('cheapestTag')}
            </Text>
          ) : null}
          {result.isPromoted ? <Badge label={t('badgePromoted')} variant="neutral" /> : null}
        </View>
        <Text style={[styles.address, { color: colors.muted }]} numberOfLines={1}>
          {result.address}
        </Text>
        <View style={styles.metaRow}>
          <Badge label={availability.label} variant={availability.variant} />
          <Text style={[styles.distance, { color: colors.muted }]}>
            {formatDistance(result.distanceMeters)}
          </Text>
        </View>
      </View>
      {isBusiness ? (
        <View style={styles.right}>
          <Text style={[styles.price, { color: colors.pri }]}>
            {result.priceCents != null
              ? formatMoney(result.priceCents, locale, result.currency)
              : '—'}
          </Text>
          <Text style={[styles.priceLabel, { color: colors.muted }]}>{t('priceTotalSuffix')}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

// Refreshes rebuild result objects, so compare by value to skip re-rendering
// rows whose displayed fields are unchanged.
export const FacilityCard = memo(
  FacilityCardBase,
  (a, b) =>
    a.onSelect === b.onSelect &&
    a.isCheapest === b.isCheapest &&
    a.result.id === b.result.id &&
    a.result.name === b.result.name &&
    a.result.address === b.result.address &&
    a.result.kind === b.result.kind &&
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
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  left: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: typography.label.fontSize, fontWeight: '700', flexShrink: 1 },
  cheapestTag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  address: { fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  distance: { fontSize: typography.caption.fontSize },
  right: { alignItems: 'flex-end', justifyContent: 'center' },
  price: { fontSize: typography.heading.fontSize, fontWeight: '800' },
  priceLabel: { fontSize: typography.caption.fontSize },
})
