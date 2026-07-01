"""Ball trajectory + chaos endpoints (real physics)."""

from __future__ import annotations

import math

import numpy as np
from fastapi import APIRouter, Depends

from ..schemas import PredictBallRequest
from ..core.ball_physics import LaunchState, simulate
from ..core.chaos import finite_time_lyapunov, landing_ensemble
from ..ratelimit import RateLimiter, rate_limit

router = APIRouter(prefix="/predict", tags=["ball"])

# This is the heaviest endpoint (RK4 + Lyapunov sweep + Monte-Carlo ensemble).
_limit = Depends(rate_limit(RateLimiter(max_events=90, window_s=60.0)))


def _sanitize(obj):
    """Replace any NaN/Inf with None so the response is always valid JSON."""
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    return obj


@router.post("/ball", dependencies=[_limit])
def predict_ball(req: PredictBallRequest):
    """
    Integrate the shot, and (optionally) run the chaos/sensitivity analysis.

    Returns the deterministic trajectory, the Lyapunov-based sensitivity report,
    and a Monte-Carlo landing ensemble (the practical "where will it land + how
    sure are we" answer).
    """
    launch = LaunchState(
        position=np.asarray(req.launch.position, dtype=float),
        velocity=np.asarray(req.launch.velocity, dtype=float),
        spin=np.asarray(req.launch.spin, dtype=float),
    )

    traj = simulate(launch)
    # Downsample the path for transport to the browser (~120 points max).
    step = max(1, len(traj.t) // 120)
    path = [
        {"t": round(float(t), 4),
         "x": round(float(p[0]), 4), "y": round(float(p[1]), 4), "z": round(float(p[2]), 4)}
        for t, p in zip(traj.t[::step], traj.positions[::step])
    ]

    result = {
        "trajectory": path,
        "landing": None if traj.landing is None else [round(float(traj.landing[0]), 3),
                                                      round(float(traj.landing[1]), 3)],
        "landed_in": traj.landed_in,
        "cleared_net": traj.cleared_net,
        "apex_m": round(traj.apex, 3),
        "flight_time_s": round(traj.flight_time, 3),
        "impact_speed_ms": round(traj.extras["impact_speed"], 2),
        "spin_rpm": round(traj.extras["spin_rpm"], 1),
    }

    if req.run_chaos:
        sens = finite_time_lyapunov(launch)
        ens = landing_ensemble(launch, n_samples=req.ensemble_samples)
        result["chaos"] = {
            "lyapunov_estimate": sens.lyapunov_estimate,
            "predictability_horizon_s": sens.predictability_horizon_s,
            "divergence_curve": sens.divergence_curve,
            "interpretation": sens.interpretation,
        }
        result["ensemble"] = {
            "mean_landing": ens.mean_landing,
            "std_landing": ens.std_landing,
            "in_probability": ens.in_probability,
            "spread_m": ens.spread_m,
            "samples": ens.samples,
        }

    return _sanitize(result)
