/**
 * ==========================================
 * CONFIGURATION LAYER (MAPBOX)
 * ==========================================
 */
const MAPBOX_CONFIG = {
    // ⚠️ CRITICAL: Wajib ganti dengan Access Token asli dari dashboard mapbox.com lu
    accessToken: "pk.eyJ1IjoiYWxmYXRhaHJ6ayIsImEiOiJjbW4zZjk1czgxY2NrMm9xNW1xeDNjNGplIn0.kTnR7XkvTxRPM_Te-rPZnw" 
};

/**
 * ==========================================
 * COMPONENT: Trip Add Manual View (With Mapbox & Real Route Preview)
 * ==========================================
 */
class TripAddView {
    static markerJemput = null;
    static markerSelesai = null;
    static mapInstance = null;
    static routeLayerId = 'route-line';
    static routeSourceId = 'route-source';
    static currentCalculatedDistance = 0; 

    /** Memuat aset Mapbox GL JS secara dinamis */
    static loadMapbox() {
        return new Promise((resolve) => {
            if (window.mapboxgl) return resolve();

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
            document.head.appendChild(link);

            const script = document.createElement('script');
            script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
            script.onload = () => {
                mapboxgl.accessToken = MAPBOX_CONFIG.accessToken;
                resolve();
            };
            document.head.appendChild(script);
        });
    }

    /** Helper memecah teks koordinat */
    static parseCoords(str) {
        if (!str) return null;
        const parts = str.split(',');
        if (parts.length !== 2) return null;
        const lat = parseFloat(parts[0].trim());
        const lng = parseFloat(parts[1].trim());
        if (isNaN(lat) || isNaN(lng)) return null;
        return { lat, lng };
    }

