import { useEffect, useRef, useState } from 'react'

let leafletLoaded = false

async function ensureLeaflet() {
  if (typeof window === 'undefined') return null
  if (window.L) return window.L

  if (!leafletLoaded) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    leafletLoaded = true
  }

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

async function geocodeAreaInBahrain(areaName) {
  const q = encodeURIComponent(`${areaName}, Bahrain`)
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${q}&accept-language=en`
  const res = await fetch(url, {
    headers: {
      'Accept-Language': 'en',
      'Accept': 'application/json',
    },
  })
  const data = await res.json()
  const hit = Array.isArray(data) ? data[0] : null
  if (!hit?.lat || !hit?.lon) return null
  return { latitude: Number(hit.lat), longitude: Number(hit.lon) }
}

const BAHRAIN_CENTER = { lat: 26.0667, lng: 50.5577, zoom: 11 }
const BOUNDS_SW = [25.5, 50.25]
const BOUNDS_NE = [26.45, 50.95]

function clampToBahrain(lat, lng) {
  const latitude = Math.max(BOUNDS_SW[0], Math.min(BOUNDS_NE[0], Number(lat)))
  const longitude = Math.max(BOUNDS_SW[1], Math.min(BOUNDS_NE[1], Number(lng)))
  return {
    latitude: Number(latitude).toFixed(6),
    longitude: Number(longitude).toFixed(6),
  }
}

function createMarkerIcon(L) {
  return L.divIcon({
    className: '',
    html: `<div style="width:32px;height:40px;position:relative;">
      <svg viewBox="0 0 32 40" width="32" height="40" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C9.4 0 4 5.4 4 12c0 8.4 12 28 12 28S28 20.4 28 12C28 5.4 22.6 0 16 0z" fill="#b8621b"/>
        <circle cx="16" cy="12" r="6" fill="white"/>
      </svg>
    </div>`,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
  })
}

export default function OwnerLocationPicker({
  latitude,
  longitude,
  onLocationChange,
  height = '340px',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [selected, setSelected] = useState(null)
  const [areaQuery, setAreaQuery] = useState('')
  const [searchingArea, setSearchingArea] = useState(false)
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    const parsedLat = Number(latitude)
    const parsedLng = Number(longitude)
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return
    const next = clampToBahrain(parsedLat, parsedLng)
    setSelected((prev) => (
      prev?.latitude === next.latitude && prev?.longitude === next.longitude ? prev : next
    ))
  }, [latitude, longitude])

  useEffect(() => {
    let destroyed = false
    let resizeTimerA = null
    let resizeTimerB = null

    async function init() {
      const L = await ensureLeaflet()
      if (!L || !containerRef.current || destroyed || mapRef.current) return

      const bounds = L.latLngBounds(BOUNDS_SW, BOUNDS_NE)
      const map = L.map(containerRef.current, {
        center: [BAHRAIN_CENTER.lat, BAHRAIN_CENTER.lng],
        zoom: BAHRAIN_CENTER.zoom,
        zoomControl: true,
        maxZoom: 19,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0,
      })
      map.fitBounds(bounds, { padding: [8, 8] })
      map.setMinZoom(map.getBoundsZoom(bounds))

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map)

      const icon = createMarkerIcon(L)
      const bindDragEnd = (marker) => {
        marker.on('dragend', (event) => {
          const { lat: dragLat, lng: dragLng } = event.target.getLatLng()
          const dragged = clampToBahrain(dragLat, dragLng)
          event.target.setLatLng([Number(dragged.latitude), Number(dragged.longitude)])
          setSelected(dragged)
          onLocationChange?.(dragged)
        })
      }

      const placeOrMoveMarker = (lat, lng, shouldCenter = true) => {
        const clamped = clampToBahrain(lat, lng)
        const latNum = Number(clamped.latitude)
        const lngNum = Number(clamped.longitude)

        if (markerRef.current) {
          markerRef.current.setLatLng([latNum, lngNum])
        } else {
          const marker = L.marker([latNum, lngNum], { icon, draggable: true }).addTo(map)
          bindDragEnd(marker)
          markerRef.current = marker
        }

        if (shouldCenter) map.setView([latNum, lngNum], 14)
        setSelected(clamped)
        onLocationChange?.(clamped)
      }

      const initLat = Number(latitude)
      const initLng = Number(longitude)
      if (Number.isFinite(initLat) && Number.isFinite(initLng)) {
        placeOrMoveMarker(initLat, initLng, true)
      }

      map.on('click', (event) => {
        const { lat, lng } = event.latlng
        placeOrMoveMarker(lat, lng, false)
      })

      mapRef.current = map
      resizeTimerA = setTimeout(() => map.invalidateSize(), 0)
      resizeTimerB = setTimeout(() => map.invalidateSize(), 250)
    }

    init()
    return () => {
      destroyed = true
      if (resizeTimerA) clearTimeout(resizeTimerA)
      if (resizeTimerB) clearTimeout(resizeTimerB)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      markerRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const L = window.L
    const map = mapRef.current
    if (!L || !map) return
    if (!selected) return

    const icon = createMarkerIcon(L)
    const latNum = Number(selected.latitude)
    const lngNum = Number(selected.longitude)
    if (markerRef.current) {
      markerRef.current.setLatLng([latNum, lngNum])
    } else {
      const marker = L.marker([latNum, lngNum], { icon, draggable: true }).addTo(map)
      marker.on('dragend', (event) => {
        const { lat: dragLat, lng: dragLng } = event.target.getLatLng()
        const dragged = clampToBahrain(dragLat, dragLng)
        event.target.setLatLng([Number(dragged.latitude), Number(dragged.longitude)])
        setSelected(dragged)
        onLocationChange?.(dragged)
      })
      markerRef.current = marker
    }
    map.setView([latNum, lngNum], map.getZoom() < 14 ? 14 : map.getZoom())
  }, [selected, onLocationChange])

  async function handleAreaSearch() {
    const query = areaQuery.trim()
    if (!query) return
    const map = mapRef.current
    if (!map || !window.L) return
    setSearchError('')
    setSearchingArea(true)
    try {
      const result = await geocodeAreaInBahrain(query)
      if (!result) {
        setSearchError('Area not found. Try a more specific area name in Bahrain.')
        return
      }

      const clamped = clampToBahrain(result.latitude, result.longitude)
      const latNum = Number(clamped.latitude)
      const lngNum = Number(clamped.longitude)
      const icon = createMarkerIcon(window.L)

      if (markerRef.current) {
        markerRef.current.setLatLng([latNum, lngNum])
      } else {
        const marker = window.L.marker([latNum, lngNum], { icon, draggable: true }).addTo(map)
        marker.on('dragend', (event) => {
          const { lat: dragLat, lng: dragLng } = event.target.getLatLng()
          const dragged = clampToBahrain(dragLat, dragLng)
          event.target.setLatLng([Number(dragged.latitude), Number(dragged.longitude)])
          setSelected(dragged)
          onLocationChange?.(dragged)
        })
        markerRef.current = marker
      }

      map.setView([latNum, lngNum], 14)
      setSelected(clamped)
      onLocationChange?.(clamped)
    } catch {
      setSearchError('Failed to search this area. Please try again.')
    } finally {
      setSearchingArea(false)
    }
  }

  return (
    <div className="owner-location-wrap">
      <div className="owner-area-search">
        <input
          className="pf-input"
          type="text"
          value={areaQuery}
          onChange={(e) => setAreaQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAreaSearch()
            }
          }}
          placeholder="Enter area name (e.g. Juffair)"
        />
        <button
          type="button"
          className="pf-btn pf-btn-sm pf-btn-ghost"
          onClick={handleAreaSearch}
          disabled={searchingArea || !areaQuery.trim()}
        >
          {searchingArea ? 'Finding...' : 'Find area'}
        </button>
      </div>
      {searchError ? <p className="owner-area-search-error">{searchError}</p> : null}
      <div className="map-picker-container" ref={containerRef} style={{ height }} />
    </div>
  )
}
