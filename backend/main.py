from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
import base64
import json
import math

import cv2
import mediapipe as mp
import numpy as np
from openai import OpenAI

load_dotenv()

# ── Supabase client ───────────────────────────────────────────────────────────
try:
    from supabase import create_client, Client
    _url  = os.getenv("SUPABASE_URL", "")
    _key  = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase: Optional[Client] = create_client(_url, _key) if _url and _key else None
except Exception:
    supabase = None

# ── Groq client ───────────────────────────────────────────────────────────────
_groq_key = os.getenv("GROQ_API_KEY", "")
groq_client: Optional[OpenAI] = (
    OpenAI(api_key=_groq_key, base_url="https://api.groq.com/openai/v1")
    if _groq_key else None
)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Phoenix-AI Backend",
    description="REST API for the Phoenix-AI rehabilitation platform",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "https://neptune-ph.vercel.app",
    ],
    allow_origin_regex="https://.*vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ────────────────────────────────────────────────────────────────────
class JointScore(BaseModel):
    name: str
    score: int
    status: str

class SessionResult(BaseModel):
    patient_id:   str
    exercise_id:  int
    score:        int
    reps:         int
    duration:     int
    joint_scores: List[JointScore]

class FeedbackPayload(BaseModel):
    patient_id: str
    doctor_id:  str
    message:    str

class AnalyzeRequest(BaseModel):
    session_id:  str
    patient_id:  str
    exercise_id: int

# ── Helpers ───────────────────────────────────────────────────────────────────
def score_label(score: int) -> str:
    if score >= 80:   return "Excellent session"
    elif score >= 60: return "Good effort"
    else:             return "Keep practicing"


# DEFAULT_RANGES is used ONLY to calculate all angles — never for scoring.
# Scoring uses ONLY the joints in each exercise's "ranges" key.
DEFAULT_RANGES = {
    "left_knee":      (80, 160),
    "right_knee":     (80, 160),
    "left_hip":       (60, 140),
    "right_hip":      (60, 140),
    "left_shoulder":  (30, 110),
    "right_shoulder": (30, 110),
    "spine":          (150, 180),
}

# ranges  = ONLY these joints are scored. Nothing else affects the score.
# primary = joint used for rep counting.
# voice_intro = spoken to patient when session first detects their pose.
# voice_cues  = what to say when a specific joint is doing it wrong.
EXERCISE_TARGETS = {
    1: {
        "primary":      "left_knee",
        "ranges":       {"left_knee": (90, 120), "right_knee": (90, 120), "left_hip": (70, 120)},
        "voice_intro":  "Starting knee flexion stretch. Sit on the edge of a chair and slowly bend your knee.",
        "voice_cues":   {
            "left_knee":  "Bend your left knee more",
            "right_knee": "Bend your right knee more",
            "left_hip":   "Keep your back straight",
        },
    },
    2: {
        "primary":      "left_hip",
        "ranges":       {"left_hip": (30, 60), "right_hip": (30, 60)},
        "voice_intro":  "Starting straight leg raise. Lie on your back and lift your leg to 45 degrees.",
        "voice_cues":   {
            "left_hip":  "Raise your left leg higher",
            "right_hip": "Raise your right leg higher",
        },
    },
    3: {
        "primary":      "left_knee",
        "ranges":       {"left_knee": (0, 20), "right_knee": (0, 20)},
        "voice_intro":  "Starting terminal knee extension. Straighten your knee fully and hold for 2 seconds.",
        "voice_cues":   {
            "left_knee":  "Straighten your left knee fully",
            "right_knee": "Straighten your right knee fully",
        },
    },
    4: {
        "primary":      "left_shoulder",
        "ranges":       {"left_shoulder": (20, 60), "right_shoulder": (20, 60)},
        "voice_intro":  "Starting shoulder pendulum. Lean forward and let your arm hang freely making small circles.",
        "voice_cues":   {
            "left_shoulder":  "Relax your left shoulder",
            "right_shoulder": "Relax your right shoulder",
        },
    },
    5: {
        "primary":      "left_shoulder",
        "ranges":       {"left_shoulder": (40, 80), "right_shoulder": (40, 80)},
        "voice_intro":  "Starting shoulder blade squeeze. Pull your shoulder blades together and hold for 5 seconds.",
        "voice_cues":   {
            "left_shoulder":  "Squeeze your shoulder blades together more",
            "right_shoulder": "Keep your shoulders down away from your ears",
        },
    },
    6: {
        "primary":      "spine",
        "ranges":       {"spine": (165, 180)},
        "voice_intro":  "Starting pelvic tilt. Lie on your back and flatten your lower back against the floor.",
        "voice_cues":   {
            "spine": "Flatten your lower back fully against the floor",
        },
    },
    7: {
        "primary":      "spine",
        "ranges":       {"spine": (140, 175)},
        "voice_intro":  "Starting cat camel stretch. On all fours, slowly arch your back up then let it sag down.",
        "voice_cues":   {
            "spine": "Move through the full range, arch up then sag down slowly",
        },
    },
    8: {
        "primary":      "left_shoulder",
        "ranges":       {"left_shoulder": (20, 60), "right_shoulder": (20, 60)},
        "voice_intro":  "Starting wrist flexion and extension. Extend your arm and bend your wrist up and down.",
        "voice_cues":   {
            "left_shoulder":  "Keep your elbow straight",
            "right_shoulder": "Keep your elbow straight",
        },
    },
    9: {
        "primary":      "left_shoulder",
        "ranges":       {"left_shoulder": (20, 60), "right_shoulder": (20, 60)},
        "voice_intro":  "Starting grip strengthening. Squeeze the ball firmly, hold for 3 seconds, then fully release.",
        "voice_cues":   {
            "left_shoulder":  "Squeeze more firmly with your full hand",
            "right_shoulder": "Fully release your grip between reps",
        },
    },
}

