# Tanks & Kings — Ads Model (Jay, decided 2026-11-05)

Status: APPROVED MODEL, NOT YET BUILT. Sequencing (Jay, 2026-11-05): the current
release ships WITHOUT ads; ads are the next update. Basis: industry-customs
analysis (~/workspace/research_notes/mobile-game-ad-monetization-customs-20261105-1719/report.md
and the tanks-kings-ads-analysis artifact).

## Formats
- Rewarded video + interstitials only. No banners, no app-open, no native.
- Mediation: AdMob via @capacitor-community/admob at launch (only mature
  Capacitor route). Revisit mediation stacking (MAX/LevelPlay) only above
  ~$50-100/day ad revenue.
- Wiring: same bridge pattern as billing — game calls an ads seam in the web
  layer, the native bridge answers; the plain web build shows no ads.

## Interstitials (forced)
- Placements ONLY: post-battle results screen; returning to the lobby.
  Never during battle, never between waves, never at battle start, never on
  loading screens, never inside the purchase flow.
- Caps: max 1 per 3 minutes; max 3 per session; no back-to-back across
  consecutive triggers (results -> lobby fires once).
- Grace: session 1 = zero interstitials. From session 2, only after at least
  one lifetime completed battle.
- Suppression: none within 5 min after a rewarded video; none in a session
  where the player makes any purchase.

## Rewarded (always opt-in, reward labeled before the tap)
- Revive (defeat screen): continue at 50% HP, same terms as the paid revive.
  Cap 1 per battle.
- Double rewards (results screen): 2x the scrap + gems that battle paid.
  Cap 1 per battle.
- Free gems (shop): +10 gems per view, cap 3/day. (Flagged generous:
  900 gems/mo for a daily player ~= $8.91 ladder value vs ~$1.50 ad revenue;
  tightening option on record: 5 gems x 3/day.)
- Idle boost (idle earnings sheet): 2x offline earnings. Cap 1 per claim.
- Free chest (shop): 1 Rare chest per day.
- EXCLUDED by design: no ad entry for the Dungeon (date-gated per Jay's
  ruling, no extra entries of any kind); no extra Guild Boss attempt
  (1 attempt/day is the competitive balance).

## Who never sees forced ads
- Remove Ads IAP: new non-consumable, $4.99 — interstitials off permanently.
  Rewarded (opt-in) stays.
- Season Pass Premium holders: no interstitials while the pass is active.
- Payers: any purchase suppresses interstitials for that session; lifetime
  spend >= $20 suppresses them permanently.

## Compliance / paperwork (ships with the ads update)
- UMP consent before SDK init (EEA/UK/CH); ATT prompt after the first battle,
  not at first launch; plan for ~60% non-personalized iOS ads.
- App Store privacy nutrition label updated for ad-SDK data; Google Play
  Ads/Data Safety declarations; app-ads.txt on the privacy site.
- Privacy policy rewrite: the "no third-party analytics, advertising, or
  tracking SDKs" line (privacy-policy-tanks-kings.md) is removed/replaced.
- Test ads only via AdMob test IDs until production release.
