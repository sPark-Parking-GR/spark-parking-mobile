import { Ionicons } from '@expo/vector-icons'
import { radii, spacing, typography, useTheme } from '../../theme'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useLanguage } from '../../i18n/LanguageProvider'
import type { FacilitySearchResult } from '../../lib/api'
import { formatDistance, formatMoney } from '../../lib/format'
import { Badge } from '../ui'

export function SelectedFacilityCard({
  facility,
  onDetails,
  onDirections,
}: {
  facility: FacilitySearchResult
  onDetails: () => void
  onDirections: () => void
}) {
  const { colors } = useTheme()
  const { t, locale } = useLanguage()
  const isBusiness = facility.kind === 'BUSINESS'

  return (
    <View style={[styles.card, { backgroundColor: colors.sheet, borderColor: colors.line }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
          {facility.name}
        </Text>
        {isBusiness && facility.priceCents != null ? (
          <Text style={[styles.price, { color: colors.pri }]}>
            {formatMoney(facility.priceCents, locale, facility.currency)}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.addr, { color: colors.muted }]} numberOfLines={1}>
        {facility.address}
      </Text>
      <View style={styles.metaRow}>
        {isBusiness ? (
          facility.onlineBookingStatus === 'NOT_OFFERED' ? (
            <Badge label={t('badgeWalkInOnly')} variant="neutral" />
          ) : (
            <Badge
              label={facility.onlineBookingStatus === 'FULL' ? t('badgeFull') : t('badgeAvailable')}
              variant={facility.onlineBookingStatus === 'FULL' ? 'error' : 'success'}
            />
          )
        ) : (
          <Badge label={t('badgeInfoOnly')} variant="neutral" />
        )}
        <Text style={[styles.distance, { color: colors.muted }]}>
          {formatDistance(facility.distanceMeters)}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={onDetails}
          style={({ pressed }) => [
            styles.detailsBtn,
            { backgroundColor: colors.card2 },
            pressed && styles.actionBtnPressed,
          ]}
        >
          <Text style={[styles.detailsLabel, { color: colors.pri }]}>{t('mapDetailsCta')}</Text>
        </Pressable>
        <Pressable
          onPress={onDirections}
          accessibilityLabel={t('mapDirectionsCta')}
          style={({ pressed }) => [
            styles.navBtn,
            { backgroundColor: colors.card2 },
            pressed && styles.actionBtnPressed,
          ]}
        >
          <Ionicons name="navigate" size={18} color={colors.pri} />
        </Pressable>
      </View>
    </View>
  )
}

const ACTION_BTN_HEIGHT = 36

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 6,
    // shadowColor: '#000',
    // shadowOpacity: 0.28,
    // shadowRadius: 12,
    // shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    width: '100%',
    height: 'auto',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  price: { fontSize: 17, fontWeight: '800' },
  addr: { fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  distance: { fontSize: typography.caption.fontSize },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  detailsBtn: {
    flex: 1,
    height: ACTION_BTN_HEIGHT,
    borderRadius: ACTION_BTN_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsLabel: { fontSize: typography.body.fontSize, fontWeight: '700' },
  navBtn: {
    width: ACTION_BTN_HEIGHT,
    height: ACTION_BTN_HEIGHT,
    borderRadius: ACTION_BTN_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPressed: { opacity: 0.6 },
})
