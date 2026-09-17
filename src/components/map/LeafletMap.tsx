import type { ThemeContextValue } from '../../theme'
import { useTheme } from '../../theme'
import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

import { PIN_ANCHOR, PIN_SIZE, pinSvgMarkup } from './logo'
import type { MapProps } from './types'

function buildHtml(
  center: { lat: number; lng: number },
  colors: ThemeContextValue['colors'],
  mode: ThemeContextValue['mode'],
): string {
  const tileTheme = mode === 'dark' ? 'dark_all' : 'light_all'
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
    /* Applied only while a marker is entering/leaving/repositioning (see
       animateIcon below) so an ordinary pan/zoom's own position updates,
       driven by the map pane transform rather than per-marker setLatLng,
       are never caught mid-transition. */
    .leaflet-marker-icon.anim { transition: transform 300ms ease, opacity 240ms ease; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var DEFAULT_ZOOM = 14;
    var map = L.map('map', { zoomControl: false }).setView([${center.lat}, ${center.lng}], DEFAULT_ZOOM);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/${tileTheme}/{z}/{x}/{y}{r}.png', {
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
    // Shifts a target point's on-screen position by offsetPx (positive moves it
    // up, toward the top bar's clear side; negative moves it down, toward the
    // sheet/card's clear side), so it lands in the middle of the viewport still
    // actually visible between the top bar and the bottom sheet/card. offsetPx
    // is read fresh from the RN side at the moment of centering.
    function offsetLatLng(lat, lng, zoom, offsetPx) {
      if (!offsetPx) return L.latLng(lat, lng);
      var p = map.project([lat, lng], zoom);
      return map.unproject([p.x, p.y + offsetPx], zoom);
    }
    window.recenter = function (lat, lng, offsetPx) {
      programmatic = true;
      map.setView(offsetLatLng(lat, lng, DEFAULT_ZOOM, offsetPx), DEFAULT_ZOOM, { animate: true });
    };
    window.centerOnSpot = function (lat, lng, offsetPx) {
      var target = offsetLatLng(lat, lng, map.getZoom(), offsetPx);
      var c = map.getCenter();
      if (Math.abs(c.lat - target.lat) < CENTER_EPS && Math.abs(c.lng - target.lng) < CENTER_EPS) return;
      selecting = true;
      map.setView(target, map.getZoom(), { animate: true });
      map.once('moveend', function () { selecting = false; });
    };
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
    var PIN_BUSINESS = ${JSON.stringify(pinSvgMarkup('BUSINESS', colors, mode))};
    var PIN_FREE_PUBLIC = ${JSON.stringify(pinSvgMarkup('FREE_PUBLIC', colors, mode))};
    var PIN_OTHER = ${JSON.stringify(pinSvgMarkup('RESTRICTED', colors, mode))};
    var PIN_SIZE = [${PIN_SIZE.width}, ${PIN_SIZE.height}];
    var PIN_ANCHOR = [${PIN_SIZE.width * PIN_ANCHOR.x}, ${PIN_SIZE.height * PIN_ANCHOR.y}];
    function pinMarkupFor(kind) {
      if (kind === 'FREE_PUBLIC') return PIN_FREE_PUBLIC;
      if (kind !== 'BUSINESS') return PIN_OTHER;
      return PIN_BUSINESS;
    }
    function makeIcon(kind) {
      return L.divIcon({
        className: '',
        html: '<div class="pin">' + pinMarkupFor(kind) + '</div>',
        iconSize: PIN_SIZE, iconAnchor: PIN_ANCHOR
      });
    }
    function makeClusterIcon(count) {
      return L.divIcon({
        className: '',
        html: '<div class="cluster">' + count + '</div>',
        iconSize: [44, 44], iconAnchor: [22, 22]
      });
    }
    var FLY_MS = 320, FADE_MS = 240;
    function animateIcon(marker, ms) {
      var icon = marker._icon;
      if (!icon) return;
      icon.classList.add('anim');
      setTimeout(function () { if (icon.classList) icon.classList.remove('anim'); }, ms);
    }
    function distSq(aLat, aLng, bLat, bLng) {
      var dLat = aLat - bLat, dLng = aLng - bLng;
      return dLat * dLat + dLng * dLng;
    }
    // An entering marker only flies from a vanished one within this fraction
    // of the current extent (the bounding diagonal of everything in play this
    // update) — otherwise it fades in in place. Without a cap, an unrelated
    // pair of markers leaving and arriving on opposite sides of the same
    // viewport update would fly across the whole map at each other, reading
    // as a bug rather than a cluster splitting or merging.
    var FLIGHT_EXTENT_FRACTION = 0.4;
    function extentOf(points) {
      if (!points.length) return 0;
      var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      points.forEach(function (p) {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      });
      return Math.sqrt(Math.pow(maxLat - minLat, 2) + Math.pow(maxLng - minLng, 2));
    }
    // How close a new cluster from the server has to sit to a previously
    // tracked one (as a fraction of the same extent) to be treated as the
    // SAME cluster rather than a fresh one. Needed because supercluster's
    // cluster_id is tied to a tree node at a specific zoom level: zooming by
    // even one level gives almost every on-screen cluster a brand new id even
    // when the real-world grouping barely moved, which without this match
    // would read as the entire map flushing and re-entering on every zoom step.
    var CLUSTER_MATCH_FRACTION = 0.3;
    var clusterKeySeq = 0;
    function resolveClusterKeys(clusterList, trackedClusterPairs, thresholdSq) {
      var candidates = [];
      clusterList.forEach(function (c, ni) {
        trackedClusterPairs.forEach(function (pair) {
          var d = distSq(c.lat, c.lng, pair.v.lat, pair.v.lng);
          if (d <= thresholdSq) candidates.push({ ni: ni, key: pair.key, d: d });
        });
      });
      candidates.sort(function (a, b) { return a.d - b.d; });
      var matchedNext = {}, matchedTracked = {}, resolved = {};
      candidates.forEach(function (cand) {
        if (matchedNext[cand.ni] || matchedTracked[cand.key]) return;
        matchedNext[cand.ni] = true;
        matchedTracked[cand.key] = true;
        resolved[cand.ni] = cand.key;
      });
      return clusterList.map(function (_, ni) {
        return resolved[ni] !== undefined ? resolved[ni] : ('c:new:' + clusterKeySeq++);
      });
    }
    // Persistent markers keyed by 'p:'+id / 'c:'+id, spanning both layers so a
    // point turning into a cluster (or back) is one continuous reconcile
    // instead of two independent ones — needed to find, for a marker with no
    // id match in the previous frame, the nearest marker that just vanished
    // so it can fly out from (split) or converge into (merge) that spot. The
    // server exposes no real parent/child relationship between an old cluster
    // and what replaces it, so nearest-vanished-neighbour is an approximation,
    // but the right one in both directions.
    //
    // A vanished entry stays in this dict (marked exiting, with its pending
    // removal timer) rather than being deleted right away: a bounds flap
    // right at a supercluster bucket boundary can bring the same key back
    // before its fade-out finishes, and deleting eagerly would leave the old
    // marker fading out on the map while a duplicate new one fades in on top
    // of it.
    var markers = {};
    window.renderMarkers = function (points, clusters) {
      var trackedClusterPairs = [];
      Object.keys(markers).forEach(function (key) {
        if (markers[key].kind === 'cluster') trackedClusterPairs.push({ key: key, v: markers[key] });
      });
      var matchExtentPoints = points.concat(clusters);
      Object.keys(markers).forEach(function (key) { matchExtentPoints.push(markers[key]); });
      var matchThresholdSq = Math.pow(extentOf(matchExtentPoints) * CLUSTER_MATCH_FRACTION, 2);
      var clusterKeys = resolveClusterKeys(clusters, trackedClusterPairs, matchThresholdSq);

      var next = {};
      points.forEach(function (it) { next['p:' + it.id] = { kind: 'point', it: it }; });
      clusters.forEach(function (it, i) { next[clusterKeys[i]] = { kind: 'cluster', it: it }; });

      var vanishing = [];
      Object.keys(markers).forEach(function (key) {
        if (!next[key] && !markers[key].exiting) vanishing.push(markers[key]);
      });
      var extentPoints = vanishing.slice();
      Object.keys(next).forEach(function (key) { extentPoints.push(next[key].it); });
      var maxFlightSq = Math.pow(extentOf(extentPoints) * FLIGHT_EXTENT_FRACTION, 2);

      Object.keys(next).forEach(function (key) {
        var entry = next[key];
        var it = entry.it;
        var existing = markers[key];
        if (existing) {
          if (existing.exiting) {
            clearTimeout(existing.exitTimer);
            existing.exiting = false;
            animateIcon(existing.m, FADE_MS + 20);
            existing.m.setOpacity(1);
          }
          if (existing.lat !== it.lat || existing.lng !== it.lng) {
            animateIcon(existing.m, FLY_MS);
            existing.m.setLatLng([it.lat, it.lng]);
            existing.lat = it.lat; existing.lng = it.lng;
          }
          if (entry.kind === 'point' && existing.m._kind !== it.kind) {
            existing.m.setIcon(makeIcon(it.kind)); existing.m._kind = it.kind;
          } else if (entry.kind === 'cluster' && existing.m._count !== it.count) {
            existing.m.setIcon(makeClusterIcon(it.count)); existing.m._count = it.count;
          }
          return;
        }

        var nearest = null;
        vanishing.forEach(function (v) {
          var d = distSq(it.lat, it.lng, v.lat, v.lng);
          if (d > maxFlightSq) return;
          if (!nearest || d < distSq(it.lat, it.lng, nearest.lat, nearest.lng)) nearest = v;
        });
        var startLat = nearest ? nearest.lat : it.lat;
        var startLng = nearest ? nearest.lng : it.lng;
        var targetLayer = entry.kind === 'point' ? layer : clusterLayer;
        var icon = entry.kind === 'point' ? makeIcon(it.kind) : makeClusterIcon(it.count);
        var m = L.marker([startLat, startLng], { icon: icon, opacity: 0 }).addTo(targetLayer);
        if (entry.kind === 'point') {
          m._kind = it.kind;
          m.on('click', function () {
            var ll = m.getLatLng();
            post({ type: 'spotpress', id: it.id, lat: ll.lat, lng: ll.lng });
          });
        } else {
          m._count = it.count;
          m.on('click', function () {
            programmatic = true;
            map.flyTo([it.lat, it.lng], Math.min(map.getZoom() + 2, 18), { animate: true });
            post({ type: 'clusterpress', id: it.id });
          });
        }
        markers[key] = { key: key, m: m, kind: entry.kind, lat: it.lat, lng: it.lng, exiting: false, exitTimer: null };
        animateIcon(m, Math.max(FLY_MS, FADE_MS) + 20);
        // Two rAFs: the first lets the marker's initial (opacity:0, start
        // position) paint commit, so the second's changes are a transition
        // from that frame rather than getting coalesced into the same one.
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            m.setOpacity(1);
            if (nearest) m.setLatLng([it.lat, it.lng]);
          });
        });
      });

      vanishing.forEach(function (v) {
        v.exiting = true;
        animateIcon(v.m, FADE_MS + 20);
        v.m.setOpacity(0);
        v.exitTimer = setTimeout(function () {
          (v.kind === 'point' ? layer : clusterLayer).removeLayer(v.m);
          delete markers[v.key];
        }, FADE_MS);
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
  getCenterOffsetPx,
}: MapProps) {
  const { mode, colors } = useTheme()
  const ref = useRef<WebView>(null)
  // Only `mode` (not `center`) is a dep: center changes are pushed via
  // `recenter()` post-mount, not by rebuilding the whole HTML document.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildHtml(center, colors, mode), [mode])

  const payload = useMemo(
    () =>
      results.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, kind: r.kind })),
    [results],
  )

  const clusterPayload = useMemo(
    () => clusters.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, count: c.count })),
    [clusters],
  )

  const readyRef = useRef(false)

  function renderMarkers() {
    ref.current?.injectJavaScript(
      `window.renderMarkers(${JSON.stringify(payload)}, ${JSON.stringify(clusterPayload)}); true;`,
    )
  }

  function recenter() {
    ref.current?.injectJavaScript(
      `window.recenter(${center.lat}, ${center.lng}, ${getCenterOffsetPx()}); true;`,
    )
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
  // One combined effect (not one per payload) so a mode flip between points
  // and clusters reconciles both in the same call — needed for the entering
  // side of the split/merge animation to see the other side's vanishing keys.
  useEffect(() => {
    if (readyRef.current) renderMarkers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, clusterPayload])

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
      } else if (msg.type === 'clusterpress' && msg.id) {
        const cluster = clusters.find((c) => c.id === msg.id)
        if (cluster) onClusterPress?.(cluster)
      } else if (msg.type === 'gesture') {
        onUserGesture?.()
      } else if (msg.type === 'mappress') {
        onMapPress()
      } else if (msg.type === 'spotpress' && msg.id) {
        onSpotSelect(msg.id)
        if (msg.lat != null && msg.lng != null) {
          const offset = getCenterOffsetPx()
          ref.current?.injectJavaScript(
            `window.centerOnSpot(${msg.lat}, ${msg.lng}, ${offset}); true;`,
          )
        }
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
