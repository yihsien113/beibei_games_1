// 帳號密碼模組
(function () {
  const FIREBASE_PROJECT_ID = 'beibeigames1';
  const FIREBASE_API_KEY = 'AIzaSyBv4VsrYA5XcWTl5HeUcH0MwJxpeOntUyA';
  const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/accounts`;

  const ACCOUNT_KEY = 'cloud_sync_account';
  const PASSWORD_KEY = 'cloud_sync_password';
  const UPDATED_AT_KEY = 'cloud_sync_updatedAt';
  const SKIP_PROMPT_KEY = 'cloud_sync_skip_prompt';
  const OWNER_KEY = 'cloud_sync_owner';

  const rawSetItem = Storage.prototype.setItem;
  const rawGetItem = Storage.prototype.getItem;
  const rawRemoveItem = Storage.prototype.removeItem;

  let isApplyingCloudData = false;
  let uploadDebounceTimer = null;
  let activeSyncPromise = null;
  let pendingSyncAfterActive = false;
  let hasDirtyUnsyncedChanges = false;

  function bumpLocalTimestamp() {
    const prev = parseInt(rawGetItem.call(localStorage, UPDATED_AT_KEY) || '0', 10);
    const next = Math.max(Date.now(), prev + 1);
    rawSetItem.call(localStorage, UPDATED_AT_KEY, String(next));
    return next;
  }

  function isProgressKey(key) {
    if (!key || typeof key !== 'string') return false;
    if (
      key === 'playerCoins' ||
      key === 'equippedCharacter' ||
      key === 'lobby_tutorial_done' ||
      key === 'sticker_tutorial_done' ||
      key === 'lobbyPlayerX' ||
      key === 'lobbyPlayerY' ||
      key === 'lobby1PlayerX' ||
      key === 'lobby1PlayerY' ||
      key === 'last_lobby'
    ) {
      return true;
    }
    return (
      key.startsWith('sticker_') ||
      key.startsWith('blindbox_') ||
      key.startsWith('owns_') ||
      key.endsWith('_cleared')
    );
  }

  function toDocId(account) {
    const clean = String(account || '').trim().toLowerCase();
    if (/^[a-z0-9_-]+$/.test(clean)) return clean;
    return 'u_' + Array.from(new TextEncoder().encode(clean))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function getDocUrl(account) {
    return `${FIRESTORE_BASE_URL}/${encodeURIComponent(toDocId(account))}?key=${FIREBASE_API_KEY}`;
  }

  function exportLocalProgress() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (isProgressKey(k)) {
        const val = rawGetItem.call(localStorage, k);
        if (val !== null) data[k] = val;
      }
    }
    return data;
  }

  function areProgressObjectsEqual(a, b) {
    const objA = a || {};
    const objB = b || {};
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      const k = keysA[i];
      if (!Object.prototype.hasOwnProperty.call(objB, k) || String(objA[k]) !== String(objB[k])) {
        return false;
      }
    }
    return true;
  }

  function mergeProgressData(localObj, cloudObj, preferCloudScalars) {
    const merged = {};
    const allKeys = new Set([
      ...Object.keys(localObj || {}),
      ...Object.keys(cloudObj || {})
    ]);

    allKeys.forEach((k) => {
      const lVal = localObj ? localObj[k] : undefined;
      const cVal = cloudObj ? cloudObj[k] : undefined;

      if (
        k.endsWith('_cleared') ||
        k.startsWith('owns_') ||
        k === 'lobby_tutorial_done' ||
        k === 'sticker_tutorial_done'
      ) {
        if (lVal === 'true' || cVal === 'true') {
          merged[k] = 'true';
        }
      } else if (k.startsWith('blindbox_')) {
        if (lVal === 'claimed' || cVal === 'claimed') {
          merged[k] = 'claimed';
        }
      } else if (k.startsWith('sticker_')) {
        if (lVal === 'true' || cVal === 'true') {
          merged[k] = 'true';
        } else if (lVal === 'new' || cVal === 'new') {
          merged[k] = 'new';
        }
      } else if (k === 'playerCoins') {
        const lCoins = parseInt(lVal || '0', 10);
        const cCoins = parseInt(cVal || '0', 10);
        if (preferCloudScalars) {
          merged[k] = String(cVal !== undefined ? cCoins : lCoins);
        } else {
          merged[k] = String(lVal !== undefined ? lCoins : cCoins);
        }
      } else {
        if (preferCloudScalars) {
          merged[k] = cVal !== undefined ? cVal : lVal;
        } else {
          merged[k] = lVal !== undefined ? lVal : cVal;
        }
      }
    });

    return merged;
  }

  function clearLocalProgress() {
    isApplyingCloudData = true;
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (isProgressKey(k) && k !== 'game_version') {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => rawRemoveItem.call(localStorage, k));
      rawRemoveItem.call(localStorage, 'lobbyPlayerX');
      rawRemoveItem.call(localStorage, 'lobbyPlayerY');
      rawRemoveItem.call(localStorage, 'lobby1PlayerX');
      rawRemoveItem.call(localStorage, 'lobby1PlayerY');
      rawRemoveItem.call(localStorage, 'last_lobby');
      rawRemoveItem.call(localStorage, 'stickerBookVisited_v1');
    } finally {
      isApplyingCloudData = false;
    }
  }

  function applyProgressToLocal(mergedObj, timestamp, replaceAll) {
    if (replaceAll) {
      clearLocalProgress();
    }
    isApplyingCloudData = true;
    try {
      Object.keys(mergedObj).forEach((k) => {
        if (mergedObj[k] !== undefined && mergedObj[k] !== null) {
          rawSetItem.call(localStorage, k, String(mergedObj[k]));
        }
      });
      if (typeof timestamp === 'number' && !isNaN(timestamp)) {
        rawSetItem.call(localStorage, UPDATED_AT_KEY, String(timestamp));
      }
    } finally {
      isApplyingCloudData = false;
    }
    window.dispatchEvent(new CustomEvent('cloudsync:updated'));
  }

  async function fetchCloudAccount(account) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(getDocUrl(account), {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.status === 200) {
        const doc = await res.json();
        const fields = doc.fields || {};
        const password = fields.password ? fields.password.stringValue : '';
        const updatedAt = fields.updatedAt ? parseInt(fields.updatedAt.integerValue || '0', 10) : 0;
        let saveData = {};
        if (fields.saveData && fields.saveData.stringValue) {
          try {
            saveData = JSON.parse(fields.saveData.stringValue);
          } catch (e) {
            saveData = {};
          }
        }
        return { exists: true, password, updatedAt, saveData };
      }

      const errData = await res.json().catch(() => ({}));
      const errMsg = (errData.error && errData.error.message) || '';

      if (res.status === 404) {
        if (errMsg.includes('database (default) does not exist')) {
          throw new Error('DB_NOT_CREATED');
        }
        return { exists: false };
      }
      if (res.status === 403) {
        throw new Error('PERMISSION_DENIED');
      }
      throw new Error(errMsg || 'NETWORK_ERROR');
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  async function saveCloudAccount(account, password, saveData, updatedAt, useKeepalive) {
    const payload = {
      fields: {
        accountName: { stringValue: String(account).trim() },
        password: { stringValue: String(password).trim() },
        saveData: { stringValue: JSON.stringify(saveData || {}) },
        updatedAt: { integerValue: String(updatedAt || Date.now()) }
      }
    };

    const res = await fetch(getDocUrl(account), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: !!useKeepalive
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = (errData.error && errData.error.message) || '';
      if (res.status === 404 && errMsg.includes('database (default) does not exist')) {
        throw new Error('DB_NOT_CREATED');
      }
      if (res.status === 403) {
        throw new Error('PERMISSION_DENIED');
      }
      throw new Error(errMsg || 'SAVE_FAILED');
    }
    return true;
  }

  function formatCloudError(err) {
    const msg = (err && err.message) || '';
    if (msg === 'DB_NOT_CREATED') {
      return '請先到 Firebase 後台左側點選「Firestore Database」並按下「建立資料庫（測試模式）」！';
    }
    if (msg === 'PERMISSION_DENIED') {
      return 'Firebase 資料庫權限未開啟，請在 Firestore 的「規則 (Rules)」中開啟讀寫權限！';
    }
    if (!navigator.onLine || msg === 'Failed to fetch' || err.name === 'AbortError') {
      return '目前沒有網路連線，請連上網路後再試一次，或先點選「不註冊直接遊玩」。';
    }
    return '連線雲端失敗，請稍後再試 (' + msg + ')';
  }

  async function registerAccount(account, password) {
    const cleanAcc = String(account || '').trim();
    const cleanPwd = String(password || '').trim();
    if (!cleanAcc || !cleanPwd) {
      return { ok: false, msg: '請輸入帳號與密碼！' };
    }

    try {
      const existing = await fetchCloudAccount(cleanAcc);
      if (existing.exists) {
        return { ok: false, msg: '這個帳號已經註冊過囉！如果是你的帳號，請按「登入」；如果要創新的請換一個帳號名稱。' };
      }

      const now = Date.now();
      const prevOwner = rawGetItem.call(localStorage, OWNER_KEY);
      let initialData = {};

      if (!prevOwner) {
        // 這台手機原本還沒綁定過任何帳號：直接繼承目前這台手機的進度給第一個註冊的帳號
        initialData = exportLocalProgress();
      } else {
        // 這台手機之前已經綁過別的帳號（按了切換帳號後再註冊第 2、3 個帳號）：新帳號從 0 開始，不複製前一個人的進度
        clearLocalProgress();
        initialData = {};
      }

      await saveCloudAccount(cleanAcc, cleanPwd, initialData, now, false);

      rawSetItem.call(localStorage, ACCOUNT_KEY, cleanAcc);
      rawSetItem.call(localStorage, PASSWORD_KEY, cleanPwd);
      rawSetItem.call(localStorage, OWNER_KEY, cleanAcc.toLowerCase());
      rawSetItem.call(localStorage, UPDATED_AT_KEY, String(now));
      rawRemoveItem.call(localStorage, SKIP_PROMPT_KEY);

      window.dispatchEvent(new CustomEvent('cloudsync:updated'));
      return {
        ok: true,
        msg: !prevOwner
          ? '註冊成功！已將這台裝置目前的進度綁定至此帳號。'
          : '新帳號註冊成功！已從全新進度開始。'
      };
    } catch (err) {
      return { ok: false, msg: formatCloudError(err) };
    }
  }

  async function loginAccount(account, password) {
    const cleanAcc = String(account || '').trim();
    const cleanPwd = String(password || '').trim();
    if (!cleanAcc || !cleanPwd) {
      return { ok: false, msg: '請輸入帳號與密碼！' };
    }

    try {
      const cloud = await fetchCloudAccount(cleanAcc);
      if (!cloud.exists) {
        return { ok: false, msg: '找不到這個帳號喔！請檢查帳號有沒有打錯，或點擊「註冊」建立新帳號。' };
      }
      if (cloud.password !== cleanPwd) {
        return { ok: false, msg: '密碼不正確喔！請確認密碼後再試一次。' };
      }

      const prevOwner = rawGetItem.call(localStorage, OWNER_KEY);
      let mergedData;

      if (!prevOwner || prevOwner === cleanAcc.toLowerCase()) {
        // 若這台裝置還沒綁過帳號（例如剛打開平板登入），或是登入同一個帳號，將本地與雲端進度合併
        const localData = exportLocalProgress();
        mergedData = mergeProgressData(localData, cloud.saveData, true);
      } else {
        // 若這台裝置之前登入過別人的帳號，先清空前一個人的殘留資料，只載入這個帳號自己的雲端存檔
        mergedData = cloud.saveData || {};
      }

      const shouldUpload = !areProgressObjectsEqual(mergedData, cloud.saveData);
      const appliedTimestamp = shouldUpload
        ? Math.max(Date.now(), (cloud.updatedAt || 0) + 1)
        : (cloud.updatedAt || 0);

      applyProgressToLocal(mergedData, appliedTimestamp, true);
      rawSetItem.call(localStorage, ACCOUNT_KEY, cleanAcc);
      rawSetItem.call(localStorage, PASSWORD_KEY, cleanPwd);
      rawSetItem.call(localStorage, OWNER_KEY, cleanAcc.toLowerCase());
      rawRemoveItem.call(localStorage, SKIP_PROMPT_KEY);
      hasDirtyUnsyncedChanges = false;

      if (shouldUpload) {
        hasDirtyUnsyncedChanges = true;
        try {
          await saveCloudAccount(cleanAcc, cleanPwd, mergedData, appliedTimestamp, false);
          const currentUpdatedAt = parseInt(rawGetItem.call(localStorage, UPDATED_AT_KEY) || '0', 10);
          if (currentUpdatedAt <= appliedTimestamp) {
            hasDirtyUnsyncedChanges = false;
          }
        } catch (e) {}
      }
      return { ok: true, msg: '登入成功！已同步雲端遊戲進度。' };
    } catch (err) {
      return { ok: false, msg: formatCloudError(err) };
    }
  }

  async function syncNow(useKeepalive) {
    if (uploadDebounceTimer) {
      clearTimeout(uploadDebounceTimer);
      uploadDebounceTimer = null;
    }

    const acc = rawGetItem.call(localStorage, ACCOUNT_KEY);
    const pwd = rawGetItem.call(localStorage, PASSWORD_KEY);
    if (!acc || !pwd || !navigator.onLine) return { ok: false, reason: 'offline_or_unauthed' };

    if (activeSyncPromise) {
      pendingSyncAfterActive = true;
      return activeSyncPromise;
    }

    const syncAcc = acc;
    const syncPwd = pwd;

    const runSync = async () => {
      try {
        const cloud = await fetchCloudAccount(syncAcc);

        if (
          rawGetItem.call(localStorage, ACCOUNT_KEY) !== syncAcc ||
          rawGetItem.call(localStorage, PASSWORD_KEY) !== syncPwd
        ) {
          return { ok: false, reason: 'account_changed' };
        }

        const localData = exportLocalProgress();
        const localUpdatedAt = parseInt(rawGetItem.call(localStorage, UPDATED_AT_KEY) || '0', 10);

        if (!cloud.exists) {
          const now = localUpdatedAt || Date.now();
          await saveCloudAccount(syncAcc, syncPwd, localData, now, useKeepalive);
          const currentUpdatedAt = parseInt(rawGetItem.call(localStorage, UPDATED_AT_KEY) || '0', 10);
          if (currentUpdatedAt <= now) {
            hasDirtyUnsyncedChanges = false;
          }
          return { ok: true };
        }

        if (cloud.password !== syncPwd) {
          return { ok: false, reason: 'password_mismatch' };
        }

        const cloudUpdatedAt = cloud.updatedAt || 0;
        const preferCloudScalars = cloudUpdatedAt > localUpdatedAt;
        const mergedData = mergeProgressData(localData, cloud.saveData, preferCloudScalars);
        const shouldUpload = !areProgressObjectsEqual(mergedData, cloud.saveData);

        if (shouldUpload) {
          const nextTimestamp = Math.max(localUpdatedAt, cloudUpdatedAt + 1, Date.now());
          hasDirtyUnsyncedChanges = true;
          applyProgressToLocal(mergedData, nextTimestamp);
          await saveCloudAccount(syncAcc, syncPwd, mergedData, nextTimestamp, useKeepalive);

          const currentUpdatedAt = parseInt(rawGetItem.call(localStorage, UPDATED_AT_KEY) || '0', 10);
          if (currentUpdatedAt <= nextTimestamp) {
            hasDirtyUnsyncedChanges = false;
          }
        } else {
          const syncedTimestamp = cloudUpdatedAt > 0 ? cloudUpdatedAt : localUpdatedAt;
          applyProgressToLocal(mergedData, syncedTimestamp);

          const currentUpdatedAt = parseInt(rawGetItem.call(localStorage, UPDATED_AT_KEY) || '0', 10);
          if (currentUpdatedAt <= syncedTimestamp) {
            hasDirtyUnsyncedChanges = false;
          }
        }

        return { ok: true };
      } catch (err) {
        return { ok: false, error: err };
      } finally {
        activeSyncPromise = null;
        if (pendingSyncAfterActive) {
          pendingSyncAfterActive = false;
          syncNow(false);
        }
      }
    };

    activeSyncPromise = runSync();
    return activeSyncPromise;
  }

  function scheduleUpload() {
    const acc = rawGetItem.call(localStorage, ACCOUNT_KEY);
    const pwd = rawGetItem.call(localStorage, PASSWORD_KEY);
    if (!acc || !pwd) return;

    if (uploadDebounceTimer) clearTimeout(uploadDebounceTimer);
    uploadDebounceTimer = setTimeout(() => {
      uploadDebounceTimer = null;
      syncNow(false);
    }, 350);
  }

  // 攔截所有頁面的 localStorage.setItem，只有進度值真的有變動時才更新時間戳記並在背景備份到雲端
  Storage.prototype.setItem = function (key, value) {
    const isLocalProgress = this === localStorage && !isApplyingCloudData && isProgressKey(key) && key !== 'game_version';
    const prevValue = isLocalProgress ? rawGetItem.call(this, key) : null;
    rawSetItem.call(this, key, value);
    if (isLocalProgress && prevValue !== String(value)) {
      bumpLocalTimestamp();
      hasDirtyUnsyncedChanges = true;
      scheduleUpload();
    }
  };

  // 當頁面即將跳轉（例如從關卡、衣櫥、貼紙簿回到大廳）或關閉時，若還有未上傳的變動，立即以 keepalive 送出
  window.addEventListener('pagehide', () => {
    if (uploadDebounceTimer || hasDirtyUnsyncedChanges) {
      if (uploadDebounceTimer) {
        clearTimeout(uploadDebounceTimer);
        uploadDebounceTimer = null;
      }
      const acc = rawGetItem.call(localStorage, ACCOUNT_KEY);
      const pwd = rawGetItem.call(localStorage, PASSWORD_KEY);
      if (acc && pwd && navigator.onLine) {
        const localData = exportLocalProgress();
        const localUpdatedAt = parseInt(rawGetItem.call(localStorage, UPDATED_AT_KEY) || String(Date.now()), 10);
        hasDirtyUnsyncedChanges = false;
        saveCloudAccount(acc, pwd, localData, localUpdatedAt, true).catch(() => {});
      }
    }
  });

  // 網路恢復時自動補傳離線期間的進度
  window.addEventListener('online', () => {
    syncNow(false);
  });

  window.CloudSync = {
    register: registerAccount,
    login: loginAccount,
    syncNow: syncNow,
    getAccount: () => rawGetItem.call(localStorage, ACCOUNT_KEY) || '',
    isSkipped: () => rawGetItem.call(localStorage, SKIP_PROMPT_KEY) === 'true',
    setSkipped: () => {
      rawSetItem.call(localStorage, SKIP_PROMPT_KEY, 'true');
    },
    logout: () => {
      if (uploadDebounceTimer) {
        clearTimeout(uploadDebounceTimer);
        uploadDebounceTimer = null;
      }
      pendingSyncAfterActive = false;
      hasDirtyUnsyncedChanges = false;
      clearLocalProgress();
      rawRemoveItem.call(localStorage, ACCOUNT_KEY);
      rawRemoveItem.call(localStorage, PASSWORD_KEY);
      rawRemoveItem.call(localStorage, UPDATED_AT_KEY);
      rawSetItem.call(localStorage, OWNER_KEY, '__logged_out__');
      window.dispatchEvent(new CustomEvent('cloudsync:updated'));
    }
  };
})();
