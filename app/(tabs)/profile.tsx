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
          <Ionicons name="person" size={28} color={colors.muted} />
        </View>
        <Text style={[styles.name, { color: colors.ink }]}>{t('profileGuest')}</Text>
      </View>

      <Card padding={0} style={styles.card}>
        <View style={styles.settingsBlock}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>{t('settings')}</Text>
          <View style={[styles.row, styles.rowSpaced]}>
            <Text style={[styles.rowLabel, { color: colors.ink }]}>{t('language')}</Text>
            <SegmentedControl
              options={LANGUAGE_OPTIONS}
              value={locale}
              onChange={(next) => setLocale(next as Locale)}
            />
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.ink }]}>{t('theme')}</Text>
            <SegmentedControl
              options={THEME_OPTIONS}
              value={mode}
              onChange={(next) => setOverride(next as ThemeMode)}
            />
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.line }]} />
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

      <View style={[styles.signOut, { borderColor: colors.line }]}>
        <Text style={[styles.signOutText, { color: colors.bad }]}>{t('profileSignOut')}</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: typography.heading.fontSize, fontWeight: typography.heading.fontWeight },
  card: { marginBottom: spacing.md, overflow: 'hidden' },
  settingsBlock: { paddingHorizontal: spacing.md, paddingTop: 15, paddingBottom: 15 },
  eyebrow: {
    fontSize: typography.eyebrow.fontSize,
    fontWeight: typography.eyebrow.fontWeight,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowSpaced: { marginBottom: 15 },
  inertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
  },
  rowLabel: { fontSize: typography.body.fontSize, fontWeight: typography.body.fontWeight },
  inertValue: { fontSize: typography.caption.fontSize },
  divider: { height: 1 },
  signOut: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
  },
  signOutText: { fontSize: typography.body.fontSize, fontWeight: '700' },
})
