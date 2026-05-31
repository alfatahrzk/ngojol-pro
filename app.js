/**
 * ==========================================
 * CONFIGURATION LAYER
 * ==========================================
 */
const SUPABASE_CONFIG = {
    url: "https://gxmufqdqtloeogjwfcqn.supabase.co", // <-- Isi dengan URL Supabase Lu
    anonKey: "sb_publishable_yl10Yjku6p9ppx8PdvOF9w_EbR1yAu-" // <-- Isi dengan Anon Key Lu
};

/**
 * ==========================================
 * 1. DOMAIN LAYER (Struktur Data & OOP)
 * ==========================================
 */

class GeoLocation {
    constructor(latitude, longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }
}

class Trip {
    constructor() {
        this.tripId = crypto.randomUUID();
        this.status = 'draft'; // draft | completed
        this.waktuJemput = null;
        this.koordinatJemput = null; 
        this.waktuSelesai = null;
        this.koordinatSelesai = null; 
        
        // Smart Defaults
        this.jenisLayanan = 'Hemat'; 
        this.metodePembayaran = 'Nontunai'; 
        this.nominalPembayaran = 0;
        this.jarak = 0; // Menyimpan jarak dalam satuan KM

        // Flag sinkronisasi cloud
        this.isSynced = false; 
    }

    start(location) {
        if (!(location instanceof GeoLocation)) throw new Error("Lokasi tidak valid.");
        this.waktuJemput = new Date().toISOString();
        this.koordinatJemput = location;
        this.status = 'draft';
        this.isSynced = false;
    }

    complete(location) {
        if (!this.waktuJemput) throw new Error("Trip belum dimulai.");
        if (!(location instanceof GeoLocation)) throw new Error("Lokasi tidak valid.");
        this.waktuSelesai = new Date().toISOString();
        this.koordinatSelesai = location;

        // Otomatis hitung jarak lurus (Haversine) sebagai fallback aman pas on-bid di jalan
        this.jarak = LocationService.calculateHaversine(
            this.koordinatJemput.latitude, this.koordinatJemput.longitude,
            this.koordinatSelesai.latitude, this.koordinatSelesai.longitude
        );
    }

    updateFinancials(layanan, metode, nominal) {
        // Tambahkan Food dan Express ke dalam whitelist aturan
        const validLayanan = ['Hemat', 'Standart', 'Food', 'Express'];
        const validMetode = ['Tunai', 'QR', 'Nontunai'];

        if (!validLayanan.includes(layanan)) throw new Error("Layanan tidak valid.");
        if (!validMetode.includes(metode)) throw new Error("Metode pembayaran tidak valid.");
        if (isNaN(nominal) || nominal < 0) throw new Error("Nominal harus berupa angka positif.");

        this.jenisLayanan = layanan;
        this.metodePembayaran = metode;
        this.nominalPembayaran = Number(nominal);
        this.status = 'completed';
    }

    toJSON() {
        return {
            tripId: this.tripId,
            status: this.status,
            waktuJemput: this.waktuJemput,
            koordinatJemput: this.koordinatJemput ? { lat: this.koordinatJemput.latitude, lng: this.koordinatJemput.longitude } : null,
            waktuSelesai: this.waktuSelesai,
            koordinatSelesai: this.koordinatSelesai ? { lat: this.koordinatSelesai.latitude, lng: this.koordinatSelesai.longitude } : null,
            jenisLayanan: this.jenisLayanan,
            metodePembayaran: this.metodePembayaran,
            nominalPembayaran: this.nominalPembayaran,
            jarak: this.jarak,
            isSynced: this.isSynced
        };
    }

    toDatabaseSchema() {
        return {
            trip_id: this.tripId,
            status: this.status,
            waktu_jemput: this.waktuJemput,
            koordinat_jemput: this.koordinatJemput ? { lat: this.koordinatJemput.latitude, lng: this.koordinatJemput.longitude } : null,
            waktu_selesai: this.waktuSelesai,
            koordinat_selesai: this.koordinatSelesai ? { lat: this.koordinatSelesai.latitude, lng: this.koordinatSelesai.longitude } : null,
            jenis_layanan: this.jenisLayanan,
            metode_pembayaran: this.metodePembayaran,
            nominal_pembayaran: this.nominalPembayaran,
            jarak: this.jarak
        };
    }

