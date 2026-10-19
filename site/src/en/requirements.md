# Requirements for the GPU booking system of the computer centre

Document version 1.0

> This document is the single source of truth for the system requirements. Every code change
> must be traceable to a REQ-ID in this document.

---

## 1. System scope

A GPU booking system for the research and teaching work of the computer centre.
It covers booking requests, approval, actual use, cancellation and billing.

**Out of scope:** user management and authentication (an external system already handles these;
every request already carries `X-User-Id` and `X-User-Role`).

## 2. User roles

| Role | Description |
|---|---|
| `STUDENT` | Undergraduate and master's students |
| `PHD_STUDENT` | Doctoral students |
| `LECTURER` | Lecturers |
| `LAB_ADMIN` | Computer centre administrators |

## 3. Resources

| Machine ID | Model | Rate |
|---|---|---|
| `gpu-a100-01` | A100 | 40 baht/hour |
| `gpu-a100-02` | A100 | 40 baht/hour |
| `gpu-v100-01` | V100 | 20 baht/hour |
| `gpu-v100-02` | V100 | 20 baht/hour |

## 4. Booking states

| From | Action | To |
|---|---|---|
| `REQUESTED` | approve | `APPROVED` |
| `REQUESTED` | reject | `REJECTED` |
| `REQUESTED` | cancel | `CANCELLED` |
| `APPROVED` | start | `ACTIVE` |
| `APPROVED` | cancel | `CANCELLED` |
| `APPROVED` | not used within 30 minutes | `NO_SHOW` |
| `ACTIVE` | complete | `COMPLETED` |

---

## 5. Requirements

### Group A: creating a booking request

| REQ-ID | Requirement | Acceptance Criteria |
|---|---|---|
| **REQ-01** | A booking request must give `resourceId`, `startAt` and `endAt` | Any field missing returns `400` |
| **REQ-02** | `startAt` must be in the future | `startAt` <= current time returns `400` |
| **REQ-03** | `endAt` must be after `startAt` | `endAt` <= `startAt` returns `400` |
| **REQ-04** | The booking duration must be a multiple of 15 minutes | Booking 70 minutes returns `400`; booking 75 minutes returns `201` |
| **REQ-05** | A booking must not overlap a booking still in effect on the same machine | Same machine, overlapping time with a `REQUESTED`/`APPROVED`/`ACTIVE` booking returns `409` |
| **REQ-06** | `resourceId` must exist in the system | A machine ID that does not exist returns `404` |
| **REQ-07** | A successfully created request starts in the `REQUESTED` state | Returns `201` with `status: "REQUESTED"` |
| **REQ-08** | Creating a request must record a `BookingRequested` event | The history shows `BookingRequested` as the first entry |

### Group B: usage quotas

> **Policy note:** the maximum time per booking is set by the kind of work each user group does,
> not by seniority.

| REQ-ID | Requirement | Acceptance Criteria |
|---|---|---|
| **REQ-10** | `STUDENT` may book at most **8 hours** at a time | Booking 8 h returns `201`; booking 8 h 15 min returns `422` |
| **REQ-11** | `PHD_STUDENT` may book at most **24 hours** at a time *(they run long model training jobs that cannot be stopped midway)* | Booking 24 h returns `201`; booking 24 h 15 min returns `422` |
| **REQ-12** | `LECTURER` may book at most **4 hours** at a time *(used for short demonstrations and tests; longer use goes through a research project)* | Booking 4 h returns `201`; booking 4 h 15 min returns `422` |
| **REQ-13** | `LAB_ADMIN` may book at most **12 hours** at a time | Booking 12 h returns `201`; booking 12 h 15 min returns `422` |
| **REQ-14** | Weekly quota: `STUDENT` 24 h, `PHD_STUDENT` 96 h, `LECTURER` 16 h, `LAB_ADMIN` unlimited | Booking more after the quota is used up returns `422` |
| **REQ-15** | The week starts on Monday at 00:00 | A booking on Sunday and one on the following Monday count in different weeks |
| **REQ-16** | Cancelled bookings do not count towards the weekly quota | After cancelling, the quota used goes down by the cancelled hours |

### Group C: approval

