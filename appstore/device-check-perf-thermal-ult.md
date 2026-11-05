# Device check — thermal + ULT + full-scope perf stack

For the build pushed from the full 13-commit local stack, in order: `a64c511`,
`024dd4b`, `33bafca`, `f3fb3ff`, `01fad6a`, `9830bb9` (asset-resize completion),
`18a307a`, `c0ce7f3`, `af342df`, `e4a407d`, `1f1293b`, `3e4d6a2`, `9d632d1`
(HEAD). Sections 1–5 cover the first six commits; sections 6–9 cover the next
four; sections 10–12 cover the three added 2026-10-19. One pass, in this order.
Nothing here is proven until this runs on Jay's iPhone and iPad —
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

## 6. Clear-cut bug batch (`18a307a`)
- Event screen: the countdown ticks live instead of freezing at "Ends in --".
- Explosion / nova FX: effect tails play to completion — no longer cut off
  early when the FX canvas goes idle.
- ULT orb in a spawn gap: each new gap gets its own full 1.5s hold (the wait
  resets on retarget, it does not carry a partial wait over).
- Tutorial battles: uncheck auto-ULT / auto-parry — neither fires while the
  UI shows OFF.

## 7. SFX — files or silence (`c0ce7f3`)
- Coin pickup, shield, boss roar, and the evolution / login fanfares are
  SILENT — that is correct now, not a bug. They stay silent until Jay
  supplies files for: a reward chime, a boss roar, a fanfare jingle.
- Hit / player-hit / kill play Jay's impact clip; cannon, enemy fire, impact
  and ULT-impact play his clips. No synthesized tone anywhere in menus,
  combat, or ULTs.

## 8. Umbra ULT (`af342df`)
- Fire an ULT at Umbra (god #8, floors 80/180/…): it always lands — no evade.
- Regular fire, melee, missiles, abilities and DoTs can still be evaded
  (15%) — only ULTs are exempt.

## 9. Dev menu double gate (`e4a407d`)
- 5 taps on the title logo → PIN prompt only; nothing unlocks before the PIN.
- Wrong PIN counts up (1/3…); 3 wrong attempts lock the prompt for 60s.
- Correct PIN → menu opens; a grant lands at exactly 1,000,000 scrap,
  2,500 gems, and 100 each of valor, seals, emblems and every shard pool —
  no more, no less.

## 10. Logic-test fixes (`1f1293b`)
- Campaign mutual kill (you and the boss die together): season / event
  mission credit is NOT granted for that run — the gate now applies there,
  as it already did for guild (section 4).
- Dev-menu reset: the toast prints the capped grant amounts from section 9,
  not the old flat numbers.
- Purchase rollback: cancel / fail a flash-offer purchase, an earned-skin
  purchase, and the premium purchase — prior currencies, skins, and receipt
  state are restored exactly, nothing duplicated or lost.

## 11. Jay's 12 logic rulings (`3e4d6a2`)
- One crit per hit: Zip's and Tesla's multi-strike abilities deal exactly
  their table values every cast — no stacked second crit system. Mist's
  banked crit is spent on the next real hit, not eaten by a blocked one.
- ULTs are exempt from Volt crit — an ULT never crits.
- Kingdom status effects land on direct hits only; DoT ticks and indirect
  damage do not re-apply them.
- ULT meter: +8 from direct actions only — a full meter takes 13 direct
  hits; DoTs and indirect damage add nothing.
- Bloom reflect: only post-shield HP damage is reflected — a fully blocked
  hit reflects nothing.
- Dungeon valor and guild-kill seals now roll through the boost: the grant
  is 2 most runs, 3 on roughly 1 in 5.
- DoTs: burn / poison are reduced against Crag (×0.68); Solar Burn and
  Thornbleed tick at the god multiplier against gods.
- Ascendant ULT orb overlay in landscape scale-to-fits the screen; portrait
  rendering is unchanged from before this commit.
- HUD text floor is 9px on every track (the two 8px labels in section 12
  are the specific exceptions fixed afterward).
- Harness-only, no device check: stun overwrite and the date-gated dungeon
  are kept as ruled; corrupt-save backups are capped at 3.

## 12. Bug test #2 — all 4 LOW defects fixed (`9d632d1`)
- Title screen, iPhone landscape: the "Choose Your Faction" button text
  renders at 8px (was 4px); portrait still renders at 9px.
- Character screen at phone width: the two header micro-labels render at
  8px (were 6.5px).
- Dungeon sweep: the toast prints the actual boost-rolled valor received
  (2 or 3 — see section 11), matching the grant; the reward card still
  lists the base +2 table value.
- Guild seals: banked pending guild seals above 1,000 now survive a reload
  (sanitizer cap raised to 100,000). Theoretical at current balances —
  check only if a large unclaimed guild balance exists.

## Left untouched — Jay's call only
- WebP conversion (~175MB smaller install) — skipped: breaks the PNG-only rule.
- The ~69MB music buffer — device-verified design, left as is.
