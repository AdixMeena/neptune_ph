# Graph Report - mishra  (2026-04-30)

## Corpus Check
- 27 files · ~26,237 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 117 nodes · 88 edges · 12 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]

## God Nodes (most connected - your core abstractions)
1. `session_ws()` - 4 edges
2. `save_session()` - 3 edges
3. `JointScore` - 2 edges
4. `SessionResult` - 2 edges
5. `FeedbackPayload` - 2 edges
6. `AnalyzeRequest` - 2 edges
7. `score_label()` - 2 edges
8. `angle_degrees()` - 2 edges
9. `midpoint()` - 2 edges
10. `score_for_angle()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (22): analyze_session(), AnalyzeRequest, angle_degrees(), FeedbackPayload, get_feedback(), get_patient_analysis(), get_patient_stats(), JointScore (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.5
Nodes (2): formatTime(), MessageBubble()

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (1): Called after a patient completes a camera session.     Persists the session sco

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (1): AI agent endpoint. Call this right after /session returns a session_id.     Fet

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (1): Returns aggregated session stats for a patient.

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (1): Returns recent session analyses for a patient.     Used by DoctorPatientDetail

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (1): Doctor sends feedback message to a patient.

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (1): Fetch all feedback messages for a patient.

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (1): Called after a patient completes a camera session.     Persists the session sco

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (1): Returns aggregated session stats for a patient.

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (1): Doctor sends feedback message to a patient.

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (1): Fetch all feedback messages for a patient.

## Knowledge Gaps
- **16 isolated node(s):** `Called after a patient completes a camera session.     Persists the session sco`, `AI agent endpoint. Call this right after /session returns a session_id.     Fet`, `Returns aggregated session stats for a patient.`, `Returns recent session analyses for a patient.     Used by DoctorPatientDetail`, `Doctor sends feedback message to a patient.` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 7`** (5 nodes): `PatientHealthChat.jsx`, `formatTime()`, `MessageBubble()`, `PatientHealthChat()`, `TypingDots()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `Called after a patient completes a camera session.     Persists the session sco`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `AI agent endpoint. Call this right after /session returns a session_id.     Fet`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `Returns aggregated session stats for a patient.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `Returns recent session analyses for a patient.     Used by DoctorPatientDetail`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `Doctor sends feedback message to a patient.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `Fetch all feedback messages for a patient.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `Called after a patient completes a camera session.     Persists the session sco`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `Returns aggregated session stats for a patient.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `Doctor sends feedback message to a patient.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `Fetch all feedback messages for a patient.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `Called after a patient completes a camera session.     Persists the session sco`, `AI agent endpoint. Call this right after /session returns a session_id.     Fet`, `Returns aggregated session stats for a patient.` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._