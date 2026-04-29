# Graph Report - mishra  (2026-04-29)

## Corpus Check
- 26 files · ~21,734 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 96 nodes · 76 edges · 1 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]

## God Nodes (most connected - your core abstractions)
1. `session_ws()` - 4 edges
2. `save_session()` - 3 edges
3. `JointScore` - 2 edges
4. `SessionResult` - 2 edges
5. `FeedbackPayload` - 2 edges
6. `score_label()` - 2 edges
7. `angle_degrees()` - 2 edges
8. `midpoint()` - 2 edges
9. `score_for_angle()` - 2 edges
10. `get_patient_stats()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (17): angle_degrees(), FeedbackPayload, get_feedback(), get_patient_stats(), JointScore, midpoint(), Called after a patient completes a camera session.     Persists the session sco, Returns aggregated session stats for a patient. (+9 more)

## Knowledge Gaps
- **4 isolated node(s):** `Called after a patient completes a camera session.     Persists the session sco`, `Returns aggregated session stats for a patient.`, `Doctor sends feedback message to a patient.`, `Fetch all feedback messages for a patient.`
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `Called after a patient completes a camera session.     Persists the session sco`, `Returns aggregated session stats for a patient.`, `Doctor sends feedback message to a patient.` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._