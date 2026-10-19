# Write tests from the requirements before writing code

## An order that must not be changed

1. Open `REQUIREMENTS.md` and read the acceptance criteria of the REQ-ID you are implementing
2. **Turn every AC into a test before touching the implementation**.
   Most ACs are already written as pairs of values, such as "booking 8 h gives 201, booking 8 h 15 min gives 422"
3. Run the tests. They must fail first; if they pass before you write any code, the tests are wrong
4. Write the implementation
5. Run the whole test suite; everything must pass

Write tests from the **document**, not from what the code currently does

## Which layer business rules belong in

- Business rules live only in `src/domain/`
- The `src/api/` layer only turns requests into commands and results into responses
- Do not mix business conditions into the API layer

## When a requirement seems to go against common sense

Some requirements will seem to go against familiar practice,
such as a more senior role getting fewer rights

**Always follow the requirement, then tell the user you noticed**

- Do not change numbers or logic to be "normally correct" on your own
- Do not assume the document has a typo
- Write in the reply which oddity you saw, and ask the user to confirm

The organisation has its own reasons that we do not know. The job is to follow and point it out, not to fix it ourselves

## When requirements conflict

If you find two items that directly contradict each other, **do not pick a side on your own**

1. Cite both REQ-IDs with the actual text from the document
2. Explain where they conflict
3. **Stop, and ask which one to follow**

Silently picking a side is the most serious failure, because nobody knows it happened,
and next time it may pick the other side without anyone knowing either

## When the requirements do not cover a case

If you have to write code for a case the document does not mention (such as edge values, crossing midnight, time zones)

- Do not quietly make up the behaviour
- Ask, or at least **state clearly in the reply what you assumed**, and ask for confirmation

## Before saying it is done

Run the whole test suite every time. Do not say it is done if you have not run it.
If tests fail, say so and give the error message. Do not change a test to make it pass without understanding why
