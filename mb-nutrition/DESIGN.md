# DESIGN.md — MB NUTRITION

> A quiet health dashboard: grey page, white cards, one colour per metric, numbers first, almost no words.

Source of truth for values: `www/app.css` (`:root` tokens). This file codifies the current identity; it is not a redesign.

## 1. Visual Theme & Atmosphere

**Style**: iOS-native health dashboard (Apple Fitness / Health family).
**Keywords**: calm, numeric, rounded, light, sporty, legible, native.
**Tone**: friendly coach, precise numbers — NOT luxury, NOT black + gold, NOT gamified neon.
**Feel**: a clean training notebook where each number already has its colour.
**Interaction tier**: L1 (app): subtle, transform/opacity only. **Dependencies**: CSS only (+ Inter from Google Fonts).

## 2. Color Palette & Roles

All colours are tokens on `:root`. No hex or rgba outside the token blocks.
Dark values live in `@media (prefers-color-scheme:dark){:root:not([data-theme="light"])}` **and** `:root[data-theme="dark"]` (app.js sets `data-theme` on `<html>` from the user setting).

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | #F2F2F5 | #0B0B0F | page |
| `--card` | #FFFFFF | #17171C | cards, sheets, tab bar (via color-mix) |
| `--sunk` / `--sunk-2` | #ECECF0 / #E0E0E6 | #222229 / #2E2E37 | wells, tracks, inactive chips / borders of checkboxes |
| `--ink` | #0B0B0F | #F5F5F7 | headings, numbers, primary buttons, selected states |
| `--on-ink` | #FFFFFF | #0B0B0F | text/icons on an `--ink` fill (primary button inverts in dark) |
| `--on-dark` | #FFFFFF | #FFFFFF | icons on a metric-coloured fill |
| `--text` | #2C2C33 | #D6D6DC | body |
| `--mute` | #6A6A76 | #9A9AA6 | secondary labels (≥4.5:1 on bg and card) |
| `--line` | #E4E4EA | #26262D | hairlines |
| `--scrim` | ink 32% | black 60% | sheet backdrop |
| `--toast-link` | #9CC2FF | #1F5FD6 | action link inside the toast |
| `--mark-hi` | #3A3A44 | #B8B8C2 | logo gradient top stop |
| `--ok` `--warn` `--bad` | #187A44 #9A5F00 #D11F25 | #34C46E #F5A524 #FF6166 | status text, danger button |

**Metric colours** — the plain token is for fills (rings, bars, dots); `-text` is the same hue at ≥4.5:1 for small text (eyebrows `.c-*`). In dark, fills are brightened and `-text` = fill.

| Metric | Fill light | Text light | Fill dark |
|---|---|---|---|
| `--kcal` calories | #FF5A1F | #CC3600 | #FF6A33 |
| `--prot` protein (also links, focus) | #2F7BFF | #1660E0 | #4C8DFF |
| `--carb` carbs | #FFC53D | #916600 | #FFD15C |
| `--fat` fat | #E5489E | #D01E7F | #F062B0 |
| `--steps` | #20C463 | #157E40 | #30D46F |
| `--water` | #1FB7E8 | #107799 | #38C4EE |
| `--weight` | #9B5CF6 | #8B41F5 | #A978FF |
| `--train` | #F5B700 | #8C6900 | #FFC21A |
| `--hr` heart rate | #F2385A | #DC0E34 | #FF4D6D |
| `--sleep` | #5856D6 | #5856D6 | #8583FF |
| `--fast` fasting | #12B5A5 | #0C7B70 | #2CCCBB |

**Rules**: one metric = one colour everywhere (ring, bar, dot, eyebrow). Text in a metric colour uses `--x-text` (or `.c-x`). The UI chrome stays neutral (ink/grey); colour is reserved for data. Translucency is `color-mix(in srgb,var(--token) N%,transparent)`, never a new rgba.

## 3. Typography Rules

`Inter` 400–800 (`--sans`, falls back to system-ui / SF Pro). Features `cv11`, `ss01`; numbers `tabular-nums`.

| Role | Size | Weight | Line height | Tracking |
|---|---|---|---|---|
| Page title `.ttl b` | 1.625rem | 800 | 1.1 | -.035em |
| Hero number `.n` (tile/metric) | 1.75–2.5rem | 700 | 1 | -.035em |
| Section h2 `.sec-t h2` | 1.25rem | 700 | — | -.025em |
| Card h2 / h3 | 1.0625 / .9375rem | 700 / 600 | 1.3 | -.025em |
| Body | .9375rem (15px) | 400 | 1.45 | — |
| Small | .8125rem | 400–600 | 1.4 | — |
| Eyebrow `.eyebrow`, `.lg>span` | .6875rem uppercase | 600–700 | — | .06em |

Numbers are the biggest thing on a card; units are `small` in `--mute`. No gradient or shadowed text. Never a serif, never a display/novelty font.

