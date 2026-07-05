"""
Chaos / sensitivity analysis for ball flight.

Why this belongs in a tennis app: a struck ball is a nonlinear dynamical
system (drag + Magnus coupling). Tiny differences at contact -- a degree of
racquet angle, a few rad/s of extra spin -- grow into large differences at the
landing point. This module quantifies that growth the same way you'd study any
chaotic system:

  1. Finite-Time Lyapunov Exponent (FTLE):
        lambda(t) = (1/t) * ln( |delta(t)| / |delta(0)| )
     estimated by integrating a reference shot and a cloud of perturbed shots,
     then measuring how fast their separation in state space grows.

  2. Landing-point ensemble ("cone of uncertainty"): Monte-Carlo over realistic
     contact-condition noise, giving a probability map of where the ball lands
     and a robust in/out probability instead of a single deterministic answer.

This intentionally mirrors classic chaos diagnostics (e.g. the double pendulum):
small perturbation -> exponential divergence -> ensemble forecasting.
"""

from __future__ import annotations

from dataclasses import dataclass
import numpy as np

from .ball_physics import (
    LaunchState, simulate, simulate_batch, integrate_paths_batch,
    COURT_LENGTH, COURT_WIDTH,
)


@dataclass
class SensitivityReport:
    lyapunov_estimate: float
    divergence_curve: list[dict]          # [{t, separation}]
    predictability_horizon_s: float       # time for separation to grow ~e-fold
    interpretation: str


@dataclass
class LandingEnsemble:
    mean_landing: list[float]
    std_landing: list[float]
    in_probability: float
    samples: list[list[float]]            # subsampled [x, y] landing points
    spread_m: float                       # RMS spread of landing cloud


def _state_vector(traj) -> np.ndarray:
    """Resample a trajectory's [pos, vel] onto a common time grid tail value."""
    return np.concatenate([traj.positions[-1], traj.velocities[-1]])


def finite_time_lyapunov(
    launch: LaunchState,
    perturbation: float = 1e-3,
    n_directions: int = 4,
    dt: float = 4e-3,
) -> SensitivityReport:
    """
    Estimate how fast nearby shots diverge.

    We perturb the launch velocity by `perturbation` along several orthogonal
    directions, integrate each, and track the growth of the separation between
    each perturbed trajectory and the reference over their common lifetime.
    """
    ref = simulate(launch, dt=dt)
    ref_len = len(ref.t)

    base = launch.velocity.astype(float)
    directions = []
    for axis in range(3):
        for sign in (+1.0, -1.0):
            d = np.zeros(3)
            d[axis] = sign
            directions.append(d)
    directions = directions[:n_directions]

    # Integrate all perturbed shots as one vectorised batch on the reference's
    # time grid, instead of a serial `simulate` per direction. This is the hot
    # path of the endpoint; batching collapses ~4 full integrations into one.
    n_steps = max(ref_len - 1, 1)
    dirs = np.array(directions)                                   # (D, 3)
    v0 = base[None, :] + perturbation * dirs                      # (D, 3)
    p0 = np.tile(launch.position.astype(float), (len(directions), 1))
    s0 = np.tile(launch.spin.astype(float), (len(directions), 1))
    paths = integrate_paths_batch(p0, v0, s0, n_steps=n_steps, dt=dt)  # (D, ref_len, 3)

    # Mean separation from the reference over the shared time window.
    sep = np.linalg.norm(paths - ref.positions[None, :ref_len, :], axis=2)  # (D, ref_len)
    mean_sep = np.maximum(sep.mean(axis=0), 1e-12)

    # Lyapunov estimate from the log-separation slope over the growth phase.
    t = ref.t
    valid = t > 1e-3
    if valid.sum() > 4:
        log_sep = np.log(mean_sep[valid] / perturbation)
        # Robust slope via least squares on the early-to-mid growth window.
        window = slice(0, max(4, int(0.6 * valid.sum())))
        tt = t[valid][window]
        ls = log_sep[window]
        A = np.vstack([tt, np.ones_like(tt)]).T
        slope, _ = np.linalg.lstsq(A, ls, rcond=None)[0]
        lyap = float(slope)
    else:
        lyap = 0.0

    horizon = float(1.0 / lyap) if lyap > 1e-6 else float("inf")

    curve = [
        {"t": round(float(tt), 4), "separation": round(float(ss), 6)}
        for tt, ss in zip(t[:: max(1, ref_len // 60)], mean_sep[:: max(1, ref_len // 60)])
    ]

    if lyap > 1.5:
        interp = "Highly sensitive: small contact errors blow up fast. Margin matters."
    elif lyap > 0.4:
        interp = "Moderately sensitive: spin/angle precision noticeably affects the result."
    else:
        interp = "Stable shot: forgiving of small contact variations."

    return SensitivityReport(
        lyapunov_estimate=round(lyap, 4),
        divergence_curve=curve,
        predictability_horizon_s=round(horizon, 3) if np.isfinite(horizon) else -1.0,
        interpretation=interp,
    )


def landing_ensemble(
    launch: LaunchState,
    n_samples: int = 200,
    vel_noise: float = 0.4,        # m/s std on each velocity component
    angle_noise_deg: float = 1.0,  # std on launch direction
    spin_noise: float = 8.0,       # rad/s std on each spin component
    seed: int = 7,
    dt: float = 4e-3,
) -> LandingEnsemble:
    """
    Monte-Carlo landing forecast under realistic contact-condition noise.

    Returns the landing cloud, its spread, and a calibrated in/out probability
    -- the practically useful output of the chaos analysis.
    """
    rng = np.random.default_rng(seed)
    base_v = launch.velocity.astype(float)
    speed = float(np.linalg.norm(base_v))

    # Build all perturbed launch conditions at once, then integrate them as one
    # batch (vectorised RK4) -- ~50x faster than looping per shot.
    v = base_v[None, :] + rng.normal(0.0, vel_noise, size=(n_samples, 3))
    # Launch-angle jitter via first-order small rotation: R·v ≈ v + (θ × v).
    theta = np.deg2rad(rng.normal(0.0, angle_noise_deg, size=(n_samples, 3)))
    v = v + np.cross(theta, v)
    if speed > 1e-6:
        norms = np.linalg.norm(v, axis=1, keepdims=True)
        v *= speed / np.where(norms < 1e-6, 1.0, norms)   # preserve struck speed
    spins = launch.spin.astype(float)[None, :] + rng.normal(0.0, spin_noise, size=(n_samples, 3))
    positions = np.tile(launch.position.astype(float), (n_samples, 1))

    res = simulate_batch(positions, v, spins, dt=dt)
    valid = res["landed"] & ~np.isnan(res["landing"][:, 0])
    pts = res["landing"][valid]
    in_count = int(res["in_court"].sum())

    if pts.shape[0] == 0:
        return LandingEnsemble([0, 0], [0, 0], 0.0, [], 0.0)

    mean = pts.mean(axis=0)
    std = pts.std(axis=0)
    spread = float(np.sqrt(np.mean(np.sum((pts - mean) ** 2, axis=1))))
    sub = pts[:: max(1, len(pts) // 120)]

    return LandingEnsemble(
        mean_landing=[round(float(mean[0]), 3), round(float(mean[1]), 3)],
        std_landing=[round(float(std[0]), 3), round(float(std[1]), 3)],
        in_probability=round(in_count / n_samples, 3),
        samples=[[round(float(p[0]), 3), round(float(p[1]), 3)] for p in sub],
        spread_m=round(spread, 3),
    )
