// components/OsmMap.js
// Free map (OpenStreetMap data, Leaflet) shown inside a WebView.
// No Google Maps, no API key, no billing. Works in Expo Go and in the APK.
//
//   <OsmMap
//     ref={mapRef}
//     style={...}
//     center={{ latitude, longitude }}   // first view
//     zoom={16}
//     markers={[{ id, latitude, longitude, color, title }]}
//     onMarkerPress={(id) => ...}
//     onMapPress={() => ...}
//   />
//
//   mapRef.current.flyTo({ latitude, longitude }, 17)
//   mapRef.current.fitAll([{ latitude, longitude }, ...], { top, right, bottom, left })

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { colors } from '../Theme';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';

// Map tiles: CARTO "Voyager" style (OpenStreetMap data). Free for small,
// non-commercial projects like this one; attribution is shown on the map.
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const buildHtml = (center, zoom) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="${LEAFLET}/leaflet.css" />
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #EEF1EC; }
  .leaflet-control-attribution { font-size: 10px; }
  .leaflet-tooltip { font-family: -apple-system, Roboto, sans-serif; font-size: 13px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="${LEAFLET}/leaflet.js"></script>
<script>
  (function () {
    function send(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
    if (!window.L) { send({ type: 'error', message: 'Map library could not load. Check the internet connection.' }); return; }

    var map = L.map('map', { zoomControl: false, attributionControl: true })
      .setView([${center.latitude}, ${center.longitude}], ${zoom});
    L.tileLayer('${TILES}', { maxZoom: 20, subdomains: 'abcd', attribution: '${ATTRIBUTION}' }).addTo(map);
    map.attributionControl.setPrefix(false);

    var layers = {};
    map.on('click', function () { send({ type: 'mapPress' }); });

    window.pg = {
      setMarkers: function (list) {
        var seen = {};
        list.forEach(function (m) {
          seen[m.id] = true;
          var style = { radius: 11, color: '#ffffff', weight: 3, fillColor: m.color || '#2E7D32', fillOpacity: 1 };
          var layer = layers[m.id];
          if (!layer) {
            layer = L.circleMarker([m.latitude, m.longitude], style).addTo(map);
            layer.on('click', function (e) {
              L.DomEvent.stopPropagation(e);
              send({ type: 'markerPress', id: m.id });
            });
            layers[m.id] = layer;
          } else {
            layer.setLatLng([m.latitude, m.longitude]);
            layer.setStyle(style);
          }
          layer.unbindTooltip();
          if (m.title) layer.bindTooltip(m.title, { direction: 'top', offset: [0, -10] });
        });
        Object.keys(layers).forEach(function (id) {
          if (!seen[id]) { map.removeLayer(layers[id]); delete layers[id]; }
        });
      },
      flyTo: function (lat, lng, zoom) {
        map.flyTo([lat, lng], zoom || map.getZoom(), { duration: 0.4 });
      },
      fitAll: function (points, pad) {
        if (!points.length) return;
        if (points.length === 1) { map.flyTo(points[0], 16, { duration: 0.4 }); return; }
        map.flyToBounds(points, {
          paddingTopLeft: [pad.left, pad.top],
          paddingBottomRight: [pad.right, pad.bottom],
          maxZoom: 17,
          duration: 0.4
        });
      }
    };
    send({ type: 'ready' });
  })();
</script>
</body>
</html>`;

const OsmMap = forwardRef(function OsmMap(
  { style, center, zoom = 15, markers = [], onMarkerPress, onMapPress, onError },
  ref
) {
  const webRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Build the page once (the first center/zoom); later moves use flyTo/fitAll
  const firstView = useRef({ center, zoom });
  const html = useMemo(
    () => buildHtml(firstView.current.center || { latitude: 8.4542, longitude: 124.6319 }, firstView.current.zoom),
    []
  );

  // Commands sent before the map finishes loading wait here
  const readyRef = useRef(false);
  const queue = useRef([]);
  const run = (js) => {
    if (!readyRef.current) {
      queue.current.push(js);
      return;
    }
    webRef.current?.injectJavaScript(`try{${js}}catch(e){};true;`);
  };

  useImperativeHandle(ref, () => ({
    flyTo: (point, z) => point && run(`pg.flyTo(${point.latitude}, ${point.longitude}, ${z || 0})`),
    fitAll: (points, pad = { top: 60, right: 60, bottom: 60, left: 60 }) =>
      run(`pg.fitAll(${JSON.stringify(points.map((p) => [p.latitude, p.longitude]))}, ${JSON.stringify(pad)})`),
  }));

  // Send markers whenever they change (after the map is ready)
  const markersJson = JSON.stringify(
    markers.map((m) => ({
      id: String(m.id),
      latitude: Number(m.latitude),
      longitude: Number(m.longitude),
      color: m.color,
      title: m.title || '',
    }))
  );
  useEffect(() => {
    if (ready) run(`pg.setMarkers(${markersJson})`);
  }, [ready, markersJson]);

  const onMessage = (e) => {
    let msg;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      readyRef.current = true;
      setReady(true);
      const waiting = queue.current;
      queue.current = [];
      waiting.forEach(run);
    }
    else if (msg.type === 'markerPress') onMarkerPress?.(msg.id);
    else if (msg.type === 'mapPress') onMapPress?.();
    else if (msg.type === 'error') {
      console.log('MAP ERROR:', msg.message);
      onError?.(msg.message);
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        ref={webRef}
        source={{ html, baseUrl: 'https://pawguard.app/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        applicationNameForUserAgent="PawGuard/1.0"
        style={styles.web}
      />
      {!ready && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.ink} />
        </View>
      )}
    </View>
  );
});

export default OsmMap;

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#EEF1EC' },
  web: { flex: 1, backgroundColor: 'transparent' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});