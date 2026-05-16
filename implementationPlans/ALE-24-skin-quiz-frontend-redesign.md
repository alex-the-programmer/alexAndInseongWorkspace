# ALE-24 Skin Quiz Frontend Redesign

## Context

The quiz backend is fully generic — the same model, interactions, and GraphQL operations cover any quiz. The production `quizRunner.tsx` intentionally keeps that shape. However its visual presentation is a plain card-in-container layout that doesn't match the Hubble prototype (`commercePlatformMocks/hubble/components/skin-quiz.jsx`), which has a rich full-screen 2-column design.

Goal: restyle `quizRunner.tsx` to match the prototype's aesthetic while keeping every line of business logic (GraphQL, state, answer types, validation) exactly as-is.

User decisions:
- Light/dark follows the app's existing mode toggle (not always-dark)
- Results screen: profile summary full-width, no recommendations panel yet
- "Skip — just chat" / "Save & exit" omitted until flows exist

---

## Gap Analysis (Prototype vs Production)

| Area | Production today | Prototype target |
|---|---|---|
| Outer layout | Card inside padded container | Full-screen, no card chrome |
| Background | Light cream / dark per mode | Follows app mode (already works) |
| Progress header | None — CardHeader shows "Q X of Y" | Logo · "STEP 01 / 06" mono · progress bar |
| Intro | Simple card + count text + Start button | Large serif headline · orb · subtitle · Start/Retake |
| Question layout | Single column card | 2-column: left = prompt + back/continue, right = input |
| SingleChoice | Orange border/bg, no glyph | Glyph slot (emoji) + checkmark circle on selected |
| MultiChoice | Vertical list | 2-col chip grid + checkbox squares + mono counter |
| BudgetInput | Range slider, no tier badge | + tier context badge from `configJson.tierLabel` |
| RoutineInput | AM/PM simple list | ☀/☾ headers, ●/○ toggles, step count badge |
| AvoidInput | Pills + FormInput | +/× toggle pill style, dashed-border textarea |
| Loading | Plain text | Orb + animated multi-phase checklist |
| Results | Q&A list | Profile card (skin type, concerns, budget, avoids, loves) |

---

## Critical Files

- **`components/quizRunner.tsx`** — only file that changes (all visual rework here)
- **`app/globals.css`** — add `@keyframes quizSpin` and `.quiz-progress-bar` animation
- **`components/hubbleLogoMark.tsx`** — reuse as-is for the progress header logo
- **`theme.ts`** — all color/font tokens already present, no changes needed

---

## Implementation Plan

### 1. CSS additions (`app/globals.css`)

Add two utility keyframes/classes:

```css
@keyframes quizSpin {
  to { transform: rotate(360deg); }
}
.quiz-loading-spin {
  animation: quizSpin 0.9s linear infinite;
}
```

No other global changes — all layout stays inline.

---

### 2. Intro screen (`phase === "intro"`)

Replace the Card+CardHeader with a full-screen centered panel:

```
┌─────────────────────────────────────────┐
│                                         │
│         [HubbleLogoMark 48px]           │
│                                         │
│   {quiz.introTitle}                     │  ← Instrument Serif, clamp(44px,6vw,72px)
│                                         │
│   {quiz.introSubtitle}                  │  ← text-muted, 16px, max-width 480px
│                                         │
│   [Start quiz]   [Retake quiz]          │  ← existing Button components
│                                         │
└─────────────────────────────────────────┘
```

- Outer: `minHeight: "100svh"`, `display: flex`, `flexDirection: column`, `alignItems: center`, `justifyContent: center`, `padding: "0 24px"`, `background: theme.colors.background`
- Headline: `fontFamily: theme.font.display`, `fontSize: "clamp(44px, 6vw, 72px)"`, `letterSpacing: "-0.03em"`, `textAlign: center`
- "N questions" line removed — not needed visually

---

### 3. Progress header (quiz phase only)

A fixed-position header rendered at the top when `phase === "quiz"`:

```
┌──────────────────────────────────────────────────────────┐
│  [HubbleLogoMark]  HUBBLE    STEP 01 / 06                │
│══════════════════▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ← accent-colored bar
└──────────────────────────────────────────────────────────┘
```

- `position: fixed`, `top: 0`, `left: 0`, `right: 0`, `zIndex: 100`
- `background: theme.colors.navBg`, `backdropFilter: blur(12px)`
- `borderBottom: 1px solid theme.colors.navBorder`
- Logo + "HUBBLE" wordmark on left
- Step label center: `font-family: theme.font.sans`, monospaced via `fontVariantNumeric: "tabular-nums"`, `fontSize: 11`, `letterSpacing: "0.1em"`, `textTransform: "uppercase"`, `color: theme.colors.textMuted`
- Progress bar: absolute bottom edge, `height: 2px`, `background: theme.colors.accent`, `width: {stepProgress}%`, `transition: width 0.3s ease`
- `stepProgress = ((stepIndex + 1) / questions.length) * 100`

