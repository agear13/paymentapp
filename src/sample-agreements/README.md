# Agreement Extraction Benchmark Dataset

High-quality benchmark corpus for evaluating Agreement Analyzer extraction quality across commercial relationship types.

## Corpus overview

- **20 agreements** across hospitality, events, and services
- Each sample includes `agreement.md` (source text) and `expected.json` (ground-truth labels)
- Summary metadata in `dataset-summary.json`

## Layout

```
sample-agreements/
  dataset-summary.json
  promoter-revenue-share/
    agreement.md
    expected.json
    actual.json          # optional — model output for evaluation
  venue-hire/
  ...
```

## Category distribution (5 each)

| Category | Samples |
|----------|---------|
| Revenue share | promoter-revenue-share, promoter-dj-revenue-share, venue-sponsorship, dj-performance, ticketing-partnership |
| Event | venue-hire, entertainment-booking, beach-club-event, event-management, festival-partnership |
| Service | contractor, security-services, food-vendor, beverage-supplier, photographer |
| Partnership | sponsorship, event-partnership, marketing-agency, influencer-partnership, production-services |

## Difficulty distribution

| Difficulty | Count | Examples |
|------------|-------|----------|
| Simple | 5 | promoter-revenue-share, venue-hire, contractor |
| Medium | 10 | food-vendor, sponsorship, dj-performance |
| Complex | 5 | ticketing-partnership, production-services, festival-partnership |

## Expected schema (`expected.json`)

```json
{
  "commercialRelationshipType": "promoter-revenue-share",
  "category": "revenueShare",
  "difficulty": "simple",
  "parties": [],
  "roles": [],
  "revenueSplits": [],
  "paymentConditions": [],
  "obligationCount": 0,
  "riskCount": 0,
  "missingClauseCount": 0
}
```

- `parties` / `roles` / `revenueSplits` / `paymentConditions`: structured ground-truth arrays
- `obligationCount`, `riskCount`, `missingClauseCount`: count targets for evaluation metrics
- `missingClauseCount` reflects clauses intentionally absent from `agreement.md` (e.g. GST clause, dispute resolution, data privacy)

## Running evaluation

After running extraction against `agreement.md` files, save outputs as `actual.json` in each folder, then:

```bash
cd src
npm run evaluate:agreements
```

See Ticket 4.1A evaluation framework for metric definitions.
