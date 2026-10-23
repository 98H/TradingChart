# Feature Specification: Internationalisation, RTL and Mobile

**Feature Branch**: `011-i18n-rtl-mobile` (retrofit)

**Created**: 2026-10-23

**Status**: Implemented (retrofit spec, 2026-10-23)

**Input**: Founder intent (reconstructed): "Chartivia is bilingual from the core: every screen works fully in formal Persian (right-to-left, Persian digits, Vazirmatn) and in English, switchable instantly anywhere without reload — and every screen works on a phone with touch-friendly controls, no overflow and nothing hidden."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch language anywhere (Priority: P1)

A user switches between English and Persian from the topbar, the settings dialog, the command palette or the trader profile; the whole app re-renders in the chosen language and direction immediately, and the choice is remembered.

**Why this priority**: Most target users are Persian speakers; the language must never be half-translated.

**Independent Test**: In English open several panels, switch to Persian, and confirm direction rtl, Persian labels everywhere and zero untranslated strings; reload and confirm Persian persists.

**Acceptance Scenarios**:

1. **Given** English, **When** the user clicks FA/EN, **Then** `html` gets `lang="fa"` and `dir="rtl"`, Persian fonts apply, and every open view, dialog and panel re-renders in Persian without reload.
2. **Given** the settings dialog, **When** the user selects Persian and saves, **Then** the same switch happens; the command palette action "Toggle Language FA/EN" does likewise.
3. **Given** Persian chosen, **When** the page reloads, **Then** it starts in Persian.
4. **Given** Persian, **Then** the chart's month and weekday labels and the data-window fields (Open, High, Low, Close, Volume, Time, Change) are shown in Persian while numbers stay left-to-right.

---

### User Story 2 - Correct numbers and direction in Persian (Priority: P1)

In Persian, counts, prices and badges use Persian digits where text is shown, while the chart canvas, the code editor and numeric cells keep left-to-right tabular digits; brand names and code stay Latin.

**Acceptance Scenarios**:

1. **Given** Persian, **Then** text counters (indicator counts, alert badges, layout counts, gold and TSE figures) show Persian digits ۰-۹.
2. **Given** Persian, **Then** the Pine editor, the chart canvas and numeric cells remain ltr with Latin tabular digits.
3. **Given** the full-surface leak audit in Persian on desktop and mobile, **Then** zero untranslated user-facing Latin strings are found outside the allowed brand/code list.

---

### User Story 3 - Use the app on a phone (Priority: P1)

On a phone (≤ 768 px) the user reaches every function: the chart's mobile bar (symbol, timeframe, indicators, drawings, more, settings), the "more" bottom sheet with panels, full-screen panel sheets with a drag handle and a 44 px close button, the panels menu as a bottom drawer, the minimised quick-trade pill, the scale controls above the time axis, and header buttons for layouts and full screen.

**Acceptance Scenarios**:

1. **Given** a 390×844 viewport, **When** the user taps the mobile bar's "more" button, **Then** a bottom sheet opens with Undo, Redo, Screenshot and panel rows; in Persian its rows are right-aligned with mirrored chevrons.
2. **Given** a panel row (e.g. Watchlist), **When** tapped, **Then** the panel opens as a full-width sheet below the header with a ≥ 44 px close button that closes it.
3. **Given** the mobile header, **Then** layout and full-screen buttons are present and work; the header has no horizontal overflow.
4. **Given** "+ Panels" on mobile, **Then** the menu opens as a bottom drawer (max 75 % height) with one-column items at least 44 px tall.
5. **Given** the indicators button on the mobile bar, **Then** the app's own indicators dialog (with Persian names) opens instead of the engine's default dialog.

---

### User Story 4 - Medium screens (Priority: P2)

On tablets and small laptops (769–1380 px) the header stays on one line without overflow by hiding secondary buttons and labels.

**Acceptance Scenarios**:

1. **Given** widths 769–1100 px and 1101–1380 px, **Then** the header shows no overflow and no wrapping; secondary buttons/labels are hidden as designed.

---

### User Story 5 - Landing page and admin console languages (Priority: P2)