    static fromJSON(raw) {
        const trip = new Trip();
        trip.tripId = raw.tripId;
        trip.status = raw.status;
        trip.waktuJemput = raw.waktuJemput;
        trip.koordinatJemput = raw.koordinatJemput ? new GeoLocation(raw.koordinatJemput.lat, raw.koordinatJemput.lng) : null;
        trip.waktuSelesai = raw.waktuSelesai;
        trip.koordinatSelesai = raw.koordinatSelesai ? new GeoLocation(raw.koordinatSelesai.lat, raw.koordinatSelesai.lng) : null;
        trip.jenisLayanan = raw.jenisLayanan;
        trip.metodePembayaran = raw.metodePembayaran;
        trip.nominalPembayaran = raw.nominalPembayaran;
        trip.jarak = raw.jarak || 0;
        trip.isSynced = raw.isSynced || false;
        return trip;
    }
}

/**
 * ==========================================
 * 2. INFRASTRUCTURE LAYER (Hardware, Storage & Cloud API)
 * ==========================================
 */

class LocationService {
    static getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                return reject(new Error("Geolocation tidak didukung oleh browser ini."));
            }
            const gpsOptions = { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 };
            navigator.geolocation.getCurrentPosition(
                (position) => resolve(new GeoLocation(position.coords.latitude, position.coords.longitude)),
                (error) => reject(error),
                gpsOptions
            );
        });
    }

    /** Rumus Haversine untuk hitung jarak bumi (KM) */
    static calculateHaversine(lat1, lon1, lat2, lon2) {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; 
    }
}

class TripRepository {
    constructor() {
        this.storageKey = 'ngojol_trip_history';
    }

    getAllTrips() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
    }

    save(trip) {
        const trips = this.getAllTrips();
        const index = trips.findIndex(t => t.tripId === trip.tripId);
        
        if (index !== -1) {
            trips[index] = trip.toJSON();
        } else {
            trips.push(trip.toJSON());
        }
        localStorage.setItem(this.storageKey, JSON.stringify(trips));
    }
}

class SupabaseService {
    static async upsertTrip(trip) {
        if (!(trip instanceof Trip)) throw new Error("Data tidak valid");
        
        const payload = trip.toDatabaseSchema();
        const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/trips`;

        const response = await fetch(endpoint, {
            method: 'POST', 
            headers: {
                'apikey': SUPABASE_CONFIG.anonKey,
                'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates' 
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Supabase Error: ${errText}`);
        }
        return true;
    }
}

