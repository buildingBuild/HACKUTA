# Human mentorship marketplace

The active route is `/coaching`, using the shared session and navigation. This feature adds human mentorship only, with no AI coaching or voice modules.

## Selection and presentation

Gaming and Creator each expose three existing focus records. Session inclusions and preparation appear inline. Legacy `?session=` links resolve to the selected focus on the main configurator. URL selection and browser preferences retain category, focus, mentor and duration.

Two fictional sample profiles, Review mentor and Workshop mentor, are available in both categories. Selecting a mentor selects a supported offering and duration. Review supports one or two hours; Workshop supports two hours only. Portraits are licensed stock illustrations, not participating coaches; see [credits](assets/CREDITS.md).

Real FaZe guest concepts remain below the standard configurator, participation unconfirmed and never directly bookable. Existing roster images and public role references remain attributed. Register interest opens an informational preview; no interest submission backend exists.

## Quotes and requests

`pricing.ts` configures illustrative USD rates: Review $60/one hour or $110/two hours, Workshop $120/two hours. Verified existing Community karma earns one benefit: 5% at 100, 10% at 500, capped at 10%. Integer cents prevent currency rounding drift. Missing or unverified karma receives regular pricing.

The feature-owned Express router in `server/src/routes/mentorship.ts` recomputes quotes from existing thread/comment score totals. It validates session/mentor compatibility, duration, authenticated identity, clip ownership, inputs and expected total. A request key prevents duplicate submissions, including concurrent retries. The recorded quote remains a snapshot if karma later changes. Requests remain pending, with no payment, reservation or mentor acceptance.

The Community full-preview adapter mounts this router using explicitly memory-only storage. Requests survive browser refresh and are account-scoped, but disappear when the preview server restarts. Preview profile karma is not trusted for discounts. Existing local drafts remain readable as legacy drafts.

The production server mounts the router with existing cookie authentication and PostgreSQL. The additive `mentorship_requests` table is included in the shared schema; run the existing `npm run db:migrate` before using requests. If storage is unavailable, the UI reports the API error rather than claiming success. No payment or scheduling integration is configured.

## Development and checks

Use the existing Vite development server with the Community full-preview adapter when a database is unavailable. The live app uses `/coaching`; `preview.html` is a retained isolated development entry. Do not reapply archived routing proposals.

Run `npm run lint`, `npm run build`, and `npx tsx --test web/src/features/mentorship/*.test.ts web/src/features/community/*.test.ts`. Tests cover karma thresholds, unavailable data, selection restoration, legacy drafts, authentication, rejected quote tampering, unsupported durations, clip ownership and idempotent pending requests.
