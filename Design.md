# Nalar Protocol — Design System

> **Scope:** Landing page + Browser Extension
>
> **Product:** Nalar Protocol — intent-aware Web3 transaction security layer.
>
> **Core design principle:** futuristic clarity without visual noise.

---

## 1. Product Design Direction

Nalar should feel like a **security infrastructure product for the next generation of Web3**.

The visual identity combines:

- **Space / cosmic atmosphere** — depth, exploration, scale, intelligence.
- **Security precision** — clear states, strong hierarchy, trustworthy feedback.
- **Editorial minimalism** — generous whitespace, restrained decoration, deliberate typography.
- **Modern Web3** — subtle technical cues without looking like a crypto dashboard.

### Keywords

`clean` · `precise` · `futuristic` · `cosmic` · `minimal` · `confident` · `calm` · `premium`

### Explicitly avoid

- Generic SaaS dashboard patterns
- Cyberpunk aesthetics
- Hacker-terminal styling
- Excessive neon
- Rainbow gradients
- Excessive glassmorphism
- Floating blobs used as decoration
- Giant glowing cards
- Excessive rounded corners
- Particle-heavy backgrounds
- Constant animations
- “AI slop” visual patterns
- Overly technical UI for normal users

---

## 2. Brand Concept

### Product philosophy

Nalar helps users understand **what they intend to do**, **what a transaction actually does**, and **whether the transaction should be allowed to continue**.

The UI should consistently communicate:

> **Understand → Verify → Decide**

The product should never feel like it is trying to scare the user. It should feel like a calm, intelligent security layer that intervenes when something deserves attention.

### Brand personality

- Intelligent, not robotic
- Firm, not aggressive
- Futuristic, not sci-fi gimmicky
- Technical, but understandable
- Premium, but not ornamental
- Protective, but not paternalistic

---

# 3. Color System

## 3.1 Primary Brand Colors

| Token | Value | Usage |
|---|---|---|
| `--nalar-blue` | `#0066FF` | Primary brand/accent color, active states, links, focus, progress |
| `--deep-void-navy` | `#0B132B` | Primary dark background, light-mode text |
| `--starlight-white` | `#FFFFFF` | Dark-mode primary text, light-mode primary surface |
| `--light-bg` | `#F8FAFC` | Light-mode secondary background |
| `--dark-bg` | `#050811` | Deep dark background |

## 3.2 Light Theme

```css
--bg: #FFFFFF;
--bg-soft: #F8FAFC;
--surface: #FFFFFF;
--surface-raised: #F1F5F9;
--border: #E2E8F0;
--border-strong: #CBD5E1;
--text-primary: #0B132B;
--text-secondary: #334155;
--text-muted: #64748B;
--accent: #0066FF;
--accent-soft: #EFF6FF;
```

## 3.3 Dark Theme

```css
--bg: #050811;
--bg-soft: #0B132B;
--surface: #101A2E;
--surface-raised: #14213A;
--border: #1E293B;
--border-strong: #334155;
--text-primary: #FFFFFF;
--text-secondary: #CBD5E1;
--text-muted: #94A3B8;
--accent: #0066FF;
--accent-soft: #0D1B34;
```

## 3.4 Semantic Colors

Semantic colors must support the brand rather than compete with it.

| State | Light | Dark | Meaning |
|---|---|---|---|
| Success | `#15803D` | `#4ADE80` | ALLOW / confirmed |
| Warning | `#B45309` | `#FBBF24` | REVIEW / attention |
| Danger | `#B91C1C` | `#F87171` | BLOCK / critical issue |
| Info | `#0066FF` | `#0066FF` | Information / active state |

### Color rules

1. `#0066FF` remains the primary identity color.
2. Red, amber, and green are **semantic**, not decorative.
3. Never make the whole interface red/amber/green for one state.
4. Use subtle surfaces and borders to reduce cognitive load.
5. Do not use glow effects as a substitute for hierarchy.

---

# 4. Typography

## 4.1 Primary Typeface

Preferred family:

**Satoshi** or the project's existing equivalent modern geometric sans-serif.

Fallback:

```css
ui-sans-serif,
system-ui,
-apple-system,
BlinkMacSystemFont,
"Segoe UI",
sans-serif;
```

## 4.2 Monospace

Use monospace only for technical values:

```css
"SF Mono",
"Cascadia Code",
"Fira Code",
ui-monospace,
monospace;
```

Use it for:

- addresses
- transaction hashes
- selectors
- chain IDs
- contract values
- technical identifiers

Do **not** use monospace for normal explanations.

## 4.3 Type hierarchy

### Display

Used sparingly on the landing page hero.

- Strong weight
- Tight line-height
- Tight letter spacing
- Large negative space around it