class SyncManager {
    static async checkCloudConnection() {
        if (!navigator.onLine) {
            if (typeof updateConnectionIndicator === 'function') updateConnectionIndicator('red');
            return;
        }

        if (typeof updateConnectionIndicator === 'function') updateConnectionIndicator('yellow');

        try {
            const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/trips?limit=1`;
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_CONFIG.anonKey,
                    'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
                }
            });

            if (response.ok) {
                if (typeof updateConnectionIndicator === 'function') updateConnectionIndicator('green');
            } else {
                if (typeof updateConnectionIndicator === 'function') updateConnectionIndicator('red');
            }
        } catch (error) {
            if (typeof updateConnectionIndicator === 'function') updateConnectionIndicator('red');
        }
    }

    static async syncPendingTrips() {
        // Log Diagnostik 1: Memastikan fungsi terpanggil
        console.log("🔄 [Sync Debug] Fungsi syncPendingTrips dipicu...");

        if (!navigator.onLine) {
            console.warn("⚠️ [Sync Debug] Pendorong dibatalkan: Browser melaporkan perangkat OFFLINE.");
            return;
        }

        const repo = new TripRepository();
        const allRawTrips = repo.getAllTrips();
        
        // Log Diagnostik 2: Cek isi LocalStorage mentah
        console.log("📊 [Sync Debug] Isi mentah LocalStorage:", allRawTrips);

        // Menyisir data spesifik
        const pendingTrips = allRawTrips.filter(t => t.status === 'completed' && !t.isSynced);
        
        // Log Diagnostik 3: Cek jumlah data lolos sensor
        console.log("🔍 [Sync Debug] Jumlah data berstatus 'completed' & belum sync:", pendingTrips.length);

        if (pendingTrips.length === 0) {
            console.log("ℹ️ [Sync Debug] Tidak ada antrean data yang valid untuk dikirim. Keluar dari proses.");
            await this.checkCloudConnection();
            return;
        }

        if (typeof updateConnectionIndicator === 'function') updateConnectionIndicator('yellow');

        for (const raw of pendingTrips) {
            const tripInstance = Trip.fromJSON(raw);
            try {
                console.log(`📤 [Sync Debug] Mencoba Upsert Trip ID: ${tripInstance.tripId} ke Supabase...`);
                await SupabaseService.upsertTrip(tripInstance);
                
                tripInstance.isSynced = true;
                repo.save(tripInstance);
                console.log(`✅ [Sync Debug] Trip ID ${tripInstance.tripId} BERHASIL sinkron.`);
            } catch (error) {
                console.error(`❌ [Sync Debug] Gagal sinkronisasi di tengah jalan:`, error.message);
            }
        }

        await this.checkCloudConnection();
    }

    /**
     * Menarik seluruh data dari Supabase Cloud untuk digabungkan ke penyimpanan lokal HP
     */
    static async fetchCloudTrips() {
        if (!navigator.onLine) throw new Error("Perangkat sedang offline.");

        // Ambil data diurutkan dari waktu jemput terbaru
        const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/trips?order=waktu_jemput.desc`;
        
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_CONFIG.anonKey,
                'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Supabase Fetch Error: ${errText}`);
        }

        const cloudTrips = await response.json();
        const repo = new TripRepository();
        const localTrips = repo.getAllTrips();

        // Proses sinkronisasi & mapping nama kolom DB Cloud ke Properti Lokal HP
        cloudTrips.forEach(cloud => {
            const index = localTrips.findIndex(l => l.tripId === cloud.trip_id);
            
            const localFormat = {
                tripId: cloud.trip_id,
                status: cloud.status,
                waktuJemput: cloud.waktu_jemput,
                koordinatJemput: cloud.koordinat_jemput,
                waktuSelesai: cloud.waktu_selesai,
                koordinatSelesai: cloud.koordinat_selesai,
                jenisLayanan: cloud.jenis_layanan,
                metodePembayaran: cloud.metode_pembayaran,
                nominalPembayaran: cloud.nominal_pembayaran,
                jarak: cloud.jarak,
                isSynced: true // Set true karena bersumber langsung dari cloud
            };

            if (index !== -1) {
                // Jika data sudah ada di lokal, timpa dengan versi terbaru dari cloud
                localTrips[index] = localFormat;
            } else {
                // Jika data baru, masukkan ke barisan lokal
                localTrips.push(localFormat);
            }
        });

        // Simpan pembaruan gabungan ke LocalStorage HP
        localStorage.setItem(repo.storageKey, JSON.stringify(localTrips));
        
        // Perbarui status lampu indikator
        await this.checkCloudConnection();
    }
}

/**
 * ==========================================
 * 3. APPLICATION LAYER (State & Lifecycle Handlers)
 * ==========================================
 */

const tripRepo = new TripRepository();
let currentActiveTrip = null;

async function handleTapMulaiOrder() {
    try {
        const lokasiJemput = await LocationService.getCurrentLocation();
        currentActiveTrip = new Trip();
        currentActiveTrip.start(lokasiJemput);
        tripRepo.save(currentActiveTrip);
        console.log("Trip Draft Tersimpan (Mulai):", currentActiveTrip.toJSON());
    } catch (error) {
        console.error("Gagal kunci GPS Jemput:", error.message);
        throw error;
    }
}

async function handleTapSelesaiOrder() {
    if (!currentActiveTrip) return;
    try {
        const lokasiSelesai = await LocationService.getCurrentLocation();
        currentActiveTrip.complete(lokasiSelesai);
        tripRepo.save(currentActiveTrip);
        console.log("Trip Draft Diperbarui (Selesai):", currentActiveTrip.toJSON());
    } catch (error) {
        console.error("Gagal kunci GPS Selesai:", error.message);
        throw error;
    }
}

async function handleSimpanLazyInput(tripInstance, inputLayanan, inputMetode, inputNominal) {
    if (!tripInstance) return;
    
    tripInstance.updateFinancials(inputLayanan, inputMetode, inputNominal);
    tripRepo.save(tripInstance);
    
    currentActiveTrip = null;
    await SyncManager.syncPendingTrips();
}

/**
 * ==========================================
 * 4. EVENT LISTENERS AUTOMATION
 * ==========================================
 */

window.addEventListener('online', () => {
    console.log("Koneksi internet aktif!");
    SyncManager.syncPendingTrips();
});

window.addEventListener('offline', () => {
    console.log("Perangkat offline.");
    if (typeof updateConnectionIndicator === 'function') updateConnectionIndicator('red');
});

document.addEventListener('DOMContentLoaded', () => {
    SyncManager.syncPendingTrips();
    
    setInterval(() => {
        SyncManager.checkCloudConnection();
    }, 30000); 
});