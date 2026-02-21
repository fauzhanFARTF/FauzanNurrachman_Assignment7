/**
 * Script untuk Peta Transportasi Jakarta
 * Menggunakan Leaflet.js untuk menampilkan peta interaktif
 * Fokus area: DKI Jakarta
 */

// ========================================
// KONFIGURASI WARNA RUTE
// ========================================
const ROUTE_CONFIG = {
  tj: {
    color: '#0066CC',
    name: 'Transjakarta',
    file: 'jalur_transjakarta.geojson',
  },
  mrt: {
    color: '#DC143C',
    name: 'MRT Jakarta',
    file: 'jalur_mrt.geojson',
  },
  lrt: {
    color: '#228B22',
    name: 'LRT Jakarta',
    file: 'jalur_lrt_jakarta.geojson',
  },
  krl: {
    color: '#2E2E2E',
    name: 'KRL Commuter Line',
    dashArray: '10, 5',
  },
};

// ========================================
// BOUNDING BOX DKI JAKARTA
// ========================================
const JAKARTA_BOUNDS = {
  south: -6.3751,
  north: -6.0844,
  west: 106.6294,
  east: 106.9758,
};

// ========================================
// CENTER & DEFAULT ZOOM JAKARTA
// ========================================
const JAKARTA_CENTER = [-6.2088, 106.8456];
const DEFAULT_ZOOM = 11;
const MIN_ZOOM = 10;
const MAX_ZOOM = 16;

// ========================================
// INISIALISASI PETA
// ========================================
const map = L.map('map', {
  center: JAKARTA_CENTER,
  zoom: DEFAULT_ZOOM,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  maxBounds: [
    [JAKARTA_BOUNDS.south - 0.1, JAKARTA_BOUNDS.west - 0.1],
    [JAKARTA_BOUNDS.north + 0.1, JAKARTA_BOUNDS.east + 0.1],
  ],
  maxBoundsViscosity: 0.8,
});

// Tambah tile layer OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

// ========================================
// PENYIMPANAN LAYER
// ========================================
const layers = {};

// ========================================
// FUNGSI CEK KOORDINAT DALAM JAKARTA
// ========================================
function isPointInJakarta(lat, lng) {
  return (
    lat >= JAKARTA_BOUNDS.south &&
    lat <= JAKARTA_BOUNDS.north &&
    lng >= JAKARTA_BOUNDS.west &&
    lng <= JAKARTA_BOUNDS.east
  );
}

// ========================================
// FUNGSI FILTER GEOJSON BY BOUNDS
// ========================================
function filterGeoJSONByBounds(geojson) {
  if (!geojson || !geojson.features)
    return { type: 'FeatureCollection', features: [] };

  return {
    type: 'FeatureCollection',
    features: geojson.features.filter((feature) => {
      if (!feature.geometry) return false;

      const geom = feature.geometry;

      if (geom.type === 'LineString') {
        return geom.coordinates.some(([lng, lat]) =>
          isPointInJakarta(lat, lng),
        );
      }

      if (geom.type === 'MultiLineString') {
        return geom.coordinates.some((line) =>
          line.some(([lng, lat]) => isPointInJakarta(lat, lng)),
        );
      }

      if (geom.type === 'Point') {
        const [lng, lat] = geom.coordinates;
        return isPointInJakarta(lat, lng);
      }

      if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
        // Cek bounding box polygon
        const coords =
          geom.type === 'Polygon'
            ? geom.coordinates[0]
            : geom.coordinates[0][0];
        return coords.some(([lng, lat]) => isPointInJakarta(lat, lng));
      }

      return false;
    }),
  };
}

