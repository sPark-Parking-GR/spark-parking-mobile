import { Linking, Platform } from 'react-native'

export interface Destination {
  lat: number
  lng: number
  label?: string
}

// Hand the destination to whatever maps app the device offers. Android's `geo:`
// scheme raises the system app chooser; iOS routes to Apple Maps (no chooser
// exists). The Google Maps web URL is the fallback when no native handler binds.
function buildUrl({ lat, lng, label }: Destination): string {
  const coord = `${lat},${lng}`
  const name = label ? encodeURIComponent(label) : ''
  return Platform.select({
    ios: `maps://?daddr=${coord}${name ? `&q=${name}` : ''}`,
    android: `geo:${coord}?q=${coord}${name ? `(${name})` : ''}`,
    default: webUrl(coord),
  })
}

function webUrl(coord: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coord}`
}

export async function openDirections(dest: Destination): Promise<void> {
  const url = buildUrl(dest)
  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url)
      return
    }
  } catch {
    // Fall through to the web fallback below.
  }
  await Linking.openURL(webUrl(`${dest.lat},${dest.lng}`))
}