POSE_CONNECTIONS = [
    (11, 13), (13, 15), (12, 14), (14, 16),
    (11, 12), (11, 23), (12, 24),
    (23, 24), (23, 25), (25, 27), (24, 26), (26, 28),
    (27, 29), (28, 30), (29, 31), (30, 32),
]


def angle_degrees(a, b, c) -> Optional[float]:
    if a is None or b is None or c is None:
        return None
    ba    = np.array(a) - np.array(b)
    bc    = np.array(c) - np.array(b)
    denom = np.linalg.norm(ba) * np.linalg.norm(bc)
    if denom == 0:
        return None
    cos_angle = float(np.dot(ba, bc) / denom)
    cos_angle = max(-1.0, min(1.0, cos_angle))
    return math.degrees(math.acos(cos_angle))


def midpoint(a, b):
    return [(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2]


def score_for_angle(angle, low, high):
    if angle is None:
        return 0
    if low <= angle <= high:
        return 100
    deviation = min(abs(angle - low), abs(angle - high))
    return max(0, int(round(100 - deviation * 2)))


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":             "ok",
        "service":            "Phoenix-AI Backend",
        "supabase_connected": supabase is not None,
        "groq_connected":     groq_client is not None,
    }


@app.websocket("/ws/session/{session_id}")
async def session_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()

    exercise_id   = int(websocket.query_params.get("exercise_id", "0"))
    target_config = EXERCISE_TARGETS.get(exercise_id, {
        "primary":     "left_knee",
        "ranges":      {"left_knee": (80, 160)},
        "voice_intro": "Starting exercise. Follow the guidance.",
        "voice_cues":  {},
    })

    primary_joint = target_config["primary"]
    score_ranges  = target_config["ranges"]          # ONLY these joints scored
    voice_cues    = target_config.get("voice_cues", {})
    voice_intro   = target_config.get("voice_intro", "")

    # MediaPipe initialization with complexity 0 (lighter for Railway)
    try:
        mp_pose = mp.solutions.pose
        pose    = mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
    except Exception as e:
        err_msg = f"MediaPipe Init Error: {str(e)}"
        print(err_msg)
        try:
            await websocket.send_text(json.dumps({"error": err_msg, "feedback": "System Error"}))
        except:
            pass
        await websocket.close(code=1011)
        return

    rep_phase         = 0
    rep_count         = 0
    first_valid_frame = True

    try:
        while True:
            payload = await websocket.receive_text()
            try:
                data      = json.loads(payload)
                frame_b64 = data.get("frame", "")
            except json.JSONDecodeError:
                frame_b64 = payload

            if not frame_b64:
                await websocket.send_text(json.dumps({
                    "landmarks": [], "joint_scores": {}, "session_score": 0,
                    "rep_counted": False, "feedback": "No frame data", "voice_intro": "",
                }))
                continue

            if "," in frame_b64:
                frame_b64 = frame_b64.split(",", 1)[1]

            img_bytes = base64.b64decode(frame_b64)
            np_arr    = np.frombuffer(img_bytes, np.uint8)
            frame     = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if frame is None:
                await websocket.send_text(json.dumps({
                    "landmarks": [], "joint_scores": {}, "session_score": 0,
                    "rep_counted": False, "feedback": "Invalid frame", "voice_intro": "",
                }))
                continue

            rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = pose.process(rgb)

            if not result.pose_landmarks:
                await websocket.send_text(json.dumps({
                    "landmarks": [], "joint_scores": {}, "session_score": 0,
                    "rep_counted": False, "feedback": "Step into frame", "voice_intro": "",
                }))
                continue

            landmarks = []
            for lm in result.pose_landmarks.landmark:
                landmarks.append({"x": lm.x, "y": lm.y, "z": lm.z})

            def lm(idx):
                if idx >= len(landmarks): return None
                return [landmarks[idx]["x"], landmarks[idx]["y"], landmarks[idx]["z"]]

            left_shoulder   = lm(11)
            right_shoulder  = lm(12)
            left_elbow      = lm(13)
            right_elbow     = lm(14)
            left_hip        = lm(23)
            right_hip       = lm(24)
            left_knee       = lm(25)
            right_knee      = lm(26)
            left_ankle      = lm(27)
            right_ankle     = lm(28)
            shoulder_center = midpoint(left_shoulder, right_shoulder)
            hip_center      = midpoint(left_hip, right_hip)
            knee_center     = midpoint(left_knee, right_knee)

            angles = {
                "left_knee":      angle_degrees(left_hip,        left_knee,      left_ankle),
                "right_knee":     angle_degrees(right_hip,       right_knee,     right_ankle),
                "left_hip":       angle_degrees(left_shoulder,   left_hip,       left_knee),
                "right_hip":      angle_degrees(right_shoulder,  right_hip,      right_knee),
                "left_shoulder":  angle_degrees(left_elbow,      left_shoulder,  left_hip),
                "right_shoulder": angle_degrees(right_elbow,     right_shoulder, right_hip),
                "spine":          angle_degrees(shoulder_center, hip_center,     knee_center),
            }

            # ── FIXED: score ONLY exercise-relevant joints ──────────────────
            joint_scores = {}
            score_values = []
            worst_joint  = None
            worst_score  = 101

            for joint, (low, high) in score_ranges.items():
                s = score_for_angle(angles.get(joint), low, high)
                joint_scores[joint] = s
                score_values.append(s)
                if s < worst_score:
                    worst_score = s
                    worst_joint = joint

            session_score = int(round(sum(score_values) / len(score_values))) if score_values else 0

            # Rep detection
            rep_counted   = False
            primary_range = score_ranges.get(primary_joint)
            if primary_range:
                mid_angle     = (primary_range[0] + primary_range[1]) / 2
                current_angle = angles.get(primary_joint)
                if current_angle is not None:
                    above = current_angle >= mid_angle
                    if rep_phase == 0 and above:
                        rep_phase = 1
                    elif rep_phase == 1 and not above:
                        rep_phase = 0
                        rep_count += 1
                        rep_counted = True

            # Feedback text using exercise-specific cues
            if session_score >= 85:
                feedback = "Great form"
            elif worst_joint and worst_joint in voice_cues:
                feedback = voice_cues[worst_joint]
            elif worst_joint:
                feedback = f"Adjust {worst_joint.replace('_', ' ')}"
            else:
                feedback = "Hold steady"

            # Send voice_intro only on the very first valid frame
            emit_intro    = voice_intro if first_valid_frame else ""
            first_valid_frame = False

            await websocket.send_text(json.dumps({
                "landmarks":     landmarks,
                "joint_scores":  joint_scores,
                "session_score": session_score,
                "rep_counted":   rep_counted,
                "feedback":      feedback,
                "voice_intro":   emit_intro,
            }))

    except WebSocketDisconnect:
        print(f"WebSocket disconnected: {session_id}")
    except Exception as e:
        print(f"WebSocket Error: {e}")
    finally:
        try:
            pose.close()
        except:
            pass


