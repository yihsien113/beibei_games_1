//           Version:  3.0.0

//需要更新時修改版本數字↑↑↑↑
// 引用素材清單
importScripts('./assets-manifest.js');

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

// 3. 攔截請求：優先讀取快取，沒有才走網路（並順手將新請求寫入快取）
self.addEventListener('fetch', (event) => {
  // 只攔截 GET 請求，且略過 Firebase / Google 雲端 API 請求（確保雲端存檔永遠抓最新資料，離線時由前端自行處理）
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('googleapis.com') || event.request.url.includes('firebase')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. 如果快取有，直接回傳
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // 2. 若快取沒有，準備發送網路請求 (Request 是 Stream，需 clone 一份)
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then((response) => {
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