/**
 * ==========================================
 * COMPONENT: Trip History Table View
 * ==========================================
 */
class TripHistoryView {
    /** Merender tabel riwayat perjalanan */
    static render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const repo = new TripRepository();
        const trips = repo.getAllTrips().reverse(); 

        let html = `
            <div class="view-header">
                <h2>📦 Riwayat Perjalanan</h2>
                <div style="display:flex; gap:8px;">
                    <button class="btn-back" style="background-color:#16a34a; border-color:#16a34a;" onclick="pergiKeTambahManual()">➕ Tambah Manual</button>
                    <button class="btn-back" onclick="kembaliKeDashboard()">⬅ Kembali</button>
                </div>
            </div>

            <div class="cloud-action-bar">
                <button class="btn-cloud btn-cloud-push" onclick="eksekusiPushManual()">
                    📤 Push Data Lokal
                </button>
                <button class="btn-cloud btn-cloud-fetch" onclick="eksekusiFetchManual()">
                    📥 Pull Data Cloud
                </button>
            </div>
        `;

        if (trips.length === 0) {
            html += `
                <div class="empty-state">
                    <p>Belum ada riwayat trip terrekam, Bang.</p>
                    <p style="font-size: 0.9rem; color: #666; margin-top: 5px;">Gacor hari ini belum dimulai, yuk on-bid dulu atau klik "Pull Data Cloud".</p>
                </div>
            `;
            container.innerHTML = html;
            return;
        }

        html += `
            <div class="table-responsive">
                <table class="trip-table">
                    <thead>
                        <tr>
                            <th>Waktu & Tipe</th>
                            <th>Rute (Jemput ➜ Tujuan)</th>
                            <th>Arus Kas</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        trips.forEach(trip => {
            const waktuObj = new Date(trip.waktuJemput);
            const waktuStr = waktuObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const tglStr = waktuObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

            const latJemput = trip.koordinatJemput ? Number(trip.koordinatJemput.lat).toFixed(4) : '-';
            const lngJemput = trip.koordinatJemput ? Number(trip.koordinatJemput.lng).toFixed(4) : '-';
            const latSelesai = trip.koordinatSelesai ? Number(trip.koordinatSelesai.lat).toFixed(4) : '-';
            const lngSelesai = trip.koordinatSelesai ? Number(trip.koordinatSelesai.lng).toFixed(4) : '-';

            const formatJarak = trip.jarak ? `${Number(trip.jarak).toFixed(1)} km` : '0.0 km';

            const syncBadge = trip.isSynced 
                ? '<span class="badge badge-synced">☁️ Cloud</span>' 
                : '<span class="badge badge-local">📱 Lokal</span>';

            html += `
                <tr>
                    <td>
                        <div class="text-main">${waktuStr} <span style="font-size:0.75rem; color:#888;">(${tglStr})</span></div>
                        <div class="text-sub layanan-${trip.jenisLayanan.toLowerCase()}">${trip.jenisLayanan} • ${formatJarak}</div>
                    </td>
                    <td>
                        <div class="text-main">📌 ${latJemput}, ${lngJemput}</div>
                        <div class="text-sub">🏁 ${latSelesai}, ${lngSelesai}</div>
                    </td>
                    <td>
                        <div class="text-main price-tag">Rp ${Number(trip.nominalPembayaran).toLocaleString('id-ID')}</div>
                        <div class="text-sub">${trip.metodePembayaran}</div>
                    </td>
                    <td>${syncBadge}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }
}