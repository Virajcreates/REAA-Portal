# Design System: REAA Portal (Developer Console & Admin Control Center)
Last Updated: 2026-11-24
Platform: web
Domain: Developer Tools / Institutional PropTech Infrastructure
Style: Architectural Ledger (Swiss Editorial Precision)

## Mood
**Confident + Calm (Institutional Infrastructure)**
- Color Temp: Warm stone neutrals (`oklch` alabaster & charcoal) paired with restrained Karnataka Terracotta Copper accent
- Typography Weight: Structured hierarchy (500–700 headings, 400–500 body, monospace tabular numbers for every metric/ID/key)
- Whitespace: Generous, grid-aligned, zero visual clutter
- Motion: Subtle, purposeful snaps (`150ms–220ms cubic-bezier(0.2, 0, 0, 1)`), strictly gated with live `prefers-reduced-motion`
- Shadow: Crisp 1px hairlines over soft elevation (only modals use subtle directional shadow)

## Color Tokens

### Primitive & Semantic (oklch — Zero Pure #000 / #fff)
```css
:root {
  --bg-base:          oklch(96.8% 0.007 82);
  --bg-surface:       oklch(99.1% 0.003 82);
  --bg-subtle:        oklch(94.6% 0.008 82);
  --bg-elevated:      oklch(99.6% 0.002 82);
  --bg-ink:           oklch(17.5% 0.012 75);

  --text-primary:     oklch(17.5% 0.012 75);
  --text-secondary:   oklch(43.5% 0.014 75);
  --text-tertiary:    oklch(55.5% 0.012 75);
  --text-on-accent:   oklch(98.5% 0.004 82);

  --border:           oklch(88.2% 0.009 80);
  --border-strong:    oklch(79.5% 0.012 80);

  --accent:           oklch(52.5% 0.145 36);
  --accent-hover:     oklch(from var(--accent) calc(l - 0.06) c h);
  --accent-active:    oklch(from var(--accent) calc(l - 0.11) c h);
  --accent-soft:      oklch(from var(--accent) 94% 0.032 h);
  --accent-border:    oklch(from var(--accent) 82% 0.065 h);

  --success:          oklch(46.5% 0.125 152);
  --success-soft:     oklch(from var(--success) 95% 0.032 h);
  --warning:          oklch(56.0% 0.145 72);
  --warning-soft:     oklch(from var(--warning) 95% 0.042 h);
  --danger:           oklch(50.5% 0.175 24);
  --danger-soft:      oklch(from var(--danger) 95% 0.035 h);
}
```

## Scale Minimums (Measurable Contract)
- Auth Hero Display: `48px` (`3rem`, line-height `1.06`, tracking `-0.03em`)
- Page H1: `28px` (`1.75rem`, weight `700`, tracking `-0.02em`, `text-wrap: pretty`)
- Section H2: `18px` (`1.125rem`, weight `600`, tracking `-0.01em`, `text-wrap: pretty`)
- Body Copy: `16px` (`1rem`, weight `400`, line-height `1.55`) — never below `16px` for body text
- Table / Meta Labels: `13px–14px`, contrast >= 4.5:1 against `--bg-surface`
- Interactive Touch Targets: `>= 44px` height on primary buttons/inputs/mobile controls; `>= 36px` compact table action buttons with `8px` minimum gap
- Focus Ring: `2px solid var(--accent)` with `2px` offset via `:focus-visible` on every interactive control

## Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Display | Plus Jakarta Sans | 700 | 48px |
| H1 | Plus Jakarta Sans | 700 | 28px |
| H2 / Panel Title | Plus Jakarta Sans | 600 | 18px |
| Body | Plus Jakarta Sans | 400 / 500 | 16px |
| Mono / Keys / Metrics | JetBrains Mono | 400 / 500 / 600 | 13px–24px (`tabular-nums`) |

Numbers rule: `JetBrains Mono` with `font-variant-numeric: tabular-nums` for ALL counts, quotas, latencies, timestamps, and API key prefixes.

## Spacing & Radius
- Base grid: `8px` (`xs: 4px`, `sm: 8px`, `md: 16px`, `lg: 24px`, `xl: 32px`, `2xl: 48px`)
- Border radius: `sm: 6px` (badges/inputs), `md: 8px` (buttons/panels), `lg: 12px` (modals/feature cards)

## Iconography
- Strictly `@phosphor-icons/react` (`regular` and `bold` weights, `16px–20px`). Zero custom hand-rolled SVGs for standard icons.

## Anti-Patterns (MUST NOT Generate)
- No purple/indigo/cyan neon gradients or glowing drop shadows (wrong for institutional PropTech infrastructure)
- No pure `#000000` or `#FFFFFF` in semantic tokens
- No glassmorphism / backdrop-blur card stacks
- No rainbow KPI cards (neutral stone surfaces with crisp 1px borders and semantic status dots only)
- No lorem ipsum or fake placeholder text
- No raw upstream K-RERA or Turso URLs exposed anywhere in public UI
- No `outline-none` without explicit `focus-visible` ring

## UX Writing
- Tone: Direct, institutional, calm, zero marketing hype
- Button labels: Verb-first (`Mint API Key`, `Approve Account`, `Revoke Key`, `Update Limits`, `Request Access`)
- Error template: `[What failed] + [Why] + [Next step]` (e.g., `"Couldn't mint API key: account is pending admin review. You'll get access once approved."`)
- Empty state template: `[What's missing] + [Direct next action]`
- Confirmation template: `[Exact consequence] + [Reversibility]` (e.g., `"Revoking rk_live_8f3a immediately rejects all requests using this key. This cannot be undone."`)

## Pre-Delivery Checklist
- [ ] Color contrast >= 4.5:1 verified on rendered surfaces
- [ ] Visible `:focus-visible` ring on all buttons, inputs, tabs, and links
- [ ] Touch targets >= 44px mobile / >= 36px desktop with >= 8px gap
- [ ] All icon-only buttons have `aria-label`; all inputs have `<label>`
- [ ] Empty, loading, and error states implemented for all async views
- [ ] `prefers-reduced-motion` disables transitions cleanly
- [ ] Visually inspected via in-app browser at `1440px` and `375px`