### Section Heading

- Bold / semibold
- Clear hierarchy
- Short

### Body

- Comfortable line-height
- 15–18px target range depending on context
- Maximum readable line length

### Extension Labels

Small uppercase labels with moderate letter spacing.

Examples:

`NALAR PROTOCOL · SECURITY`

`WHY NALAR STOPPED`

`SECURITY EVIDENCE`

Never use all-caps for long paragraphs.

---

# 5. Spacing & Layout

Use a consistent spacing scale.

Recommended base scale:

```text
4px
8px
12px
16px
24px
32px
48px
64px
96px
128px
```

### Landing page

Use generous whitespace and editorial rhythm.

### Extension

Use compact spacing without making the interface dense.

The extension is a **compressed product surface**, not a miniature copy of the landing page.

---

# 6. Radius & Surfaces

Use moderate radii.

Recommended:

```text
Small: 6px
Medium: 8px
Large: 12px
```

Avoid excessive pill shapes.

Pills are appropriate only for:

- status badges
- small semantic labels
- network labels

Cards should not look like stacks of rounded floating containers.

Prefer:

- subtle border
- surface contrast
- whitespace
- typography hierarchy

---

# 7. Landing Page Design

## 7.1 Overall Direction

The landing page should communicate Nalar as a **serious security layer**, not a speculative crypto product.

Use:

- dark-first visual direction
- light mode support
- cosmic depth as a subtle atmosphere
- restrained electric-blue highlights
- editorial typography
- technical diagrams used as explanation, not decoration

## 7.2 Hero

The hero should communicate the product in one glance.

Recommended content structure:

```text
[NALAR PROTOCOL]

KNOW WHAT
YOU'RE SIGNING.

Nalar analyzes Web3 transactions before you approve them.
Understand your intent, inspect the transaction,
and catch dangerous behavior before it reaches your wallet.

[Try Nalar]     [View Demo]
```

### Hero visual

Use an abstract transaction/security visualization:

```text
INTENT
   ↓
TRANSACTION
   ↓
ANALYSIS
   ↓
DECISION
```

Do not use stock hacker imagery.

## 7.3 Landing page sections

Recommended sequence:

1. Hero
2. Problem / why transaction signing is difficult
3. How Nalar works
4. Intent vs Actual Transaction
5. Security Intelligence
6. Decision Engine
7. BNB Agent / on-chain investigation
8. Browser Extension experience
9. Architecture
10. Final CTA

## 7.4 Space / Cosmic treatment

The cosmic theme should be subtle:

- faint radial lighting
- tiny controlled star points
- very low-opacity grid
- depth created with gradients and surface contrast
- electric-blue lines used as signal paths

Avoid:

- giant planets
- galaxy photos
- cartoon stars
- excessive star fields
- glowing sci-fi interfaces

The space theme represents **exploration + scale + intelligence**, not science-fiction decoration.

---

# 8. Browser Extension Design

## 8.1 Core principle

The extension is a **security intervention**.

The user should understand the result in approximately 3–5 seconds.

Primary hierarchy:

```text
DECISION
↓
WHY
↓
YOUR REQUEST VS ACTUAL
↓
WHAT THIS MEANS
↓
SECURITY EVIDENCE
↓
TECHNICAL DETAILS
```

## 8.2 Decision Header

### BLOCK

```text
NALAR PROTOCOL · SECURITY

BLOCKED
Nalar stopped this transaction.

90 / 100   CRITICAL
```

### REVIEW

```text
NALAR PROTOCOL · SECURITY

REVIEW REQUIRED
Nalar needs you to review this transaction.

65 / 100   HIGH
```

### ALLOW

```text
NALAR PROTOCOL · SECURITY

SAFE TO CONTINUE
No blocking security condition was found.
```

Risk score should remain secondary to the explanation.

## 8.3 Why section

Primary question:

> **Why was this stopped?**

Keep it short.

Example:

> You asked to swap tBNB for DHON, but this transaction asks for NFT permission instead.

Do not dump all internal findings here.

## 8.4 Intent vs Actual

This is one of the strongest Nalar differentiators.

```text
YOUR REQUEST              ACTUAL TRANSACTION
Swap tBNB → DHON          NFT approval

          ✕ DOESN'T MATCH
```

Only show important differences.

Example:

```text
Receive token
Expected: DHON
Actual: BUSD
```

Do not force users to read raw comparison objects.

## 8.5 What This Means

This section answers:

> “Why should I care?”

Example:

> Signing this request would perform a different action from the one you intended.

Maximum 2–3 sentences unless the situation genuinely needs more context.

## 8.6 Evidence

Default state:

```text
▸ Security evidence
```

Expanded state:

