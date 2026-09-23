import AsyncStorage from '@react-native-async-storage/async-storage'
import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { ONBOARDED_STORAGE_KEY } from '../src/lib/constants'

export default function Index() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void AsyncStorage.getItem(ONBOARDED_STORAGE_KEY).then((stored) => {
      if (!cancelled) setOnboarded(stored === 'true')
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (onboarded === null) return <View style={{ flex: 1 }} />

  return <Redirect href={onboarded ? '/(tabs)/map' : '/onboarding'} />
}
