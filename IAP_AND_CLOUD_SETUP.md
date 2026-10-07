# Tanks & Kings — IAP + Cloud Save Setup

## What's Built (code-complete)

### RevenueCat IAP
- `@revenuecat/purchases-capacitor` added to `package.json`
- `www/tk-native-bridge.js` — creates a `RevenueCatBillingAdapter` and injects
  it via the game's existing `TanksKingsBilling.setAdapter()` seam
- The game's `Billing.purchase()` / `Billing.restore()` now route to RevenueCat
  when the API key is present; falls back to demo billing otherwise
- Gem-priced items (not real money) bypass the store entirely — granted instantly

### iCloud Cloud Save
- `ios/App/App/TKiCloudSync.swift` — Capacitor plugin wrapping
  `NSUbiquitousKeyValueStore`
- `App.entitlements` — iCloud KVS entitlement wired into both build configs
- `www/tk-native-bridge.js` — on boot, pulls iCloud save; if newer than local,
  writes to localStorage and reloads once. Auto-pushes (5s debounce) on every
  game save via `progressSaveSoon()` hook, plus on app background.

---

## Your Steps

### A. RevenueCat account (10 min)
1. Sign up at [revenuecat.com](https://revenuecat.com)
2. Create a project → add an **iOS app**
3. Copy the **iOS API key** (starts with `appl_`)
4. In Codemagic, add it as an environment variable:
   - Codemagic → your app → Environment variables → add `TK_REVENUECAT_KEY`
   - Value: your `appl_` key
   - Check "Secure" so it doesn't print in logs
5. The build injects it via `window.__TK_REVENUECAT_KEY` (see codemagic.yaml —
   you'll need to add one line; template below)

### B. App Store Connect products (20 min)
Create these 8 consumable IAPs in App Store Connect → your app → Monetization:

| Product ID | Type | Price | What it grants |
|---|---|---|---|
| `com.tanksandkings.app.gems80` | Consumable | $0.99 | 80 gems (60+20 bonus) |
| `com.tanksandkings.app.gems535` | Consumable | $4.99 | 535 gems (403+132) |
| `com.tanksandkings.app.gems1200` | Consumable | $9.99 | 1200 gems (969+231) |
| `com.tanksandkings.app.gems2880` | Consumable | $19.99 | 2880 gems (2020+860) |
| `com.tanksandkings.app.gems7650` | Consumable | $49.99 | 7650 gems (4040+3610) |
| `com.tanksandkings.app.gems16100` | Consumable | $99.99 | 16100 gems (8080+8020) |
| `com.tanksandkings.app.starter` | Consumable | $2.99 | 500 gems + 1500 scrap + Rare chest |
| `com.tanksandkings.app.treasury` | Consumable | $14.99 | 3200 gems (LTO) |

All are **consumable** (not subscriptions, not non-consumables).

### C. RevenueCat dashboard (10 min)
1. RevenueCat → your project → Products → import from App Store Connect
2. Create an Entitlement called `premium_currency` (or just use products directly —
   the bridge purchases by product ID, no entitlement check needed for consumables)
3. No paywall configuration needed — the game has its own shop UI

### D. iCloud capability (2 min)
In Apple Developer portal → Identifiers → `com.tanksandkings.app` → enable
**iCloud** → check **Key-Value Storage**. (The entitlements file is already in
the Xcode project; Codemagic's `--create` will generate a provisioning profile
that includes it.)

### E. Codemagic env injection (2 min)
Add to `codemagic.yaml` under the `ios-release` workflow's `environment:vars:`,
or better as a secure env var in the Codemagic UI. Then add a build script step
before "Sync Capacitor iOS project":

```yaml
- name: Inject RevenueCat key
  script: |
    # Writes the key where tk-native-bridge.js can read it
    sed -i.bak "s|window.__TK_REVENUECAT_KEY='';|window.__TK_REVENUECAT_KEY='$TK_REVENUECAT_KEY';|" www/index.html || \
    echo "<script>window.__TK_REVENUECAT_KEY='$TK_REVENUECAT_KEY';</script>" | cat - www/index.html > www/index.html.tmp && mv www/index.html.tmp www/index.html
```

Simpler alternative: add this line to `www/index.html` `<head>` manually before
each release build. The bridge reads `window.__TK_REVENUECAT_KEY`.

---

## Testing
1. Sandbox tester: App Store Connect → Users and Access → Sandbox Testers → create one
2. On device, sign out of App Store, sign in with sandbox account when prompted
3. Buy a $0.99 gem pack — should charge $0.00 (sandbox)
4. Delete the app, reinstall — progress should restore from iCloud
5. Check `TKNative` in Safari remote debugger for manual push/pull

## Notes
- First-purchase 2× gem bonus and starter-pack one-time logic are preserved —
  they run in the game's `grant()` functions, not in the billing layer
- Receipts still logged to `STORE.receipts` with provider `revenuecat`
- Demo billing remains active on web and when no API key is configured
