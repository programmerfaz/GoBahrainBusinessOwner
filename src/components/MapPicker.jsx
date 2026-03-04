import { useEffect, useRef, useState } from 'react'

// Leaflet CSS is loaded dynamically so we don't need a bundler import
let leafletLoaded = false

async function ensureLeaflet() {
  if (typeof window === 'undefined') return null
  if (window.L) return window.L

  // Load CSS once
  if (!leafletLoaded) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    leafletLoaded = true
  }

  // Load JS
  if (!window.L) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }
  return window.L
}

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1&accept-language=en`
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'Accept': 'application/json',
      },
    })
    const data = await res.json()
    const addr = data.address || {}
    return (
      addr.suburb ||
      addr.neighbourhood ||
      addr.city_district ||
      addr.quarter ||
      addr.town ||
      addr.city ||
      addr.county ||
      ''
    )
  } catch {
    return ''
  }
}

/**
 * MapPicker
 * Props:
 *   lat, lng          – current values (strings or numbers)
 *   onChange(lat, lng, areaName) – called when user clicks the map
 *   height            – CSS height string, default '340px'
 *   label             – optional label above the map
 */
export default function MapPicker({ lat, lng, onChange, height = '340px', label }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [geocoding, setGeocoding] = useState(false)
  const [areaName, setAreaName] = useState('')

  // Bahrain only: center and strict bounds (no pan/zoom outside country)
  const BAHRAIN = { lat: 26.0667, lng: 50.5577, zoom: 11 }

  useEffect(() => {
    let destroyed = false

    async function init() {
      const L = await ensureLeaflet()
      if (!L || !containerRef.current || destroyed) return

      // Already initialized
      if (mapRef.current) return

      const bounds = L.latLngBounds([25.5, 50.25], [26.45, 50.95])

      const map = L.map(containerRef.current, {
        center: [BAHRAIN.lat, BAHRAIN.lng],
        zoom: BAHRAIN.zoom,
        zoomControl: true,
        minZoom: 10,
        maxZoom: 19,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0,
      })

      /* Clean, light map: CARTO Positron (Western style, easy to read). */
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map)

      // Custom marker icon (fixes default icon path issue with bundlers)
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:32px;height:40px;position:relative;
        ">
          <svg viewBox="0 0 32 40" width="32" height="40" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C9.4 0 4 5.4 4 12c0 8.4 12 28 12 28S28 20.4 28 12C28 5.4 22.6 0 16 0z" fill="#b8621b"/>
            <circle cx="16" cy="12" r="6" fill="white"/>
          </svg>
        </div>`,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
      })

      // Place marker if we already have coords (clamp to Bahrain)
      const initLat = parseFloat(lat)
      const initLng = parseFloat(lng)
      if (!isNaN(initLat) && !isNaN(initLng)) {
        const latC = Math.max(25.5, Math.min(26.45, initLat))
        const lngC = Math.max(50.25, Math.min(50.95, initLng))
        const m = L.marker([latC, lngC], { icon }).addTo(map)
        markerRef.current = m
        map.setView([latC, lngC], 14)
      }

      // Click handler
      map.on('click', async (e) => {
        const { lat: clickLat, lng: clickLng } = e.latlng
        const latStr = clickLat.toFixed(6)
        const lngStr = clickLng.toFixed(6)

        // Move or place marker
        if (markerRef.current) {
          markerRef.current.setLatLng([clickLat, clickLng])
        } else {
          markerRef.current = L.marker([clickLat, clickLng], { icon }).addTo(map)
        }

        setGeocoding(true)
        const area = await reverseGeocode(latStr, lngStr)
        setGeocoding(false)
        if (destroyed) return
        setAreaName(area)
        onChange?.(latStr, lngStr, area)
      })

      mapRef.current = map
    }

    init()

    return () => {
      destroyed = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync marker when lat/lng props change externally (clamp to Bahrain)
  useEffect(() => {
    const L = window.L
    const map = mapRef.current
    if (!L || !map) return
    const parsedLat = parseFloat(lat)
    const parsedLng = parseFloat(lng)
    if (isNaN(parsedLat) || isNaN(parsedLng)) return

    const latClamp = Math.max(25.5, Math.min(26.45, parsedLat))
    const lngClamp = Math.max(50.25, Math.min(50.95, parsedLng))

    const icon = L.divIcon({
      className: '',
      html: `<div style="width:32px;height:40px;"><svg viewBox="0 0 32 40" width="32" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C9.4 0 4 5.4 4 12c0 8.4 12 28 12 28S28 20.4 28 12C28 5.4 22.6 0 16 0z" fill="#b8621b"/><circle cx="16" cy="12" r="6" fill="white"/></svg></div>`,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
    })

    if (markerRef.current) {
      markerRef.current.setLatLng([latClamp, lngClamp])
    } else {
      markerRef.current = L.marker([latClamp, lngClamp], { icon }).addTo(map)
    }
    map.setView([latClamp, lngClamp], 14)
  }, [lat, lng])

  return (
    <div className="map-picker-wrap">
      {label && <span className="map-picker-label">{label}</span>}
      <div className="map-picker-container" ref={containerRef} style={{ height }} />
      {geocoding && (
        <div className="map-picker-status">
          <span className="map-picker-dot" /> Fetching location name…
        </div>
      )}
      {!geocoding && areaName && (
        <div className="map-picker-status map-picker-status-ok">
          📍 {areaName}
        </div>
      )}
      <p className="map-picker-hint">Click anywhere on the map to set coordinates</p>
    </div>
  )
}
