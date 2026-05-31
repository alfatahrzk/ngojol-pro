/**
 * ==========================================
 * COMPONENT: Analytics Dashboard View (Predictive Pro v2.2)
 * ==========================================
 */
class AnalyticsView {
    static mapInstance = null;
    static rawGeoJSON = null;

    static async render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `<div class="empty-state"><p>☕ Memuat Radar Prediksi Gacor...</p></div>`;

        const repo = new TripRepository();
        const trips = repo.getAllTrips().filter(t => t.status === 'completed');

        let totalPendapatan = 0, totalJarak = 0, totalTrip = trips.length;

        let hematCount = 0, totalPendapatanHemat = 0, totalJarakHemat = 0;
        let standartCount = 0, totalPendapatanStandart = 0, totalJarakStandart = 0;
        let foodCount = 0, totalPendapatanFood = 0, totalJarakFood = 0;
        let expressCount = 0, totalPendapatanExpress = 0, totalJarakExpress = 0;

        trips.forEach(trip => {
            totalPendapatan += trip.nominalPembayaran || 0;
            totalJarak += trip.jarak || 0;
            
            if (trip.jenisLayanan === 'Hemat') {
                hematCount++; totalPendapatanHemat += trip.nominalPembayaran || 0; totalJarakHemat += trip.jarak || 0;
            } else if (trip.jenisLayanan === 'Standart') {
                standartCount++; totalPendapatanStandart += trip.nominalPembayaran || 0; totalJarakStandart += trip.jarak || 0;
            } else if (trip.jenisLayanan === 'Food') {
                foodCount++; totalPendapatanFood += trip.nominalPembayaran || 0; totalJarakFood += trip.jarak || 0;
            } else if (trip.jenisLayanan === 'Express') {
                expressCount++; totalPendapatanExpress += trip.nominalPembayaran || 0; totalJarakExpress += trip.jarak || 0;
            }
        });

        const yieldHemat = totalJarakHemat > 0 ? (totalPendapatanHemat / totalJarakHemat) : 0;
        const yieldStandart = totalJarakStandart > 0 ? (totalPendapatanStandart / totalJarakStandart) : 0;
        const yieldFood = totalJarakFood > 0 ? (totalPendapatanFood / totalJarakFood) : 0;
        const yieldExpress = totalJarakExpress > 0 ? (totalPendapatanExpress / totalJarakExpress) : 0;

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

                <div class="stat-title" style="margin-top: 10px;">Yield / KM Per Layanan</div>
                <div class="analytics-grid" style="grid-template-columns: repeat(2, 1fr); gap: 12px;">
                    <div class="stat-card highlight-card hemat-card">
                        <div class="stat-title text-blue">HEMAT</div>
                        <div class="stat-value" style="font-size:1.3rem;">Rp ${yieldHemat.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div class="stat-card highlight-card standart-card">
                        <div class="stat-title text-yellow">STANDART</div>
                        <div class="stat-value" style="font-size:1.3rem;">Rp ${yieldStandart.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div class="stat-card highlight-card food-card">
                        <div class="stat-title text-orange">FOOD</div>
                        <div class="stat-value" style="font-size:1.3rem;">Rp ${yieldFood.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div class="stat-card highlight-card express-card">
                        <div class="stat-title text-purple">EXPRESS</div>
                        <div class="stat-value" style="font-size:1.3rem;">Rp ${yieldExpress.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</div>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-title" style="margin-bottom: 12px;">Distribusi Layanan</div>
                    <div class="progress-bar-container">
                        <div class="progress-segment segment-hemat" style="width: ${totalTrip > 0 ? (hematCount/totalTrip)*100 : 25}%">H (${hematCount})</div>
                        <div class="progress-segment segment-standart" style="width: ${totalTrip > 0 ? (standartCount/totalTrip)*100 : 25}%">S (${standartCount})</div>
                        <div class="progress-segment segment-food" style="width: ${totalTrip > 0 ? (foodCount/totalTrip)*100 : 25}%">F (${foodCount})</div>
                        <div class="progress-segment segment-express" style="width: ${totalTrip > 0 ? (expressCount/totalTrip)*100 : 25}%">E (${expressCount})</div>
                    </div>
                </div>

                <div class="stat-card" style="padding: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 4px;">
                        <div class="stat-title" style="margin-bottom: 0;">🔥 Peta Prediksi Order</div>
                        
                        <select id="filter-waktu-heatmap" class="input-field select-field" style="width: auto; padding: 6px 10px; font-size: 0.8rem;" onchange="AnalyticsView.applyHeatmapFilter()">
                            <option value="semua">Tampilkan Semua</option>
                            <option value="prediksi_depan">Prediksi 1 Jam ke Depan</option>
                            <option value="pagi">Pagi (05:00 - 11:00)</option>
                            <option value="siang">Siang (11:00 - 15:00)</option>
                            <option value="sore">Sore (15:00 - 19:00)</option>
                            <option value="malam">Malam (19:00 - 05:00)</option>
                        </select>
                    </div>
                    
                    <div id="map-heatmap" style="width: 100%; height: 320px; border-radius: 12px; border: 1px solid #3a3a3a; z-index: 10;"></div>
                    <div class="stat-desc" id="heatmap-desc">Pusat konsentrasi order lu secara keseluruhan.</div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        this.initHeatmap(trips);
    }

    static initHeatmap(trips) {
        const features = trips
            .filter(t => t.koordinatJemput && t.koordinatJemput.lat && t.koordinatJemput.lng)
            .map(t => {
                const dateObj = new Date(t.waktuJemput);
                return {
                    "type": "Feature",
                    "properties": { 
                        "jam": dateObj.getHours(),
                        "menit": dateObj.getMinutes()
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [t.koordinatJemput.lng, t.koordinatJemput.lat]
                    }
                };
            });

        this.rawGeoJSON = { "type": "FeatureCollection", "features": features };

        const defaultLng = 112.7688; 
        const defaultLat = -7.2504;

        this.mapInstance = new mapboxgl.Map({
            container: 'map-heatmap', style: 'mapbox://styles/mapbox/dark-v11', center: [defaultLng, defaultLat], zoom: 11
        });

        this.mapInstance.on('load', () => {
            this.mapInstance.resize();
            this.mapInstance.addSource('titik-jemput', { type: 'geojson', data: this.rawGeoJSON });

            this.mapInstance.addLayer({
                id: 'heatmap-layer', type: 'heatmap', source: 'titik-jemput', maxzoom: 15,
                paint: {
                    'heatmap-weight': 1,
                    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
                    'heatmap-color': [
                        'interpolate', ['linear'], ['heatmap-density'],
                        0, 'rgba(0,0,0,0)', 0.2, '#38bdf8', 0.5, '#22c55e', 0.8, '#fbbf24', 1, '#dc2626'    
                    ],
                    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 5, 15, 30],
                    'heatmap-opacity': 0.85
                }
            });

            if (features.length > 0) {
                const bounds = new mapboxgl.LngLatBounds();
                features.forEach(f => bounds.extend(f.geometry.coordinates));
                this.mapInstance.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 1500 });
            }
        });
    }

