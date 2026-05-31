/**
 * ==========================================
 * COMPONENT: Analytics Dashboard View (Pro Version)
 * ==========================================
 */
class AnalyticsView {
    static mapInstance = null;
    static rawGeoJSON = null;

    static async render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `<div class="empty-state"><p>☕ Mengumpulkan data intelijen...</p></div>`;

        const repo = new TripRepository();
        const trips = repo.getAllTrips().filter(t => t.status === 'completed');

        // Variabel Kalkulator Utama
        let totalPendapatan = 0;
        let totalJarak = 0;
        let totalTrip = trips.length;

        // Pemisah Metrik Layanan
        let hematCount = 0;
        let totalPendapatanHemat = 0;
        let totalJarakHemat = 0;

        let standartCount = 0;
        let totalPendapatanStandart = 0;
        let totalJarakStandart = 0;

        trips.forEach(trip => {
            totalPendapatan += trip.nominalPembayaran || 0;
            totalJarak += trip.jarak || 0;
            
            if (trip.jenisLayanan === 'Hemat') {
                hematCount++;
                totalPendapatanHemat += trip.nominalPembayaran || 0;
                totalJarakHemat += trip.jarak || 0;
            } else if (trip.jenisLayanan === 'Standart') {
                standartCount++;
                totalPendapatanStandart += trip.nominalPembayaran || 0;
                totalJarakStandart += trip.jarak || 0;
            }
        });

        // Hitung Metrik Yield/KM
        const yieldHemat = totalJarakHemat > 0 ? (totalPendapatanHemat / totalJarakHemat) : 0;
        const yieldStandart = totalJarakStandart > 0 ? (totalPendapatanStandart / totalJarakStandart) : 0;

        // Muat Library Mapbox (Meminjam fungsi load dari TripAddView)
        await TripAddView.loadMapbox();

