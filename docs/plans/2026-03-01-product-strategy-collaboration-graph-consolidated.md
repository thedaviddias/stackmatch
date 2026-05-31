# Stackmatch Product Strategy: Collaboration Graph (Consolidated v2)

## Context
This document consolidates and improves the imported source plan:

- Source: `docs/plans/product-strategy-collaboration-graph.source.md`
- Product baseline: Stackmatch currently finds stack similarity from `package.json` data and surfaces stackmates.

## Executive Summary
The source strategy is directionally strong: it turns passive repo data into active collaboration loops. The strongest idea is a verified review-exchange loop that creates daily utility and retention.

The main risk is sequencing. The plan combines identity modeling, tri-modal matching, quest systems, trust scoring, LLM quality checks, and virality in one pass. That is too much for current product maturity. This consolidated version keeps the core thesis but stages complexity by evidence.

## Pros (What To Keep)
1. Clear product thesis: move from static matching to collaboration outcomes.
2. Strong engagement loop: Match -> Action -> Verification -> Reputation.
3. Useful segmentation: similar, complementary, and adjacent/mentorship matches.
4. Trust-aware design: anti-spam controls and verification are considered early.
5. Good viral surfaces: profile artifacts and badges map to developer behavior.

## Cons (What To Fix)
1. Overly broad initial scope. It tries to ship identity science, recommendation systems, quest economy, and verification at once.
2. Ambiguous target user. "Developers" is too broad; the plan needs a strict ICP for phase 1.
3. Weak success metrics. It lacks concrete activation, retention, and quality thresholds.
4. High infra cost too early. Full GitHub webhook verification + LLM comment scoring in MVP is expensive.
5. Rebrand decision is unresolved. Naming/legal/SEO risk is acknowledged but not time-boxed.

## Consolidated Strategy
### Product Positioning
Stackmatch is a **developer collaboration router**:
- Input: repository stack signals + user collaboration intent.
- Output: high-confidence people/project matches with one concrete next action.

### Initial ICP (Phase 1)
Focus on one wedge only:
- JavaScript/TypeScript developers active in OSS or public side projects.
- Goal: find review partners and issue collaborators within 24 hours of signup.

### Core Loop (Single Loop First)
1. Compute stack similarity (existing strength).
2. Collect explicit intent (`review_exchange`, `project_buddy`, `mentorship`).
3. Generate one high-confidence collaboration suggestion per user/day.
4. Capture completion signals and peer feedback.
5. Update reputation lanes with decay.

## Prioritized Roadmap
### Phase 0 (0-3 weeks): Foundation and Risk Closure
1. Import and publish strategy docs (done in this repo).
2. Resolve naming risk with a hard decision date:
   - Legal/SEO check.
   - Decide: keep `Stackmatch` or pivot before growth work.
3. Define product KPIs and instrumentation events.
4. Keep scope to JS/TS package ecosystem; do not expand language coverage yet.

### Phase 1 (Weeks 4-8): Review Exchange MVP
1. Add intent modes to profile.
2. Introduce daily "best next collaboration action" card.
3. Start with lightweight verification:
   - User claims completion.
   - Counterparty confirms value with a simple rating.
4. Add basic anti-abuse constraints:
   - Context-required messaging.
   - Daily request cap.

Exit criteria:
- Activation >= 35% (user completes at least one collaboration action in first 7 days).
- 2-week return rate >= 20% for activated users.
- Abuse reports < 2% of interactions.

### Phase 2 (Weeks 9-14): Trust and Quality Automation
1. GitHub integration for stronger completion signals (PR comment/review presence).
2. Add low-cost quality heuristics before LLM scoring:
   - Comment length threshold.
   - Thread depth/reply evidence.
   - Unique actionable suggestions count.
3. Introduce reputation lanes (`Reviewer`, `Mentor`, `Contributor`), with 30-day decay.

Exit criteria:
- Verified action rate >= 70% of claimed actions.
- Quality-positive feedback >= 60%.

### Phase 3 (Weeks 15-24): Matching Expansion and Growth
1. Add complementary matching (skills that co-ship well).
2. Keep adjacent mentorship matching gated behind trust thresholds.
3. Launch shareable artifacts:
   - Stack Card.
   - Public collab badge.
4. Publish weekly stack trends only after data volume is statistically stable.

## What Changes From The Source Plan
1. One wedge first (`review_exchange`) instead of multiple daily quest types.
2. Deferred heavy automation (webhooks + LLM scoring) until behavior proves value.
3. Strong phase gates with measurable thresholds.
4. Explicit ICP and language-scope constraints.
5. Time-boxed naming decision to avoid strategic drift.

## Implementation Notes For Current Stack
Given current architecture (Next.js + Convex + Better Auth), implementation should follow these constraints:

1. Keep matching calculations as background jobs/actions in Convex.
2. Add event schema for loop analytics before new UI surfaces.
3. Start trust checks with deterministic rules; add LLM quality scoring only after baseline precision/recall is measured.
4. Prefer reversible product flags for each phase.

## KPI Framework
1. Activation: first collaboration action completed within 7 days.
2. Retention: week-2 and week-4 return rate of activated users.
3. Collaboration quality: mean counterpart rating and dispute/report rate.
4. Network utility: accepted match rate and repeat collaboration rate.
5. Trust health: spam attempts blocked, false positive moderation rate.

## Risks and Mitigations
1. **Low match density in early cohorts**
   - Mitigation: constrain ICP and geography/time zones per cohort; seed project opportunities.
2. **Spam and low-quality interactions**
   - Mitigation: interaction caps, context-only outreach, reputation decay, explicit feedback loops.
3. **Feature fatigue from "quests" framing**
   - Mitigation: present one recommended action per day, not a task list.
4. **Cost creep from AI moderation**
   - Mitigation: deterministic heuristics first; sample-based AI scoring second.
5. **Brand collision**
   - Mitigation: formal decision gate in Phase 0.

## 30/60/90-Day Deliverables
### Day 30
1. Naming decision memo.
2. KPI/event spec.
3. Intent mode UX + schema.

### Day 60
1. Review Exchange MVP live to limited cohort.
2. Basic trust controls and feedback capture.
3. Activation dashboard.

### Day 90
1. Verification automation v1.
2. Reputation lanes with decay.
3. Scale decision: proceed to complementary matching or iterate on quality first.

## Decision
Adopt the source strategy direction, but execute with strict sequencing and phase gates. The product should prove one repeatable collaboration loop before building the full collaboration economy.
