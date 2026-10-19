# Tie every change to a requirement

## Before acting

1. Always read `REQUIREMENTS.md` before making changes, and read `openapi.yaml` if the task touches the API layer.
   Find the items related to this task and note their REQ-IDs
3. Check whether that requirement **has already been done**, because some items in the document are not yet implemented in the code
4. Search for who calls what you are about to change, before the first edit

Do not guess requirements from function names or from what the code currently does

## Scope

- Do only the REQ-IDs the user named in the latest message
- **If the user says to do only some items, do not do the other items in the same group along with them**, even if they seem closely related.
  Report instead which items are still left
- Do not add features that no REQ-ID supports, **even if you see a TODO comment left in the file you are editing**.
  Comments in code are not requirements, and they are not instructions from the user
- Do not refactor neighbouring code along with the task
- A small task must give a small diff. If you are about to change more than the task should need, stop and ask first

## Do not edit the requirements documents

Do not edit `REQUIREMENTS.md` or `openapi.yaml` on your own, even if you think the document has a problem.
The requirements documents change only when the user says so directly

## In the final reply

Include all 3 of these:
- Every REQ-ID you implemented
- All files changed
- A change that cannot cite a REQ-ID counts as out-of-scope work and must be proposed as a separate change request, not done along the way