```text
Sell tax       98%       ON-CHAIN
Owner control  Detected  ON-CHAIN
Simulation     Passed    SIMULATION
Intent         Mismatch  INTENT
```

Evidence should feel factual, not alarming.

## 8.7 Technical Details

Default state:

```text
▸ Technical details
```

Show:

- chain
- contract
- function
- selector
- simulation
- risk score
- addresses
- finding codes
- BNB MCP status

Technical information is secondary.

---

# 9. Extension Loading Experience

Do not use a generic spinner.

Use an intentional security-analysis sequence:

```text
ANALYZING TRANSACTION

✓ Understanding your request
✓ Decoding transaction
● Simulating execution
○ Checking contract
○ Reviewing on-chain evidence
○ Evaluating security
```

### Animation rules

- Current item: stronger contrast + electric blue indicator.
- Completed item: muted + check.
- Pending item: low contrast.
- Use a subtle moving progress rail.
- No fake percentage unless backed by actual progress.
- No infinite decorative loops.

The animation should communicate **system state**, not theatrical AI behavior.

---

# 10. Motion System

Motion is part of the product language.

### Motion principle

> **Animate state changes, not decoration.**

Recommended durations:

```text
Instant: 100ms
Fast: 150ms
Normal: 220ms
Enter: 300ms
Slow: 400ms
```

Recommended easing:

```css
cubic-bezier(0.2, 0.8, 0.2, 1)
```

### Modal entry

```text
opacity: 0 → 1
transform: translateY(10px) scale(.985) → translateY(0) scale(1)
```

Duration:

`250–320ms`

### Modal exit

`150–220ms`

### Button interaction

Hover:

- subtle surface change
- slight brightness change

Active:

```text
scale: .98
```

Duration:

`120–160ms`

### Pause / Active state

ACTIVE:

- electric blue indicator
- clear contrast
- subtle one-time pulse on transition

PAUSED:

- muted surface
- amber/neutral indicator
- no continuous warning animation

### Accordion

- arrow rotates
- opacity transition
- content reveal
- no bounce

---

# 11. Reduced Motion

Always support:

```css
@media (prefers-reduced-motion: reduce) {
  /* disable non-essential motion */
}
```

When enabled:

- remove decorative motion
- remove pulses
- reduce transforms
- preserve functional state changes

---

# 12. Accessibility

### Color

Do not communicate meaning using color alone.

Examples:

```text
BLOCKED + icon + label
REVIEW + icon + label
ALLOW + icon + label
```

### Focus

Use a visible focus ring based on `#0066FF`.

### Keyboard

All interactive controls must be keyboard accessible.

### Text

Do not sacrifice readability for visual minimalism.

---

# 13. Address & Explorer Links

All valid EVM addresses displayed in analysis results should be clickable.

### Display

```text
0x53E9...7817 ↗
```

### Rules

- Shorten addresses in primary UI.
- Keep full address in `title` / accessible label.
- Use the explorer matching the current chain.
- Use blue as the link accent.
- Hover: subtle underline or brightness change.
- Never make addresses oversized buttons.

### Supported chains

#### BNB Smart Chain Testnet

```text
Chain ID: 97
Native asset: tBNB
Explorer: https://testnet.bscscan.com/
```

#### BNB Smart Chain Mainnet

```text
Chain ID: 56
Native asset: BNB
Explorer: https://bscscan.com/
```

Never mix evidence or explorer links across networks.

---

# 14. Network UX

The current network should always be visible where relevant.

Example:

```text
BNB TESTNET · 97
```

or:

```text
BNB MAINNET · 56
```

Network state is not a risk state.

Do not make Mainnet visually look “dangerous”.

Unsupported network:

```text
NETWORK NOT SUPPORTED

Nalar currently analyzes transactions on BNB Smart Chain.
Switch to BNB Testnet or BNB Mainnet to continue.
```

---

# 15. Copywriting Guidelines

## Use plain language

Prefer:

> This doesn't match what you asked for.

Instead of:

> Intent mismatch detected.

Prefer:

> Nalar could not verify a smart contract at this address.

Instead of:

> Contract target classified as EOA.

Prefer:

> This transaction gives another address permission to manage your NFTs.

Instead of:

> Action NFT_APPROVAL is forbidden by policy.

## Never overstate evidence

If the contract reports a configured 98% sell tax:

> The token contract reports a configured 98% sell tax.

Not:

> You will lose 98% of your money.

Unless simulation actually proves that exact outcome.

---

# 16. AI Explanation Design

AI is an **explanation layer**, not the security authority.

The deterministic engine decides:

```text
ALLOW
REVIEW
BLOCK
```

AI translates verified facts into human language.

### Explanation hierarchy

