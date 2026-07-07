import { Badge, Card, spacing, typography, useTheme } from '@spark/ui'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useLanguage } from '../../src/i18n/LanguageProvider'
import { vehicleLabel } from '../../src/lib/constants'
import { formatMoney, formatTimeRange } from '../../src/lib/format'
import type { TripRecord } from '../../src/lib/trips'
import { useOverlay } from '../../src/navigation/OverlayContext'

export default function TripsScreen() {
  const { colors } = useTheme()
  const { t, locale } = useLanguage()
  const { trips, openFacilityDetail } = useOverlay()
  const insets = useSafeAreaInsets()

  const sorted = [...trips].sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt))

  const renderItem = ({ item }: { item: TripRecord }) => {
    const isActive = new Date(item.endsAt) > new Date()
    return (
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={[styles.facilityName, { color: colors.ink }]} numberOfLines={1}>
            {item.facilityName}
          </Text>
          <Badge variant={isActive ? 'ok' : 'neutral'}>
            {isActive ? t('tripsActive') : t('tripsPast')}
          </Badge>
        </View>
        <Text style={[styles.recap, { color: colors.muted }]}>
          {formatTimeRange(item.startsAt, item.endsAt, locale)}
        </Text>
        <Text style={[styles.recap, { color: colors.muted }]}>
          {vehicleLabel(item.vehicleType, t)}
        </Text>
        <View style={[styles.footerRow, { borderTopColor: colors.line }]}>
          <View>
            <Text style={[styles.code, { color: colors.pri }]}>{item.code}</Text>
            <Text style={[styles.price, { color: colors.ink }]}>
              {formatMoney(item.totalCents, locale, item.currency)}
            </Text>
          </View>
          <Pressable onPress={() => openFacilityDetail(item.facilityId)} hitSlop={8}>
            <Text style={[styles.directions, { color: colors.pri }]}>{t('tripsDirections')}</Text>
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
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: {
    fontSize: typography.display.fontSize,
    fontWeight: '600',
    padding: spacing.md,
    paddingBottom: 0,
  },
  list: { padding: spacing.md, gap: spacing.md },
  card: { marginBottom: spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  facilityName: { fontSize: typography.heading.fontSize, fontWeight: '600', flexShrink: 1 },
  recap: { fontSize: typography.body.fontSize, marginTop: 4 },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  code: { fontSize: typography.caption.fontSize, fontWeight: '700', letterSpacing: 1 },
  price: { fontSize: typography.body.fontSize, fontWeight: '600' },
  directions: { fontSize: typography.label.fontSize, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 15, textAlign: 'center' },
})
