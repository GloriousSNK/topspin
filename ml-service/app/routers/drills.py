"""Drill & workout generation endpoints."""

from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel, Field

from ..schemas import WorkoutFromFlawsRequest, WorkoutByGoalRequest
from ..core import drills_engine
from ..ratelimit import RateLimiter, rate_limit
from .. import analytics

router = APIRouter(prefix="/drills", tags=["drills"])

_limit = Depends(rate_limit(RateLimiter(max_events=120, window_s=60.0)))


class DynamicRequest(BaseModel):
    goal: str = Field(min_length=1, max_length=200)


@router.post("/dynamic", dependencies=[_limit])
def dynamic_drill(req: DynamicRequest, background: BackgroundTasks):
    """Generate a single drill from a free-text goal (AI if configured, else rules)."""
    drill = drills_engine.generate_drill(req.goal)
    background.add_task(analytics.record_action, "workout")
    return drill


@router.get("/catalogue")
def catalogue():
    """The full drill library (for browsing / building custom workouts)."""
    return {"drills": drills_engine.DRILL_CATALOGUE}


@router.post("/from-flaws", dependencies=[_limit])
def workout_from_flaws(req: WorkoutFromFlawsRequest, background: BackgroundTasks):
    """Build a personalised session from detected flaws."""
    workout = drills_engine.generate_from_flaws(
        flaws=[f.model_dump() for f in req.flaws], level=req.level, max_minutes=req.max_minutes
    )
    background.add_task(analytics.record_action, "workout", len(workout.drills))
    return workout.to_dict()


@router.post("/by-goal", dependencies=[_limit])
def workout_by_goal(req: WorkoutByGoalRequest, background: BackgroundTasks):
    """Build a workout from a high-level goal when there's no clip analysis."""
    workout = drills_engine.generate_by_goal(
        goal=req.goal, level=req.level, max_minutes=req.max_minutes
    )
    background.add_task(analytics.record_action, "workout", len(workout.drills))
    return workout.to_dict()
