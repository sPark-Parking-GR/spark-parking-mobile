import { Badge, Card, spacing, typography, useTheme } from '@spark/ui'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useLanguage } from '../../src/i18n/LanguageProvider'
import { tabBarFloatOffset, vehicleLabel } from '../../src/lib/constants'
import { formatMoney, formatTimeRange } from '../../src/lib/format'
import type { TripRecord } from '../../src/lib/trips'
import { useOverlay } from '../../src/navigation/OverlayContext'

export default function TripsScreen() {
  const { colors } = useTheme()
  const { t, locale } = useLanguage()
  const { trips, openFacilityDetail } = useOverlay()
  const insets = useSafeAreaInsets()
  const barOffset = tabBarFloatOffset(insets.bottom)

  const sorted = [...trips].sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt))

  const renderItem = ({ item }: { item: TripRecord }) => {
    const isActive = new Date(item.endsAt) > new Date()
    return (
      <Card padding={16} style={styles.card}>
        <View style={styles.headerRow}>
          <Badge variant={isActive ? 'ok' : 'neutral'}>
            {isActive ? t('tripsActive') : t('tripsPast')}
          </Badge>
          <Text style={[styles.price, { color: colors.ink }]}>
            {formatMoney(item.totalCents, locale, item.currency)}
          </Text>
        </View>
        <Text style={[styles.facilityName, { color: colors.ink }]} numberOfLines={1}>
          {item.facilityName}
        </Text>
        <Text style={[styles.recap, { color: colors.muted }]}>
          {formatTimeRange(item.startsAt, item.endsAt, locale)} · {vehicleLabel(item.vehicleType, t)}
        </Text>
        <View style={[styles.footerRow, { borderTopColor: colors.line }]}>
          <Text style={[styles.code, { color: colors.pri }]}>{item.code}</Text>
          <Pressable onPress={() => openFacilityDetail(item.facilityId)} hitSlop={8}>
            <Text style={[styles.directions, { color: colors.pri }]}>
              {t('tripsDirections')} →
            </Text>
          </Pressable>
        </View>
      </Card>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: colors.ink }]}>{t('tripsTitle')}</Text>
      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.faint }]}>{t('tripsEmpty')}</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => `${item.code}-${item.confirmedAt}`}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: spacing.md + barOffset }]}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    padding: spacing.md,
    paddingBottom: 0,
  },
  list: { padding: spacing.md, gap: 12 },
  card: { borderRadius: 18 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 9,
  },
  facilityName: {
    fontSize: 16,
    fontWeight: typography.heading.fontWeight,
    marginTop: 6,
  },
  recap: { fontSize: 12, marginTop: 4 },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  code: { fontSize: typography.caption.fontSize, fontWeight: '700', letterSpacing: 1 },
  price: { fontSize: 16, fontWeight: '800' },
  directions: { fontSize: 13, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 15, textAlign: 'center' },
})