    /** FILTER ALGORITMA PREDIKSI 1 JAM KE DEPAN */
    static applyHeatmapFilter() {
        if (!this.mapInstance || !this.rawGeoJSON) return;

        const filterValue = document.getElementById('filter-waktu-heatmap').value;
        const descLabel = document.getElementById('heatmap-desc');
        let filteredFeatures = this.rawGeoJSON.features;

        if (filterValue === 'prediksi_depan') {
            // 1. Dapatkan jam dan menit HP saat ini
            const sekarang = new Date();
            const currentTotalMinutes = (sekarang.getHours() * 60) + sekarang.getMinutes();
            
            // Hitung 1 jam ke depan untuk UI text
            let satuJamKedepanMenit = currentTotalMinutes + 60;
            if (satuJamKedepanMenit >= 24 * 60) satuJamKedepanMenit -= (24 * 60);

            const timeFormatStr = (menitTotal) => {
                let h = Math.floor(menitTotal / 60) % 24;
                let m = menitTotal % 60;
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            };
            
            descLabel.innerHTML = `Prediksi titik kumpul order <b style="color:#22c55e;">${timeFormatStr(currentTotalMinutes)} s/d ${timeFormatStr(satuJamKedepanMenit)}</b> dari histori semua hari.`;

            // 2. LOGIKA FORWARD-LOOKING (Prediksi Depan)
            filteredFeatures = this.rawGeoJSON.features.filter(f => {
                const orderTotalMinutes = (f.properties.jam * 60) + f.properties.menit;
                
                // Kurangi waktu order dengan waktu sekarang
                let diff = orderTotalMinutes - currentTotalMinutes;
                
                // Jika waktu order lebih kecil (contoh: sekarang 23:45, order histori jam 00:30 besoknya)
                // Kita tambahkan 24 jam ke perhitungan agar tidak error minus
                if (diff < 0) diff += 24 * 60; 

                // Lolos sensor JIKA order terjadi antara 0 sampai 60 menit KE DEPAN dari jam HP sekarang
                return diff >= 0 && diff <= 60;
            });

        } else {
            if (filterValue === 'semua') descLabel.innerText = "Pusat konsentrasi order lu secara keseluruhan.";
            if (filterValue === 'pagi') descLabel.innerText = "Histori area ramai order Pagi (05:00 - 11:00).";
            if (filterValue === 'siang') descLabel.innerText = "Histori area ramai order Siang (11:00 - 15:00).";
            if (filterValue === 'sore') descLabel.innerText = "Histori area ramai order Sore (15:00 - 19:00).";
            if (filterValue === 'malam') descLabel.innerText = "Histori area ramai order Malam (19:00 - 05:00).";

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
        }

        // Tembak data hasil prediksi ke Mapbox
        this.mapInstance.getSource('titik-jemput').setData({
            "type": "FeatureCollection", "features": filteredFeatures
        });
    }
}