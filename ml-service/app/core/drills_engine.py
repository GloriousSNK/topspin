"""
Drill & workout generation.

Real, rule-based logic (no model needed): a catalogue of drills, each tagged
with the flaws it addresses, plus a generator that turns a set of detected
flaws (from the JEPA analysis) into a periodised, prioritised practice session.

This is deliberately data-driven so the catalogue can grow without touching the
generator, and so a player can also request a workout by goal/level directly.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict

# --- Drill catalogue -------------------------------------------------------
# Each drill targets one or more flaw ids from jepa.FLAW_LIBRARY.
DRILL_CATALOGUE = [
    {
        "id": "shadow_unit_turn", "name": "Shadow unit-turn timing",
        "addresses": ["late_preparation"], "category": "footwork",
        "intensity": "low", "equipment": "none",
        "focus": "Trigger the shoulder turn the instant the ball is struck.",
        "default_sets": 3, "default_reps": 12,
    },
    {
        "id": "elbow_up_wall", "name": "Elbow-up wall rally",
        "addresses": ["low_elbow", "wrist_instability"], "category": "technique",
        "intensity": "medium", "equipment": "wall, balls",
        "focus": "Keep the elbow lifted and the wrist firm through contact.",
        "default_sets": 4, "default_reps": 20,
    },
    {
        "id": "front_foot_drive", "name": "Front-foot loading step-in",
        "addresses": ["open_stance_drift", "narrow_base"], "category": "footwork",
        "intensity": "medium", "equipment": "cones",
        "focus": "Load the back leg, then drive weight forward into the shot.",
        "default_sets": 3, "default_reps": 15,
    },
    {
        "id": "finish_over_shoulder", "name": "Finish-over-shoulder feeds",
        "addresses": ["short_followthrough"], "category": "technique",
        "intensity": "medium", "equipment": "feeder/basket",
        "focus": "Exaggerate a full follow-through finishing above the shoulder.",
        "default_sets": 4, "default_reps": 18,
    },
    {
        "id": "eyes_on_contact", "name": "Quiet-head contact hold",
        "addresses": ["head_drop"], "category": "perception",
        "intensity": "low", "equipment": "balls",
        "focus": "Hold your gaze on the contact zone a half-second after impact.",
        "default_sets": 3, "default_reps": 20,
    },
    {
        "id": "contact_out_front", "name": "Contact-point spacing ladder",
        "addresses": ["early_contact"], "category": "timing",
        "intensity": "medium", "equipment": "cones, basket",
        "focus": "Meet the ball progressively further in front each set.",
        "default_sets": 4, "default_reps": 16,
    },
    {
        "id": "split_step_react", "name": "Split-step reaction starts",
        "addresses": [], "category": "footwork",
        "intensity": "high", "equipment": "none",
        "focus": "Time the split step to the opponent's contact for explosive starts.",
        "default_sets": 5, "default_reps": 10,
    },
    {
        "id": "spin_window", "name": "Topspin net-clearance window",
        "addresses": [], "category": "consistency",
        "intensity": "medium", "equipment": "rope/target, basket",
        "focus": "Land balls in a high-margin window 1-1.5 m over the net.",
        "default_sets": 4, "default_reps": 20,
    },
]

INTENSITY_MINUTES = {"low": 6, "medium": 9, "high": 12}


@dataclass
class PrescribedDrill:
    id: str
    name: str
    category: str
    focus: str
    sets: int
    reps: int
    intensity: str
    equipment: str
    targets: list[str]            # flaw labels this addresses for the user
    est_minutes: int
    priority: float               # higher = more important for this player


@dataclass
class Workout:
    title: str
    goal: str
    level: str
    total_minutes: int
    drills: list[dict]
    notes: str

    def to_dict(self) -> dict:
        return asdict(self)


def _catalogue_by_flaw(flaw_id: str):
    return [d for d in DRILL_CATALOGUE if flaw_id in d["addresses"]]


def generate_from_flaws(
    flaws: list[dict],
    level: str = "intermediate",
    max_minutes: int = 45,
) -> Workout:
    """
    Turn detected flaws (each {id, label, severity, ...}) into a prioritised
    session. Highest-severity flaws get their drills first; we then top up with
    general consistency/footwork work until the time budget is filled.
    """
    level_mult = {"beginner": 0.8, "intermediate": 1.0, "advanced": 1.25}.get(level, 1.0)
    prescribed: list[PrescribedDrill] = []
    used_ids: set[str] = set()
    flaws_sorted = sorted(flaws, key=lambda f: f.get("severity", 0), reverse=True)

    for flaw in flaws_sorted:
        if not flaw.get("id"):
            continue
        for drill in _catalogue_by_flaw(flaw["id"]):
            if drill["id"] in used_ids:
                continue
            used_ids.add(drill["id"])
            sets = max(1, round(drill["default_sets"] * level_mult))
            prescribed.append(_prescribe(drill, sets, flaw, flaw.get("severity", 0.5)))

    # Top up with general-purpose drills (footwork/consistency).
    for drill in DRILL_CATALOGUE:
        if drill["id"] in used_ids or drill["addresses"]:
            continue
        used_ids.add(drill["id"])
        sets = max(1, round(drill["default_sets"] * level_mult))
        prescribed.append(_prescribe(drill, sets, None, 0.3))

    # Fill to time budget, highest priority first.
    prescribed.sort(key=lambda d: d.priority, reverse=True)
    session, total = [], 0
    for d in prescribed:
        if total + d.est_minutes > max_minutes and session:
            break
        session.append(d)
        total += d.est_minutes

    return Workout(
        title="Personalised practice session",
        goal="Address detected technical flaws + maintain general sharpness",
        level=level,
        total_minutes=total,
        drills=[asdict(d) for d in session],
        notes="Warm up 5 min. Rest 45-60 s between sets. Quality over speed.",
    )


def generate_by_goal(goal: str, level: str = "intermediate", max_minutes: int = 45) -> Workout:
    """Goal-based workout when there's no clip analysis (e.g. 'consistency')."""
    goal_categories = {
        "consistency": ["consistency", "technique", "perception"],
        "power": ["technique", "footwork"],
        "footwork": ["footwork"],
        "serve": ["technique", "timing"],
        "all_round": ["footwork", "technique", "consistency", "timing"],
    }
    cats = goal_categories.get(goal, ["footwork", "technique"])
    level_mult = {"beginner": 0.8, "intermediate": 1.0, "advanced": 1.25}.get(level, 1.0)

    chosen = [d for d in DRILL_CATALOGUE if d["category"] in cats]
    session, total = [], 0
    for drill in chosen:
        sets = max(1, round(drill["default_sets"] * level_mult))
        p = _prescribe(drill, sets, None, 0.5)
        if total + p.est_minutes > max_minutes and session:
            break
        session.append(p)
        total += p.est_minutes

    return Workout(
        title=f"{goal.replace('_', ' ').title()} workout",
        goal=goal,
        level=level,
        total_minutes=total,
        drills=[asdict(d) for d in session],
        notes="Warm up 5 min. Track makes/misses to measure progress over weeks.",
    )


def _prescribe(drill: dict, sets: int, flaw: dict | None, priority_base: float) -> PrescribedDrill:
    est = INTENSITY_MINUTES[drill["intensity"]] * max(1, round(sets / drill["default_sets"]))
    targets = [flaw.get("label", "")] if flaw and flaw.get("label") else []
    priority = priority_base + (0.4 if flaw else 0.0)
    return PrescribedDrill(
        id=drill["id"], name=drill["name"], category=drill["category"],
        focus=drill["focus"], sets=sets, reps=drill["default_reps"],
        intensity=drill["intensity"], equipment=drill["equipment"],
        targets=targets, est_minutes=est, priority=round(priority, 3),
    )
