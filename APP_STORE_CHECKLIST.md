# Tanks & Kings — App Store Upload Checklist

## What's Done
- [x] Capacitor iOS wrapper (`com.tanksandkings.app`)
- [x] Web build staged in `www/` (58MB)
- [x] Bundle ID configured in Xcode project + Info.plist
- [x] Display name: "Tanks & Kings", version 1.0 (build 1)
- [x] Codemagic pipeline (`codemagic.yaml`) — auto-builds IPA + uploads to TestFlight on push
- [x] Privacy policy draft (`privacy-policy-tanks-kings.md`)
- [x] App Store listing copy (`appstore/listing.md`)
- [ ] App icon — **waiting for your pick** (tank vs emblem, in `appstore/`)

## Your Manual Steps

### 1. Pick the app icon (2 min)
Two options are in `appstore/`. Tell me which one and I'll wire it into
the Xcode asset catalog at 1024×1024.

### 2. GitHub repo (5 min)
- Create a new repo, push `tanks-kings-native/` contents
- Codemagic watches `main`/`master` — push triggers the iOS build

### 3. Codemagic setup (5 min)
- codemagic.io → Continue with GitHub → Add application → pick the repo
- Teams & integrations → App Store Connect API → add key
  (Issuer ID + Key ID + .p8 from Apple Developer → Users and Access → Integrations → App Store Connect API → Team Keys)
- This handles code signing AND TestFlight upload automatically

### 4. Apple Developer portal (5 min)
- Identifiers → confirm App ID `com.tanksandkings.app` exists (Codemagic can create it)
- No special capabilities needed (no push, no IAP yet — add later)

### 5. App Store Connect (15 min)
- Create the app record: Tanks & Kings, `com.tanksandkings.app`, Strategy category
- Fill in listing from `appstore/listing.md` (description, keywords, subtitle)
- Upload screenshots (iPhone 6.7", 6.5", iPad 12.9" — 3 each minimum)
- Privacy policy URL (host `privacy-policy-tanks-kings.md` somewhere public)
- Age rating questionnaire → expect 9+
- Pricing: Free with IAP (configure IAP products later via RevenueCat)

### 6. First build
- Push to `main` → Codemagic builds → IPA appears in TestFlight (10-30 min)
- Add yourself as a tester, install via TestFlight, playtest
- When ready: App Store Connect → submit for review

## Notes
- IAP (in-app purchases) are NOT wired yet — the web build has demo purchase
  flows. RevenueCat integration comes before you can sell anything.
- Game is session-only (no cloud save) — fine for v1.0.
- Current web build is the live published version with fixed God King Vanguards
  and the audio overhaul.
