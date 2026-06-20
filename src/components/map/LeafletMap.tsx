import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { formatDistance } from '../../lib/format'
import { colors } from '../../theme'
import { PIN_ANCHOR, PIN_SIZE, pinSvgMarkup } from './logo'
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
    .pin { filter: drop-shadow(0 2px 4px rgba(0,0,0,.35)); line-height: 0; }
    .leaflet-popup-content { margin: 10px 12px; }
    .leaflet-popup-content-wrapper { border-radius: 14px; cursor: pointer;
      background: ${colors.surface}; color: ${colors.textMain}; border: 1px solid ${colors.border}; }
    .leaflet-popup-tip { background: ${colors.surface}; }
    .tip { min-width: 170px; }
    .tip__name { font: 600 14px system-ui, sans-serif; color: ${colors.textMain}; }
    .tip__addr { font-size: 12px; color: ${colors.textSecondary}; margin: 2px 0 6px; }
    .tip__meta { font-size: 13px; color: ${colors.textMain}; margin-bottom: 6px; }
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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 20
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
    // Suppress the close handler while we programmatically center on a tapped spot.
    var selecting = false;
    // ~1m: if the spot is already centered, skip the pan (and its refetch).
    var CENTER_EPS = 1e-5;
    // Close the tooltip on any user-driven map movement (drag/zoom/resize).
    map.on('movestart zoomstart resize', function () { if (!selecting) map.closePopup(); });
    // A tap on empty map collapses the sheet — but if a tooltip is open, that tap
    // just closes the tooltip (popup still open at click time), so skip it.
    var popupOpen = false;
    map.on('popupopen', function () { popupOpen = true; });
    map.on('popupclose', function () { popupOpen = false; });
    map.on('click', function () { if (!popupOpen) post({ type: 'mappress' }); });
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
    var PIN_AVAIL = ${JSON.stringify(pinSvgMarkup(true))};
    var PIN_FULL = ${JSON.stringify(pinSvgMarkup(false))};
    var PIN_SIZE = [${PIN_SIZE.width}, ${PIN_SIZE.height}];
    var PIN_ANCHOR = [${PIN_SIZE.width * PIN_ANCHOR.x}, ${PIN_SIZE.height * PIN_ANCHOR.y}];
    function makeIcon(available) {
      return L.divIcon({
        className: '',
        html: '<div class="pin">' + (available ? PIN_AVAIL : PIN_FULL) + '</div>',
        iconSize: PIN_SIZE, iconAnchor: PIN_ANCHOR
      });
    }
    function popupHtml(it) {
      return '<div class="tip" onclick="window.go(\\'' + it.id + '\\')">' +
               '<div class="tip__name">' + it.name + '</div>' +
               '<div class="tip__addr">' + it.address + '</div>' +
               '<div class="tip__meta">' + it.meta + '</div>' +
               '<div class="tip__cta">Λεπτομέρειες →</div>' +
             '</div>';
    }
    // Persistent markers keyed by id. Refetch reconciles in place so the tapped
    // marker (and its open tooltip) is never destroyed and re-created.
    var markers = {};
    window.render = function (items) {
      var next = {};
      items.forEach(function (it) { next[it.id] = true; });
      Object.keys(markers).forEach(function (id) {
        if (!next[id]) { layer.removeLayer(markers[id]); delete markers[id]; }
      });
      items.forEach(function (it) {
        var m = markers[it.id];
        if (m) {
          m.setLatLng([it.lat, it.lng]);
          if (m._available !== it.available) { m.setIcon(makeIcon(it.available)); m._available = it.available; }
          m.setPopupContent(popupHtml(it));
          return;
        }
        m = L.marker([it.lat, it.lng], { icon: makeIcon(it.available) }).addTo(layer);
        m._available = it.available;
        m.bindPopup(popupHtml(it), { closeButton: false, autoClose: true, closeOnClick: true, autoPan: false });
        m.on('click', function () {
          post({ type: 'spotpress' });
          var ll = m.getLatLng();
          var c = map.getCenter();
          if (Math.abs(c.lat - ll.lat) < CENTER_EPS && Math.abs(c.lng - ll.lng) < CENTER_EPS) {
            m.openPopup();
            return;
          }
          selecting = true;
          map.setView([ll.lat, ll.lng], map.getZoom(), { animate: true });
          m.openPopup();
          map.once('moveend', function () { selecting = false; });
        });
        markers[it.id] = m;
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
  onMapPress,
  onSpotSelect,
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
        available: r.available,
        meta: (r.available ? 'Διαθέσιμο' : 'Πλήρες') + ' · ' + formatDistance(r.distanceMeters),
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
      } else if (msg.type === 'mappress') {
        onMapPress()
      } else if (msg.type === 'spotpress') {
        onSpotSelect()
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
