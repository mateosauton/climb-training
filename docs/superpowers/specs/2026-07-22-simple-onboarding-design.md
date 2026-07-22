# Simple onboarding design

## Goal

After a user verifies their email, collect only the information needed to make a safe, useful first climbing plan. The flow must feel sequential, finish in about two minutes, and never demand measurements or tests the user may not know.

## Chosen approach

Use a four-screen **minimum viable personalization** flow inspired by Fitbod's goal/experience/equipment setup, followed by Duolingo's immediate value delivery. The app generates the first plan immediately after the fourth screen. Details that improve future recommendations live in an editable profile instead of blocking entry.

The other evaluated pattern, a persistent onboarding checklist like Headspace, is retained only for deferred profile enrichment. It must not gate training access.

## User flow

1. The user confirms their email and reaches the onboarding screen.
2. The app shows `Step 1 of 4`, a short benefit-led description, and one category at a time. Section names are not directly navigable.
3. Answers are saved as a draft after each change and restored after refresh or return.
4. The user can use Back and Continue. Continue validates only the small set of required answers for that screen.
5. After the fourth screen, `Create my plan` saves the completed onboarding and starts generation. A progress state explains that the plan is being prepared; failures provide Retry without losing answers.
6. When a plan is available, the user enters the application. The Profile surface offers non-blocking `Improve my plan` sections for deferred information.

## The four screens

### 1. Personal details

- Required: first name.
- Optional: age range.

No photo, location, sex, height, weight, wingspan, hand measurements, or ape index belongs here. Those data are optional profile fields and must have clear use-case copy if introduced later.

### 2. Climber details

- Required: experience band: new, under one year, one to three years, or more than three years.
- Required: primary climbing type: boulder, sport, or both.
- Required: sessions available each week: 1, 2, 3, 4, or 5+.
- Optional: current grade using a compact picker and an `I don't know` option.

If the generator requires a goal, show one concise primary-goal choice here. Do not show both boulder and sport grade pickers, project taxonomy, or technical-focus lists during initial onboarding.

### 3. Strengths & weaknesses

- Optional: strongest area: strength, technique, endurance, mobility, or confidence/route reading.
- Required: choose up to two areas to improve from the same compact list.
- Required: `Do you have pain that affects climbing today?` with No, A little, and Yes.
- Conditional: show a 0–10 pain scale only for A little or Yes, explaining that it adapts load rather than diagnosing an injury.

Do not ask for hangboard results, pull-up counts, shoulder tests, sleep, stress, recovery, skin, nutrition, or injury history in this flow.

### 4. Available material

- Required: primary place to train: climbing gym, board, rock, or home.
- Required: equipment multi-select, including `None / bodyweight only` and `Not sure`.

The result controls only what the initial plan can prescribe. Fine-grained board angle, wall details, and free-form notes are deferred.

## Interaction and language rules

- Display an honest `Takes about 2 minutes` promise.
- Limit each screen to two to four visible decisions; conditional questions appear only when relevant.
- Use short answer cards or chips, with plain-language labels and an `I don't know` path wherever knowledge is uncertain.
- Do not show an unanswered-field counter or a clickable row of all sections.
- Keep copy benefit-led: explain how an answer improves the plan, not internal training jargon.
- Provide standard keyboard, focus, screen-reader labels, and touch targets at the existing responsive breakpoints.

## Data and compatibility

- Introduce a v3 onboarding schema and four matching section identifiers.
- Preserve legacy v2 questionnaire records and fields unchanged.
- Store the new minimal answers in compatible normalized values. In particular, map sessions per week to the existing `weeklyAvailability` value and the conditional pain answer to `currentPain`, because current plan safety rules consume those values.
- Do not fill omitted advanced fields with misleading fabricated values. The generator must receive explicit defaults only where a safe, documented fallback is intended.
- The client and persistence boundary must reject an incomplete required set before setting `questionnaireCompleted`.

## Deferred Profile enrichment

Move advanced details to clearly optional profile sections: body details, grades and projects, detailed style preferences, capacity tests, training/recovery habits, health history, and environment notes. Saving them must improve future plans but must never reopen the onboarding or block an existing plan.

## Measurement and acceptance criteria

Instrument: onboarding started, each step viewed, each step completed, validation error, abandonment step, elapsed time, plan requested, and plan generated.

The release is complete when:

- A verified user can generate a plan through exactly four sequential screens.
- The required onboarding has no more than eight core answers plus conditional pain detail.
- A refresh resumes the same draft.
- Incomplete required values cannot mark onboarding complete.
- A user who does not know their grade or equipment can still finish safely.
- Existing v2 users and stored data continue to render and generate plans.

## Implementation boundaries and tests

The work affects the questionnaire definition, onboarding component and save state, plan-generation mapping, profile editing surface, field registry/types/migrations as needed, and the registration/onboarding E2E scenario. Add focused tests for section ordering, required/conditional validation, draft restore, compatibility mappings, plan generation, and keyboard/mobile behavior. Audit the plan-generation prompt and rules before release to ensure no untracked dependency requires one of the deferred fields.
