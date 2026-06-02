/**
 * ==========================================
 * COMPONENT: Monthly Target Tracker View (With Daily Pacing & Web Notification)
 * ==========================================
 */
class TargetView {
    static currentFilter = '';
    static calcResult = null; 

    static render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Minta izin memunculkan notifikasi sistem di HP saat menu dibuka
        this.requestNotificationPermission();

        if (!this.currentFilter) {
            const sekarang = new Date();
            const yyyy = sekarang.getFullYear();
            const mm = String(sekarang.getMonth() + 1).padStart(2, '0');
            this.currentFilter = `${yyyy}-${mm}`;
        }

        const [targetYear, targetMonth] = this.currentFilter.split('-').map(Number);
        const namaBulanObj = new Date(targetYear, targetMonth - 1, 1);
        const namaBulanUI = namaBulanObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

        let html = `
            <div class="view-header">
                <h2>🎯 Target Bulanan</h2>
                <button class="btn-back" onclick="kembaliKeDashboard()">⬅ Kembali</button>
            </div>

            <div class="analytics-container">
                <div class="stat-card" style="padding: 16px; border-color: #3a3a3a;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div class="stat-title" style="margin-bottom: 0;">📅 Filter Periode</div>
                        <input type="month" id="filter-bulan-target" class="input-field select-field" 
                            style="width: auto; padding: 6px 12px; font-size: 0.95rem; font-weight: bold; background-color: #2a2a2a; color: #fff;" 
                            value="${this.currentFilter}" onchange="TargetView.applyFilter()">
                    </div>
                </div>

                <div class="stat-card main-stat-card" style="border-color: #a855f7; background: linear-gradient(145deg, #1a1a1a 0%, #1c0d2b 100%);">
                    <div class="stat-title">Rekapitulasi Target</div>
                    <div class="stat-value text-purple" style="font-size: 1.5rem;">${namaBulanUI}</div>
                    <div class="stat-desc">Tekan tombol di bawah untuk mengevaluasi progres kerja dan menyalakan radar target harian.</div>
                </div>

                <button class="btn-submit" id="btn-hitung-rekap" onclick="TargetView.hitungEvaluasi()" style="margin-top: 5px; background-color: #38bdf8; color: #121212;">
                    🔄 HITUNG EVALUASI & TARGET HARIAN
                </button>

                <div id="rekap-container" style="display: none; flex-direction: column; gap: 16px; margin-top: 10px;"></div>
            </div>
        `;

