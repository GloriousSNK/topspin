"""Pydantic request/response models (the API contract with the frontend)."""

from __future__ import annotations

import math

from pydantic import BaseModel, Field, field_validator, model_validator

# Per-component sanity clamp (finiteness first), then per-vector physical norm
# caps below keep the integrator well away from overflow/NaN regimes.
_MAX_MAG = 1.0e3
_MAX_SPEED = 130.0     # m/s — well above a pro serve (~73 m/s)
_MAX_SPIN = 1200.0     # rad/s — ~11,500 rpm, beyond any real stroke
_MAX_POS = 100.0       # m


def _finite_vec3(v: list[float], cap: float) -> list[float]:
    """Reject NaN/Inf and clamp each component to a sane magnitude."""
    out = []
    for x in v:
        fx = float(x)
        if not math.isfinite(fx):
            raise ValueError("vector components must be finite numbers")
        out.append(max(-cap, min(cap, fx)))
    return out


def _cap_norm(v: list[float], max_norm: float) -> list[float]:
    """Scale a vector down so its magnitude never exceeds max_norm."""
    n = math.sqrt(sum(x * x for x in v))
    if n > max_norm and n > 0:
        s = max_norm / n
        return [x * s for x in v]
    return v


# --- Ball flight / chaos ---------------------------------------------------
class LaunchInput(BaseModel):
    position: list[float] = Field(default=[0.0, 0.0, 0.9], min_length=3, max_length=3,
                                  description="[x, y, z] contact point in metres")
    velocity: list[float] = Field(default=[28.0, 0.0, 6.0], min_length=3, max_length=3,
                                  description="[vx, vy, vz] in m/s")
    spin: list[float] = Field(default=[0.0, -300.0, 0.0], min_length=3, max_length=3,
                              description="angular velocity [wx, wy, wz] in rad/s (topspin ~ -y)")

    @field_validator("position", "velocity", "spin")
    @classmethod
    def _validate_vec(cls, v: list[float]) -> list[float]:
        return _finite_vec3(v, _MAX_MAG)

    @model_validator(mode="after")
    def _cap_physical(self) -> "LaunchInput":
        # Bound by physical magnitude so no finite-but-absurd input can drive the
        # integrator to overflow (which would emit NaN/Infinity in the response).
        self.position = _finite_vec3(self.position, _MAX_POS)
        self.velocity = _cap_norm(self.velocity, _MAX_SPEED)
        self.spin = _cap_norm(self.spin, _MAX_SPIN)
        return self


class FlawIn(BaseModel):
    """One detected flaw — typed so a malformed item can't crash the generator."""
    id: str = Field(default="", max_length=64)
    label: str = Field(default="", max_length=128)
    severity: float = Field(default=0.5, ge=0.0, le=1.0)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    phase: str | None = Field(default=None, max_length=64)
    coaching_cue: str | None = Field(default=None, max_length=256)


class PredictBallRequest(BaseModel):
    launch: LaunchInput = LaunchInput()
    run_chaos: bool = True
    ensemble_samples: int = Field(default=200, ge=20, le=1000)


class TrajectoryPoint(BaseModel):
    t: float
    x: float
    y: float
    z: float


# --- Clip analysis ---------------------------------------------------------
class AnalyzeRequest(BaseModel):
    # clip_id is server-generated as uuid4().hex[:12]; pin the shape so a
    # crafted value can never be used to build a filesystem path later.
    clip_id: str = Field(pattern=r"^[0-9a-fA-F]{12}$")
    duration_s: float = Field(default=2.0, ge=0.1, le=30.0)
    stroke: str | None = Field(default=None, max_length=32)


# --- Drills / workouts -----------------------------------------------------
class WorkoutFromFlawsRequest(BaseModel):
    flaws: list[FlawIn] = Field(default_factory=list, max_length=50)
    level: str = Field(default="intermediate", max_length=24)
    max_minutes: int = Field(default=45, ge=10, le=120)


class WorkoutByGoalRequest(BaseModel):
    goal: str = "all_round"
    level: str = "intermediate"
    max_minutes: int = Field(default=45, ge=10, le=120)
