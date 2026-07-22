import type { ThemeContextValue } from '@spark/ui'
import { useTheme } from '@spark/ui'
import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

import { PIN_ANCHOR, PIN_SIZE, pinSvgMarkup } from './logo'
import type { MapProps } from './types'

function buildHtml(
  center: { lat: number; lng: number },
  colors: ThemeContextValue['colors'],
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: ${colors.map}; }
    .pin { filter: drop-shadow(0 2px 4px rgba(0,0,0,.35)); line-height: 0; }
    .user-dot { width: 18px; height: 18px; border-radius: 50%; background: ${colors.pri};
      border: 3px solid ${colors.surface}; box-shadow: 0 0 0 2px ${colors.priSoft}, 0 1px 4px rgba(0,0,0,.3);
      transform: translate(-50%, -50%); }
    .cluster { width: 44px; height: 44px; border-radius: 50%; background: ${colors.pri};
      border: 2px solid ${colors.surface}; color: ${colors.ink}; display: flex;
      align-items: center; justify-content: center; font: 700 13px system-ui, sans-serif;
      box-shadow: 0 1px 4px rgba(0,0,0,.35); cursor: pointer; }
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
    var clusterLayer = L.layerGroup().addTo(map);
    // True while a scripted camera move (recenter/fit/flyTo) animates, so the gesture
    // signal fires only for real user pan/zoom — mirrors the native provider isGesture.
    var programmatic = false;
    function post(msg) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
    window.recenter = function (lat, lng) { programmatic = true; map.setView([lat, lng], DEFAULT_ZOOM, { animate: true }); };
    window.fitBounds = function (s, w, n, e) {
      programmatic = true;
      map.fitBounds([[s, w], [n, e]], { padding: [60, 60], maxZoom: 16, animate: true });
    };
    var userMarker = null;
    window.setUser = function (lat, lng) {
      var icon = L.divIcon({ className: '', html: '<div class="user-dot"></div>',
        iconSize: [0, 0], iconAnchor: [0, 0] });
      if (userMarker) userMarker.setLatLng([lat, lng]);
      else userMarker = L.marker([lat, lng], { icon: icon, interactive: false, zIndexOffset: 1000 }).addTo(map);
    };
    // Suppress the gesture signal while we programmatically center on a tapped spot.
    var selecting = false;
    // ~1m: if the spot is already centered, skip the pan (and its refetch).
    var CENTER_EPS = 1e-5;
    // A user pan or zoom — not a scripted move — clears the location lock so the
    // locate button icon reverts to the no-dot state.
    map.on('movestart zoomstart', function () {
      if (!programmatic && !selecting) post({ type: 'gesture' });
    });
    map.on('moveend zoomend', function () { programmatic = false; });
    map.on('click', function () { post({ type: 'mappress' }); });
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
    var PIN_AVAIL = ${JSON.stringify(pinSvgMarkup(true, colors))};
    var PIN_FULL = ${JSON.stringify(pinSvgMarkup(false, colors))};
    var PIN_SIZE = [${PIN_SIZE.width}, ${PIN_SIZE.height}];
    var PIN_ANCHOR = [${PIN_SIZE.width * PIN_ANCHOR.x}, ${PIN_SIZE.height * PIN_ANCHOR.y}];
    function makeIcon(available) {
      return L.divIcon({
        className: '',
        html: '<div class="pin">' + (available ? PIN_AVAIL : PIN_FULL) + '</div>',
        iconSize: PIN_SIZE, iconAnchor: PIN_ANCHOR
      });
    }
    // Persistent markers keyed by id. Refetch reconciles in place so the tapped
    // marker is never destroyed and re-created.
    var markers = {};
    var clusterMarkers = {};
    function clearClusters() {
      Object.keys(clusterMarkers).forEach(function (id) {
        clusterLayer.removeLayer(clusterMarkers[id]); delete clusterMarkers[id];
      });
    }
    function clearPoints() {
      Object.keys(markers).forEach(function (id) {
        layer.removeLayer(markers[id]); delete markers[id];
      });
    }
    window.render = function (items) {
      if (items.length) clearClusters();
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
          return;
        }
        m = L.marker([it.lat, it.lng], { icon: makeIcon(it.available) }).addTo(layer);
        m._available = it.available;
        m.on('click', function () {
          post({ type: 'spotpress', id: it.id });
          var ll = m.getLatLng();
          var c = map.getCenter();
          if (Math.abs(c.lat - ll.lat) < CENTER_EPS && Math.abs(c.lng - ll.lng) < CENTER_EPS) return;
          selecting = true;
          map.setView([ll.lat, ll.lng], map.getZoom(), { animate: true });
          map.once('moveend', function () { selecting = false; });
        });
        markers[it.id] = m;
      });
    };
    function makeClusterIcon(count) {
      return L.divIcon({
        className: '',
        html: '<div class="cluster">' + count + '</div>',
        iconSize: [44, 44], iconAnchor: [22, 22]
      });
    }
    window.renderClusters = function (items) {
      if (items.length) clearPoints();
      var next = {};
      items.forEach(function (it) { next[it.id] = true; });
      Object.keys(clusterMarkers).forEach(function (id) {
        if (!next[id]) { clusterLayer.removeLayer(clusterMarkers[id]); delete clusterMarkers[id]; }
      });
      items.forEach(function (it) {
        var m = clusterMarkers[it.id];
        if (m) {
          m.setLatLng([it.lat, it.lng]);
          if (m._count !== it.count) { m.setIcon(makeClusterIcon(it.count)); m._count = it.count; }
          return;
        }
        m = L.marker([it.lat, it.lng], { icon: makeClusterIcon(it.count) }).addTo(clusterLayer);
        m._count = it.count;
        m.on('click', function () {
          programmatic = true;
          map.flyTo([it.lat, it.lng], Math.min(map.getZoom() + 2, 18), { animate: true });
          post({ type: 'clusterpress', id: it.id });
        });
        clusterMarkers[it.id] = m;
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
  clusters,
  onClusterPress,
  onRegionChange,
  onUserGesture,
  onMapPress,
  onSpotSelect,
}: MapProps) {
  const { mode, colors } = useTheme()
  const ref = useRef<WebView>(null)
  // Only `mode` (not `center`) is a dep: center changes are pushed via
  // `recenter()` post-mount, not by rebuilding the whole HTML document.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildHtml(center, colors), [mode])

  const payload = useMemo(
    () => results.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, available: r.available })),
    [results],
  )

  const clusterPayload = useMemo(
    () => clusters.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, count: c.count })),
    [clusters],
  )

  const readyRef = useRef(false)

  function renderMarkers() {
    ref.current?.injectJavaScript(`window.render(${JSON.stringify(payload)}); true;`)
  }

  function renderClusters() {
    ref.current?.injectJavaScript(`window.renderClusters(${JSON.stringify(clusterPayload)}); true;`)
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
    if (readyRef.current) renderClusters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterPayload])

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
        renderClusters()
      } else if (msg.type === 'clusterpress' && msg.id) {
        const cluster = clusters.find((c) => c.id === msg.id)
        if (cluster) onClusterPress?.(cluster)
      } else if (msg.type === 'gesture') {
        onUserGesture?.()
      } else if (msg.type === 'mappress') {
        onMapPress()
      } else if (msg.type === 'spotpress' && msg.id) {
        onSpotSelect(msg.id)
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
