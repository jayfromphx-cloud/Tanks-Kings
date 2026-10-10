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
 * Hide dev/web-only surfaces that must not ship in the App Store build:
 * - Diagnostics button (internal Tower-freeze debug tooling)
 * - Check-for-update button + build status (web hot-update mechanism;
 *   native updates come through the App Store, not this)
 * The bridge only runs natively, so the web game is untouched. */
try {
  document.documentElement.classList.add('tk-native');
  var prodCss = document.createElement('style');
  prodCss.textContent = 'html.tk-native #diagnosticsBtn,html.tk-native #updateCheckBtn,html.tk-native #updateStatus{display:none!important}';
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
  var DURABLE_KEYS = ['tk_tutorial_completed'];

  function mirrorToPreferences(key, value) {
    if (!Preferences) return;
    try {
      Preferences.set({ key: key, value: String(value) });
    } catch (e) {}
  }

  async function restoreDurableFlags() {
    if (!Preferences) return;
    for (var i = 0; i < DURABLE_KEYS.length; i++) {
      var k = DURABLE_KEYS[i];
      try {
        var res = await Preferences.get({ key: k });
        if (res && res.value !== null && res.value !== undefined) {
          try { localStorage.setItem(k, res.value); } catch (e) {}
          console.log('[TK] Restored durable flag ' + k + ' from Preferences');
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

  // Restore durable flags before cloud restore (durable > local > cloud)
  restoreDurableFlags();

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

  function localTs() {
    // Approximate: use the latest timestamp we can find, or 0 for fresh
    try {
      var s = localStorage.getItem('tk_store_v1');
      if (s) { var d = JSON.parse(s); if (d && d.ltoAnchor) return d.ltoAnchor; }
    } catch (e) {}
    return 0;
  }

  async function bootRestore() {
    if (!CloudSync) return;
    // Don't loop: if we already restored this session, skip
    try {
      if (sessionStorage.getItem(RELOAD_FLAG) === '1') return;
    } catch (e) {}
    try {
      var res = await CloudSync.pullWithTimestamp({});
      if (res && res.snapshot && res.timestamp > localTs()) {
        var n = applySnapshot(res.snapshot);
        if (n > 0) {
          try { sessionStorage.setItem(RELOAD_FLAG, '1'); } catch (e) {}
          console.log('[TK] Restored ' + n + ' keys from iCloud, reloading');
          location.reload();
        }
      }
    } catch (e) {}
  }

  // Kick off immediately (don't wait for DOMContentLoaded)
  bootRestore();

  /* ---- Cloud push (debounced, hooks into game's save) ---- */
  var pushTimer = null;
  async function pushCloudSave() {
    if (!CloudSync) return;
    try {
      await CloudSync.pushWithTimestamp({ snapshot: collectSnapshot(), timestamp: Date.now() });
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
    lto_treasury: 'com.tanksandkings.app.treasury'
  };

  var Purchases = null;
  try { Purchases = Capacitor.Plugins.Purchases; } catch (e) {}

  var RevenueCatBillingAdapter = {
    id: 'revenuecat',
    async purchase(product) {
      if (!Purchases) throw new Error('RevenueCat not available');
      var pid = PRODUCT_IDS[product.key];
      if (!pid) {
        return { orderId: 'GEM-' + Date.now().toString(36).toUpperCase(), when: Date.now(), provider: 'gems' };
      }
      await Purchases.purchaseProduct({ productIdentifier: pid });
      return { orderId: 'RC-' + Date.now().toString(36).toUpperCase(), when: Date.now(), provider: 'revenuecat' };
    },
    async restore() {
      if (!Purchases) return [];
      try {
        var info = await Purchases.restorePurchases();
        var txs = (info.customerInfo && info.customerInfo.nonSubscriptionTransactions) || [];
        return txs.map(function (t) {
          return { orderId: t.transactionId || 'RC-RESTORE', when: Date.now(), provider: 'revenuecat-restore' };
        });
      } catch (e) { return []; }
    }
  };

  /* ---- Wire everything on DOM ready ---- */
  document.addEventListener('DOMContentLoaded', function () {
    // RevenueCat
    (async function () {
      if (!Purchases) return;
      var apiKey = window.__TK_REVENUECAT_KEY || '';
      if (!apiKey) { console.warn('[TK] RevenueCat key missing — demo billing'); return; }
      try {
        await Purchases.configure({ apiKey: apiKey });
        if (window.TanksKingsBilling && window.TanksKingsBilling.setAdapter) {
          window.TanksKingsBilling.setAdapter(RevenueCatBillingAdapter);
          console.log('[TK] RevenueCat billing live');
        }
      } catch (e) { console.warn('[TK] RevenueCat init failed:', e); }
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
