import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { formatDistance, formatMoney, formatPriceShort } from '../../lib/format'
import { colors } from '../../theme'
import type { MapProps } from './types'

function buildHtml(center: { lat: number; lng: number }): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: ${colors.bg}; }
    .marker { display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); }
    .pill { color: #fff; padding: 5px 11px; border-radius: 16px; border: 1.5px solid #fff;
      font: 700 13px system-ui, sans-serif; line-height: 1; white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,.22); }
    .tail { width: 0; height: 0; margin-top: -1px;
      border-left: 5px solid transparent; border-right: 5px solid transparent; }
    .leaflet-popup-content { margin: 10px 12px; }
    .leaflet-popup-content-wrapper { border-radius: 14px; cursor: pointer; }
    .tip { min-width: 170px; }
    .tip__name { font: 600 14px system-ui, sans-serif; color: #1F2933; }
    .tip__addr { font-size: 12px; color: #6B727A; margin: 2px 0 6px; }
    .tip__meta { font-size: 13px; color: #1F2933; margin-bottom: 6px; }
    .tip__cta { font: 600 13px system-ui, sans-serif; color: ${colors.primary}; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([${center.lat}, ${center.lng}], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    var layer = L.layerGroup().addTo(map);
    function post(msg) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
    window.recenter = function (lat, lng) { map.setView([lat, lng], map.getZoom(), { animate: true }); };
    window.go = function (id) { post({ type: 'navigate', id: id }); };
    // Close the tooltip on any map movement (drag/zoom/resize).
    map.on('movestart zoomstart resize', function () { map.closePopup(); });
    function postRegion() {
      var c = map.getCenter();
      var ne = map.getBounds().getNorthEast();
      post({ type: 'region', lat: c.lat, lng: c.lng, radius: Math.round(map.distance(c, ne)) });
    }
    map.on('moveend', postRegion);
    map.whenReady(postRegion);
    window.render = function (items) {
      layer.clearLayers();
      items.forEach(function (it) {
        var icon = L.divIcon({
          className: '',
          html: '<div class="marker">' +
                  '<div class="pill" style="background:' + it.color + '">' + it.label + '</div>' +
                  '<div class="tail" style="border-top:6px solid ' + it.color + '"></div>' +
                '</div>',
          iconSize: [0, 0], iconAnchor: [0, 0]
        });
        var m = L.marker([it.lat, it.lng], { icon: icon }).addTo(layer);
        m.bindPopup(
          '<div class="tip" onclick="window.go(\\'' + it.id + '\\')">' +
            '<div class="tip__name">' + it.name + '</div>' +
            '<div class="tip__addr">' + it.address + '</div>' +
            '<div class="tip__meta">' + it.meta + '</div>' +
            '<div class="tip__cta">Λεπτομέρειες →</div>' +
          '</div>',
          { closeButton: false, autoClose: true, closeOnClick: true }
        );
      });
    };
    post({ type: 'ready' });
  </script>
</body>
</html>`
}

export function LeafletMap({
  center,
  centerNonce,
  results,
  onMarkerPress,
  onRegionChange,
}: MapProps) {
  const ref = useRef<WebView>(null)
  const html = useMemo(() => buildHtml(center), [])

  const payload = useMemo(
    () =>
      results.map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        name: r.name,
        address: r.address,
        color: r.available ? colors.primary : '#9AA0A6',
        label: r.priceCents != null ? formatPriceShort(r.priceCents, r.currency) : '—',
        meta:
          (r.available ? 'Διαθέσιμο' : 'Πλήρες') +
          ' · ' +
          formatDistance(r.distanceMeters) +
          (r.priceCents != null ? ' · ' + formatMoney(r.priceCents, r.currency) : ''),
      })),
    [results],
  )

  const readyRef = useRef(false)

  function renderMarkers() {
    ref.current?.injectJavaScript(`window.render(${JSON.stringify(payload)}); true;`)
  }

  function recenter() {
    ref.current?.injectJavaScript(`window.recenter(${center.lat}, ${center.lng}); true;`)
  }

  // Markers update without recentering, so panning the map doesn't snap back.
  useEffect(() => {
    if (readyRef.current) renderMarkers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload])

  useEffect(() => {
    if (readyRef.current) recenter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, centerNonce])

  function onMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as {
        type: string
        id?: string
        lat?: number
        lng?: number
        radius?: number
      }
      if (msg.type === 'ready') {
        readyRef.current = true
        recenter()
        renderMarkers()
      } else if (msg.type === 'navigate' && msg.id) {
        onMarkerPress(msg.id)
      } else if (msg.type === 'region' && msg.lat != null && msg.lng != null && msg.radius != null) {
        onRegionChange({ lat: msg.lat, lng: msg.lng, radiusMeters: msg.radius })
      }
    } catch {
      // ignore malformed messages
    }
  }

  return (
    <View style={styles.fill}>
      <WebView
        ref={ref}
        source={{ html }}
        style={styles.fill}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
