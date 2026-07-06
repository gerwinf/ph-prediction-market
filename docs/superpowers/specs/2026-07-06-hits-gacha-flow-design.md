# /hits gacha flow — design

Date: 2026-07-06
Scope: presentation layer only. No data-model, settlement, economy, or pool
changes. Turn the `/hits` journey into a Pokémon-collector experience:
booster-pack reveal on acquisition + a binder for the collection.

## Problem

The `/hits` flow drops the user straight into perpetual DEMO and feels flat:
- **Pick** — buying a card makes the 5×5 board just *appear*. No "pull" moment.
- **See cards** — `/hits/history` is a plain newest-first receipt list, only
  reachable from the account menu. It reads as a log, not a collection.

The raw material for a collector feel already exists: every event cell carries a
`rarity` (`common | uncommon | rare`, see `lib/hits/types.ts`), and finished
cards already persist their `cells` + win result in the `cards` table.

## Goal

A coherent five-stage journey that feels like opening and collecting cards:

1. **Pick → booster-pack rip** (new reveal moment)
2. **Open card during the event** (reuse)
3. **View card update live** (reuse)
4. **See resolution** (reuse + small "card complete" ending)
5. **See cards → binder** (restyle history into a collection)

Everything is a presentation layer over the existing game. Chosen directions
(from the visual brainstorm): reveal = **booster pack rip** (not instant/holo,
not single-card); won-card treatment in the binder = **green ₱ ribbon** (not
holo shine).

## Stages

### 1. Booster-pack rip (NEW)

- Landing CTA copy changes from "Bumili ng ₱N card" to **"Buksan ang pack · ₱N"**
  (keep the disabled/limit variants; only the primary label changes).
- Buy flow is unchanged (`completePurchase` still POSTs `/api/cards` and
  navigates to `/hits/{cardId}?bet=…&type=…[&live=1&match=…]`).
- On the **card page first mount**, if this is a *fresh acquisition*, play a
  `PackRipReveal` over the board:
  - A match-themed pack (home/away names + colors from `sample`/`fixtureInfo`,
    generic fallback for daily/unknown) → tap-to-rip → the 25 cells cascade in,
    **rare cells (`cell.rarity === 'rare'`) flip last with a holo shine**, then
    settle into the normal playable board.
  - Duration ~2s; **tap-to-skip**; honors `prefers-reduced-motion` and the
    existing `?speed` param (both skip/shorten the rip).
  - The reveal is purely visual — it renders the already-generated `card.cells`;
    it does not change generation, timing of events, or hit detection.
- **Fresh-acquisition detection:** the card page currently always renders the
  board. Add a one-shot signal that the card was just bought (not revisited):
  pass `?new=1` on the post-buy navigation (from `completePurchase` and from
  shuffle/"another card"), consumed once on mount then removed from the URL
  (`router.replace` without `new`). Opening a card from the binder or a shared
  link has no `?new=1`, so it shows the board instantly. Rationale: URL-flag is
  simplest, SSR-safe, and self-clears so a refresh won't re-rip.

### 2–3. Play (REUSE)

No mechanics change. After the rip settles, the board is in its existing demo or
live state and lights cells exactly as today (`hitIndices`, event polling / the
`SAMPLE_MATCH` timer). The rip only replaces the abrupt board appearance.

### 4. Resolution (REUSE + small ending)

- Keep the existing win modal (`winShown`, `bestPayout`, `/api/cards/[id]/won`).
- When the card finishes (`done === true`), replace the always-on "Share + Iba
  pang card" footer's neutral copy with a **"card complete"** state that adds an
  **"Add to binder →"** link to `/hits/history` (the binder). This gives the
  journey an ending instead of a frozen board. No settlement change.

### 5. Binder (RESTYLE of `/hits/history`)

- Restyle the history list into a **binder grid**: pockets in a 3-wide grid,
  each showing the card's mini 5×5 (hit cells filled, free cell marked), match
  label, date/price, and result.
- Header stats row: **cards · wins · ₱ won** (derived from the same
  `/api/cards` payload the page already fetches; compute counts/sum client-side).
- Result treatment:
  - **Won** → green **₱{score} ribbon** (calm; no holo).
  - **Live/in-progress** → orange pulsing "● LIVE" badge.
  - **Miss/finished-no-win** → plain pocket, "—".
- Tapping a pocket opens that card's page (finished → replay/static board; live
  → live view). Reuses existing card URLs; **no `?new=1`**, so no re-rip.
- **Navigation:** add a visible **"Binder"** entry reachable by both anon and
  authed users (not only the authed `AccountMenu`) — e.g. in the `/hits` header
  and the card page header. Anon binder already works (device-scoped
  `/api/cards`); keep the existing "sign in so you don't lose it" banner.

## Components / boundaries

| Unit | Type | Responsibility | Depends on |
|---|---|---|---|
| `components/hits/PackRipReveal.tsx` | new | Render the pack + cascade/holo reveal over a given `cells[]`; fire `onDone`; self-skip on reduced-motion/speed. | `Card.cells`, `rarity`, match label/colors |
| card page `[card_id]/page.tsx` | edit | Detect `?new=1`, gate `PackRipReveal` before play; add "card complete → Add to binder" footer state. | PackRipReveal |
| landing `page.tsx` | edit | CTA copy → "Buksan ang pack"; append `?new=1` on buy; add "Binder" nav entry. | — |
| history `history/page.tsx` → binder | restyle | Binder grid + stats + result ribbons; pocket → card link. | `/api/cards` (unchanged) |
| `app/hits/hits.css` (or existing styles) | edit | Pack/rip/holo + binder pocket styles. | — |

No API, DB, or `lib/hits/*` logic changes. `PackRipReveal` is isolated: input is
`cells[] + match meta`, output is an `onDone` callback; testable in isolation.

## Testing

- Unit (vitest, jsdom where needed):
  - Binder stat derivation (cards/wins/₱ from a `/api/cards`-shaped list):
    counts, sum, empty state.
  - `?new=1` consumption logic (a small pure helper: given search params →
    `{ showRip: boolean, cleanedUrl }`), including reduced-motion/speed short-circuit.
- Manual/local render (needs borrowed creds — `/hits` boots a Supabase client):
  - Fresh buy → pack rips → cascade → board plays (demo Portugal–Spain).
  - Refresh mid-card does **not** re-rip; binder-open does **not** rip.
  - Binder grid renders won (ribbon) / live (pulse) / miss pockets; pocket opens
    the card.
  - `prefers-reduced-motion` and `?speed=8` skip the rip.

## Out of scope (explicit)

- Any collectible *economy*: persistent rarity value, dupes, dex completion,
  trading, keep-vs-play. (This is scope "B" — deferred.)
- Sound effects (haptic only for now).
- Live football data feed — play still uses the existing demo/ops-fired paths.
- Changes to card generation, pools, payouts, or settlement.
