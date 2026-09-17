import { spacing, typography, useTheme } from '../theme'
import { useEffect } from 'react'
import { BackHandler, StyleSheet, Text, View } from 'react-native'

import { Button } from '../components/ui'
import { useLanguage } from '../i18n/LanguageProvider'
import { useOverlay } from '../navigation/OverlayContext'

const AMENITY_KEYS = [
  'filterCctv',
  'filterCovered',
  'filterEvCharging',
  'filterAccessible',
] as const

export function FiltersOverlay() {
  const { closeSheet } = useOverlay()
  const { t } = useLanguage()
  const { colors, radii } = useTheme()

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSheet()
      return true
    })
    return () => sub.remove()
  }, [closeSheet])

  return (
    <>
      <Text style={[styles.title, { color: colors.ink }]}>{t('filtersTitle')}</Text>
      <Text style={[styles.note, { color: colors.muted }]}>{t('filtersComingSoon')}</Text>
      <Text style={[styles.eyebrow, { color: colors.muted }]}>{t('filtersAmenities')}</Text>
      <View style={styles.chips}>
        {AMENITY_KEYS.map((key) => (
          <View
            key={key}
            style={[styles.chip, { borderColor: colors.line, borderRadius: radii.md }]}
          >
            <Text style={[styles.chipText, { color: colors.ink }]}>{t(key)}</Text>
          </View>
        ))}
      </View>
      <Button label={t('bookingApply')} onPress={closeSheet} />
    </>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: typography.heading.fontSize, fontWeight: typography.heading.fontWeight },
  note: { fontSize: typography.body.fontSize, marginTop: -spacing.sm },
  eyebrow: {
    fontSize: typography.eyebrow.fontSize,
    fontWeight: typography.eyebrow.fontWeight,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, opacity: 0.4 },
  chip: { paddingVertical: 10, paddingHorizontal: 15, borderWidth: 1 },
  chipText: { fontSize: typography.body.fontSize, fontWeight: '700' },
})