        container.innerHTML = html;
        this.calcResult = null;
    }

    /** Minta Izin Akses Notifikasi Sistem Android/Browser */
    static requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log(`[PWA Notification] Status Izin: ${permission}`);
            });
        }
    }

    /** Trigger Notification Core */
    static tembakNotifikasi(judul, pesan) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(judul, {
                body: pesan,
                icon: 'icon-192.png', // Menggunakan ikon utama PWA lu
                vibrate: [200, 100, 200] // Efek getar HP ojol pas target tembus
            });
        } else {
            // Fallback teks di header status jika notifikasi browser diblokir
            const statusTxt = document.getElementById('status-text');
            if (statusTxt) statusTxt.innerText = `🏆 ${judul}: ${pesan}`;
        }
    }

    static applyFilter() {
        const inputBulan = document.getElementById('filter-bulan-target');
        if (inputBulan && inputBulan.value) {
            this.currentFilter = inputBulan.value;
            this.render('menu-view'); 
        }
    }

    static hitungEvaluasi() {
        const btnHitung = document.getElementById('btn-hitung-rekap');
        if (btnHitung) {
            btnHitung.innerText = "⏳ Memisahkan data shift & waktu...";
            btnHitung.disabled = true;
        }

        setTimeout(() => {
            this.eksekusiPerhitungan();
            this.renderHasil();
            if (btnHitung) btnHitung.style.display = 'none';
            document.getElementById('rekap-container').style.display = 'flex';
        }, 150);
    }

    static eksekusiPerhitungan() {
        const [targetYear, targetMonth] = this.currentFilter.split('-').map(Number);
        const repo = new TripRepository();
        
        const tripsBulanFilter = repo.getAllTrips().filter(t => {
            if (t.status !== 'completed') return false;
            const tglTrip = new Date(t.waktuJemput);
            return tglTrip.getMonth() === (targetMonth - 1) && tglTrip.getFullYear() === targetYear;
        });

        const TARGET_TRIP = 250;
        const TARGET_JAM = 250;
        const TARGET_HARI = 24;

        let currentTrip = tripsBulanFilter.length;
        let totalJamOnline = 0;
        let dailyTripsMap = {};

        // Ambil string tanggal hari ini untuk kunci saringan real-time
        const hariIniKey = new Date().toLocaleDateString('id-ID');
        let tripHariIni = 0;
        let jamHariIni = 0;

        tripsBulanFilter.forEach(trip => {
            if (!trip.waktuJemput || !trip.waktuSelesai) return;
            const dateKey = new Date(trip.waktuJemput).toLocaleDateString('id-ID'); 
            if (!dailyTripsMap[dateKey]) dailyTripsMap[dateKey] = [];
            dailyTripsMap[dateKey].push({
                start: new Date(trip.waktuJemput),
                end: new Date(trip.waktuSelesai)
            });
        });

        let currentHari = Object.keys(dailyTripsMap).length;
        const MAX_GAP_MINUTES = 120; 

        Object.entries(dailyTripsMap).forEach(([dateKey, dailyTrips]) => {
            dailyTrips.sort((a, b) => a.start - b.start);
            let shiftStart = dailyTrips[0].start;
            let shiftEnd = dailyTrips[0].end;
            let jamHariIniKalkulator = 0;

            for (let i = 1; i < dailyTrips.length; i++) {
                let currentTrip = dailyTrips[i];
                let gapMinutes = (currentTrip.start - shiftEnd) / (1000 * 60);

                if (gapMinutes > MAX_GAP_MINUTES) {
                    const durasiShift = (shiftEnd - shiftStart) / (1000 * 60 * 60);
                    totalJamOnline += durasiShift;
                    if (dateKey === hariIniKey) jamHariIniKalkulator += durasiShift;

                    shiftStart = currentTrip.start;
                    shiftEnd = currentTrip.end;
                } else {
                    if (currentTrip.end > shiftEnd) shiftEnd = currentTrip.end;
                }
            }
            const durasiShiftTerakhir = (shiftEnd - shiftStart) / (1000 * 60 * 60);
            totalJamOnline += durasiShiftTerakhir;
            if (dateKey === hariIniKey) jamHariIniKalkulator += durasiShiftTerakhir;

            // Ikat data pencapaian khusus hari ini
            if (dateKey === hariIniKey) {
                tripHariIni = dailyTrips.length;
                jamHariIni = jamHariIniKalkulator;
            }
        });

        // KALKULASI SISA TARGET HARIAN (PACING)
        const sisaTrip = Math.max(0, TARGET_TRIP - currentTrip);
        const sisaJam = Math.max(0, TARGET_JAM - totalJamOnline);
        const sisaHari = Math.max(1, TARGET_HARI - currentHari); 

        const targetTripHarian = Math.ceil(sisaTrip / sisaHari);
        const targetJamHarian = (sisaJam / sisaHari).toFixed(1);

        // EVALUASI: Apakah progres hari ini sudah menembus target harian (pacing)?
        const isTargetHariIniTercapai = (tripHariIni >= targetTripHarian) && (jamHariIni >= parseFloat(targetJamHarian));

        this.calcResult = {
            TARGET_TRIP, TARGET_JAM, TARGET_HARI,
            currentTrip, currentJam: totalJamOnline, currentHari,
            sisaTrip, sisaJam, sisaHari,
            targetTripHarian, targetJamHarian,
            tripHariIni, jamHariIni, isTargetHariIniTercapai,
            pctTrip: Math.min((currentTrip / TARGET_TRIP) * 100, 100).toFixed(1),
            pctJam: Math.min((totalJamOnline / TARGET_JAM) * 100, 100).toFixed(1),
            pctHari: Math.min((currentHari / TARGET_HARI) * 100, 100).toFixed(1)
        };

        // PEMICU NOTIFIKASI: Tembak jika status evaluasinya lolos tercapai
        if (isTargetHariIniTercapai) {
            this.tembakNotifikasi(
                "🏆 TARGET HARIAN CAPAI!",
                `Selamat Baginda! Target harian hari ini (${targetTripHarian} Trip & ${targetJamHarian} Jam) TELAH TERPENUHI. Silakan istirahat!`
            );
        }
    }

    static renderHasil() {
        const r = this.calcResult;
        const container = document.getElementById('rekap-container');
        if (!container || !r) return;

        // Pilih warna gradasi kartu berdasarkan status pencapaian hari ini
        const cardStyle = r.isTargetHariIniTercapai 
            ? 'border-color: #22c55e; background: linear-gradient(145deg, #1a1a1a 0%, #0d2b18 100%);' // Hijau jika tercapai
            : 'border-color: #22c55e; background: linear-gradient(145deg, #1a1a1a 0%, #1a1c1a 100%);';

        const statusBadge = r.isTargetHariIniTercapai
            ? `<span style="background-color: #22c55e; color: #121212; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 800;">TERCAPAI 🔥</span>`
            : `<span style="background-color: #262626; color: #a3a3a3; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 800;">PROGRES</span>`;

        let html = `
            <div class="stat-card highlight-card" style="${cardStyle}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div class="stat-title" style="color: #22c55e; margin-bottom: 0;">🚨 Evaluasi Target Hari Ini</div>
                    ${statusBadge}
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div style="background-color: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; border: 1px dashed #3a3a3a;">
                        <div style="font-size: 0.75rem; color: #a3a3a3;">Target vs Hari Ini</div>
                        <div style="font-size: 1.4rem; font-weight: 800; color: #fff;">${r.tripHariIni} <span style="font-size:0.8rem; color:#888;">/ ${r.targetTripHarian} Trp</span></div>
                    </div>
                    <div style="background-color: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; border: 1px dashed #3a3a3a;">
                        <div style="font-size: 0.75rem; color: #a3a3a3;">Jam Online Hari Ini</div>
                        <div style="font-size: 1.4rem; font-weight: 800; color: #fff;">${r.jamHariIni.toFixed(1)} <span style="font-size:0.8rem; color:#888;">/ ${r.targetJamHarian} Jm</span></div>
                    </div>
                </div>
                <div class="stat-desc" style="margin-top: 10px;">
                    Sisa waktu bulan ini: <b>${r.sisaHari} Hari</b> lagi untuk menutup kekurangan total <b>${r.sisaTrip} Trip</b> dan <b>${r.sisaJam.toFixed(1)} Jam</b>.
                </div>
            </div>

            <div class="stat-card">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <div class="stat-title" style="margin-bottom:0; color:#38bdf8;">🏁 Total Progress Trip Bulanan</div>
                    <div style="font-size:0.85rem; font-weight:bold; color:#fff;">${r.pctTrip}%</div>
                </div>
                <div style="font-size:1.5rem; font-weight:800; color:#fff;">
                    ${r.currentTrip} <span style="font-size:1rem; color:#888;">/ ${r.TARGET_TRIP} Trip</span>
                </div>
                <div class="target-track">
                    <div class="target-fill fill-blue" style="width: ${r.pctTrip}%;"></div>
                </div>
            </div>

            <div class="stat-card">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <div class="stat-title" style="margin-bottom:0; color:#fbbf24;">⏱️ Total Progress Jam Online</div>
                    <div style="font-size:0.85rem; font-weight:bold; color:#fff;">${r.pctJam}%</div>
                </div>
                <div style="font-size:1.5rem; font-weight:800; color:#fff;">
                    ${r.currentJam.toFixed(1)} <span style="font-size:1rem; color:#888;">/ ${r.TARGET_JAM} Jam</span>
                </div>
                <div class="target-track">
                    <div class="target-fill fill-yellow" style="width: ${r.pctJam}%;"></div>
                </div>
            </div>

            <div class="stat-card">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <div class="stat-title" style="margin-bottom:0; color:#22c55e;">🗓️ Total Progress Hari Online</div>
                    <div style="font-size:0.85rem; font-weight:bold; color:#fff;">${r.pctHari}%</div>
                </div>
                <div style="font-size:1.5rem; font-weight:800; color:#fff;">
                    ${r.currentHari} <span style="font-size:1rem; color:#888;">/ ${r.TARGET_HARI} Hari</span>
                </div>
                <div class="target-track">
                    <div class="target-fill fill-green" style="width: ${r.pctHari}%;"></div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
}