        let html = `
            <div class="view-header">
                <h2>📈 Analitik Gacor</h2>
                <button class="btn-back" onclick="kembaliKeDashboard()">⬅ Kembali</button>
            </div>

            <div class="analytics-container">
                <div class="stat-card main-stat-card">
                    <div class="stat-title">Total Arus Kas Masuk</div>
                    <div class="stat-value text-gacor">Rp ${totalPendapatan.toLocaleString('id-ID')}</div>
                </div>

                <div class="analytics-grid">
                    <div class="stat-card">
                        <div class="stat-title">Total Tarikan</div>
                        <div class="stat-value">${totalTrip} <span class="stat-unit">Trip</span></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-title">Jarak Ditempuh</div>
                        <div class="stat-value">${totalJarak.toFixed(1)} <span class="stat-unit">km</span></div>
                    </div>
                </div>

                <!-- KOMPARASI YIELD PER KM -->
                <div class="stat-title" style="margin-top: 10px;">Efisiensi Pendapatan (Yield/KM)</div>
                <div class="analytics-grid">
                    <div class="stat-card highlight-card hemat-card">
                        <div class="stat-title text-blue">HEMAT</div>
                        <div class="stat-value">Rp ${yieldHemat.toLocaleString('id-ID', { maximumFractionDigits: 0 })} <span class="stat-unit" style="font-size:0.75rem;">/km</span></div>
                    </div>
                    <div class="stat-card highlight-card standart-card">
                        <div class="stat-title text-yellow">STANDART</div>
                        <div class="stat-value">Rp ${yieldStandart.toLocaleString('id-ID', { maximumFractionDigits: 0 })} <span class="stat-unit" style="font-size:0.75rem;">/km</span></div>
                    </div>
                </div>

                <!-- HEATMAP MAPBOX -->
                <div class="stat-card" style="padding: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div class="stat-title" style="margin-bottom: 0;">🔥 Peta Titik Panas</div>
                        
                        <!-- Dropdown Filter Waktu -->
                        <select id="filter-waktu-heatmap" class="input-field select-field" style="width: auto; padding: 6px 10px; font-size: 0.8rem;" onchange="AnalyticsView.applyHeatmapFilter()">
                            <option value="semua">Tampilkan Semua</option>
                            <option value="pagi">Pagi (05:00 - 11:00)</option>
                            <option value="siang">Siang (11:00 - 15:00)</option>
                            <option value="sore">Sore (15:00 - 19:00)</option>
                            <option value="malam">Malam (19:00 - 05:00)</option>
                        </select>
                    </div>
                    
                    <div id="map-heatmap" style="width: 100%; height: 320px; border-radius: 12px; border: 1px solid #3a3a3a; z-index: 10;"></div>
                    <div class="stat-desc">Area merah menandakan pusat konsentrasi lu mendapatkan order.</div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Render Mapbox setelah elemen HTML nyangkut di layar
        this.initHeatmap(trips);
    }

    /** Membangun Peta Heatmap dari Data Lokal */
    static initHeatmap(trips) {
        // Ekstraksi data latitude, longitude, dan jam jemput ke format GeoJSON
        const features = trips
            .filter(t => t.koordinatJemput && t.koordinatJemput.lat && t.koordinatJemput.lng)
            .map(t => {
                const dateObj = new Date(t.waktuJemput);
                const jam = dateObj.getHours(); // Ambil jam lokal
                return {
                    "type": "Feature",
                    "properties": { "jam": jam },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [t.koordinatJemput.lng, t.koordinatJemput.lat] // Mapbox pakai format [Lng, Lat]
                    }
                };
            });

        // Simpan data mentah di memory class untuk difilter nanti
        this.rawGeoJSON = {
            "type": "FeatureCollection",
            "features": features
        };

        // Fallback titik awal aman sebelum auto-zoom
        const defaultLng = 112.7688; 
        const defaultLat = -7.2504;

        this.mapInstance = new mapboxgl.Map({
            container: 'map-heatmap',
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [defaultLng, defaultLat],
            zoom: 11
        });

        this.mapInstance.on('load', () => {
            this.mapInstance.resize();

            // Daftarkan koordinat sebagai sumber data
            this.mapInstance.addSource('titik-jemput', {
                type: 'geojson',
                data: this.rawGeoJSON
            });

            // Pasang lapisan pemanas (Heatmap Layer)
            this.mapInstance.addLayer({
                id: 'heatmap-layer',
                type: 'heatmap',
                source: 'titik-jemput',
                maxzoom: 15, // Setelah di-zoom melebihi 15, heatmap bakal memudar
                paint: {
                    // Bobot masing-masing titik koordinat
                    'heatmap-weight': 1,
                    // Intensitas global berdasarkan level zoom
                    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
                    // Palet warna gradasi dari bening ➜ Biru ➜ Hijau ➜ Kuning ➜ Merah
                    'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        0, 'rgba(0,0,0,0)',
                        0.2, '#38bdf8', 
                        0.5, '#22c55e', 
                        0.8, '#fbbf24', 
                        1, '#dc2626'    
                    ],
                    // Radius penyebaran warna per titik
                    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 5, 15, 30],
                    // Transparansi keseluruhan layer
                    'heatmap-opacity': 0.85
                }
            });

            // Framing Kamera Otomatis: Kamera Mapbox akan mencari batas terjauh semua titik lu
            if (features.length > 0) {
                const bounds = new mapboxgl.LngLatBounds();
                features.forEach(f => bounds.extend(f.geometry.coordinates));
                this.mapInstance.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 1500 });
            }
        });
    }

    /** Fungsi memotong data yang ditampilkan Mapbox saat dropdown diganti */
    static applyHeatmapFilter() {
        if (!this.mapInstance || !this.rawGeoJSON) return;

        const filterValue = document.getElementById('filter-waktu-heatmap').value;
        let filteredFeatures = this.rawGeoJSON.features;

        if (filterValue !== 'semua') {
            filteredFeatures = this.rawGeoJSON.features.filter(f => {
                const jam = f.properties.jam;
                if (filterValue === 'pagi') return jam >= 5 && jam < 11;
                if (filterValue === 'siang') return jam >= 11 && jam < 15;
                if (filterValue === 'sore') return jam >= 15 && jam < 19;
                if (filterValue === 'malam') return jam >= 19 || jam < 5;
                return true;
            });
        }

        // Tembak data baru ke Mapbox
        this.mapInstance.getSource('titik-jemput').setData({
            "type": "FeatureCollection",
            "features": filteredFeatures
        });
    }
}