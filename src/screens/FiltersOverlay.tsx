import { spacing, typography, useTheme } from '@spark/ui'
import { useEffect } from 'react'
import { BackHandler, StyleSheet, Text, View } from 'react-native'

import { Badge, Button } from '../components/ui'
import { useLanguage } from '../i18n/LanguageProvider'
import { useOverlay } from '../navigation/OverlayContext'

const AMENITY_KEYS = [
  'filterCctv',
  'filterCovered',
  'filterEvCharging',
  'filterAccessible',
] as const

export function FiltersOverlay() {
  const { closeOverlay } = useOverlay()
  const { t } = useLanguage()
  const { colors } = useTheme()

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeOverlay()
      return true
    })
    return () => sub.remove()
  }, [closeOverlay])

  return (
    <>
      <Text style={[styles.title, { color: colors.ink }]}>{t('filtersTitle')}</Text>
      <Text style={[styles.note, { color: colors.muted }]}>{t('filtersComingSoon')}</Text>
      <View style={styles.chips}>
        {AMENITY_KEYS.map((key) => (
          <View key={key} style={styles.chipMuted}>
            <Badge label={t(key)} variant="neutral" />
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button label={t('filtersReset')} variant="secondary" onPress={closeOverlay} />
        </View>
        <View style={styles.action}>
          <Button label={t('bookingApply')} onPress={closeOverlay} />
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: typography.heading.fontSize, fontWeight: '700' },
  note: { fontSize: typography.body.fontSize, marginTop: -spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipMuted: { opacity: 0.4 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
})
