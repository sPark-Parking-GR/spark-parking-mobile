import { Ionicons } from '@expo/vector-icons'
import { Card, SegmentedControl, spacing, typography, useTheme } from '@spark/ui'
import type { ThemeMode } from '@spark/ui'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '../../src/auth/AuthProvider'
import { DeleteAccountDialog } from '../../src/components/DeleteAccountDialog'
import type { Locale } from '../../src/i18n/messages'
import { useLanguage } from '../../src/i18n/LanguageProvider'
import { tabBarFloatOffset } from '../../src/lib/constants'
import { hasNotificationPermission } from '../../src/lib/pushNotifications'
import { useOverlay } from '../../src/navigation/OverlayContext'

const LANGUAGE_OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'el', label: 'ΕΛ' },
]

export default function ProfileScreen() {
  const { colors, radii, mode, setOverride } = useTheme()
  const { locale, setLocale, t } = useLanguage()
  const { status, user, isAuthenticated, signOut, enableNotifications } = useAuth()
  const { openAuth, openPlan } = useOverlay()
  const insets = useSafeAreaInsets()
  const barOffset = tabBarFloatOffset(insets.bottom)
  const [deleting, setDeleting] = useState(false)
  const [notificationsOn, setNotificationsOn] = useState(false)
  const [notificationsDenied, setNotificationsDenied] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    hasNotificationPermission()
      .then(setNotificationsOn)
      .catch(() => undefined)
  }, [isAuthenticated])

  const handleEnableNotifications = () => {
    enableNotifications()
      .then((granted) => {
        setNotificationsOn(granted)
        setNotificationsDenied(!granted)
      })
      .catch(() => undefined)
  }

  const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
    { value: 'dark', label: t('themeDark') },
    { value: 'light', label: t('themeLight') },
  ]

  const subtitle = user
    ? user.displayName
      ? user.email
      : null
    : status === 'anonymous'
      ? t('profileSignedOutBody')
      : null

  const handleSignOut = () => {
    signOut().catch(() => undefined)
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.md + barOffset },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.card2 }]}>
          <Ionicons name="person" size={28} color={colors.muted} />
        </View>
        {/* Nothing is rendered while the keystore is still being read, so a stored
            session never flashes as "Guest" before it resolves. */}
        {status === 'restoring' ? null : (
          <View style={styles.identity}>
            <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
              {user ? (user.displayName ?? user.email) : t('profileGuest')}
            </Text>
            {subtitle ? (
              <Text style={[styles.identitySub, { color: colors.muted }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <Card padding={0} style={styles.card}>
        <View style={[styles.cardClip, { borderRadius: radii.lg }]}>
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
          {/* A rider's own subscription — nothing a guest has, so the row only exists
              once there is an account behind it. */}
          {isAuthenticated ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.line }]} />
              <Pressable
                onPress={openPlan}
                style={({ pressed }) => [styles.inertRow, pressed && styles.navRowPressed]}
              >
                <Text style={[styles.rowLabel, { color: colors.ink }]}>{t('profilePlan')}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.faint} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: colors.line }]} />
              <Pressable
                onPress={notificationsOn ? undefined : handleEnableNotifications}
                disabled={notificationsOn}
                style={styles.inertRow}
              >
                <Text style={[styles.rowLabel, { color: colors.ink }]}>
                  {t('profileNotifications')}
                </Text>
                <Text style={[styles.inertValue, { color: colors.faint }]}>
                  {notificationsOn ? t('profileNotificationsOn') : t('profileNotificationsOff')}
                </Text>
              </Pressable>
              {notificationsDenied ? (
                <Text style={[styles.accountNote, { color: colors.faint }]}>
                  {t('profileNotificationsDenied')}
                </Text>
              ) : null}
            </>
          ) : null}
          <View style={[styles.divider, { backgroundColor: colors.line }]} />
          <View style={styles.inertRow}>
            <Text style={[styles.rowLabel, { color: colors.ink }]}>{t('profileHelp')}</Text>
            <Text style={[styles.inertValue, { color: colors.faint }]}>
              {t('profileNotAvailableYet')}
            </Text>
          </View>
        </View>
      </Card>

      {status === 'restoring' ? null : isAuthenticated ? (
        <>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.accountAction,
              { borderColor: colors.line },
              pressed && styles.accountActionPressed,
            ]}
          >
            <Text style={[styles.accountActionText, { color: colors.bad }]}>
              {t('profileSignOut')}
            </Text>
          </Pressable>
          {/* Sign-out revokes server-side sessions for the account, not just this
              handset — say so rather than let it surprise the user's other device. */}
          <Text style={[styles.accountNote, { color: colors.faint }]}>
            {t('profileSignOutAllDevices')}
          </Text>
          {/* In-app account deletion, required by App Store Review Guideline 5.1.1(v).
              Reachable in one tap from the account screen, and confirmed — with the
              password — in the dialog rather than here. */}
          <Pressable
            onPress={() => setDeleting(true)}
            style={({ pressed }) => [
              styles.accountAction,
              styles.destructiveAction,
              { borderColor: colors.bad },
              pressed && styles.accountActionPressed,
            ]}
          >
            <Text style={[styles.accountActionText, { color: colors.bad }]}>
              {t('profileDeleteAccount')}
            </Text>
          </Pressable>
          <DeleteAccountDialog open={deleting} onClose={() => setDeleting(false)} />
        </>
      ) : (
        <Pressable
          onPress={() => openAuth('signIn')}
          style={({ pressed }) => [
            styles.accountAction,
            { borderColor: colors.line },
            pressed && styles.accountActionPressed,
          ]}
        >
          <Text style={[styles.accountActionText, { color: colors.pri }]}>
            {t('profileSignIn')}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md },
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
  identity: { flex: 1, gap: 2 },
  name: { fontSize: typography.heading.fontSize, fontWeight: typography.heading.fontWeight },
  identitySub: { fontSize: typography.caption.fontSize },
  card: { marginBottom: spacing.md },
  cardClip: { overflow: 'hidden' },
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
  navRowPressed: { opacity: 0.6 },
  divider: { height: 1 },
  accountAction: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
  },
  accountActionPressed: { opacity: 0.6 },
  destructiveAction: { marginTop: spacing.md },
  accountActionText: { fontSize: typography.body.fontSize, fontWeight: '700' },
  accountNote: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
})
