import { Ionicons } from '@expo/vector-icons'
import { Card, SegmentedControl, spacing, typography, useTheme } from '@spark/ui'
import type { ThemeMode } from '@spark/ui'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { Locale } from '../../src/i18n/messages'
import { useLanguage } from '../../src/i18n/LanguageProvider'

const LANGUAGE_OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'el', label: 'ΕΛ' },
]

export default function ProfileScreen() {
  const { colors, mode, setOverride } = useTheme()
  const { locale, setLocale, t } = useLanguage()
  const insets = useSafeAreaInsets()

  const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
    { value: 'dark', label: t('themeDark') },
    { value: 'light', label: t('themeLight') },
  ]

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.card2 }]}>
          <Ionicons name="person" size={40} color={colors.muted} />
        </View>
        <Text style={[styles.name, { color: colors.ink }]}>{t('profileGuest')}</Text>
      </View>

      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.ink }]}>{t('language')}</Text>
          <SegmentedControl
            options={LANGUAGE_OPTIONS}
            value={locale}
            onChange={(next) => setLocale(next as Locale)}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.line }]} />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.ink }]}>{t('theme')}</Text>
          <SegmentedControl
            options={THEME_OPTIONS}
            value={mode}
            onChange={(next) => setOverride(next as ThemeMode)}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.inertRow}>
          <Text style={[styles.rowLabel, { color: colors.ink }]}>{t('profilePaymentMethods')}</Text>
          <Text style={[styles.inertValue, { color: colors.faint }]}>
            {t('profileNotAvailableYet')}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.line }]} />
        <View style={styles.inertRow}>
          <Text style={[styles.rowLabel, { color: colors.ink }]}>{t('profileHelp')}</Text>
          <Text style={[styles.inertValue, { color: colors.faint }]}>
            {t('profileNotAvailableYet')}
          </Text>
        </View>
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  name: { fontSize: typography.heading.fontSize, fontWeight: '700' },
  card: { marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  inertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowLabel: { fontSize: typography.body.fontSize },
  inertValue: { fontSize: typography.caption.fontSize },
  divider: { height: 1 },
})