---

### 4. 2-column question layout

Replace Card with a full-screen grid:

```
┌────────────────────────────────┬─────────────────────────┐
│  [orb 28px]                    │                         │
│  Hubble is asking · Q{N}       │   [Answer surface]      │
│                                │                         │
│  {question.prompt}             │                         │
│  {question.helperText}         │                         │
│                                │                         │
│  [Back]  [Continue →]          │                         │
└────────────────────────────────┴─────────────────────────┘
```

- Outer: `display: grid`, `gridTemplateColumns: "1fr 1.1fr"`, `minHeight: "100svh"`, `paddingTop: 64` (header height), `maxWidth: 1360`, `margin: "0 auto"`, `gap: 0`
- Left column: `padding: "56px 48px"`, `display: flex`, `flexDirection: column`
  - Step label: `fontSize: 11`, `letterSpacing: "0.1em"`, `textTransform: uppercase`, `color: theme.colors.textMuted`, `fontVariantNumeric: tabular-nums`
  - Prompt: `fontFamily: theme.font.display`, `fontSize: "clamp(28px, 3.8vw, 48px)"`, `lineHeight: 1.1`, `letterSpacing: "-0.02em"`, `color: theme.colors.textPrimary`, `marginTop: 20`
  - Helper text: `fontSize: 15`, `color: theme.colors.textMuted`, `marginTop: 10`
  - Buttons pinned to bottom via `marginTop: auto`, `paddingTop: 32`, `display: flex`, `gap: 10`
- Right column: `padding: "56px 40px"`, `display: flex`, `alignItems: "flex-start"`, `borderLeft: 1px solid theme.colors.borderSubtle`

Responsive: on narrow viewports (<768px), collapse to single column stacked layout.

---

### 5. `SingleChoiceInput` — glyph slot + checkmark

Config can supply `option.glyph` (emoji or text). The existing `option.helperText` maps to subtitle.

```
[  🔴  ]  Option label          [✓]   ← selected
          Option helper text
```

- Button: `display: flex`, `alignItems: center`, `gap: 14`, `padding: "16px 18px"`, `borderRadius: 14`
- Glyph slot: `width: 40`, `height: 40`, `borderRadius: 10`, `background: theme.colors.surface`, `display: flex/center` — render `option.label.slice(0,2)` as fallback if no glyph field
- Actually: keep glyph slot only if `option.glyph` exists in a parsed `configJson`. If not present, render without glyph (the generic case).
- Checkmark: right-aligned circle 22px, `background: theme.colors.accent`, white `✓` when selected; `border: 1px solid theme.colors.borderSubtle` when not selected
- Selected state: `background: theme.colors.accentBgLight`, `border: 1px solid theme.colors.accentBorder`

---

### 6. `MultiChoiceInput` — 2-column chip grid + checkbox

```
┌─────────────┐  ┌─────────────┐
│ ☐ Option A  │  │ ☑ Option B  │   ← 22px checkbox square
└─────────────┘  └─────────────┘
2/4 SELECTED · pick at least one     ← mono label below
```

- Grid: `display: grid`, `gridTemplateColumns: "1fr 1fr"`, `gap: 8`
- Each chip: `borderRadius: 12`, `padding: "10px 14px"`, `display: flex`, `alignItems: center`, `gap: 10`
- Checkbox: 22×22px square, `borderRadius: 5`, `border: 1px solid`, accent-filled with `✓` when selected
- Counter: `fontSize: 11`, `letterSpacing: "0.08em"`, `textTransform: uppercase`, `color: theme.colors.textMuted`, `marginTop: 4`
  - Format: `{count}/{maxSelections} SELECTED` (show only when `maxSelections` is finite)

---

### 7. `BudgetInput` — tier badge

Parse `question.configJson` for `tierLabel` (string to display below the `$low – $high` display):

```typescript
const config = safeJsonParse<{ min?; max?; defaultLow?; defaultHigh?; tierLabels?: Array<{ upTo: number; label: string }> }>(question.configJson);
```

Derive the active tier label by checking which `upTo` threshold the current `high` value falls under.

Render below the `$low – $high` heading:
```
$30 – $80 per product
Mid-tier · the sweet spot
```
- Badge: `display: inline-flex`, `borderRadius: 999`, `padding: "4px 10px"`, `fontSize: 12`, `background: theme.colors.accentBg`, `color: theme.colors.textSubtle`, `marginTop: 6`

---

### 8. `RoutineInput` — icons + step count + ●/○

```
☀  Morning         ☾  Evening
5 steps            3 steps
[ ● Cleanser  ]    [ ○ Oil cleanser ]
[ ○ Toner     ]    [ ● Cleanser     ]
```

- Column header: emoji (☀/☾) + "Morning"/"Evening" label + step count badge (`{count} steps`)  
  Step count badge: `fontSize: 11`, `letterSpacing: "0.06em"`, `background: theme.colors.surfaceSubtle`, `borderRadius: 999`, `padding: "2px 8px"`
