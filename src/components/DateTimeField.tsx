import { Ionicons } from '@expo/vector-icons'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { formatDateTimeShort } from '../lib/format'
import { colors, font, radius, space } from '../theme'
import { Button } from './ui'

export function DateTimeField({
  label,
  icon,
  value,
  minimumDate,
  onChange,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  value: Date
  minimumDate?: Date
  onChange: (date: Date) => void
}) {
  const [iosOpen, setIosOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  function openAndroid() {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate,
      onValueChange: (_, picked) => {
        DateTimePickerAndroid.open({
          value: picked,
          mode: 'time',
          is24Hour: true,
          minimumDate,
          onValueChange: (__, time) => onChange(time),
        })
      },
    })
  }

  function open() {
    if (Platform.OS === 'android') openAndroid()
    else {
      setDraft(value)
      setIosOpen(true)
    }
  }

  return (
    <Pressable onPress={open} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} numberOfLines={1}>
          {formatDateTimeShort(value.toISOString())}
        </Text>
      </View>

      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setIosOpen(false)}>
            <Pressable style={styles.sheet}>
              <DateTimePicker
                value={draft}
                mode="datetime"
                display="inline"
                minimumDate={minimumDate}
                onValueChange={(_, d) => setDraft(d)}
                onDismiss={() => setIosOpen(false)}
              />
              <Button
                label="OK"
                onPress={() => {
                  onChange(draft)
                  setIosOpen(false)
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  pressed: { borderColor: colors.primary, backgroundColor: '#f4fbfb' },
  text: { flex: 1 },
  label: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' },
  value: { fontSize: font.small, color: colors.textMain, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.md,
    gap: space.md,
  },
})
