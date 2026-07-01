"""
V-JEPA stroke analysis -- service boundary + heuristic stub.

The real plan: feed short clips into Meta's V-JEPA 2 video encoder, pool the
predicted-representation embeddings over time, and run a lightweight head that
maps the embedding to (a) stroke type, (b) phase segmentation, and (c) a set of
biomechanical "flaw" scores trained on annotated coaching data.

Right now `analyze_clip` returns a *deterministic heuristic* result derived from
basic clip metadata so the whole app is runnable end-to-end. Every field has the
exact shape the real model will produce, so swapping in the trained model is a
drop-in replacement -- nothing upstream changes.

To wire the real model later:
    1. pip install torch + the v-jepa weights
    2. implement `_embed(frames) -> np.ndarray`
    3. replace the heuristic block in `analyze_clip` with the trained head.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, asdict

EMBED_DIM = 1024  # V-JEPA 2 ViT-L pooled embedding size

STROKES = ["forehand", "backhand", "serve", "volley", "slice"]

# Canonical phase template per stroke (fractions of clip duration).
PHASES = ["preparation", "backswing", "contact", "follow_through", "recovery"]

# Flaw library: id -> (label, the cue a coach would give).
FLAW_LIBRARY = {
    "late_preparation": ("Late unit turn / preparation", "Start your turn as the ball leaves their racquet."),
    "low_elbow": ("Dropped elbow at contact", "Keep the elbow up and stable through the strike."),
    "open_stance_drift": ("Weight drifting backward", "Drive off the front foot and transfer forward."),
    "short_followthrough": ("Truncated follow-through", "Finish over the shoulder; let the racquet decelerate naturally."),
    "head_drop": ("Head pulling off contact", "Keep your eyes on the contact point a beat longer."),
    "wrist_instability": ("Unstable wrist at impact", "Firm the wrist through contact for a cleaner strike."),
    "narrow_base": ("Base too narrow", "Widen your stance for a stable platform."),
    "early_contact": ("Contact point too far back", "Meet the ball more out in front."),
}


@dataclass
class Flaw:
    id: str
    label: str
    coaching_cue: str
    severity: float        # 0-1
    confidence: float      # 0-1
    phase: str             # which phase it shows up in


@dataclass
class StrokeAnalysis:
    stroke: str
    stroke_confidence: float
    phases: list[dict]                 # [{phase, start, end}]
    flaws: list[dict]
    embedding_dim: int
    model: str
    summary: str

    def to_dict(self) -> dict:
        return asdict(self)


def _seed_from(*parts: str) -> int:
    h = hashlib.sha256("::".join(parts).encode()).hexdigest()
    return int(h[:8], 16)


def _pick(seq, seed: int):
    return seq[seed % len(seq)]


def analyze_clip(
    clip_id: str,
    duration_s: float = 2.0,
    declared_stroke: str | None = None,
    fps: float = 30.0,
) -> StrokeAnalysis:
    """
    Heuristic stand-in for the V-JEPA inference head.

    Deterministic in `clip_id` so the same upload always yields the same
    analysis (important for a believable demo and for tests).
    """
    seed = _seed_from(clip_id)
    stroke = declared_stroke if declared_stroke in STROKES else _pick(STROKES, seed)
    stroke_conf = 0.72 + (seed % 23) / 100.0

    # Build phase segmentation across the clip duration.
    weights = [0.18, 0.22, 0.12, 0.30, 0.18]
    phases, cursor = [], 0.0
    for name, w in zip(PHASES, weights):
        start = cursor
        cursor += w * duration_s
        phases.append({"phase": name, "start": round(start, 3), "end": round(cursor, 3)})

    # Select 2-3 plausible flaws deterministically and score them.
    flaw_ids = list(FLAW_LIBRARY.keys())
    n_flaws = 2 + (seed % 2)
    chosen = []
    for i in range(n_flaws):
        fid = flaw_ids[(seed >> (i * 3)) % len(flaw_ids)]
        if fid in [c.id for c in chosen]:
            continue
        label, cue = FLAW_LIBRARY[fid]
        sev = 0.35 + ((seed >> i) % 50) / 100.0
        conf = 0.6 + ((seed >> (i + 2)) % 35) / 100.0
        phase = _pick(PHASES, seed + i)
        chosen.append(Flaw(fid, label, cue, round(sev, 2), round(min(conf, 0.98), 2), phase))

    chosen.sort(key=lambda f: f.severity, reverse=True)
    top = chosen[0].label.lower() if chosen else "no major flaws"
    summary = f"Detected {stroke} ({stroke_conf:.0%} conf). Top priority: {top}."

    return StrokeAnalysis(
        stroke=stroke,
        stroke_confidence=round(min(stroke_conf, 0.97), 2),
        phases=phases,
        flaws=[asdict(f) for f in chosen],
        embedding_dim=EMBED_DIM,
        model="vjepa2-heuristic-stub-v0",
        summary=summary,
    )