@app.post("/session")
async def save_session(result: SessionResult):
    payload = {
        "patient_id":   result.patient_id,
        "exercise_id":  result.exercise_id,
        "score":        result.score,
        "reps":         result.reps,
        "duration":     result.duration,
        "joint_scores": [j.model_dump() for j in result.joint_scores],
        "label":        score_label(result.score),
    }
    if supabase:
        try:
            data       = supabase.table("sessions").insert(payload).execute()
            session_id = data.data[0]["id"] if data.data else None
            return {"success": True, "session_id": session_id, "data": data.data, "label": payload["label"]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"success": True, "session_id": None, "data": payload, "label": payload["label"], "note": "Supabase not configured"}


@app.post("/analyze")
async def analyze_session(req: AnalyzeRequest):
    # 1. Fetch session
    session_data = None
    if supabase:
        try:
            res          = supabase.table("sessions").select("*").eq("id", req.session_id).single().execute()
            session_data = res.data
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Session not found: {e}")
    if not session_data:
        session_data = {"score": 72, "reps": 10, "duration": 120, "joint_scores": [], "label": "Good effort"}

    # 2. Fetch exercise
    exercise_data = None
    if supabase:
        try:
            res           = supabase.table("exercises").select("*").eq("id", req.exercise_id).single().execute()
            exercise_data = res.data
        except Exception:
            pass
    if not exercise_data:
        exercise_data = {
            "name": "Exercise", "target_angle": "Variable",
            "target_angle_min": 0, "target_angle_max": 180,
            "common_mistakes": ["Incorrect form", "Insufficient range of motion"],
            "instructions": "Follow prescribed exercise guidelines.",
        }

    # 3. Fetch past sessions
    past_sessions = []
    if supabase:
        try:
            res = (
                supabase.table("sessions")
                .select("score, reps, duration, created_at")
                .eq("patient_id", req.patient_id)
                .eq("exercise_id", req.exercise_id)
                .neq("id", req.session_id)
                .order("created_at", desc=True)
                .limit(3)
                .execute()
            )
            past_sessions = res.data or []
        except Exception:
            pass

    # 4. Build prompt
    joint_scores_summary = ""
    if session_data.get("joint_scores"):
        for j in session_data["joint_scores"]:
            joint_scores_summary += f"  - {j['name']}: {j['score']}/100 ({j['status']})\n"
    else:
        joint_scores_summary = "  - Joint score data not available\n"

    trend_summary = ""
    if past_sessions:
        for i, s in enumerate(past_sessions, 1):
            trend_summary += f"  - Session -{i}: score={s['score']}, reps={s['reps']}, duration={s['duration']}s\n"
    else:
        trend_summary = "  - No previous sessions for this exercise\n"

    prompt = f"""You are a physiotherapy AI assistant. Analyze this exercise session and return ONLY a valid JSON object — no explanation, no markdown, no extra text.

EXERCISE INFORMATION:
- Name: {exercise_data.get('name', 'Unknown')}
- Target angle range: {exercise_data.get('target_angle_min', 0)}° to {exercise_data.get('target_angle_max', 180)}°
- Instructions: {exercise_data.get('instructions', 'N/A')}
- Known common mistakes:
{chr(10).join(f"  * {m}" for m in (exercise_data.get('common_mistakes') or []))}

CURRENT SESSION DATA:
- Overall score: {session_data.get('score', 0)}/100
- Reps completed: {session_data.get('reps', 0)}
- Duration: {session_data.get('duration', 0)} seconds
- Per-joint scores (only exercise-relevant joints):
{joint_scores_summary}

PATIENT HISTORY (last 3 sessions for this exercise):
{trend_summary}

Return this exact JSON structure:
{{
  "overall_score": <integer 0-100>,
  "completion_confirmed": <true if reps > 0 and score >= 50, else false>,
  "mistakes": [<list of specific mistake strings, max 4>],
  "patient_message": "<2 sentences: one positive observation, one specific improvement tip>",
  "doctor_report": "<3-4 sentence clinical summary: what patient did, joint performance, key issues, recommendation>",
  "trend_note": "<1 sentence comparing to past sessions, or 'First session recorded' if no history>"
}}"""

    # 5. Call Groq
    analysis = None
    if groq_client:
        try:
            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a physiotherapy AI assistant. Always respond with valid JSON only. No markdown, no code blocks."},
                    {"role": "user",   "content": prompt},
                ],
                temperature=0.3,
                max_tokens=800,
            )
            raw = response.choices[0].message.content.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"): raw = raw[4:]
            analysis = json.loads(raw.strip())
        except json.JSONDecodeError:
            analysis = None
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Groq API error: {e}")

    # 6. Fallback
    if analysis is None:
        sc = session_data.get("score", 0)
        analysis = {
            "overall_score":        sc,
            "completion_confirmed": session_data.get("reps", 0) > 0 and sc >= 50,
            "mistakes":             ["Automated analysis unavailable"],
            "patient_message":      f"You completed the session with a score of {sc}/100. Keep practicing consistently for best results.",
            "doctor_report":        f"Patient completed {session_data.get('reps', 0)} reps over {session_data.get('duration', 0)} seconds with a score of {sc}/100.",
            "trend_note":           "Trend analysis unavailable.",
        }

    # 7. Save to Supabase
    saved_analysis_id = None
    if supabase:
        try:
            row = {
                "session_id":           req.session_id,
                "patient_id":           req.patient_id,
                "exercise_id":          req.exercise_id,
                "overall_score":        analysis.get("overall_score"),
                "completion_confirmed": analysis.get("completion_confirmed"),
                "mistakes":             analysis.get("mistakes", []),
                "patient_message":      analysis.get("patient_message"),
                "doctor_report":        analysis.get("doctor_report"),
                "trend_note":           analysis.get("trend_note"),
            }
            res = supabase.table("session_analysis").insert(row).execute()
            if res.data: saved_analysis_id = res.data[0]["id"]
        except Exception as e:
            print(f"[analyze] Supabase save failed: {e}")

    return {"success": True, "analysis_id": saved_analysis_id, "session_id": req.session_id, **analysis}