// ========================================
// FUNGSI LOAD GEOJSON LOKAL
// ========================================
async function loadLocalGeoJSON(type, filename) {
  try {
    const response = await fetch(`assets/${filename}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    const styleOptions = {
      color: ROUTE_CONFIG[type].color,
      weight: 4,
      opacity: 0.8,
    };

    if (ROUTE_CONFIG[type].dashArray) {
      styleOptions.dashArray = ROUTE_CONFIG[type].dashArray;
    }

    layers[type] = L.geoJSON(data, {
      style: styleOptions,
    }).addTo(map);

    console.log(`✅ Loaded: ${filename}`);
  } catch (error) {
    console.warn(`⚠️ Could not load ${filename}:`, error.message);
  }
}

// ========================================
// FUNGSI LOAD KRL DARI API (FOKUS JAKARTA)
// ========================================
async function loadKRLFromAPI() {
  try {
    const url =
      'https://geoservices.big.go.id/rbi/rest/services/BASEMAP/Rupabumi_Indonesia/MapServer/340/query?where=1%3D1&f=geojson&outFields=*';

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Filter data hanya untuk area Jakarta
    const jakartaData = filterGeoJSONByBounds(data);

    if (jakartaData.features.length === 0) {
      console.warn('⚠️ No KRL data found within Jakarta bounds');
      return;
    }

    layers.krl = L.geoJSON(jakartaData, {
      style: {
        color: ROUTE_CONFIG.krl.color,
        weight: 4,
        opacity: 0.9,
        dashArray: ROUTE_CONFIG.krl.dashArray,
      },
    }).addTo(map);

    console.log(
      `✅ Loaded: ${jakartaData.features.length} KRL features in Jakarta`,
    );
  } catch (error) {
    console.warn('⚠️ Could not load KRL from API:', error.message);
  }
}

// ========================================
// FUNGSI FIT BOUNDS DENGAN BATASAN
// ========================================
function fitMapToBounds(layers) {
  const allLayers = Object.values(layers).filter((layer) => layer);

  if (allLayers.length === 0) {
    map.setView(JAKARTA_CENTER, DEFAULT_ZOOM);
    return;
  }

  const group = L.featureGroup(allLayers);
  const bounds = group.getBounds();

  // Hitung span bounds
  const latSpan = bounds.getNorth() - bounds.getSouth();
  const lngSpan = bounds.getEast() - bounds.getWest();

  // Jika bounds terlalu luas (lebih dari area Jakarta), gunakan default view
  if (latSpan > 0.5 || lngSpan > 0.5) {
    map.setView(JAKARTA_CENTER, DEFAULT_ZOOM);
  } else {
    // Fit bounds dengan padding, tapi batasi zoom level
    map.fitBounds(bounds.pad(0.1), {
      maxZoom: 14,
      minZoom: MIN_ZOOM,
    });
  }
}

// ========================================
// FUNGSI FILTER
// ========================================
function setupFilter(filterId, layerType) {
  const checkbox = document.getElementById(filterId);

  if (!checkbox) return;

  checkbox.addEventListener('change', function () {
    if (this.checked) {
      if (layers[layerType]) {
        map.addLayer(layers[layerType]);

        if (layerType === 'tj') {
          layers[layerType].eachLayer((layer) => layer.bringToBack());
        }
      }
    } else {
      if (layers[layerType]) {
        map.removeLayer(layers[layerType]);
      }
    }
  });
}

// ========================================
// FUNGSI INITIALIZATION
// ========================================
async function init() {
  console.log('🗺️ Initializing map...');

  // Load semua rute
  await Promise.all([
    loadLocalGeoJSON('tj', ROUTE_CONFIG.tj.file),
    loadLocalGeoJSON('mrt', ROUTE_CONFIG.mrt.file),
    loadLocalGeoJSON('lrt', ROUTE_CONFIG.lrt.file),
    loadKRLFromAPI(),
  ]);

  // Pastikan TJ di layer paling bawah
  if (layers.tj) {
    layers.tj.eachLayer((layer) => layer.bringToBack());
  }

  // Fit bounds dengan batasan zoom Jakarta
  fitMapToBounds(layers);

  // Setup filter controls
  setupFilter('filter-tj', 'tj');
  setupFilter('filter-mrt', 'mrt');
  setupFilter('filter-lrt', 'lrt');
  setupFilter('filter-krl', 'krl');

  console.log('🗺️ Map initialized successfully!');
}

// ========================================
// JALANKAN INIT SAAT DOM READY
// ========================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
