import { Ionicons } from '@expo/vector-icons'
import { spacing, typography, useTheme } from '../theme'
import { useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'

export interface PickerOption {
  label: string
  value: string
}

export function PickerField({
  label,
  icon,
  options,
  value,
  onChange,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  options: readonly PickerOption[]
  value: string
  onChange: (value: string) => void
}) {
  const { colors, radii } = useTheme()
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          { borderColor: colors.line, borderRadius: radii.sm, backgroundColor: colors.surface },
          pressed && { borderColor: colors.pri, backgroundColor: colors.priSoft },
        ]}
      >
        <View style={[styles.iconBox, { backgroundColor: colors.card2 }]}>
          <Ionicons name={icon} size={18} color={colors.pri} />
        </View>
        <View style={styles.text}>
          <Text
            style={[styles.label, { fontSize: typography.caption.fontSize, color: colors.muted }]}
          >
            {label}
          </Text>
          <Text
            style={[styles.value, { fontSize: typography.body.fontSize, color: colors.ink }]}
            numberOfLines={1}
          >
            {selected?.label ?? '—'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: radii.lg,
                borderTopRightRadius: radii.lg,
              },
            ]}
          >
            <Text
              style={[styles.sheetTitle, { fontSize: typography.body.fontSize, color: colors.ink }]}
            >
              {label}
            </Text>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => {
                const active = item.value === value
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.row,
                      pressed && { backgroundColor: colors.card2 },
                    ]}
                    onPress={() => {
                      onChange(item.value)
                      setOpen(false)
                    }}
                  >
                    <Text
                      style={[
                        styles.rowText,
                        { fontSize: typography.body.fontSize, color: colors.ink },
                        active && { color: colors.pri, fontWeight: '600' },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {active ? <Ionicons name="checkmark" size={18} color={colors.pri} /> : null}
                  </Pressable>
                )
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  label: {
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  value: { fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: {
    paddingVertical: spacing.md,
    maxHeight: '60%',
  },
  sheetTitle: {
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  rowText: {},
})
