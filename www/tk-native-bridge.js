/* Tanks & Kings — native bridge (Capacitor)
 * Wires RevenueCat IAP + iCloud cloud save into the game's existing seams.
 *
 * LOAD ORDER: this script is injected in <head>, BEFORE the game's inline
 * script. Cloud restore uses a reload-once strategy: if iCloud has a newer
 * save than localStorage, we write it to localStorage and reload so the
 * game boots with cloud data. Guarded by a session flag to prevent loops.
 */
(function () {
  'use strict';

  var Capacitor = window.Capacitor;
  if (!Capacitor || !Capacitor.isNativePlatform()) return;

/* ---- Production hardening (native only) ----
 * Hide web-only surfaces that must not ship in the App Store build:
 * - Check-for-update button + build status (web hot-update mechanism;
 *   native updates come through the App Store, not this)
 * The bridge only runs natively, so the web game is untouched. */
try {
  document.documentElement.classList.add('tk-native');
  var prodCss = document.createElement('style');
  prodCss.textContent = 'html.tk-native #updateCheckBtn,html.tk-native #updateStatus{display:none!important}';
  (document.head || document.documentElement).appendChild(prodCss);
} catch (e) {}

  var CloudSync = null;
  try { CloudSync = Capacitor.Plugins.TKiCloudSync; } catch (e) {}

  var Preferences = null;
  try { Preferences = Capacitor.Plugins.Preferences; } catch (e) {}

  /* ---- Durable flags (Capacitor Preferences = native UserDefaults)
   * localStorage in WKWebView can be evicted by the OS under storage
   * pressure. Flags here are mirrored to Preferences the moment the game
   * writes them, and Preferences wins over localStorage on boot.
   * Add future "must never lose" keys to this list. */
  var DURABLE_KEYS = ['tk_tutorial_v1'];

  function mirrorToPreferences(key, value) {
    if (!Preferences) return;
    try {
      // Timestamped wrapper: restore compares write times so a stale
      // Preferences copy can never overwrite a newer localStorage record.
      Preferences.set({ key: key, value: JSON.stringify({ v: String(value), ts: Date.now() }) });
    } catch (e) {}
    try { origSetItem.call(localStorage, key + '__mts', String(Date.now())); } catch (e) {}
  }

  async function restoreDurableFlags() {
    if (!Preferences) return;
    for (var i = 0; i < DURABLE_KEYS.length; i++) {
      var k = DURABLE_KEYS[i];
      try {
        var res = await Preferences.get({ key: k });
        if (res && res.value !== null && res.value !== undefined) {
          var prefVal = res.value, prefTs = 0;
          try { var pw = JSON.parse(res.value); if (pw && typeof pw.v === 'string') { prefVal = pw.v; prefTs = pw.ts || 0; } } catch (e) {}
          var localVal = null, localTs = 0;
          try { localVal = localStorage.getItem(k); localTs = parseInt(localStorage.getItem(k + '__mts') || '0', 10) || 0; } catch (e) {}
          // Restore only when local is missing (eviction — the case this
          // system exists for) or the Preferences copy is provably newer.
          // Legacy unwrapped Preferences values carry ts 0 and never
          // overwrite an existing local record.
          if (localVal === null || prefTs > localTs) {
            try { localStorage.setItem(k, prefVal); } catch (e) {}
            console.log('[TK] Restored durable flag ' + k + ' from Preferences');
          }
        }
      } catch (e) {}
    }
  }

  // Hook localStorage.setItem so durable flags mirror immediately on write
  try {
    var origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      origSetItem.apply(this, arguments);
      if (DURABLE_KEYS.indexOf(k) !== -1) mirrorToPreferences(k, v);
    };
  } catch (e) {}

  // Mirror durable-key deletions too: an explicit wipe/reset must clear the
  // Preferences copy, or the flag would resurrect on the next boot. (OS
  // eviction of localStorage does not fire removeItem, so the survival
  // protection itself is unaffected.)
  try {
    var origRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (k) {
      origRemoveItem.apply(this, arguments);
      if (DURABLE_KEYS.indexOf(k) !== -1 && Preferences) {
        try { Preferences.remove({ key: k }); } catch (e) {}
      }
    };
  } catch (e) {}

  // Restore durable flags before cloud restore (durable > local > cloud)
  var durableReady = restoreDurableFlags();

  /* ---- Cloud restore (runs immediately, before game boot) ---- */
  var RELOAD_FLAG = 'tk_cloud_restored_v1';

  function collectSnapshot() {
    var snap = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('tk_') === 0 && k !== RELOAD_FLAG) snap[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return JSON.stringify({ v: 1, ts: Date.now(), data: snap });
  }

  function applySnapshot(json) {
    try {
      var parsed = JSON.parse(json);
      var data = parsed.data || {};
      var count = 0;
      Object.keys(data).forEach(function (k) {
        try { localStorage.setItem(k, data[k]); count++; } catch (e) {}
      });
      return count;
    } catch (e) { return 0; }
  }

  // Freshness of the local record AS OF BRIDGE LOAD. The bridge runs in
  // <head> before the game's inline script, so this reads the pre-boot
  // blob. It must be captured now: game boot saves re-stamp savedAt with
  // Date.now() within ~700ms (leader/season boot saves), which would
  // inflate local freshness and make bootRestore reject a genuinely
  // newer cloud save from another device.
  var BOOT_LOCAL_TS = 0;

  function localTs() {
    // Freshness of the local record = the unified progression blob's savedAt
    // stamp (progressSave writes it on every save). The legacy store key is
    // only a fallback for pre-unification installs.
    try {
      var p = localStorage.getItem('tk_progression_v1');
      if (p) { var pd = JSON.parse(p); if (pd && pd.savedAt) return pd.savedAt; }
    } catch (e) {}
    try {
      var s = localStorage.getItem('tk_store_v1');
      if (s) { var d = JSON.parse(s); if (d && d.ltoAnchor) return d.ltoAnchor; }
    } catch (e) {}
    return 0;
  }
  BOOT_LOCAL_TS = localTs();

  async function bootRestore() {
    if (!CloudSync) return;
    // Don't loop: if we already restored this session, skip
    try {
      if (sessionStorage.getItem(RELOAD_FLAG) === '1') return;
    } catch (e) {}
    try {
      var res = await CloudSync.pullWithTimestamp({});
      if (res && res.snapshot && res.timestamp > BOOT_LOCAL_TS) {
        var n = applySnapshot(res.snapshot);
        if (n > 0) {
          // Durable flags outrank the cloud copy (durable > local > cloud)
          await restoreDurableFlags();
          try { sessionStorage.setItem(RELOAD_FLAG, '1'); } catch (e) {}
          console.log('[TK] Restored ' + n + ' keys from iCloud, reloading');
          location.reload();
        }
      }
    } catch (e) {}
  }

  // Kick off once durable flags are back (don't wait for DOMContentLoaded)
  durableReady.then(function () { bootRestore(); });

  /* ---- Cloud push (debounced, hooks into game's save) ---- */
  var pushTimer = null;
  async function pushCloudSave() {
    if (!CloudSync) return;
    try {
      await CloudSync.pushWithTimestamp({ snapshot: collectSnapshot(), timestamp: localTs() || Date.now() }); /* content time, not push time: last-save-wins across devices */
    } catch (e) {}
  }
  function schedulePush() {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(pushCloudSave, 5000);
  }

  /* ---- RevenueCat IAP ---- */
  var PRODUCT_IDS = {
    gem_0: 'com.tanksandkings.app.gems80',
    gem_1: 'com.tanksandkings.app.gems535',
    gem_2: 'com.tanksandkings.app.gems1200',
    gem_3: 'com.tanksandkings.app.gems2880',
    gem_4: 'com.tanksandkings.app.gems7650',
    gem_5: 'com.tanksandkings.app.gems16100',
    starter: 'com.tanksandkings.app.starter',
    lto_treasury: 'com.tanksandkings.app.treasury',
    season_premium: 'com.tanksandkings.app.seasonpass'
  };

  var Purchases = null;
  try { Purchases = Capacitor.Plugins.Purchases; } catch (e) {}

  var RevenueCatBillingAdapter = {
    id: 'revenuecat',
    async purchase(product) {
      if (!Purchases) throw new Error('RevenueCat not available');
      var pid = PRODUCT_IDS[product.key];
      if (!pid) {
        /* Soft-currency purchases pass through: the game deducts gems
         * itself after this resolves. A USD-priced product with no store
         * mapping is a configuration error — fail loudly, never
         * fabricate a charge or a grant (C2). */
        if (product && product.priceUsd) throw new Error('No store product mapped for ' + product.key);
        return { orderId: 'GEM-' + Date.now().toString(36).toUpperCase(), when: Date.now(), provider: 'gems' };
      }
      /* C1: the v13 SDK has no purchaseProduct — fetch the store product,
       * then purchase it. */
      var res = await Purchases.getProducts({ productIdentifiers: [pid] });
      var storeProduct = res && res.products && res.products[0];
      if (!storeProduct) throw new Error('Store product unavailable: ' + pid);
      var result = await Purchases.purchaseStoreProduct({ product: storeProduct });
      /* M1: record the real transaction id — this product's entry in the
       * post-purchase customer info. */
      var txId = null;
      var txs = (result && result.customerInfo && result.customerInfo.nonSubscriptionTransactions) || [];
      for (var i = txs.length - 1; i >= 0; i--) {
        if (txs[i].productIdentifier === pid) { txId = txs[i].transactionIdentifier; break; }
      }
      return { orderId: txId || ('RC-' + Date.now().toString(36).toUpperCase()), transactionId: txId, productIdentifier: (result && result.productIdentifier) || pid, when: Date.now(), provider: 'revenuecat' };
    },
    async restore() {
      if (!Purchases) throw new Error('RevenueCat not available');
      /* C3 + M3: errors propagate so the game shows 'Restore failed'
       * instead of a false success. Returned receipts carry the game's
       * merge contract: id (dedupe), key (entitlement), when (the real
       * purchase date). */
      var info = await Purchases.restorePurchases();
      var txs = (info && info.customerInfo && info.customerInfo.nonSubscriptionTransactions) || [];
      var byPid = {};
      Object.keys(PRODUCT_IDS).forEach(function (k) { byPid[PRODUCT_IDS[k]] = k; });
      return txs.map(function (t) {
        return {
          id: t.transactionIdentifier,
          orderId: t.transactionIdentifier,
          key: byPid[t.productIdentifier] || null,
          productIdentifier: t.productIdentifier,
          when: t.purchaseDate ? Date.parse(t.purchaseDate) : Date.now(),
          provider: 'revenuecat-restore'
        };
      }).filter(function (r) { return !!r.id; });
    }
  };

  /* Fail-closed adapter (H2, runtime side): the plugin is present but
   * RevenueCat cannot be configured (missing key, init error) — purchases
   * fail instead of falling through to the free demo adapter in a native
   * build. */
  var NativeBillingUnavailable = {
    id: 'unavailable',
    async purchase() { throw new Error('Billing unavailable — check your connection and try again'); },
    async restore() { throw new Error('Billing unavailable — check your connection and try again'); }
  };

  /* ---- Wire everything on DOM ready ---- */
  document.addEventListener('DOMContentLoaded', function () {
    // RevenueCat
    (async function () {
      /* Close the pre-configure window: until RevenueCat is live, purchases
       * fail closed instead of running through the free demo adapter. */
      if (window.TanksKingsBilling && window.TanksKingsBilling.setAdapter) {
        window.TanksKingsBilling.setAdapter(NativeBillingUnavailable);
      }
      var apiKey = window.__TK_REVENUECAT_KEY || '';
      function failClosed(why) {
        console.warn('[TK] ' + why + ' — billing unavailable (fail-closed)');
        if (window.TanksKingsBilling && window.TanksKingsBilling.setAdapter) {
          window.TanksKingsBilling.setAdapter(NativeBillingUnavailable);
        }
      }
      /* The bridge only runs natively, so a missing plugin is a broken
       * build — fail closed rather than leave the free demo adapter live. */
      if (!Purchases) { failClosed('RevenueCat plugin missing'); return; }
      if (!apiKey) { failClosed('RevenueCat key missing'); return; }
      try {
        await Purchases.configure({ apiKey: apiKey });
        if (window.TanksKingsBilling && window.TanksKingsBilling.setAdapter) {
          window.TanksKingsBilling.setAdapter(RevenueCatBillingAdapter);
          console.log('[TK] RevenueCat billing live');
        }
      } catch (e) { failClosed('RevenueCat init failed: ' + e); }
    })();

    // Cloud save auto-push: hook the game's save function
    var hooked = false;
    var hookTimer = setInterval(function () {
      if (hooked) { clearInterval(hookTimer); return; }
      if (typeof window.progressSaveSoon === 'function') {
        var orig = window.progressSaveSoon;
        window.progressSaveSoon = function () {
          orig.apply(this, arguments);
          schedulePush();
        };
        hooked = true;
        clearInterval(hookTimer);
        console.log('[TK] Cloud save auto-push hooked');
      }
    }, 500);
    setTimeout(function () { clearInterval(hookTimer); }, 10000);

    document.addEventListener('pause', pushCloudSave, false);
    /* 2026-10-10: native-backed background/foreground signals (stock Capacitor
       fires DOM 'pause'/'resume' on real backgrounding, both platforms).
       Suspend the shared AudioContext on lose-focus; resume on regain. */
    document.addEventListener('pause', function(){try{if(typeof tkAudioLoseFocus==='function')tkAudioLoseFocus();}catch(e){}}, false);
    document.addEventListener('resume', function(){try{if(typeof tkAudioRegainFocus==='function')tkAudioRegainFocus();}catch(e){}}, false);
    window.addEventListener('tkCloudSaveChanged', function () {
      // Another device pushed — pull on next foreground
      console.log('[TK] Cloud save changed remotely');
    });
  });

  window.TKNative = {
    pushCloudSave: pushCloudSave,
    productIds: PRODUCT_IDS
  };
})();
