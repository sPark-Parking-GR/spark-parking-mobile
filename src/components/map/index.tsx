import { resolveRenderer, type MapProps } from './types'

export function Map(props: MapProps) {
  if (resolveRenderer() === 'native') {
    const { NativeMap } = require('./NativeMap') as typeof import('./NativeMap')
    return <NativeMap {...props} />
  }
  const { LeafletMap } = require('./LeafletMap') as typeof import('./LeafletMap')
  return <LeafletMap {...props} />
}

export type { MapBounds, MapProps, MapRegion } from './types'
