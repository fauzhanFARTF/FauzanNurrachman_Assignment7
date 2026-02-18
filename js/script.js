/**
 * Script untuk Peta Transportasi Jakarta
 * Menggunakan Leaflet.js untuk menampilkan peta interaktif
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
// INISIALISASI PETA
// ========================================
const map = L.map('map').setView([-6.2088, 106.8456], 12);

// Tambah tile layer OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 18,
}).addTo(map);

// ========================================
// PENYIMPANAN LAYER
// ========================================
const layers = {};

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
// FUNGSI LOAD KRL DARI API
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

    layers.krl = L.geoJSON(data, {
      style: {
        color: ROUTE_CONFIG.krl.color,
        weight: 4,
        opacity: 0.9,
        dashArray: ROUTE_CONFIG.krl.dashArray,
      },
    }).addTo(map);

    console.log('✅ Loaded: KRL from API');
  } catch (error) {
    console.warn('⚠️ Could not load KRL from API:', error.message);
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

        // Pastikan TJ tetap di bawah
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

  // Fit bounds untuk menampilkan semua rute
  const allLayers = Object.values(layers).filter((layer) => layer);

  if (allLayers.length > 0) {
    const group = L.featureGroup(allLayers);
    map.fitBounds(group.getBounds().pad(0.1));
  }

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
