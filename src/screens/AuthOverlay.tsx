import { Ionicons } from '@expo/vector-icons'
import { spacing, typography, useTheme } from '@spark/ui'
import { useEffect, useState } from 'react'
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import { useAuth } from '../auth/AuthProvider'
import { Button, Card, Field } from '../components/ui'
import { useLanguage } from '../i18n/LanguageProvider'
import type { AuthMode } from '../navigation/OverlayContext'
import { useOverlay } from '../navigation/OverlayContext'

const emailSchema = z.string().trim().email()

const PASSWORD_MIN = 8
const PASSWORD_MAX = 128

const TITLE_KEY: Record<AuthMode, string> = {
  signIn: 'authSignInTitle',
  signUp: 'authSignUpTitle',
  forgotPassword: 'authForgotTitle',
}

const SUBTITLE_KEY: Record<AuthMode, string> = {
  signIn: 'authSignInSubtitle',
  signUp: 'authSignUpSubtitle',
  forgotPassword: 'authForgotSubtitle',
}

const SUBMIT_KEY: Record<AuthMode, string> = {
  signIn: 'authSignInCta',
  signUp: 'authSignUpCta',
  forgotPassword: 'authForgotCta',
}

function validationKey(mode: AuthMode, email: string, password: string): string | null {
  if (!emailSchema.safeParse(email).success) return 'authInvalidEmail'
  if (mode === 'forgotPassword') return null
  if (mode === 'signIn') return password.length > 0 ? null : 'authPasswordRequired'
  if (password.length < PASSWORD_MIN) return 'authPasswordTooShort'
  if (password.length > PASSWORD_MAX) return 'authPasswordTooLong'
  return null
}

export function AuthOverlay({ mode: initialMode }: { mode: AuthMode }) {
  const { completeAuth, cancelAuth } = useOverlay()
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const { t } = useLanguage()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      cancelAuth()
      return true
    })
    return () => sub.remove()
  }, [cancelAuth])

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
    setResetSent(false)
    setPassword('')
  }

  const submit = () => {
    handleSubmit().catch(() => undefined)
  }

  async function handleSubmit(): Promise<void> {
    if (submitting) return

    const invalid = validationKey(mode, email, password)
    if (invalid) {
      setError(t(invalid))
      return
    }

    setSubmitting(true)
    setError(null)
    const address = email.trim()
    const name = displayName.trim()

    try {
      if (mode === 'forgotPassword') {
        await requestPasswordReset(address)
        setResetSent(true)
        setSubmitting(false)
        return
      }

      if (mode === 'signIn') {
        await signIn({ email: address, password })
      } else {
        await signUp({ email: address, password, ...(name ? { displayName: name } : {}) })
      }

      completeAuth()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('authGenericError'))
      setSubmitting(false)
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Pressable
        onPress={cancelAuth}
        style={({ pressed }) => [
          styles.close,
          { top: insets.top + spacing.sm, backgroundColor: colors.sheet },
          pressed && styles.closePressed,
        ]}
        hitSlop={12}
      >
        <Ionicons name="arrow-back" size={24} color={colors.ink} />
      </Pressable>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.xl + spacing.md },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: colors.ink }]}>{t(TITLE_KEY[mode])}</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>{t(SUBTITLE_KEY[mode])}</Text>

          {resetSent ? (
            <Card style={[styles.card, styles.cardRadius]}>
              <Text style={[styles.notice, { color: colors.ink }]}>{t('authForgotSent')}</Text>
            </Card>
          ) : (
            <Card style={[styles.card, styles.cardRadius]}>
              {mode === 'signUp' ? (
                <Field
                  label={t('authName')}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t('authNamePlaceholder')}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  maxLength={80}
                  editable={!submitting}
                />
              ) : null}

              <Field
                label={t('authEmail')}
                value={email}
                onChangeText={setEmail}
                placeholder={t('authEmailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                editable={!submitting}
              />

              {mode === 'forgotPassword' ? null : (
                <Field
                  label={t('authPassword')}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={
                    mode === 'signUp' ? t('authPasswordHint') : t('authPasswordPlaceholder')
                  }
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                  textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
                  maxLength={PASSWORD_MAX}
                  editable={!submitting}
                />
              )}
            </Card>
          )}

          {error ? <Text style={[styles.error, { color: colors.bad }]}>{error}</Text> : null}

          <View style={styles.submit}>
            {resetSent ? (
              <Button label={t('authBackToSignIn')} onPress={() => switchMode('signIn')} />
            ) : (
              <Button label={t(SUBMIT_KEY[mode])} onPress={submit} loading={submitting} />
            )}
          </View>

          {mode === 'signIn' && !resetSent ? (
            <Pressable
              onPress={() => switchMode('forgotPassword')}
              style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
            >
              <Text style={[styles.linkText, { color: colors.pri }]}>{t('authForgotLink')}</Text>
            </Pressable>
          ) : null}

          {resetSent ? null : (
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.muted }]}>
                {mode === 'signUp' ? t('authHasAccount') : t('authNoAccount')}
              </Text>
              <Pressable
                onPress={() => switchMode(mode === 'signUp' ? 'signIn' : 'signUp')}
                style={({ pressed }) => [pressed && styles.linkPressed]}
                hitSlop={8}
              >
                <Text style={[styles.linkText, { color: colors.pri }]}>
                  {mode === 'signUp' ? t('authSignInCta') : t('authSignUpCta')}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  close: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  closePressed: { opacity: 0.85 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: typography.body.fontSize, marginTop: spacing.xs },
  card: { marginTop: 14 },
  cardRadius: { borderRadius: 18 },
  notice: { fontSize: typography.body.fontSize, lineHeight: 20 },
  error: {
    fontSize: typography.body.fontSize,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  submit: { marginTop: spacing.md },
  link: { alignSelf: 'center', paddingVertical: spacing.sm },
  linkPressed: { opacity: 0.6 },
  linkText: { fontSize: typography.body.fontSize, fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  switchLabel: { fontSize: typography.body.fontSize },
})
