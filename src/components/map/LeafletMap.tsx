import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { formatDistance, formatMoney } from '../../lib/format'
import { colors } from '../../theme'
import { LOGO_PATHS, LOGO_VIEWBOX } from './logo'
import type { MapProps } from './types'

const LOGO_SVG = `<svg width="17" height="21" viewBox="${LOGO_VIEWBOX}">${LOGO_PATHS.map(
  (d) => `<path fill="#fff" d="${d}"/>`,
).join('')}</svg>`

function buildHtml(center: { lat: number; lng: number }): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: ${colors.bg}; }
    .marker { position: relative; width: 48px; height: 48px; transform: translate(-50%, -100%); }
    .pin { position: absolute; left: 7px; top: 7px; width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center; border: 1.5px solid #fff;
      border-radius: 50% 50% 0 50%; transform: rotate(45deg); box-shadow: 0 2px 6px rgba(0,0,0,.22); }
    .pin__inner { transform: rotate(-45deg); line-height: 0; }
    .leaflet-popup-content { margin: 10px 12px; }
    .leaflet-popup-content-wrapper { border-radius: 14px; cursor: pointer; }
    .tip { min-width: 170px; }
    .tip__name { font: 600 14px system-ui, sans-serif; color: #1F2933; }
    .tip__addr { font-size: 12px; color: #6B727A; margin: 2px 0 6px; }
    .tip__meta { font-size: 13px; color: #1F2933; margin-bottom: 6px; }
    .tip__cta { font: 600 13px system-ui, sans-serif; color: ${colors.primary}; }
    .user-dot { width: 18px; height: 18px; border-radius: 50%; background: #1A73E8;
      border: 3px solid #fff; box-shadow: 0 0 0 2px rgba(26,115,232,.35), 0 1px 4px rgba(0,0,0,.3);
      transform: translate(-50%, -50%); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var DEFAULT_ZOOM = 14;
    var map = L.map('map', { zoomControl: false }).setView([${center.lat}, ${center.lng}], DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    var layer = L.layerGroup().addTo(map);
    function post(msg) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
    window.recenter = function (lat, lng) { map.setView([lat, lng], DEFAULT_ZOOM, { animate: true }); };
    window.fitBounds = function (s, w, n, e) {
      map.fitBounds([[s, w], [n, e]], { padding: [60, 60], maxZoom: 16, animate: true });
    };
    var userMarker = null;
    window.setUser = function (lat, lng) {
      var icon = L.divIcon({ className: '', html: '<div class="user-dot"></div>',
        iconSize: [0, 0], iconAnchor: [0, 0] });
      if (userMarker) userMarker.setLatLng([lat, lng]);
      else userMarker = L.marker([lat, lng], { icon: icon, interactive: false, zIndexOffset: 1000 }).addTo(map);
    };
    window.go = function (id) { post({ type: 'navigate', id: id }); };
    // Close the tooltip on any map movement (drag/zoom/resize).
    map.on('movestart zoomstart resize', function () { map.closePopup(); });
    function postRegion() {
      var b = map.getBounds();
      var c = b.getCenter();
      var ne = b.getNorthEast();
      var sw = b.getSouthWest();
      post({ type: 'region', lat: c.lat, lng: c.lng, radius: Math.round(map.distance(c, ne)),
             north: ne.lat, south: sw.lat, east: ne.lng, west: sw.lng });
    }
    map.on('moveend', postRegion);
    map.whenReady(postRegion);
    window.render = function (items) {
      layer.clearLayers();
      items.forEach(function (it) {
        var icon = L.divIcon({
          className: '',
          html: '<div class="marker">' +
                  '<div class="pin" style="background:' + it.color + '">' +
                    '<div class="pin__inner">' + ${JSON.stringify(LOGO_SVG)} + '</div>' +
                  '</div>' +
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
  user,
  fitBounds,
  fitNonce,
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

  function renderUser() {
    if (!user) return
    ref.current?.injectJavaScript(`window.setUser(${user.lat}, ${user.lng}); true;`)
  }

  function applyFit() {
    if (!fitBounds) return
    ref.current?.injectJavaScript(
      `window.fitBounds(${fitBounds.south}, ${fitBounds.west}, ${fitBounds.north}, ${fitBounds.east}); true;`,
    )
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

  useEffect(() => {
    if (readyRef.current) renderUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.lat, user?.lng])

  useEffect(() => {
    if (readyRef.current) applyFit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce])

  function onMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as {
        type: string
        id?: string
        lat?: number
        lng?: number
        radius?: number
        north?: number
        south?: number
        east?: number
        west?: number
      }
      if (msg.type === 'ready') {
        readyRef.current = true
        recenter()
        renderUser()
        renderMarkers()
      } else if (msg.type === 'navigate' && msg.id) {
        onMarkerPress(msg.id)
      } else if (
        msg.type === 'region' &&
        msg.lat != null &&
        msg.lng != null &&
        msg.radius != null &&
        msg.north != null &&
        msg.south != null &&
        msg.east != null &&
        msg.west != null
      ) {
        onRegionChange({
          lat: msg.lat,
          lng: msg.lng,
          radiusMeters: msg.radius,
          bounds: { north: msg.north, south: msg.south, east: msg.east, west: msg.west },
        })
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
