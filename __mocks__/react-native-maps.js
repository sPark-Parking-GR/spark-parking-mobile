const React = require('react')
const { View } = require('react-native')

function stub(name) {
  const Component = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }))
  Component.displayName = name
  return Component
}

const MapView = stub('MapView')

module.exports = {
  __esModule: true,
  default: MapView,
  Marker: stub('Marker'),
  Callout: stub('Callout'),
  PROVIDER_GOOGLE: 'google',
  PROVIDER_DEFAULT: 'default',
}
