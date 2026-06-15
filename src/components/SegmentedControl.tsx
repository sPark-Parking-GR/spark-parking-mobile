import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, font, radius } from '../theme'

export interface Segment {
  value: string
  label: string
  icon: keyof typeof MaterialCommunityIcons.glyphMap
}

export function SegmentedControl({
  segments,
  value,
  onChange,
}: {
  segments: readonly Segment[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <View style={styles.track}>
      {segments.map((s) => {
        const active = s.value === value
        return (
          <Pressable
            key={s.value}
            onPress={() => onChange(s.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <MaterialCommunityIcons
              name={s.icon}
              size={19}
              color={active ? '#fff' : colors.textSecondary}
            />
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {s.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.neutralBg,
    borderRadius: radius.sm,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: radius.sm - 3,
  },
  segmentActive: {
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  label: { fontSize: font.tiny, fontWeight: '600', color: colors.textSecondary },
  labelActive: { color: '#fff' },
})
