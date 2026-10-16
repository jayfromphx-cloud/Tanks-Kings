# Device check — thermal + ULT + full-scope perf stack

For the build pushed from local commits `a64c511`, `024dd4b`, `33bafca`, `f3fb3ff`,
the asset-resize completion commit, and `01fad6a` (in that order). One pass, in
this order. Nothing here is proven until this runs on Jay's iPhone and iPad —
the test rig cannot reproduce a 120Hz panel or heat.

## 1. Heat — the headline (reported on BOTH iPhone & iPad)
- Battle ~10 minutes at normal speed, then a stretch at ×4.
- Compare device temperature against the pre-fix build — this is the verdict
  for the loop-pacing fix (60fps, 30 in Battery Saver/Performance Mode).
- Battle speed and wave timing should feel unchanged; only the frame rate
  is capped.
- Repeat a short run with Battery Saver on: 30fps, still playable.

## 2. ULT no longer wasted (reported as "cooldown resets instantly")
- Fire an ULT at a weakened enemy and let regular fire / DoTs kill that
  target during the ~2s cast + flight: the orb must retarget and damage a
  live enemy in its hit zone — meter spent, damage dealt.
- Fire an ULT into a spawn gap (no enemy on field yet): the orb holds at
  the hit point up to 1.5s and hits the next spawn instead of fizzling.

## 3. Perf-pass visuals that changed on purpose — eye check
- Comic badges (CRITICAL! / K.O.! / ULTIMATE) should look identical to
  before (now baked once instead of redrawn every frame).
- Pause and result overlays: backdrop blur removed (backgrounds were
  already opaque) — should be imperceptible.
- Battery Saver now freezes the always-on shine/sheen animations.
- ULT cinematic: no hitch at the pose swap (poses decode at battle entry).
- Title screen idle: no periodic work (was ~219ms of long tasks per 10s).

## 4. Fix batch riding in `a64c511`
- Melee lifesteal heals 15% of the damage actually applied.
- Guild boss mutual kill (both die together) resolves as a defeat.
- Retry a camp wave: spawn flags reset, wave repopulates normally.

## 5. Ascendant ULT sizing (`01fad6a`, Ascendant tier only)
- Fire an Ascendant ULT: warhead ~212px wide on phone (was ~106), orb overlay
  ×2.5 its previous size, wrapping well beyond the warhead.
- Fire a non-Ascendant ULT: sizes unchanged from before.

## Left untouched — Jay's call only
- WebP conversion (~175MB smaller install) — skipped: breaks the PNG-only rule.
- The ~69MB music buffer — device-verified design, left as is.