@app.get("/patient/{patient_id}/stats")
async def get_patient_stats(patient_id: str):
    if not supabase:
        return {"total_sessions": 0, "avg_score": 0, "best_score": 0, "last_session": None}
    try:
        res    = supabase.table("sessions").select("*").eq("patient_id", patient_id).order("created_at", desc=True).execute()
        items  = res.data or []
        scores = [s["score"] for s in items]
        return {
            "total_sessions": len(items),
            "avg_score":      round(sum(scores) / len(scores), 1) if scores else 0,
            "best_score":     max(scores) if scores else 0,
            "last_session":   items[0] if items else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analysis/{patient_id}")
async def get_patient_analysis(patient_id: str, limit: int = 10):
    if not supabase:
        return {"data": []}
    try:
        res = (
            supabase.table("session_analysis")
            .select("*, sessions(exercise_id, reps, duration, created_at)")
            .eq("patient_id", patient_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return {"data": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feedback")
async def send_feedback(payload: FeedbackPayload):
    row = {"patient_id": payload.patient_id, "doctor_id": payload.doctor_id, "message": payload.message, "is_read": False}
    if supabase:
        try:
            data = supabase.table("feedback").insert(row).execute()
            return {"success": True, "data": data.data}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"success": True, "data": row}


@app.get("/feedback/{patient_id}")
async def get_feedback(patient_id: str):
    if not supabase:
        return {"data": []}
    try:
        res = supabase.table("feedback").select("*").eq("patient_id", patient_id).order("created_at", desc=True).execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))