import { Ionicons } from '@expo/vector-icons'
import { Badge, spacing, typography, useTheme } from '../../src/theme'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { useAuth } from '../../src/auth/AuthProvider'
import { Card } from '../../src/components/ui'
import { LogoMark } from '../../src/components/map/logo'
import { useLanguage } from '../../src/i18n/LanguageProvider'
import { tabBarFloatOffset } from '../../src/lib/constants'
import { useSavedFacilities, type SavedFacility } from '../../src/lib/savedFacilities'
import { useOverlay } from '../../src/navigation/OverlayContext'

function SavedFacilityRow({
  facility,
  onPress,
}: {
  facility: SavedFacility
  onPress: (id: string) => void
}) {
  const { colors } = useTheme()
  const { t } = useLanguage()

  // The server keeps bookmarks whose facility has been deactivated, un-verified or
  // restricted, so the row has to say so: its detail page no longer resolves, and letting
  // the tap through would land the user on an error instead of a parking spot.
  return (
    <Pressable
      onPress={() => onPress(facility.id)}
      disabled={!facility.available}
      style={({ pressed }) => [
        pressed && styles.rowPressed,
        !facility.available && styles.rowUnavailable,
      ]}
    >
      <Card style={styles.card}>
        <View style={styles.avatar}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="savedAvatarGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.pri} />
                <Stop offset="1" stopColor={colors.pri2} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#savedAvatarGrad)" />
          </Svg>
          <LogoMark size={22} color="#fff" />
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
            {facility.name}
          </Text>
          <Text style={[styles.address, { color: colors.muted }]} numberOfLines={1}>
            {facility.address}
          </Text>
          {facility.available ? null : (
            <View style={styles.rowBadge}>
              <Badge variant="neutral">{t('savedUnavailable')}</Badge>
            </View>
          )}
        </View>
      </Card>
    </Pressable>
  )
}

export default function SavedScreen() {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const insets = useSafeAreaInsets()
  const { status, isAuthenticated } = useAuth()
  const { saved, reload } = useSavedFacilities()
  const { openFacilityDetail, openAuth } = useOverlay()
  const barOffset = tabBarFloatOffset(insets.bottom)

  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload]),
  )

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: colors.ink }]}>{t('savedTitle')}</Text>
      {/* Favourites work fully offline for a guest — the sync banner is a nudge to back
          them up, never a gate on using the tab. */}
      {status === 'restoring' || isAuthenticated ? null : (
        <Pressable
          onPress={() => openAuth('signIn')}
          style={({ pressed }) => [
            styles.syncBanner,
            { backgroundColor: colors.card2 },
            pressed && styles.rowPressed,
          ]}
        >
          <Ionicons name="cloud-upload-outline" size={20} color={colors.pri} />
          <Text style={[styles.syncBannerText, { color: colors.ink }]}>
            {t('savedSignedOutBody')}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>
      )}
      {saved.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="star-outline" size={40} color={colors.faint} style={styles.emptyIcon} />
          <Text style={[styles.emptyText, { color: colors.faint }]}>{t('savedEmpty')}</Text>
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SavedFacilityRow facility={item} onPress={openFacilityDetail} />
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: spacing.xl + barOffset }]}
        />
      )}
    </View>
  )
}

const AVATAR_SIZE = 44

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    paddingHorizontal: 20,
    paddingTop: spacing.sm,
    paddingBottom: 14,
  },
  listContent: { paddingHorizontal: 18, paddingTop: spacing.xs, paddingBottom: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: typography.label.fontSize, fontWeight: typography.label.fontWeight },
  address: { fontSize: 12, fontWeight: '400', marginTop: 2 },
  rowPressed: { opacity: 0.85 },
  rowUnavailable: { opacity: 0.55 },
  rowBadge: { marginTop: 6 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyIcon: { marginBottom: 14 },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: 18,
    marginBottom: spacing.sm,
    padding: 14,
    borderRadius: 16,
  },
  syncBannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
})
