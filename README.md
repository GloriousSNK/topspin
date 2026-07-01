# 🎾 TopSpin — AI Tennis Practice Lab

An AI-assisted tennis practice app for players who want to actually improve. Upload a clip
of yourself, get your stroke broken down and your flaws identified, turn those flaws into a
targeted practice session, and reason about shot tolerances with real ball-flight physics.

> Status: **v0.1 — runnable end-to-end.** The heavy ML models (V-JEPA, pose) are served as
> structured stubs behind a clean FastAPI boundary, so the whole pipeline works today and the
> real model weights drop in without touching the frontend. The physics & chaos engine is
> **real**, not stubbed.

## Features

| Feature | What it does | Status |
|---|---|---|
| **Clip Analysis** | V-JEPA video model → stroke ID, phase segmentation, technical flaw detection with coaching cues | model stubbed, pipeline live |
| **Form Comparison** | Pose estimation → your joint angles vs an ideal reference stroke, scored per joint | model stubbed, pipeline live |
| **Drills & Workouts** | Turns detected flaws (or a goal) into a prioritised, time-boxed session from a tagged drill catalogue | ✅ real |
| **Ball Lab** | Drag + Magnus flight integrator (RK4), plus chaos analysis: finite-time Lyapunov exponent + Monte-Carlo landing ensemble | ✅ real physics |

## Architecture

```
TennisAPP/
├── web/                  Next.js 16 + TypeScript + Tailwind v4 (the app UI)
│   ├── app/              dashboard, analyze, workouts, ball-lab pages
│   ├── components/       nav
│   └── lib/              typed API client + shared types
└── ml-service/           FastAPI ML & physics service
    └── app/
        ├── core/         ball_physics, chaos, jepa, pose_analysis, drills_engine
        ├── routers/      ball, analysis, drills
        └── main.py       app entrypoint
```

The frontend talks to the backend over a small typed REST API (`web/lib/api.ts` ↔
`ml-service/app/routers/*`). Swapping a stub for a real model only changes one `core/*` module.

## Running it locally

You need **Node 18+** and **Python 3.11+**. Two terminals:

### 1. ML / physics service (port 8000)

```bash
cd ml-service
py -m venv .venv                       # first time only
./.venv/Scripts/python -m pip install -r requirements.txt   # first time only
./.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Interactive API docs at http://localhost:8000/docs

### 2. Web app (port 3000)

```bash
cd web
npm install        # first time only
npm run dev
```

Open http://localhost:3000

> On Windows you can run both at once with `./dev.ps1` from the repo root.

## The physics, briefly

A spinning tennis ball obeys `m·a = F_gravity + F_drag + F_magnus`:

- **Quadratic drag** `F_d = −½ρ·Cd·A·|v|·v`
- **Magnus lift** `F_m = ½ρ·Cl·A·|v|²·n̂`, with `Cl` from the spin ratio `S = r|ω|/|v|`

Solved with **RK4** at 1 ms steps. Because drag and Magnus couple nonlinearly, the landing
point is sensitive to the contact conditions — `core/chaos.py` quantifies that with a
**finite-time Lyapunov exponent** and a **Monte-Carlo landing ensemble** (the "cone of
uncertainty" + a calibrated in/out probability).

## Roadmap to real ML

1. `pip install torch` + V-JEPA 2 weights → implement `core/jepa._embed()` and the flaw head.
2. `pip install mediapipe` (or TF MoveNet) → real per-frame keypoints in `core/pose_analysis.py`.
3. DTW-align user vs reference stroke for time-accurate form deltas.
4. Ball tracking from real clips → feed measured launch conditions into the Ball Lab.

Each step is local to one module; the API contract and UI stay the same.