    /** Mengambil data rute jalan raya dari Mapbox API */
    static async fetchAndDrawRoute(start, end) {
        if (!this.mapInstance || !this.mapInstance.getSource(this.routeSourceId)) return;

        try {
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start.lng},${start.lat};${end.lng},${end.lat}?geometries=geojson&access_token=${MAPBOX_CONFIG.accessToken}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error("Gagal mengambil data rute");
            
            const data = await response.json();
            
            if (data.routes && data.routes.length > 0) {
                const routeGeoJSON = data.routes[0].geometry;
                
                // Konversi jarak meter ke KM
                const distanceMeters = data.routes[0].distance;
                this.currentCalculatedDistance = distanceMeters / 1000;

                // Tampilkan info jarak secara live di pojok label HTML
                const distLabel = document.getElementById('manual-jarak-text');
                if (distLabel) distLabel.innerText = `${this.currentCalculatedDistance.toFixed(2)} km`;

                this.mapInstance.getSource(this.routeSourceId).setData({
                    type: 'Feature',
                    properties: {},
                    geometry: routeGeoJSON
                });
            }
        } catch (error) {
            console.error("Gagal menggambar rute:", error.message);
        }
    }

    /** Fungsi Live Preview Update Posisi Pin & Garis Rute */
    static updatePreview() {
        if (!this.mapInstance) return;

        const jemputStr = document.getElementById('manual-coord-jemput').value;
        const selesaiStr = document.getElementById('manual-coord-selesai').value;

        const posJemput = this.parseCoords(jemputStr);
        const posSelesai = this.parseCoords(selesaiStr);

        if (posJemput && this.markerJemput) {
            this.markerJemput.setLngLat([posJemput.lng, posJemput.lat]);
        }

        if (posSelesai && this.markerSelesai) {
            this.markerSelesai.setLngLat([posSelesai.lng, posSelesai.lat]);
        }

        if (posJemput && posSelesai) {
            this.fetchAndDrawRoute(posJemput, posSelesai);

            const bounds = new mapboxgl.LngLatBounds()
                .extend([posJemput.lng, posJemput.lat])
                .extend([posSelesai.lng, posSelesai.lat]);

            this.mapInstance.fitBounds(bounds, {
                padding: 50,
                maxZoom: 15,
                duration: 800
            });
        }
    }

    /** Merender UI Formulir */
    static async render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `<div class="empty-state"><p>☕ Sedang memuat modul Mapbox...</p></div>`;
        await this.loadMapbox();

        let html = `
            <div class="view-header">
                <h2>➕ Tambah Trip Manual</h2>
                <button class="btn-back" onclick="handleMenuClick('Trip')">✕ Batalkan</button>
            </div>
            
            <div class="form-manual-container">
                <div class="form-row-grid">
                    <div class="form-group">
                        <label class="form-label">Waktu Jemput</label>
                        <input type="datetime-local" id="manual-waktu-jemput" class="input-field">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Waktu Selesai</label>
                        <input type="datetime-local" id="manual-waktu-selesai" class="input-field">
                    </div>
                </div>

                <div class="form-row-grid">
                    <div class="form-group">
                        <label class="form-label">Jenis Layanan</label>
                        <select id="manual-layanan" class="input-field select-field">
                            <option value="Hemat">Hemat</option>
                            <option value="Standart">Standart</option>
                            <option value="Food">Food</option>
                            <option value="Express">Express</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Metode Bayar</label>
                        <select id="manual-metode" class="input-field select-field">
                            <option value="Nontunai">Non-Tune</option>
                            <option value="QR">QR</option>
                            <option value="Tunai">Tunai</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Nominal Pendapatan (Rp)</label>
                    <input type="number" id="manual-nominal" class="input-field" placeholder="Contoh: 18000" inputmode="numeric">
                </div>

                <div class="form-group">
                    <label class="form-label">Koordinat Jemput/Pick-up (Format: Lat, Long)</label>
                    <input type="text" id="manual-coord-jemput" class="input-field" placeholder="-7.2504, 112.7688" oninput="TripAddView.updatePreview()">
                </div>

                <div class="form-group">
                    <label class="form-label">Koordinat Tujuan/Drop-off (Format: Lat, Long)</label>
                    <input type="text" id="manual-coord-selesai" class="input-field" placeholder="-7.3001, 112.7389" oninput="TripAddView.updatePreview()">
                </div>

                <div class="form-group">
                    <label class="form-label" style="display:flex; justify-content:space-between; width:100%;">
                        <span>Preview Peta Rute</span>
                        <span id="manual-jarak-text" style="color:#22c55e; font-weight:800;">0.00 km</span>
                    </label>
                    <div class="info-map-tip">🟢 Pin Hijau = Jemput | 🔴 Pin Merah = Tujuan</div>
                    <div id="map-manual"></div>
                </div>

                <button class="btn-submit" onclick="TripAddView.eksekusiSimpanManual()">SIMPAN TRIP MANUAL</button>
            </div>
        `;

        container.innerHTML = html;
        
        const sekarang = new Date();
        sekarang.setMinutes(sekarang.getMinutes() - sekarang.getTimezoneOffset());
        document.getElementById('manual-waktu-jemput').value = sekarang.toISOString().slice(0, 16);
        document.getElementById('manual-waktu-selesai').value = sekarang.toISOString().slice(0, 16);

        this.initMap();
    }

    /** Inisialisasi Peta & Lapisan Garis Rute */
    static initMap() {
        const defaultLat = -7.2504;
        const defaultLng = 112.7688;

        this.mapInstance = new mapboxgl.Map({
            container: 'map-manual',
            style: 'mapbox://styles/mapbox/dark-v11', 
            center: [defaultLng, defaultLat], 
            zoom: 12
        });

        this.mapInstance.on('load', () => {
            this.mapInstance.resize(); 

            // Daftarkan layer rute kosong
            this.mapInstance.addSource(this.routeSourceId, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: [] }
                }
            });

            this.mapInstance.addLayer({
                id: this.routeLayerId,
                type: 'line',
                source: this.routeSourceId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#38bdf8', 
                    'line-width': 4,          
                    'line-opacity': 0.85
                }
            });

            // Inisialisasi Pin HTML Kustom
            const elJemput = document.createElement('div');
            elJemput.className = 'mapbox-custom-marker marker-green';

            const elSelesai = document.createElement('div');
            elSelesai.className = 'mapbox-custom-marker marker-red';

            this.markerJemput = new mapboxgl.Marker(elJemput).setLngLat([defaultLng, defaultLat]).addTo(this.mapInstance);
            this.markerSelesai = new mapboxgl.Marker(elSelesai).setLngLat([defaultLng, defaultLat]).addTo(this.mapInstance);

            // Tarik posisi GPS awal HP
            navigator.geolocation.getCurrentPosition((position) => {
                const currentLat = position.coords.latitude;
                const currentLng = position.coords.longitude;
                
                document.getElementById('manual-coord-jemput').value = `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;
                document.getElementById('manual-coord-selesai').value = `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;
                
                TripAddView.updatePreview();
            }, () => {
                document.getElementById('manual-coord-jemput').value = `${defaultLat}, ${defaultLng}`;
                document.getElementById('manual-coord-selesai').value = `${defaultLat}, ${defaultLng}`;
                TripAddView.updatePreview();
            });
        });
    }

    /** Simpan Akhir */
    static async eksekusiSimpanManual() {
        try {
            const waktuJemputInput = document.getElementById('manual-waktu-jemput').value;
            const waktuSelesaiInput = document.getElementById('manual-waktu-selesai').value;
            const layanan = document.getElementById('manual-layanan').value;
            const metode = document.getElementById('manual-metode').value;
            const nominal = parseInt(document.getElementById('manual-nominal').value) || 0;

            const jemputStr = document.getElementById('manual-coord-jemput').value;
            const selesaiStr = document.getElementById('manual-coord-selesai').value;

            const posJemput = this.parseCoords(jemputStr);
            const posSelesai = this.parseCoords(selesaiStr);

            if (!posJemput || !posSelesai) throw new Error("Koordinat cacat format.");

            const manualTrip = new Trip();
            manualTrip.waktuJemput = new Date(waktuJemputInput).toISOString();
            manualTrip.koordinatJemput = new GeoLocation(posJemput.lat, posJemput.lng);
            manualTrip.waktuSelesai = new Date(waktuSelesaiInput).toISOString();
            manualTrip.koordinatSelesai = new GeoLocation(posSelesai.lat, posSelesai.lng);
            
            // Loloskan layanan baru (Food & Express) ke app.js
            manualTrip.updateFinancials(layanan, metode, nominal);
            
            // Simpan jarak real kalkulasi dari Mapbox
            manualTrip.jarak = this.currentCalculatedDistance;

            const repo = new TripRepository();
            repo.save(manualTrip);

            await SyncManager.syncPendingTrips();
            handleMenuClick('Trip');
        } catch (error) {
            alert(`Gagal menyimpan data manual: ${error.message}`);
        }
    }
}