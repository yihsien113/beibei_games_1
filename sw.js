const SW_VERSION = '3.0.1';

//需要更新時修改版本數字↑↑↑↑
// 引用素材清單（加上版本參數破除 iOS / iPadOS Safari 的 HTTP 快取）
importScripts('./assets-manifest.js?v=' + SW_VERSION);

// 1. 安裝階段：移除 cache.addAll，交由 index.html 統一預載並顯示進度，避免背景搶頻寬
self.addEventListener('install', (event) => {
  self.skipWaiting(); // 強制跳過等待，立刻啟用新版 Service Worker
});

// 2. 啟用階段：清除「舊版本」快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // 如果快取名稱不是當前的 CACHE_NAME 就刪除
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // 確保清除完舊快取後，立即接管現有頁面
    })
  );
});

// 3. 攔截請求：版本清單永遠優先向伺服器確認，其餘遊戲資源優先讀取快取
self.addEventListener('fetch', (event) => {
  // 只攔截 GET 請求，且略過 Firebase / Google 雲端 API 與 sw.js 本身
  if (event.request.method !== 'GET') return;
  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') return;
  if (event.request.url.includes('googleapis.com') || event.request.url.includes('firebase')) return;
  if (event.request.url.includes('sw.js')) return;

  // 版本清單 assets-manifest.js 採用網路優先 (Network-First + no-store)，離線時才退回快取
  if (event.request.url.includes('assets-manifest.js')) {
    event.respondWith(
      fetch(event.request.url, { cache: 'no-store' })
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('./assets-manifest.js', responseToCache);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. 如果快取有，直接回傳（確保離線可玩與載入速度）
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. 若快取沒有，向伺服器抓取最新檔案（同網域加上 no-cache 避免 Safari 拿底層舊 HTTP 快取）
      const isSameOrigin = new URL(event.request.url).origin === self.location.origin;
      const networkPromise = isSameOrigin
        ? fetch(event.request.url, { cache: 'no-cache' })
        : fetch(event.request.clone());

      return networkPromise.then((response) => {
        // 檢查回應是否有效 (確保只快取成功且正常的請求)
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // 3. 準備存入快取 (Response 是 Stream，需 clone 一份給快取，原版回傳給頁面)
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});