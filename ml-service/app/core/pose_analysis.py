"""
Pose / form analysis -- service boundary + heuristic stub.

Real plan: run a pose estimator (MediaPipe Pose or MoveNet Thunder) per frame
to get 2D/3D keypoints, compute joint angles over the stroke, and compare them
against a reference "ideal form" template (a pro's stroke, time-warped with DTW).
The deviations become the per-joint feedback shown over the user's clip.

For now this returns a reference skeleton + a deterministic set of joint-angle
deviations, in the exact shape the real pipeline produces. The frontend renders
these as an overlay and a "your form vs ideal" comparison.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, asdict

# 17-keypoint COCO-style skeleton used by MoveNet / MediaPipe (subset).
KEYPOINTS = [
    "nose", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
]

# Joints we score, as (name, [a, b, c]) angle at b formed by a-b-c.
JOINT_ANGLES = {
    "right_elbow": ("right_shoulder", "right_elbow", "right_wrist"),
    "left_elbow": ("left_shoulder", "left_elbow", "left_wrist"),
    "right_knee": ("right_hip", "right_knee", "right_ankle"),
    "left_knee": ("left_hip", "left_knee", "left_ankle"),
    "trunk_lean": ("right_shoulder", "right_hip", "right_knee"),
}

# Ideal angle (deg) at the contact phase for a textbook forehand.
IDEAL_CONTACT = {
    "right_elbow": 155.0,
    "left_elbow": 90.0,
    "right_knee": 150.0,
    "left_knee": 145.0,
    "trunk_lean": 165.0,
}


@dataclass
class JointFeedback:
    joint: str
    user_angle: float
    ideal_angle: float
    deviation: float
    status: str            # "good" | "minor" | "off"
    note: str


@dataclass
class PoseReport:
    stroke: str
    reference_skeleton: dict          # keypoint -> [x, y] normalised (ideal form)
    joint_feedback: list[dict]
    form_score: float                 # 0-100, higher is closer to ideal
    model: str

    def to_dict(self) -> dict:
        return asdict(self)


def _seed(clip_id: str) -> int:
    return int(hashlib.sha256(clip_id.encode()).hexdigest()[:8], 16)


# A normalised reference "ideal form" pose at the contact frame (x right, y down).
_REFERENCE_FOREHAND = {
    "nose": [0.52, 0.18], "left_shoulder": [0.46, 0.30], "right_shoulder": [0.58, 0.30],
    "left_elbow": [0.40, 0.42], "right_elbow": [0.70, 0.36], "left_wrist": [0.45, 0.52],
    "right_wrist": [0.82, 0.30], "left_hip": [0.48, 0.56], "right_hip": [0.57, 0.56],
    "left_knee": [0.46, 0.74], "right_knee": [0.60, 0.74], "left_ankle": [0.45, 0.92],
    "right_ankle": [0.63, 0.92],
}


def analyze_form(clip_id: str, stroke: str = "forehand") -> PoseReport:
    """Deterministic per-joint form deviations vs the ideal template."""
    s = _seed(clip_id)
    feedback: list[JointFeedback] = []
    total_dev = 0.0

    for i, (joint, ideal) in enumerate(IDEAL_CONTACT.items()):
        # Deterministic pseudo-deviation in roughly [-25, +25] degrees.
        dev = ((s >> (i * 4)) % 50) - 25
        user_angle = round(ideal + dev, 1)
        abs_dev = abs(dev)
        total_dev += abs_dev
        if abs_dev <= 6:
            status, note = "good", "Within ideal range."
        elif abs_dev <= 15:
            status, note = "minor", "Slightly off -- tune with reps."
        else:
            status, note = "off", "Notable deviation -- target this in drills."
        feedback.append(
            JointFeedback(joint, user_angle, ideal, float(dev), status, note)
        )

    # Map total deviation to a 0-100 form score.
    form_score = max(0.0, 100.0 - total_dev * 0.8)

    return PoseReport(
        stroke=stroke,
        reference_skeleton=_REFERENCE_FOREHAND,
        joint_feedback=[asdict(f) for f in feedback],
        form_score=round(form_score, 1),
        model="movenet-thunder-stub-v0",
    )