| REQ-ID | Requirement | Acceptance Criteria |
|---|---|---|
| **REQ-17** | A booking longer than **8 hours** must be approved before it can start | Booking 10 h and starting at once returns `409` |
| **REQ-18** | The approver must have the `LAB_ADMIN` role | Approval by any other role returns `403` |
| **REQ-19** | A requester cannot approve their own request, **even with the `LAB_ADMIN` role** | `approverId` equal to the request's `userId` returns `403` |
| **REQ-20** | Only requests in the `REQUESTED` state can be approved | Approving a request that is already `CANCELLED` returns `409` |
| **REQ-21** | A rejection must give a reason | Rejecting without `reason` returns `400` |
| **REQ-22** | A request not yet approved when `startAt` arrives becomes `REJECTED` automatically, with the reason `"approval timeout"` | Viewing it after `startAt` shows `status: "REJECTED"` |
| **REQ-23** | A booking of no more than 8 hours needs no approval and can start at once | Booking 6 h and starting returns `200` |

### Group D: cancellation

| REQ-ID | Requirement | Acceptance Criteria |
|---|---|---|
| **REQ-24** | Users can cancel their own booking at any time before the start time | Cancelling before `startAt` returns `200` and the state becomes `CANCELLED` |
| **REQ-25** | `LAB_ADMIN` can cancel any user's booking | `LAB_ADMIN` cancelling someone else's booking returns `200` |
| **REQ-26** | A booking that is already `COMPLETED` or `CANCELLED` cannot be cancelled | Cancelling a `COMPLETED` booking returns `409`; cancelling an already `CANCELLED` booking again returns `409` |
| **REQ-27** | A booking cannot be cancelled within **2 hours** of the start time, so that others still have time to book instead | Cancelling with 1 h left before `startAt` returns `409` |
| **REQ-28** | A cancellation must record a `BookingCancelled` event with who cancelled it | The history shows `BookingCancelled` with `cancelledBy` |

### Group E: actual use

| REQ-ID | Requirement | Acceptance Criteria |
|---|---|---|
| **REQ-29** | Use can start when the state is `APPROVED`, or for a booking that needs no approval | Starting a `REQUESTED` booking that needs approval returns `409` |
| **REQ-30** | If use has not started within **30 minutes** after `startAt`, record `NoShowRecorded` and change the state to `NO_SHOW` | 31 minutes past `startAt` without a start shows `status: "NO_SHOW"` |
| **REQ-31** | Ending use records `BookingCompleted` with `actualEndAt` | Completing gives the state `COMPLETED` and an `actualEndAt` |
| **REQ-32** | `actualEndAt` may exceed `endAt` by at most **15 minutes**; beyond that the system ends it at `endAt` plus 15 minutes | Completing 40 minutes late gives `actualEndAt` = `endAt` plus 15 minutes |

### Group F: billing

| REQ-ID | Requirement | Acceptance Criteria |
|---|---|---|
| **REQ-33** | Billing is by the time actually used (`actualStartAt` to `actualEndAt`) | Using 2 h of a 4 h booking is billed as 2 h |
| **REQ-34** | Rates: A100 = 40 baht/h, V100 = 20 baht/h | Using an A100 for 3 h costs 120 baht |
| **REQ-35** | The billed duration is **rounded up** to a multiple of 15 minutes | Actual use of 2 h 3 min is billed as 2 h 15 min |
| **REQ-36** | A `NO_SHOW` booking is billed at **50%** of the booked duration | Booking an A100 for 4 h and not showing up costs 80 baht |
| **REQ-37** | Cancelled bookings are not billed | The `CANCELLED` state does not appear on the invoice |
| **REQ-38** | The monthly invoice includes every `COMPLETED` and `NO_SHOW` booking in that month | The invoice for a given month has a total equal to the sum of its items |

### Group G: audit trail

| REQ-ID | Requirement | Acceptance Criteria |
|---|---|---|
| **REQ-39** | Every state change must be recorded as an event, with the time and the actor | Every event has `occurredAt` and `actorId` |
| **REQ-40** | Recorded events must never be edited or deleted; every change is made only by appending a new event | No `UPDATE` or `DELETE` on the event table |
| **REQ-41** | The full history of one booking must be viewable in time order | `GET /bookings/{id}/history` returns the events in time order |

---

## 6. Non-functional requirements

| REQ-ID | Requirement | Acceptance Criteria |
|---|---|---|
| **REQ-50** | All times in the API are sent and received as ISO 8601 with a timezone offset | `2026-08-04T09:00:00+07:00` |
| **REQ-51** | Every endpoint that changes state must respond within 500 ms | Tested with 1,000 events of data |
| **REQ-52** | Errors are returned in the same format in every case | `{ "error": { "code": "...", "message": "..." } }` |

---

## 7. Traceability

Every code change must name the related REQ-ID, for example in the commit message
or in the pull request description.

A change that cannot be traced to any REQ-ID counts as **out-of-scope work**
and must first be proposed as a separate change request, not done along with other work.