- Toggle button: `display: flex`, `alignItems: center`, `gap: 8`
  - Leading icon: `●` (filled circle, `color: theme.colors.accent`) when active; `○` (open circle, `color: theme.colors.textMuted`) when inactive

---

### 9. `AvoidInput` — +/× pill toggle + dashed textarea

- Each pill: when not selected shows `+ Label`, when selected shows `Label ×` — swap icon on state
  - Selected: `background: theme.colors.accentBg`, `border: 1px solid theme.colors.accentBorder`
  - Not selected: `background: transparent`, `border: 1px solid theme.colors.borderSubtle`
- Notes: replace `FormInput` with a `<textarea>` styled with `border: 1px dashed theme.colors.borderMuted`, `borderRadius: 10`, `background: transparent`, `padding: "10px 12px"`, `fontSize: 14`, `color: theme.colors.textPrimary`, `resize: vertical`

---

### 10. Loading screen

```
         [HubbleLogoMark 48px]

   Building your profile…         ← Instrument Serif, 32px

   ✓  Analyzing your skin type
   ✓  Mapping your concerns
   ↻  Matching your budget         ← spinning icon (last active)
   ○  Checking your routine        ← upcoming
   ○  Reviewing ingredient flags
   ○  Preparing recommendations
```

- Phases: hardcoded list of 6 generic labels (these don't interact with backend, just cosmetic UX)
- Animate: `useEffect` with `setInterval` advancing active phase index every 600ms
- Completed: `✓` in accent color
- Active: `↻` with `animation: quizSpin 0.9s linear infinite` (CSS class added in step 1)
- Upcoming: `○` in `text-muted`
- Phase label text: `fontSize: 14`, `color: phase < activeIdx ? textPrimary : textMuted`
- Headline: `fontFamily: theme.font.display`, `fontSize: "clamp(24px, 3vw, 36px)"`

---

### 11. Results screen

Replace the Q&A list with a profile summary card:

```
┌──────────────────────────────────────────────┐
│  Your skin profile                           │
│                                              │
│  Skin feel      Reactive / sensitive         │
│  Concerns       Redness, Dehydration         │
│  Budget         $30 – $80 per product        │
│  Routine        AM 4 steps · PM 3 steps      │
│  Loves          Beauty of Joseon...          │
│  Avoiding       Fragrance, SLS               │
│                                              │
│  [Retake quiz]                               │
└──────────────────────────────────────────────┘
```

- Outer: full-width, no Card, `paddingTop: 80`, `paddingInline: 24`, `maxWidth: 680`, `margin: "0 auto"`
- Heading: `fontFamily: theme.font.display`, `fontSize: "clamp(28px, 4vw, 44px)"`, `marginBottom: 32`
- Each row: `display: flex`, `justifyContent: space-between`, `padding: "14px 0"`, `borderBottom: 1px solid theme.colors.borderSubtle`
- Label: `fontSize: 13`, `textTransform: uppercase`, `letterSpacing: "0.08em"`, `color: theme.colors.textMuted`
- Value: `fontSize: 15`, `color: theme.colors.textPrimary`, reuse `answerLabelByQuestion` helper (already exists)

---

## Responsive Breakpoint

At `maxWidth: 767px`:
- Collapse 2-column question layout → single column (prompt on top, input below)
- Left column buttons move inline below the prompt
- Progress header step label hides to save space

Implement via a `useWindowWidth` hook or CSS media query via `<style>` tag inside the component.

---

## Verification

1. Run `npm run dev` in `commerce-platform-frontend`
2. Navigate to `/quizzes/skin` (or whatever the skin quiz URL path is)
3. Check each phase: intro → question 1–6 → loading → results
4. Toggle dark mode — all phases should adapt correctly
5. Resize to 375px width — verify single-column layout
6. Confirm GraphQL queries still fire correctly (Network tab)
7. No TypeScript errors (`npm run build` or `tsc --noEmit`)

---

## TODO

- [ ] Add `@keyframes quizSpin` + `.quiz-loading-spin` to `app/globals.css`
- [ ] Redesign intro phase in `QuizRunner`
- [ ] Build `QuizProgressHeader` component (inline in `quizRunner.tsx`)
- [ ] Redesign quiz question phase — 2-column layout
- [ ] Update `SingleChoiceInput` — glyph slot + checkmark
- [ ] Update `MultiChoiceInput` — 2-col chip grid + checkbox squares
- [ ] Update `BudgetInput` — tier badge from configJson
- [ ] Update `RoutineInput` — ☀/☾ headers, ●/○ toggles, step count
- [ ] Update `AvoidInput` — +/× pill toggles, dashed textarea
- [ ] Redesign loading phase — orb + animated checklist
- [ ] Redesign results phase — profile summary card
- [ ] Responsive: single-column collapse at 767px
- [ ] Verify all phases with dark mode toggle
- [ ] `npm run build` passes with no TypeScript errors
