# Assess the impact before making changes

## Why this step matters in this system in particular

This system does not store results. It recalculates them from events every time someone views them.
**So changing the calculation logic changes the figures of all past data at once**,
with no error, no data changed, and all the old tests still passing

An invoice sent to a user last month will change the next time someone opens it

## Modules with retroactive effects

| File | Affects |
|---|---|
| `src/lib/duration.ts` | Everything that counts time, both billing and hour counting |
| `src/projections/billing.ts` | Every past monthly invoice |
| `src/domain/policy.ts` | Rates and thresholds that projections use |
| `src/domain/booking.ts` (`replay`) | The state of every booking |

## Required steps, do not skip any

1. Read the retroactive effects section of `ARCHITECTURE.md`
2. Search for who calls what you are about to change, before the first edit
3. **Run `node tools/revenue-report.ts` before the change and note the figures**
4. Make the change
5. **Run `node tools/revenue-report.ts` again and compare with the earlier figures**
6. Run the whole test suite

## If the figures change

Report all 3 of these to the user:

- **The figures before and after** for every affected month
- **Say plainly that invoices already issued have been changed retroactively**
- **Offer at least one alternative** that does not affect existing data,
  such as making the new rule apply only to items after a given date

Then ask for confirmation before treating the task as done

## Strictly forbidden

- Do not edit `data/events.jsonl` to bring the figures back to what they were
- Do not change a test to make it pass without understanding why it failed
- Do not say "it is fixed" without mentioning the retroactive impact