The landing page starts in Persian and can switch to English (with Persian-digit prices); the admin console starts in Persian and has its own language switch.

**Acceptance Scenarios**:

1. **Given** the landing page, **When** the user clicks EN / فا, **Then** all texts, aria labels and price formatting switch and the choice is shared with the app.
2. **Given** the admin console, **When** the language is switched, **Then** the console re-renders with localized menus and numbers and remembers the choice.

---

### Edge Cases

- Missing translation key → English text is used, then the key itself (never an empty label).
- Platform announcement → shown in the user's language with rtl direction in Persian.
- Unknown route → a Persian/rtl 404 page "صفحه پیدا نشد · Chartivia".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST support English and Persian, switchable from the topbar FA/EN button, the settings dialog, the command palette and the trader profile, and MUST persist the choice in `tradingchart_user_settings.language` (synced for signed-in users).
- **FR-002**: Switching language MUST set `html[lang][dir]` (`fa`/`rtl` or `en`/`ltr`), apply the Persian font class, re-render every mounted view, dialog and panel, and emit a `tc:languagechange` event, without page reload.
- **FR-003**: Persian MUST cover the chart engine's chrome, tooltips, drawing tools, harmonic patterns, context menus, mobile drawer, axis month/weekday names and data-window field names, keeping numbers ltr.
- **FR-004**: Persian text MUST use the formal register with correct ZWNJ (including the 114+ indicator names and descriptions), Persian digits for textual numbers, and ltr tabular digits for the canvas, code editor and numeric cells.
- **FR-005**: Translation lookup MUST fall back to English and then to the key; no user-facing label may render empty.
- **FR-006**: Fonts (Vazirmatn, Inter, JetBrains Mono) MUST be self-hosted with fallback stacks; no external font CDN may be used.
- **FR-007**: On viewports ≤ 768 px: the floating desktop docks MUST give way to the engine's mobile bar; the "more" sheet MUST list actions and panels (rtl-aware in Persian); panels MUST open as full-width sheets with a drag handle and a ≥ 44 px close button; the panels menu MUST be a bottom drawer with ≥ 44 px items; the quick-trade widget MUST start as a pill above the time axis; scale controls MUST sit above the time axis with ≥ 36 px buttons; the header MUST offer layouts and full-screen buttons.
- **FR-008**: The mobile bar's indicators button MUST open the app's indicators dialog.
- **FR-009**: Between 769 px and 1380 px the header MUST not overflow or wrap.
- **FR-010**: The landing page MUST start in Persian (rtl), switch to English via its toggle (texts, aria labels, prices), and share the language preference with the app.
- **FR-011**: The admin console MUST start in Persian, switch language from the gate and the sidebar, format numbers and dates per language, and remember the choice in `tc_admin_lang`.
- **FR-012**: The server's unknown-route page MUST be a Persian rtl 404 page.

### Key Entities

- **Language Preference**: `en` | `fa`, stored in user settings (app, landing) and `tc_admin_lang` (console).
- **Translation Dictionaries**: app EN/FA dictionary, chart-engine Persian dictionary, indicator Persian names and descriptions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Persian leak audit finds 0 untranslated user-facing strings on desktop and mobile.
- **SC-002**: A language switch completes (all visible labels updated) within 1 s with zero console errors.
- **SC-003**: At 390×844, 100% of interactive controls of the mobile bar, sheets and drawers are at least 44×44 px (scale buttons ≥ 36 px), and the header has 0 px horizontal overflow.
- **SC-004**: At 1440, 1280, 1024 and 820 px widths the header has 0 px overflow.

## Assumptions

- The UI probe (`.sdd/config.json` uiProbe) measures overflow, covered controls, touch-target size and untranslated text on `/` and `/chart` in both languages and both viewports; its 2026-10-23 baseline found 11 sub-44 px targets on the mobile chart, recorded for Converge.
- Known gaps for Converge: untranslated `title`/`aria-label` attributes on six header buttons; hard-coded "2 Active" alert badge in the mobile drawer; the mobile full-screen button's active state not updated; a data-window patch timer that never stops; a redundant double re-render of gold/TSE on language switch; the 404 page always Persian; unused i18n imports in nine modules.
