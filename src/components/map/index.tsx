import { resolveRenderer, type MapProps } from './types'

export function Map(props: MapProps) {
  if (resolveRenderer() === 'native') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/consistent-type-imports -- lazy require avoids bundling react-native-maps when the webview renderer is used
    const { NativeMap }: typeof import('./NativeMap') = require('./NativeMap')
    return <NativeMap {...props} />
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/consistent-type-imports -- lazy require avoids bundling react-native-webview when the native renderer is used
  const { LeafletMap }: typeof import('./LeafletMap') = require('./LeafletMap')
  return <LeafletMap {...props} />
}

export type { MapBounds, MapProps, MapRegion } from './types'
