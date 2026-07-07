// Shared types mirroring the FastAPI service responses (app/schemas.py + core/*).

export interface TrajectoryPoint {
  t: number;
  x: number;
  y: number;
  z: number;
}

export interface DivergencePoint {
  t: number;
  separation: number;
}

export interface ChaosReport {
  lyapunov_estimate: number;
  predictability_horizon_s: number;
  divergence_curve: DivergencePoint[];
  interpretation: string;
}

export interface LandingEnsemble {
  mean_landing: [number, number];
  std_landing: [number, number];
  in_probability: number;
  spread_m: number;
  samples: [number, number][];
}

export interface BallPrediction {
  trajectory: TrajectoryPoint[];
  landing: [number, number] | null;
  landed_in: boolean;
  cleared_net: boolean;
  apex_m: number;
  flight_time_s: number;
  impact_speed_ms: number;
  spin_rpm: number;
  chaos?: ChaosReport;
  ensemble?: LandingEnsemble;
}

export interface LaunchInput {
  position: [number, number, number];
  velocity: [number, number, number];
  spin: [number, number, number];
}

export interface Flaw {
  id: string;
  label: string;
  coaching_cue: string;
  severity: number;
  confidence: number;
  phase: string;
}

export interface Phase {
  phase: string;
  start: number;
  end: number;
}

export interface StrokeAnalysis {
  stroke: string;
  stroke_confidence: number;
  phases: Phase[];
  flaws: Flaw[];
  embedding_dim: number;
  model: string;
  summary: string;
}

export interface JointFeedback {
  joint: string;
  user_angle: number;
  ideal_angle: number;
  deviation: number;
  status: "good" | "minor" | "off";
  note: string;
}

export interface PoseReport {
  stroke: string;
  reference_skeleton: Record<string, [number, number]>;
  joint_feedback: JointFeedback[];
  form_score: number;
  model: string;
}

export interface ClipAnalysis {
  clip_id: string;
  analysis: StrokeAnalysis;
  pose: PoseReport;
}

export interface PrescribedDrill {
  id: string;
  name: string;
  category: string;
  focus: string;
  sets: number;
  reps: number;
  intensity: string;
  equipment: string;
  targets: string[];
  est_minutes: number;
  priority: number;
}

export interface Workout {
  title: string;
  goal: string;
  level: string;
  total_minutes: number;
  drills: PrescribedDrill[];
  notes: string;
}

export interface CatalogueDrill {
  id: string;
  name: string;
  addresses: string[];
  category: string;
  intensity: string;
  equipment: string;
  focus: string;
  default_sets: number;
  default_reps: number;
}

export interface GeneratedDrill {
  name: string;
  focus: string;
  category: string;
  intensity: string;
  sets: number;
  reps: number;
  steps: string[];
  goal: string;
}

export interface TrafficStats {
  videos_analyzed: number;
  practice_sessions: number;
  simulations: number;
  frames_processed: number;
  footage_seconds: number;
  athletes_served: number;
  orgs_reached: number;
  countries_reached: number;
  generated_at: number;
}