## 4. Component Stylings

- **Buttons** `.btn`: 50px high, radius 13px, `--ink` fill + `--on-ink` text. Variants `.soft` (sunk), `.line` (card + 1.5px line inset), `.danger`, `.sm` (36px visible, 44px hit area via `::after`). Hover: opacity .9 · Active: scale .97 · Focus: 2.5px `--prot` outline, offset 3px.
- **Cards** `.card`, `.tile`, `.rcp`, `.client`: `--card`, radius 20px, `--shadow`, padding 14–18px. Tappable cards: active scale .97, hover (pointer only) adds a 1.5px `--line` inset.
- **Week strip** `.dates`: 7 mini rings; a sliding `.sel` pill in `--ink` marks the selected day, label inverts to `--on-ink`. Future days at 45% opacity.
- **Segmented control** `.segs`: sunk track, sliding `.sel` card pill with `--shadow-seg`.
- **Chips** `.chip`: 36px pill with line inset; pressed = ink fill. **Option rows** `.opt`: 56px, pressed = card + 2px ink inset.
- **Tab bar** `.tabs`: fixed, translucent `--card` + blur, 3px ink indicator slides above the active tab; centre FAB 54px ink circle with `--shadow-pop`.
- **Sheets** `.sheet`: bottom sheet radius 24px top, grab handle, `--scrim` behind, safe-area padding.
- **Toast**: ink pill above the tab bar, optional undo link in `--toast-link`.
- **Inputs** `.input`: 48px, `--bg` fill; focus = ink border + card fill.
- **Pills / status** `.pill`: 28px, card + shadow; `.ok`/`.warn` colour the text.

All states exist for every interactive element: default, hover (`@media (hover:hover)` only), active (scale), focus-visible, pressed (`aria-pressed`), disabled (opacity).

## 5. Layout Principles

- Single column, `max-width:520px` (coach `.wide` 980px), side gutter `max(16px, safe-area)`.
- Vertical rhythm: `main` gap 14px, `.stack` 12px, card padding 16px.
- Grids: `.grid2`/`.tiles` 2 cols gap 12px, `.grid3`/`.kpis` 3 cols gap 10px, always `minmax(0,1fr)`.
- Sticky header `.top` fades into `--bg`; bottom padding clears the tab bar + home indicator.

## 6. Depth & Elevation

| Level | Token | Use |
|---|---|---|
| Flat | none | wells (`--sunk`), list rows |
| Card | `--shadow` (dark: 1px white 4% ring + black shadow) | cards, tiles, pills |
| Control | `--shadow-seg` | segmented selection |
| Pop | `--shadow-pop` | FAB, toast |
| Sheet | `--shadow-lg` | bottom sheet |

## 7. Animation & Interaction

**Philosophy**: motion confirms an action, never decorates. Transform and opacity only. **Tier**: L1.
- Easings: `--ease-out` (enter), `--ease-io` (move), `--ease-in` (leave). 120ms press, 200–320ms moves, ≤1.1s ring fills.
- View enter `.rv`: 8px rise + fade + 3px blur, 30ms stagger. Indicators slide with a short stretch.
- `prefers-reduced-motion`: all animation and transition durations collapse to ~0.

## 8. Do's and Don'ts

Do
1. Lead every card with the number; label in an uppercase eyebrow.
2. Give each new metric one token pair (`--x` fill, `--x-text` text) in light and both dark blocks.
3. Use `--ink`/`--on-ink` for primary actions and selected states so they invert correctly in dark.
4. Keep touch targets ≥44px (enlarge the hit area with `::after`, not the visual).
5. Write French copy with "vous", short.
6. Respect safe areas on anything fixed (header, tab bar, sheets, toast).
7. Check 4.5:1 for small text on both `--bg` and `--card`, in both themes.
8. Keep the health legal footer visible.

Don't
1. No hex/rgba outside the token blocks; no `#fff` for "text on dark" (use `--on-ink` / `--on-dark`).
2. No black + gold, no gradients on surfaces, no glow.
3. No second accent colour for chrome; colour belongs to metrics.
4. No metric fill colour as small text on white (use `-text`).
5. No hover-only affordances; hover is a bonus for pointer devices.
6. No layout-shifting animation (width/height/top) except the measured indicator slide.
7. No new fonts or weights beyond Inter 400–800.
8. No horizontal page scroll at any width.

## 9. Responsive Behavior

- Designed at 390×844; works from 320px up. Content is capped at 520px and centred on tablets/desktop; the coach space widens to 980px with a 2-column client grid at ≥900px.
- Rings scale with `min(44vw,172px)`; text truncates with ellipsis rather than wrapping in list rows.
- `viewport-fit=cover` + `env(safe-area-inset-*)` for notches and the home indicator (Capacitor iOS/Android).
- Theme follows the system unless the user picks one (`data-theme`).
