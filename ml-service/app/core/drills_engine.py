"""
Drill & workout generation.

Real, rule-based logic (no model needed): a catalogue of drills, each tagged
with the flaws it addresses, plus a generator that turns a set of detected
flaws (from the clip analysis) into a periodised, prioritised practice session.

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
    {
        "id": "spider_run", "name": "Spider-run court sprints",
        "addresses": [], "category": "movement",
        "intensity": "high", "equipment": "cones",
        "focus": "Touch five court spots and recover to centre as fast as you can.",
        "default_sets": 4, "default_reps": 6,
    },
    {
        "id": "serve_toss_groove", "name": "Serve toss consistency",
        "addresses": [], "category": "serve",
        "intensity": "low", "equipment": "balls",
        "focus": "Place the toss on the same spot in front, no racquet, ten in a row.",
        "default_sets": 3, "default_reps": 15,
    },
    {
        "id": "serve_leg_drive", "name": "Serve leg-drive loads",
        "addresses": ["narrow_base"], "category": "serve",
        "intensity": "medium", "equipment": "none",
        "focus": "Bend and drive up through the legs into a full extension.",
        "default_sets": 4, "default_reps": 12,
    },
    {
        "id": "kick_serve_brush", "name": "Kick-serve brush-up",
        "addresses": ["short_followthrough"], "category": "serve",
        "intensity": "medium", "equipment": "basket",
        "focus": "Brush low to high across the ball for spin and clearance.",
        "default_sets": 4, "default_reps": 15,
    },
    {
        "id": "volley_punch", "name": "Volley punch progression",
        "addresses": ["wrist_instability"], "category": "volley",
        "intensity": "medium", "equipment": "feeder/basket",
        "focus": "Short, firm punch out in front, no backswing.",
        "default_sets": 4, "default_reps": 20,
    },
    {
        "id": "reflex_volley_wall", "name": "Reflex volley wall taps",
        "addresses": ["wrist_instability", "early_contact"], "category": "volley",
        "intensity": "high", "equipment": "wall, balls",
        "focus": "Rapid firm-wrist volleys close to the wall to sharpen hands.",
        "default_sets": 5, "default_reps": 15,
    },
    {
        "id": "crosscourt_rally", "name": "Cross-court consistency rally",
        "addresses": [], "category": "consistency",
        "intensity": "medium", "equipment": "partner",
        "focus": "Rally cross-court and count how many you keep in a row.",
        "default_sets": 4, "default_reps": 25,
    },
    {
        "id": "dtl_targets", "name": "Down-the-line targets",
        "addresses": [], "category": "consistency",
        "intensity": "medium", "equipment": "targets, basket",
        "focus": "Hit down the line into a corner target each rep.",
        "default_sets": 4, "default_reps": 18,
    },
    {
        "id": "depth_control", "name": "Depth-control zone",
        "addresses": [], "category": "consistency",
        "intensity": "medium", "equipment": "rope/targets, basket",
        "focus": "Land every ball behind the service line, deep in the court.",
        "default_sets": 4, "default_reps": 20,
    },
    {
        "id": "figure_eight", "name": "Figure-8 rally",
        "addresses": [], "category": "consistency",
        "intensity": "medium", "equipment": "partner",
        "focus": "One hits cross-court, one down the line, keep it flowing.",
        "default_sets": 3, "default_reps": 30,
    },
    {
        "id": "recovery_step", "name": "Recovery step-out",
        "addresses": ["open_stance_drift"], "category": "footwork",
        "intensity": "medium", "equipment": "cones",
        "focus": "Hit, then push off the outside foot to recover to centre.",
        "default_sets": 4, "default_reps": 14,
    },
    {
        "id": "lateral_ladder", "name": "Lateral shuffle ladder",
        "addresses": [], "category": "footwork",
        "intensity": "medium", "equipment": "agility ladder",
        "focus": "Quick, low shuffles keeping your base wide and balanced.",
        "default_sets": 4, "default_reps": 10,
    },
    {
        "id": "unit_turn_racket", "name": "Unit-turn shadow with racquet",
        "addresses": ["late_preparation"], "category": "technique",
        "intensity": "low", "equipment": "racquet",
        "focus": "Turn shoulders and set the racquet back early, on repeat.",
        "default_sets": 3, "default_reps": 15,
    },
    {
        "id": "low_high_groove", "name": "Low-to-high topspin groove",
        "addresses": ["short_followthrough"], "category": "technique",
        "intensity": "medium", "equipment": "basket",
        "focus": "Start the racquet below the ball and finish high for topspin.",
        "default_sets": 4, "default_reps": 20,
    },
    {
        "id": "slice_bevel", "name": "Slice bevel control",
        "addresses": [], "category": "technique",
        "intensity": "medium", "equipment": "basket",
        "focus": "Lead with the edge, cut high to low for a floating slice.",
        "default_sets": 4, "default_reps": 16,
    },
    {
        "id": "two_ball_reaction", "name": "Two-ball reaction feed",
        "addresses": ["head_drop"], "category": "perception",
        "intensity": "high", "equipment": "feeder/partner",
        "focus": "React to a quick second feed with eyes locked on the ball.",
        "default_sets": 4, "default_reps": 14,
    },
    {
        "id": "ball_readout", "name": "Ball-read call-out",
        "addresses": ["head_drop"], "category": "perception",
        "intensity": "low", "equipment": "partner",
        "focus": "Call spin or direction early to train visual pick-up.",
        "default_sets": 3, "default_reps": 20,
    },
    {
        "id": "approach_close", "name": "Approach and close",
        "addresses": [], "category": "movement",
        "intensity": "medium", "equipment": "cones",
        "focus": "Approach off a short ball, split, and close the net.",
        "default_sets": 4, "default_reps": 12,
    },
    {
        "id": "baseline_net_sprint", "name": "Baseline-to-net sprints",
        "addresses": [], "category": "movement",
        "intensity": "high", "equipment": "none",
        "focus": "Explode forward to the net and back-pedal to recover.",
        "default_sets": 5, "default_reps": 8,
    },
    {
        "id": "serve_plus_one", "name": "Serve-plus-one pattern",
        "addresses": ["early_contact"], "category": "timing",
        "intensity": "medium", "equipment": "basket",
        "focus": "Serve, then step in and take the next ball early.",
        "default_sets": 4, "default_reps": 12,
    },
    {
        "id": "return_split_timing", "name": "Return split-step timing",
        "addresses": ["late_preparation"], "category": "timing",
        "intensity": "medium", "equipment": "partner",
        "focus": "Split as they toss, short backswing, block the return deep.",
        "default_sets": 4, "default_reps": 15,
    },
    {
        "id": "contact_wall_taps", "name": "Contact-point wall taps",
        "addresses": ["early_contact"], "category": "timing",
        "intensity": "low", "equipment": "wall, balls",
        "focus": "Control tempo against the wall, meeting the ball out front.",
        "default_sets": 3, "default_reps": 25,
    },
    {
        "id": "core_rotation_med", "name": "Core rotation with med ball",
        "addresses": [], "category": "fitness",
        "intensity": "medium", "equipment": "medicine ball",
        "focus": "Rotational throws to build the coil and uncoil of a stroke.",
        "default_sets": 3, "default_reps": 12,
    },
    {
        "id": "tempo_shadow", "name": "Shadow swings for tempo",
        "addresses": [], "category": "fitness",
        "intensity": "low", "equipment": "racquet",
        "focus": "Smooth, full-speed shadow swings to groove rhythm and balance.",
        "default_sets": 3, "default_reps": 20,
    },
    {
        "id": "grip_firm_holds", "name": "Firm-wrist grip holds",
        "addresses": ["wrist_instability"], "category": "technique",
        "intensity": "low", "equipment": "racquet",
        "focus": "Hold a firm contact position to feel a stable wrist.",
        "default_sets": 3, "default_reps": 15,
    },
    {
        "id": "balance_finish", "name": "Balance-finish holds",
        "addresses": ["open_stance_drift"], "category": "technique",
        "intensity": "low", "equipment": "none",
        "focus": "Freeze the finish for two seconds to check your balance.",
        "default_sets": 3, "default_reps": 15,
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
        "power": ["technique", "footwork", "fitness"],
        "footwork": ["footwork", "movement"],
        "serve": ["serve", "timing"],
        "volley": ["volley", "movement"],
        "all_round": ["footwork", "technique", "consistency", "timing", "serve", "volley"],
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
