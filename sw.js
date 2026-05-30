    const CACHE_NAME = 'ngojol-tracker-v1';
// Berjalan di background untuk menangani request saat offline
self.addEventListener('fetch', (event) => {
    // Lu bisa tambahkan logika caching di sini nanti
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});