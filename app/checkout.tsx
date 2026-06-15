import { router, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native'
import { Button, Card, Field } from '../src/components/ui'
import { confirmBooking, createBooking } from '../src/lib/api'
import { idempotencyKey } from '../src/lib/id'
import { colors, font, space } from '../src/theme'

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{
    facilityId: string
    name: string
    startsAt: string
    endsAt: string
    vehicleType: string
  }>()

  const [plate, setPlate] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const keyRef = useRef(idempotencyKey())

  const ready = Boolean(params.facilityId && params.startsAt && params.endsAt && params.vehicleType)

  async function submit() {
    if (!ready) {
      setError('Λείπουν στοιχεία κράτησης')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const booking = await createBooking(
        {
          facilityId: params.facilityId,
          startsAt: params.startsAt,
          endsAt: params.endsAt,
          vehicleType: params.vehicleType,
          vehiclePlate: plate.trim().toUpperCase(),
          guestEmail: email.trim(),
          guestPhone: phone.trim() || undefined,
        },
        keyRef.current,
      )
      await confirmBooking(booking.bookingId)
      router.replace({ pathname: '/booking/[id]', params: { id: booking.bookingId } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Η κράτηση απέτυχε')
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.title}>Ολοκλήρωση κράτησης</Text>
          {params.name ? <Text style={styles.name}>{params.name}</Text> : null}

          <Field
            label="Πινακίδα οχήματος"
            value={plate}
            onChangeText={setPlate}
            placeholder="ΙΑΑ-1234"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label="Τηλέφωνο (προαιρετικό)"
            value={phone}
            onChangeText={setPhone}
            placeholder="69XXXXXXXX"
            keyboardType="phone-pad"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={loading ? 'Επεξεργασία…' : 'Πληρωμή & κράτηση'}
            onPress={submit}
            disabled={loading || !plate || !email}
            loading={loading}
          />
          <Text style={styles.note}>Λειτουργία ανάπτυξης: πληρωμή μέσω mock provider.</Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.md, paddingBottom: space.xl },
  title: { fontSize: font.heading, fontWeight: '600', color: colors.textMain, marginBottom: 4 },
  name: { fontSize: font.body, color: colors.textSecondary, marginBottom: space.lg },
  error: { color: colors.error, fontSize: font.small, marginBottom: space.sm },
  note: { fontSize: font.tiny, color: colors.textSecondary, marginTop: space.md },
})
