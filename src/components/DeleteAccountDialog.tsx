import { spacing, typography, useTheme } from '../theme'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useAuth } from '../auth/AuthProvider'
import { useLanguage } from '../i18n/LanguageProvider'
import { ApiError } from '../lib/http'
import { Button, Card, Field } from './ui'

const PASSWORD_MAX = 128

// 401 is the wrong password and 409 the account still owing somebody a parking space —
// both are the user's to act on, so neither may surface as the generic failure.
function errorKey(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return 'deleteAccountWrongPassword'
  if (error instanceof ApiError && error.status === 409) return 'deleteAccountHasBookings'
  return 'deleteAccountError'
}

export function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { colors, radii } = useTheme()
  const { t } = useLanguage()
  const { user, deleteAccount } = useAuth()
  // A dashboard identity (operator, platform or super admin) is preserved server-side —
  // only this app's own data is cleared — so the confirmation must not claim the whole
  // account and password are erased.
  const mobileOnly = user != null && user.role !== 'user'

  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (submitting) return
    setPassword('')
    setError(null)
    onClose()
  }

  const submit = () => {
    handleSubmit().catch(() => undefined)
  }

  async function handleSubmit(): Promise<void> {
    if (submitting) return
    if (!password) {
      setError(t('deleteAccountPasswordRequired'))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await deleteAccount(password)
      // Nothing to close on success: dropping the session repaints the screen underneath
      // as signed-out, and this dialog unmounts with it.
      setPassword('')
      onClose()
    } catch (e) {
      setError(t(errorKey(e)))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      visible={open}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Card style={[styles.card, { borderRadius: radii.lg }]}>
              <Text style={[styles.title, { color: colors.ink }]}>
                {t(mobileOnly ? 'deleteAccountTitleMobileOnly' : 'deleteAccountTitle')}
              </Text>
              <Text style={[styles.body, { color: colors.muted }]}>
                {t(mobileOnly ? 'deleteAccountBodyMobileOnly' : 'deleteAccountBody')}
              </Text>
              <Text style={[styles.body, { color: colors.muted }]}>
                {t('deleteAccountBookingsNote')}
              </Text>

              <View style={styles.field}>
                <Field
                  label={t('deleteAccountPasswordLabel')}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('authPasswordPlaceholder')}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  textContentType="password"
                  maxLength={PASSWORD_MAX}
                  editable={!submitting}
                />
              </View>

              {error ? <Text style={[styles.error, { color: colors.bad }]}>{error}</Text> : null}

              <View style={styles.actions}>
                <Button
                  label={t(mobileOnly ? 'deleteAccountConfirmMobileOnly' : 'deleteAccountConfirm')}
                  onPress={submit}
                  variant="danger"
                  loading={submitting}
                />
                <Button
                  label={t('deleteAccountCancel')}
                  onPress={close}
                  variant="secondary"
                  disabled={submitting}
                />
              </View>
            </Card>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'center' },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.md },
  card: { gap: spacing.sm },
  title: { fontSize: 20, fontWeight: '800' },
  body: { fontSize: typography.body.fontSize, lineHeight: 20 },
  field: { marginTop: spacing.sm },
  error: { fontSize: typography.body.fontSize },
  actions: { gap: spacing.sm },
})
