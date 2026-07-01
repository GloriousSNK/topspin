"""Drill & workout generation endpoints."""

from fastapi import APIRouter, Depends

from ..schemas import WorkoutFromFlawsRequest, WorkoutByGoalRequest
from ..core import drills_engine
from ..ratelimit import RateLimiter, rate_limit

router = APIRouter(prefix="/drills", tags=["drills"])

_limit = Depends(rate_limit(RateLimiter(max_events=120, window_s=60.0)))


@router.get("/catalogue")
def catalogue():
    """The full drill library (for browsing / building custom workouts)."""
    return {"drills": drills_engine.DRILL_CATALOGUE}


@router.post("/from-flaws", dependencies=[_limit])
def workout_from_flaws(req: WorkoutFromFlawsRequest):
    """Build a personalised session from detected flaws."""
    workout = drills_engine.generate_from_flaws(
        flaws=[f.model_dump() for f in req.flaws], level=req.level, max_minutes=req.max_minutes
    )
    return workout.to_dict()


@router.post("/by-goal", dependencies=[_limit])
def workout_by_goal(req: WorkoutByGoalRequest):
    """Build a workout from a high-level goal when there's no clip analysis."""
    workout = drills_engine.generate_by_goal(
        goal=req.goal, level=req.level, max_minutes=req.max_minutes
    )
    return workout.to_dict()
