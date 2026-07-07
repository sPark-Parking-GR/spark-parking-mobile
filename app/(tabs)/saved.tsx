import { Ionicons } from '@expo/vector-icons'
import { spacing, typography, useTheme } from '@spark/ui'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Card } from '../../src/components/ui'
import { useLanguage } from '../../src/i18n/LanguageProvider'
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
        <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
          {facility.name}
        </Text>
        <Text style={[styles.address, { color: colors.muted }]} numberOfLines={1}>
          {facility.address}
        </Text>
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
          <Ionicons name="star-outline" size={40} color={colors.faint} />
          <Text style={[styles.emptyText, { color: colors.faint }]}>{t('savedEmpty')}</Text>
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SavedFacilityRow facility={item} onPress={openFacilityDetail} />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: {
    fontSize: typography.heading.fontSize,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  card: { marginBottom: spacing.md },
  name: { fontSize: typography.label.fontSize, fontWeight: '600' },
  address: { fontSize: typography.body.fontSize, marginTop: 2 },
  rowPressed: { opacity: 0.85 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: 24 },
  emptyText: { fontSize: 15, textAlign: 'center' },
})
