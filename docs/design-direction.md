# Guestbook design direction

Guestbook is a field-evidence tool, not a dashboard and not an AI demo.

This file adapts the design discipline used in SEAL to Guestbook while keeping Guestbook's own product objects and Base Gallery foundation.

## Product objects

The interface should be composed around the things the product actually contains:

1. A guest's original words.
2. A human review of machine suggestions.
3. Repetition across distinct visits.
4. The source records behind a repeated signal.
5. A human business decision.
6. System proof for offline/model/data behavior.

Do not start a screen from generic UI patterns such as cards, KPIs, bento grids, chat chrome, or analytics panels.

## Hierarchy

Guest:
original guest expression → capture controls → what happens next.

Review:
original source → suggested signals → explicit human confirmation.

Memory:
strongest repeating pattern → source-backed visit count → other patterns.

Evidence:
selected pattern → original source records → provenance.

Decide:
human decision → reason the decision surfaced → source records → product boundary.

System:
technical state → proof/diagnostics → controls.

Counts support the object. Counts do not become the object.

## Base Gallery contract

Keep the inspected Base Gallery system:

- Uber Move for the available self-hosted product typography.
- White primary surface.
- #E8E8E8 tertiary surfaces and borders.
- #5E5E5E secondary text.
- #276EF1 focus/accent.
- 8px rectangular controls.
- 64px desktop page margins and 36px grid gutters at 1136px+.
- 36px margins/gutters for the normal grid at 600–1135.
- 16px mobile margins/gutters.
- Restrained shadows and dividers.

Do not substitute a generic shadcn/SaaS aesthetic.

## Anti-slop rules

Do not add:

- KPI cards or giant statistics as the lead object.
- Decorative 01/02/03 numbering.
- Tiny eyebrow labels on every section.
- Pill chips for ordinary navigation or counts.
- Nested rounded cards.
- Bento grids.
- Gradient, glass, orb, glow, or fake-3D decoration.
- Fake terminal or AI-thinking language.
- Generic AI chat surfaces.
- Decorative arrows after links.
- Random monospace text.
- A dashboard shell just because the product has multiple states.
- “AI-powered” chrome where the user should be looking at source evidence.

Pills are reserved for genuine compact selection/state controls. Badges are reserved for real states, not for making numbers look designed.

## Evidence behavior

Original guest words stay visually primary wherever evidence is being reviewed.

Evidence is a reading sequence, not a gallery of equal cards. Each record should make provenance legible without competing with the quotation itself.

Never replace source records with a generated summary when the original can remain visible.

## Memory behavior

A repeated signal is a finding, not a KPI.

Show the pattern first. Visit counts are supporting provenance. When a 5 → 6 accumulation moment matters, show it as a restrained evidence change, not as a dashboard metric animation.

## Decision behavior

Guestbook stops before business action.

The human decision is primary. The model may surface repetition and source records, but it must not visually imply that the model made the business decision.

## System behavior

System screens may be dense because they are technical records. Prefer compact rows, explicit labels, and proof sequences over metric cards.

Benchmark values must remain clearly described as benchmark evidence, not field accuracy.

## Motion

Motion should clarify state changes only.

No parallax, spring-card choreography, ambient decoration, cursor effects, or fake AI thinking. Respect reduced motion.

## Test

Before accepting a UI change, ask:

> Could this exact screen be dropped into a random AI SaaS product without changing the composition?

If yes, the composition is still too generic. Rebuild it around Guestbook's actual product objects.
