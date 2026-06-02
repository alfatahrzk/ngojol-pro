// State internal khusus UI untuk modal finansial
let selectedLayanan = 'Hemat';
let selectedPembayaran = 'Nontunai';

/**
 * =========================================================
 * SIDEBAR CONTROLLER FUNCTIONS
 * =========================================================
 */
function toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (open) {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    } else {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }
}

function handleMenuClick(menuName) {
    console.log(`Menu ${menuName} diklik.`);
    toggleSidebar(false); 

    if (menuName === 'Trip') {
        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('menu-view').style.display = 'block';
        TripHistoryView.render('menu-view');
        document.getElementById('status-text').innerText = "Melihat rekaman riwayat narik.";
    } 
    else if (menuName === 'Analitik') {
        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('menu-view').style.display = 'block';
        AnalyticsView.render('menu-view');
        document.getElementById('status-text').innerText = "Menganalisis performa tarikan.";
    } 
    // 👉 TAMBAHKAN BLOK TARGET INI
    else if (menuName === 'Target') {
        document.getElementById('dashboard-view').style.display = 'none';
        document.getElementById('menu-view').style.display = 'block';
        TargetView.render('menu-view');
        document.getElementById('status-text').innerText = "Memantau progres target bulanan.";
    }
    else {
        alert(`Menu ${menuName} sedang dipersiapkan.`);
    }
}

function kembaliKeDashboard() {
    // Balikkan visibilitas view container
    document.getElementById('dashboard-view').style.display = 'block';
    document.getElementById('menu-view').style.display = 'none';
    
    // Kembalikan status teks ke kondisi operasional awal
    document.getElementById('status-text').innerText = "Ready untuk narik hari ini, Bang?";
}

/**
 * =========================================================
 * UI BRIDGE OPERASIONAL (KONEKSI & GPS)
 * =========================================================
 */
function updateConnectionIndicator(state) {
    const lamp = document.getElementById('connection-lamp');
    lamp.className = 'lamp'; 
    
    if (state === 'green') lamp.classList.add('status-green');
    if (state === 'yellow') lamp.classList.add('status-yellow');
    if (state === 'red') lamp.classList.add('status-red');
}

async function eksekusiMulai() {
    document.getElementById('status-text').innerText = "Sedang mengunci GPS Jemput...";
    await handleTapMulaiOrder(); // Fungsi dari app.js
    
    if (currentActiveTrip) {
        document.getElementById('btn-mulai').disabled = true;
        document.getElementById('btn-selesai').disabled = false;
        document.getElementById('status-text').innerText = "Status: Sedang di Perjalanan (In-Trip)";
    } else {
        document.getElementById('status-text').innerText = "Gagal mengunci lokasi. Coba lagi.";
    }
}

async function eksekusiSelesai() {
    document.getElementById('status-text').innerText = "Sedang mengunci GPS Tujuan...";
    await handleTapSelesaiOrder(); // Fungsi dari app.js
    
    if (currentActiveTrip && currentActiveTrip.waktuSelesai) {
        document.getElementById('lazy-modal').style.display = 'flex';
        document.getElementById('input-argo').focus();
    }
}

/**
 * =========================================================
 * MODAL FORM SELECTION & SUBMIT
 * =========================================================
 */
function setLayanan(layanan) {
    selectedLayanan = layanan;
    document.getElementById('layanan-hemat').classList.toggle('active', layanan === 'Hemat');
    document.getElementById('layanan-standart').classList.toggle('active', layanan === 'Standart');
    document.getElementById('layanan-food').classList.toggle('active', layanan === 'Food');
    document.getElementById('layanan-express').classList.toggle('active', layanan === 'Express');
}

function setPembayaran(metode) {
    selectedPembayaran = metode;
    document.getElementById('pay-nontunai').classList.toggle('active', metode === 'Nontunai');
    document.getElementById('pay-qr').classList.toggle('active', metode === 'QR');
    document.getElementById('pay-tunai').classList.toggle('active', metode === 'Tunai');
}

function eksekusiSimpanFinansial() {
    const nominal = parseInt(document.getElementById('input-argo').value) || 0;
    
    // Kirim data ke fungsi pemroses akhir di app.js
    handleSimpanLazyInput(currentActiveTrip, selectedLayanan, selectedPembayaran, nominal);
    
    // Reset Tampilan UI ke State Awal
    document.getElementById('lazy-modal').style.display = 'none';
    document.getElementById('btn-mulai').disabled = false;
    document.getElementById('btn-selesai').disabled = true;
    document.getElementById('input-argo').value = '';
    document.getElementById('status-text').innerText = "Data tarikan berhasil disimpan! Siap narik lagi.";
    
    // Kembalikan ke smart default
    setLayanan('Hemat');
    setPembayaran('Nontunai');
}

// PWA Service Worker Registration (Pastikan pakai './sw.js')
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('PWA Service Worker Aktif & Terdaftar!', reg.scope))
        .catch(err => console.error('Service Worker Gagal:', err));
}

/**
 * ROUTER NAVIGASI: Pergi ke halaman formulir manual Leaflet
 */
function pergiKeTambahManual() {
    // Pastikan wadah konten bersih, lalu panggil render dari trip-add.js
    document.getElementById('menu-view').innerHTML = '';
    TripAddView.render('menu-view');
    document.getElementById('status-text').innerText = "Menyusun data tarikan manual via peta.";
}

/**
 * HANDLER: Memaksa push semua antrean lokal ke Supabase secara manual
 */
async function eksekusiPushManual() {
    document.getElementById('status-text').innerText = "⚡ Memulai sinkronisasi push manual...";
    updateConnectionIndicator('yellow');
    try {
        await SyncManager.syncPendingTrips();
        document.getElementById('status-text').innerText = "Push sukses! Seluruh antrean lokal telah aman di Cloud.";
        // Refresh tabel riwayat biar status badge 'Lokal' langsung berubah jadi 'Cloud'
        TripHistoryView.render('menu-view');
    } catch (error) {
        document.getElementById('status-text').innerText = `Gagal sinkronisasi manual: ${error.message}`;
        updateConnectionIndicator('red');
    }
}

/**
 * HANDLER: Menarik data backup dari Supabase Cloud ke HP secara manual
 */
async function eksekusiFetchManual() {
    document.getElementById('status-text').innerText = "⚡ Sedang menarik data dari database cloud...";
    updateConnectionIndicator('yellow');
    try {
        await SyncManager.fetchCloudTrips();
        document.getElementById('status-text').innerText = "Pull sukses! Data lokal berhasil diperbarui dari Cloud.";
        // Refresh tabel riwayat untuk menampilkan data yang baru diunduh
        TripHistoryView.render('menu-view');
    } catch (error) {
        document.getElementById('status-text').innerText = `Gagal menarik data cloud: ${error.message}`;
        updateConnectionIndicator('red');
    }
}