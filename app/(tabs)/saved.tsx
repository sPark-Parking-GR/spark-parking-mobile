import { Ionicons } from '@expo/vector-icons'
import { spacing, typography, useTheme } from '@spark/ui'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

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
  return (
    <Pressable
      onPress={() => onPress(facility.id)}
      style={({ pressed }) => pressed && styles.rowPressed}
    >
      <Card style={styles.card}>
        <View style={styles.avatar}>
          <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
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
        </View>
      </Card>
    </Pressable>
  )
}

export default function SavedScreen() {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const insets = useSafeAreaInsets()
  const { saved, reload } = useSavedFacilities()
  const { openFacilityDetail } = useOverlay()
  const barOffset = tabBarFloatOffset(insets.bottom)

  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload]),
  )

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: colors.ink }]}>{t('savedTitle')}</Text>
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyIcon: { marginBottom: 14 },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
})
