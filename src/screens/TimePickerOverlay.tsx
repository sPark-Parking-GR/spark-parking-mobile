import { useEffect, useState } from 'react'
import { BackHandler } from 'react-native'

import { BookingForm, type BookingValue } from '../components/BookingForm'
import { Button } from '../components/ui'
import { useLanguage } from '../i18n/LanguageProvider'
import { useOverlay } from '../navigation/OverlayContext'

export function TimePickerOverlay({
  initial,
  onApply,
}: {
  initial: BookingValue
  onApply: (next: BookingValue) => void
}) {
  const { closeOverlay } = useOverlay()
  const { t } = useLanguage()
  const [draft, setDraft] = useState<BookingValue>(initial)

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeOverlay()
      return true
    })
    return () => sub.remove()
  }, [closeOverlay])

  return (
    <>
      <BookingForm initial={initial} onChange={setDraft} />
      <Button
        label={t('bookingApply')}
        icon="checkmark"
        onPress={() => {
          onApply(draft)
          closeOverlay()
        }}
      />
    </>
  )
}
