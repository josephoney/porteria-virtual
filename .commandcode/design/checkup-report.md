# Checkup Report — Portería Virtual

**Date:** 2026-06-19
**Surfaces Audited:** Dashboard (operator/admin/guard SPA), Kiosk (touch terminal)
**Score:** 40/60

---

## Vital Signs

### Intentionality — 10/10 ✅ Healthy

Both surfaces carry a strong, authored identity. The dashboard uses a warm off-white (`#f5f4ef`) / near-black (`#1a1916`) palette with a distinctive green primary and blue secondary — **refusing the generic blue SaaS default**. The `Syne + IBM Plex Mono` font pairing is intentional and technical, fitting a security/access-control domain. Typography leans heavily on uppercase with tight letter-spacing — a deliberate security-industry visual language.

The kiosk goes darker: cyberpunk-adjacent with `#0a0c0f` background, neon green (`#00e5a0`) accent, Bebas Neue for display, DM Sans for body. The grid background pattern, noise grain overlay, expanding call-button rings, and glassmorphism top bar are all authored decisions. Nothing here looks like an unstyled framework default.

Both surfaces have a clear visual lane. No AI-generic tells detected.

---

### Readability — 10/10 ✅ Healthy

Primary text contrast is excellent across both surfaces:
- Dashboard: `#1a1916` on `#f5f4ef` ≈ 15:1
- Kiosk: `#e8eaed` on `#0a0c0f` ≈ 11:1

Secondary/muted contrasts are comfortable (5:1+). Type scales are intentional: dashboard uses compact UI sizes (11–14px for chrome), appropriate for a desktop tool. Kiosk uses `clamp()` for display text — readable from distance. The `IBM Plex Mono` at 10–11px for logs and data is standard for operational monitoring UIs.

No illegible text combinations found.

---

### Usability — 5/10 ⚠️ Watch

**Core flows work:**
- Awaiting → Accept/Reject → In-call with controls (mute, end, open door)
- Kiosk idle → Call → Wait → Talk → Door open feedback
- Toast notification for incoming calls
- Drag-to-reposition, minimize-to-PiP for video overlay

**Concern — floating video window pattern:**
The main operator panel shows *text instructions* ("La videollamada se muestra en la ventana flotante") instead of integrating the video into the layout. The actual video lives in a detached, draggable overlay. This means:
- The primary interaction surface is disconnected from the primary navigation
- The panel-main area becomes secondary content during an active call
- New operators may miss the floating window on first use
- The PiP state is only a label — no video thumbnail in minimized mode

This is an architectural composition issue, not a visual polish problem. The video *should* be the main content during a call, not a floating box.

**Missing keyboard shortcuts** for power users (answer call, open door, end call).

---

### Responsiveness — 5/10 ⚠️ Watch

**Dashboard is effectively desktop-only.** The layout uses fixed grid columns (`240px sidebar + 1fr`), a fixed-detail panel (`1fr 280px`), and a fixed-width video overlay (`640px`). The login card is `400px` wide. There are no media queries, no container queries, and no breakpoint adaptations.

For a control-room application targeting desktop monitors, this is *defensible* but worth noting. If the dashboard ever needs to run on tablets or smaller screens, it will require a re-layout pass.

**Kiosk is inherently responsive** — uses `clamp()`, `vw`/`vh`, and `min()` units. The kiosk is a fixed hardware device (likely a mounted touchscreen), so narrow viewport adaptation is less critical. However, no true responsive testing at 320px/768px has been verified.

---

### Speed — 10/10 ✅ Healthy

Standard Vite + React SPA setup. Both apps load quickly. Socket.IO provides efficient real-time updates. Google Fonts are cached after first load. No obvious layout shift, render-blocking issues, or heavy synchronous operations in the initial render path.

Recharts (admin reports) is the heaviest dependency — fine for an admin-only route, not in the critical path.

---

### Accessibility — 0/10 🔴 Critical

**This is the most significant issue across both surfaces.**

Dashboard issues:
- No landmark elements — no `<header>`, `<nav>`, or `<main>` semantics. The entire layout is a `<div id="app">` grid.
- Focus indicator styles are **entirely absent** from the CSS. The `:focus` styles on `.form-input` (`border-color: var(--ink)`) are the only visible focus states.
- The incoming call overlay and video PiP use `position: fixed` with no focus trapping, `aria-modal`, or focus management — screen reader users would lose context.
- Inline styles on the overlay bypass any accessible styling patterns.
- SVG icons (mute, end call, door) lack `aria-label` or `title` attributes.
- No keyboard shortcuts for primary actions (answer call, open door, hang up).
- The `#app` grid gives no reading order guarantees for assistive tech.

Kiosk issues:
- `user-select: none` on body is appropriate for a touch kiosk but prevents zoom selection.
- SVG icons without labels.
- Screen state transitions (idle → calling → in-call) may not announce to screen readers.
- The connection overlay may trap focus unintentionally.
- No `prefers-reduced-motion` support for the pulse/ring animations.

**Accessibility gaps affect real users** — this isn't a theoretical concern. A keyboard-only operator cannot perform primary duties efficiently.

---

## Prescriptions by Severity

| Priority | Issue | Fix |
|---|---|---|
| **Critical** | No focus indicators, no landmarks, no keyboard shortcuts | `interaction` — add focus-visible styles, ARIA landmarks, keyboard shortcuts |
| **Critical** | Video overlay lacks accessible focus management | `interaction` — trap focus, add aria-modal, label controls |
| **Watch** | Video is a detached floating window, not integrated layout | `relayout` — make video the main content during calls |
| **Watch** | Dashboard is desktop-only with no responsive adaptation | `responsive` — add breakpoint support |
| **Info** | SVG icons missing accessible labels | `surface` — add aria-labels to all icon-only buttons |

---

## Next Move

The accessibility issues are the most impactful — they need `interaction` to add focus management, landmarks, and keyboard support. The floating video pattern needs `relayout` to integrate video into the operator's primary workspace.