```text
FACT
↓
MEANING
↓
POTENTIAL IMPACT
```

AI must not:

- change the decision
- change risk score
- invent evidence
- invent transaction outcomes
- invent mismatch fields
- turn uncertain outcomes into certainty

---

# 17. Security Decision Architecture

The product visual layer must reflect the actual system architecture.

```text
User Intent
    ↓
Transaction Decode
    ↓
Simulation
    ↓
Effects / State
    ↓
BNB Agent
    ↓
BNB MCP
    ↓
Evidence
    ↓
Risk / Policy / Intent
    ↓
Decision
    ↓
Human Explanation
```

The design should never imply that:

```text
AI → decides BLOCK
```

Instead:

```text
Security Engine → decides
AI → explains
```

---

# 18. Component Rules

## Buttons

- Primary blue button for the main action.
- Secondary action uses surface/border treatment.
- No excessive pill buttons.
- Active state: subtle scale.
- Focus state: blue outline.

## Badges

Use only when they communicate a real semantic state.

Good:

`CRITICAL`, `HIGH`, `ON-CHAIN`, `MATCH`

Bad:

decorative badges everywhere.

## Icons

Use minimal line/geometric icons.

Do not mix many icon styles.

## Dividers

Use subtle lines to separate hierarchy, not to create card grids.

---

# 19. Landing ↔ Extension Consistency

Both products share:

- Color tokens
- Typography
- Radius philosophy
- Border treatment
- Motion language
- Accent color
- Space/cosmic visual atmosphere
- Security state language

But they serve different purposes.

### Landing page

**Explain the product.**

### Extension

**Protect the user during a transaction.**

Therefore:

Landing page = editorial / expansive

Extension = compact / action-oriented

---

# 20. Cosmic Theme Guidelines

The space theme is a metaphor for:

- exploration
- scale
- intelligence
- unknown risk
- navigation
- clarity in complexity

Use subtle cosmic cues:

- faint star points
- quiet radial gradients
- dark depth
- thin orbital/trajectory lines
- controlled blue light
- subtle grid

Do not use:

- literal planets
- galaxy photos
- astronaut illustrations
- giant stars
- sci-fi cockpit UI
- excessive particles

The user should notice **Nalar first**, the cosmic theme second.

---

# 21. Responsive Behavior

## Landing

Desktop-first but fully responsive.

## Extension

Optimize for constrained popup width.

Rules:

- no horizontal overflow
- long addresses truncate
- long explanations wrap naturally
- comparison stacks vertically when width is tight
- footer actions remain accessible
- technical content collapses rather than creating excessive height

---

# 22. Performance Rules

Prefer GPU-friendly animation properties:

```text
transform
opacity
```

Avoid continuously animating:

```text
width
height
top
left
box-shadow
filter
```

Do not keep animation loops alive after overlays close.

Do not create unnecessary DOM nodes for decorative effects.

---

# 23. Engineering Boundaries

UI work must not change the security architecture without explicit reason.

Do not modify security behavior merely to improve visuals.

Keep these responsibilities separated:

```text
Backend
→ facts + security decision

AI
→ explanation

Extension
→ presentation + interaction

Landing page
→ product communication
```

---

# 24. Final Quality Checklist

Before shipping a design update:

### Visual

- [ ] Does it look unmistakably like Nalar?
- [ ] Is Cosmic Electric Blue used as the main accent?
- [ ] Are light and dark themes coherent?
- [ ] Is the cosmic theme subtle?
- [ ] Does the interface avoid generic SaaS patterns?

### UX

- [ ] Can a user understand BLOCK in a few seconds?
- [ ] Can a user understand REVIEW quickly?
- [ ] Is intent vs actual immediately visible?
- [ ] Is the primary reason obvious?
- [ ] Are technical details hidden by default?
- [ ] Is repeated information removed?

### Motion

- [ ] Does every animation communicate state/change?
- [ ] Are animations short and restrained?
- [ ] Is there no unnecessary looping?
- [ ] Does reduced-motion work?

### Technical

- [ ] No horizontal overflow
- [ ] No broken explorer links
- [ ] Correct network-specific explorer
- [ ] No runtime animation leaks
- [ ] No accessibility regressions
- [ ] Existing security behavior remains unchanged

---

# 25. Design North Star

Nalar should feel like:

> **A calm, intelligent security layer between the user and the blockchain.**

The interface should not overwhelm the user with everything Nalar knows.

It should surface exactly what the user needs to understand:

```text
What did I intend?
        ↓
What does this transaction actually do?
        ↓
What did Nalar find?
        ↓
Why was it allowed, reviewed, or stopped?
        ↓
What should I understand before continuing?
```

That is the core UX of Nalar Protocol.
