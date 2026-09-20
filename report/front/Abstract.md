# Abstract

**Title** Controlling LLM Agent Behavior in Software Development via Context
Engineering and Agent Skills

---

Large language models return different results each time the same instruction is
issued. In real software work this instability shows up as two behaviours that
are hard to govern: doing more than was asked, and deciding on the user's behalf
when a requirement is ambiguous. The industry's answer is to write working rules
into a file the agent reads every time, or to package those rules as units loaded
only when they become relevant. **Whether these two arrangements differ in effect
has not been measured systematically.**

This study builds a closed measurement system to compare the two arrangements
**while holding the content of the rules identical, so that only the delivery
mechanism differs.** It uses eleven software engineering tasks on one simulated
project, scored by deterministic program checkers rather than by humans or by a
language model, with hypotheses, endpoints and the analysis plan declared in
writing and dated before any comparative data was collected.

Data was collected in two studies: 220 runs across five arms, then 176 runs
across four. **The primary comparison is inconclusive in both.** Study 1 measured
a difference of 9.1 points (95% CI −6.8 to 27.3, p = 0.500) and study 2 measured
11.0 points (95% CI −2.1 to 27.5, p = 0.250). The direction favoured conditional
loading both times, but the confidence intervals straddle zero.

**Why the two studies are inconclusive differs, and that difference is the
study's main contribution.** In study 1 the lowest attainable p-value was 0.063,
already above the threshold, because the primary metric conjoined every critical
rule and pushed scores to the floor, leaving most tasks tied between arms. After
repairing the metric in study 2 that floor fell to 0.0625, making significance
attainable, and the observed result did not reach it. **Repairing the instrument
moved the obstacle from impossible to insufficient**, and showed that what is
missing is tasks, not measurement.

Decomposing the repaired metric revealed that **every arm carrying rules complied
with them more reliably than the arm with no rules, while completing fewer tasks.**
This observation was neither pre-registered nor tested statistically, so it is
reported as a hypothesis the data points toward rather than a conclusion.

Of four stated hypotheses, two could be answered. The hypothesis contrasting
value-judgement rules with prescriptive ones **could not be tested because no
value-judgement rule exists in the instrument** — a direct consequence of this
study's own requirement that every checker be deterministic. **The constraint
that makes the numbers trustworthy is the same constraint that bounds the
questions that can be asked.**

With the comparison inconclusive, the contribution is methodological: machine-
checked equivalence of rule content across arms; a frozen runtime fingerprint
re-verified on every run, which caught three unanticipated changes including an
agent writing the experiment's own rules into persistent memory outside the
workspace; and a single-source numbers pipeline with an automated gate that
prevents any document whose figures disagree with the data from being published.

**Keywords:** agent behaviour control · context engineering · agent skills ·
pre-registration · controlled experiment design · reproducibility
