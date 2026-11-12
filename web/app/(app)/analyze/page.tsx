"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Workout } from "@/lib/types";
import type { PoseAnalysis } from "@/lib/pose";
import { useAuth } from "@/components/AuthProvider";
import { saveSession, createShare } from "@/lib/history";
import { shareAnalysisWithCoach, syncPlayerSummary } from "@/lib/coach";
import { saveLocalSession } from "@/lib/localHistory";
import { recallSubject, refile, rememberSubject, saveStudentAnalysis, type Filed } from "@/lib/students";
import { ME, studentSubject, subjectStudentId, type Subject } from "@/lib/studentsLogic";
import SubjectPicker, { useStudentFolders } from "@/components/SubjectPicker";
import ContactSkeleton from "@/components/ContactSkeleton";
import { usePoseWarmup } from "@/lib/usePoseWarmup";

const STROKES = ["auto", "forehand", "backhand", "serve", "volley", "slice"];
const BUILDING = "Building session…";
const SHARING = "Creating summary…";

export default function Analyze() {
  const [stroke, setStroke] = useState("auto");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [result, setResult] = useState<PoseAnalysis | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [drag, setDrag] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [coachShareState, setCoachShareState] = useState<"idle" | "sharing" | "shared" | "failed">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, enabled, role } = useAuth();
  const activeUserId = useRef<string | null>(user?.id ?? null);
  const isCoach = !!user && role === "coach";
  const coachId = isCoach ? user.id : null;
  const students = useStudentFolders(coachId);
  const [chosenSubject, setChosenSubject] = useState<Subject>(ME);
  const [filed, setFiled] = useState<Filed | null>(null);
  const [refiling, setRefiling] = useState(false);
  // Start loading the pose model on idle, or sooner when the user reaches for the dropzone.
  const warmModel = usePoseWarmup();

  // Only file under a student once we know that folder exists; otherwise the
  // analysis goes to the coach's own history as it always did.
  const chosenStudent = subjectStudentId(chosenSubject);
  const subject: Subject = !isCoach || (chosenStudent && students.state !== "loading"
    && !(students.state === "ready" && students.folders.some((f) => f.id === chosenStudent))) ? ME : chosenSubject;
  const subjectName = students.nameOf(subject);
  const resultName = filed ? students.nameOf(filed.subject) : null;

  useEffect(() => {
    const previous = activeUserId.current;
    activeUserId.current = user?.id ?? null;
    if (previous && previous !== activeUserId.current) {
      setResult(null); setWorkout(null); setShareUrl(null); setFilename(null); setSaveState("idle"); setCoachShareState("idle"); setFiled(null);
    }
  }, [user?.id]);

  // Coaches start on the folder they came from (?student=) or the one they used last.
  useEffect(() => {
    if (!coachId) return;
    const fromUrl = new URLSearchParams(window.location.search).get("student");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL and storage are external state
    setChosenSubject(fromUrl ? studentSubject(fromUrl) : recallSubject(coachId) ?? ME);
  }, [coachId]);

  async function changeSubject(next: Subject) {
    setChosenSubject(next);
    if (coachId) rememberSubject(coachId, next);
    // A clip that's already saved moves with the picker, so a wrong pick is one click to fix.
    if (!coachId || !filed || filed.subject === next || saveState !== "saved") return;
    setRefiling(true);
    const moved = await refile(coachId, filed, next).catch(() => null);
    if (activeUserId.current !== coachId) return;
    setRefiling(false);
    if (moved) { setFiled(moved); setShareUrl(null); }
    else { setChosenSubject(filed.subject); setErr("Couldn't move that analysis. It's still where it was."); }
  }

  async function handleFile(file: File) {
    const ownerId = user?.id ?? null;
    const target = subject;
    setErr(null);
    setResult(null);
    setWorkout(null);
    setShareUrl(null);
    setSaveState("idle");
    setCoachShareState("idle");
    setFiled(null);
    // Guard the drop path (the file dialog uses accept="video/*", but drag-drop
    // bypasses it): reject non-videos and absurdly large files up front so we
    // give a clear message instead of a cryptic decode error or a hung tab.
    if (file.type && !file.type.startsWith("video/")) {
      setErr("That doesn't look like a video. Use an mp4, mov, or webm clip.");
      return;
    }
    if (file.size > 300 * 1024 * 1024) {
      setErr("That clip is very large. Trim it to a few seconds and try again.");
      return;
    }
    setFilename(file.name);
    try {
      setBusy("Analysing your stroke… (first run loads the model)");
      const { analyzeStroke } = await import("@/lib/pose");
      const res = await analyzeStroke(file, stroke);
      if (ownerId && activeUserId.current !== ownerId) return;
      setResult(res);
      api.recordAnalysis(res.seconds, res.videoFrames); // count it (no clip leaves the device)
      api.recordEngagement("analyze"); // this athlete actually ran an analysis
      if (ownerId) {
        setSaveState("saving");
        const studentId = subjectStudentId(target);
        let savedId: string | null;
        if (studentId) {
          // A student's clip: file it in their folder and keep it out of the coach's own history.
          savedId = await saveStudentAnalysis(ownerId, studentId, res).catch(() => null);
        } else {
          // Independent writes (the summary RPC takes the values directly), so run them together.
          [savedId] = await Promise.all([
            saveSession(res, ownerId).catch(() => null),
            syncPlayerSummary(ownerId, res.stroke, res.formScore).catch(() => false),
          ]);
        }
        if (activeUserId.current === ownerId) {
          setSaveState(savedId ? "saved" : "failed");
          setFiled(savedId ? { subject: studentId ? target : ME, id: savedId } : null);
        }
      } else saveLocalSession(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't analyse that clip.");
    } finally {
      setBusy(null);
    }
  }

  async function makeWorkout() {
    if (!result) return;
    try {
      setBusy(BUILDING);
      setWorkout(await api.workoutFromFlaws(result.flaws, "intermediate", 45));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't build a session. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function makeShare() {
    if (!result || !user) return;
    const ownerId = user.id;
    try {
      setBusy(SHARING);
      const id = await createShare({
        stroke: result.stroke, formScore: result.formScore, serveSpeedKmh: result.serveSpeedKmh,
        flaws: result.flaws, jointFeedback: result.jointFeedback, workout, createdAt: new Date().toISOString(),
      }, ownerId);
      if (activeUserId.current !== ownerId) return;
      if (id) setShareUrl(`${window.location.origin}/s/${id}`);
      else setErr("Couldn't create the summary. Sign in and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function shareWithLinkedCoach() {
    if (!result || !user) return;
    const ownerId = user.id;
    setCoachShareState("sharing");
    const ok = await shareAnalysisWithCoach(ownerId, {
      stroke: result.stroke,
      formScore: result.formScore,
      serveSpeedKmh: result.serveSpeedKmh,
      flaws: result.flaws,
      jointFeedback: result.jointFeedback,
      workout,
      createdAt: new Date().toISOString(),
    }).catch(() => false);
    if (activeUserId.current === ownerId) setCoachShareState(ok ? "shared" : "failed");
  }

  return (
    <div>
      <span className="eyebrow">Analysis</span>
      <h1 className="h1">Clip Analysis</h1>
      <p className="lead">
        Upload a clip of one stroke. Pose detection tracks your body and checks your angles at
        contact, then turns what it finds into drills. It all runs on your device, so nothing is
        uploaded and you don&apos;t need an account.
        {isCoach && <> Filming a student? Pick them below and the analysis goes in their <Link href="/students" style={{ color: "var(--court)", fontWeight: 600 }}>folder</Link>, not your own stats.</>}
      </p>

      <div className="card" style={{ marginBottom: 18, borderStyle: "dashed" }}>
        <div className="card-title">Filming a clip that analyses well</div>
        <div className="grid grid-2" style={{ gap: 10 }}>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "var(--ink-soft)" }}>
            <li>› <strong style={{ color: "var(--ink)" }}>Film from the side</strong>, level with you, not head-on.</li>
            <li>› <strong style={{ color: "var(--ink)" }}>Whole body in frame</strong> through the entire swing.</li>
            <li>› <strong style={{ color: "var(--ink)" }}>One stroke per clip</strong>, about 2 to 5 seconds long.</li>
          </ul>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "var(--ink-soft)" }}>
            <li>› <strong style={{ color: "var(--ink)" }}>Good light</strong>, and a plain-ish background helps.</li>
            <li>› <strong style={{ color: "var(--ink)" }}>Steady camera</strong>. Prop the phone up and don&apos;t pan.</li>
            <li>› <strong style={{ color: "var(--ink)" }}>Capture the finish</strong>, not just up to contact.</li>
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          {isCoach && (
            <SubjectPicker id="subject" value={subject} onChange={changeSubject}
              folders={students.folders} state={students.state} onAdd={students.add}
              disabled={!!busy || refiling || saveState === "saving"} />
          )}
          <div>
            <label className="label" htmlFor="stroke">Stroke</label>
            <select id="stroke" value={stroke} onChange={(e) => setStroke(e.target.value)} onFocus={warmModel} className="select">
              {STROKES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", maxWidth: 320 }}>
            Filming a serve? Pick <strong style={{ color: "var(--ink)" }}>serve</strong> to also get an estimated speed.
          </div>
        </div>

        <div
          className={`dropzone ${drag ? "drag" : ""}`}
          onClick={() => inputRef.current?.click()}
          onPointerEnter={warmModel}
          onDragEnter={warmModel}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault(); setDrag(false);
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
          }}
        >
          <input ref={inputRef} type="file" accept="video/*" hidden
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <div style={{ fontSize: 28, marginBottom: 8 }}>▣</div>
          <div style={{ fontWeight: 600, color: "var(--text)" }}>
            {filename ?? "Drop a clip here, or click to browse"}
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>mp4 / mov / webm · analysed on your device</div>
        </div>

        {busy && <div style={{ marginTop: 14, color: "var(--court)", fontWeight: 600 }}>● {busy}</div>}
        {err && <div style={{ marginTop: 14, color: "var(--danger)" }}>{err}</div>}
      </div>

      {result && (
        <>
          {saveState === "saved" && filed && subjectStudentId(filed.subject) ? (
            <div className="filed-banner" role="status">
              <span>✓ Filed in <strong>{students.nameOf(filed.subject)}</strong>&apos;s folder, not your own stats.</span>
              <Link href={`/students/${subjectStudentId(filed.subject)}`}>Open folder →</Link>
              {refiling && <span className="filed-moving">Moving…</span>}
            </div>
          ) : saveState === "saved" ? (
            <div className={isCoach ? "filed-banner" : undefined} role="status" style={isCoach ? undefined : { marginBottom: 14, fontSize: 14, color: "var(--ink-soft)" }}>
              <span>✓ Saved to your history.</span> <Link href="/stats" style={{ color: "var(--court)", fontWeight: 600 }}>See your stats →</Link>
              {isCoach && <span className="filed-moving">{refiling ? "Moving…" : "Student's clip? Pick them above to move it."}</span>}
            </div>
          ) : saveState === "saving" ? (
            <div style={{ marginBottom: 14, fontSize: 14, color: "var(--ink-soft)" }}>
              {subjectName ? `Filing in ${subjectName}'s folder…` : "Saving to your account…"}
            </div>
          ) : saveState === "failed" ? (
            <div role="alert" style={{ marginBottom: 14, fontSize: 14, color: "var(--danger)" }}>
              {subjectName
                ? `This analysis wasn't saved to ${subjectName}'s folder. It's still on screen, so take a screenshot if you need it.`
                : "This analysis stayed on this device and was not saved to your account."}
            </div>
          ) : enabled ? (
            <div style={{ marginBottom: 14, fontSize: 14, color: "var(--ink-soft)" }}>
              <Link href="/account" style={{ color: "var(--court)", fontWeight: 600 }}>Sign in</Link> to save this and track your form over time.
            </div>
          ) : null}

          {result.serveSpeedKmh ? (
            <div className="card" style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <span style={{ fontSize: 40 }}>🎾</span>
              <div className="stat">
                <span className="stat-value" style={{ fontSize: 40, color: "var(--court)" }}>
                  ~{result.serveSpeedKmh} km/h
                </span>
                <span className="stat-label">Estimated serve speed · {Math.round(result.serveSpeedKmh * 0.621)} mph</span>
              </div>
              <span style={{ color: "var(--ink-soft)", fontSize: 12, maxWidth: 240, marginLeft: "auto" }}>
                A rough estimate from hand speed and body size. A radar gun will be more accurate.
              </span>
            </div>
          ) : stroke === "serve" ? null : (
            <p style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 12 }}>
              Tip: pick <strong>serve</strong> from the dropdown before uploading to get a serve-speed estimate.
            </p>
          )}

          <div className="grid grid-2" style={{ marginBottom: 18 }}>
            <div className="card">
              <div className="card-title">What we saw</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 22, fontWeight: 700, textTransform: "capitalize" }}>{result.stroke}</span>
                <span className="pill accent">form {result.formScore}/100</span>
              </div>

              {result.flaws.length === 0 ? (
                <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
                  Nothing major showed up at contact. Try the Ball Lab to see how much margin your shots have.
                </p>
              ) : (
                result.flaws.map((f) => (
                  <div key={f.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{f.label}</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{
                        width: `${f.severity * 100}%`,
                        background: f.severity > 0.6 ? "var(--danger)" : f.severity > 0.4 ? "var(--warn)" : "var(--accent)",
                      }} />
                    </div>
                    <div style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 5 }}>💡 {f.coaching_cue}</div>
                  </div>
                ))
              )}

              {result.flaws.length > 0 && (
                <button className="btn" style={{ marginTop: 10 }} onClick={makeWorkout} disabled={!!busy}>
                  {busy === BUILDING ? "Building session…" : "Build a session to fix these →"}
                </button>
              )}
            </div>

            <div className="card">
              <div className="card-title">{resultName ? `${resultName}'s` : "Your"} contact position</div>
              <ContactSkeleton skeleton={result.skeleton} caption={resultName ? "contact frame" : "your contact frame"} />
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table className="data">
                  <thead><tr><th>Check</th><th>Reading</th><th></th></tr></thead>
                  <tbody>
                    {result.jointFeedback.map((j) => (
                      <tr key={j.joint}>
                        <td>{j.joint}</td>
                        <td className="mono">{j.reading}</td>
                        <td>
                          <span className={`pill ${j.status === "good" ? "good" : j.status === "minor" ? "warn" : "off"}`}>
                            {j.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ color: "var(--ink-soft)", fontSize: 12, marginTop: 10 }}>
                Measured from {result.framesAnalyzed} frames around the moment of contact.
              </p>
            </div>
          </div>

          {workout && <WorkoutCard w={workout} />}

          <div className="card" style={{ marginTop: 18 }}>
            <div className="card-title">{isCoach ? `Send the results${resultName ? ` to ${resultName}` : ""}` : "Share with a coach"}</div>
            {isCoach && !shareUrl && (
              <p style={{ color: "var(--ink-soft)", fontSize: 13, lineHeight: 1.55, marginBottom: 12 }}>
                A one-page summary link they can open on any phone, with no account. The video stays on this device.
              </p>
            )}
            {!enabled ? (
              <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Accounts aren&apos;t set up on this deployment yet.</p>
            ) : !user ? (
              <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
                <Link href="/account" style={{ color: "var(--court)", fontWeight: 600 }}>Sign in</Link> to create a one-page summary link you can send to a coach.
              </p>
            ) : shareUrl ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input className="select" style={{ flex: 1, minWidth: 240 }} readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
                <button className="btn btn-ghost" onClick={() => { navigator.clipboard?.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? "Copied!" : "Copy"}
                </button>
                <a className="btn" href={shareUrl} target="_blank" rel="noreferrer">Open</a>
              </div>
            ) : (
              <button className="btn" onClick={makeShare} disabled={!!busy}>{busy === SHARING ? "Creating summary…" : "Create a shareable summary →"}</button>
            )}
            {user && !isCoach && (
              <div style={{ borderTop: "1px solid var(--line-soft)", marginTop: 16, paddingTop: 16 }}>
                <p style={{ color: "var(--ink-soft)", fontSize: 13, lineHeight: 1.55, marginBottom: 10 }}>
                  Linked to a coach? Send this breakdown privately. The video itself stays on this device.
                </p>
                <button className="btn btn-ghost" onClick={shareWithLinkedCoach}
                  disabled={!!busy || coachShareState === "sharing" || coachShareState === "shared"}>
                  {coachShareState === "sharing" ? "Sharing..." : coachShareState === "shared" ? "Shared with coach" : "Share breakdown with my coach"}
                </button>
                {coachShareState === "failed" && <div role="alert" style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>Join a squad first, then try again.</div>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function WorkoutCard({ w }: { w: Workout }) {
  return (
    <div className="card">
      <div className="card-title">{w.title} · {w.total_minutes} min · {w.level}</div>
      <div className="grid grid-2">
        {w.drills.map((d) => (
          <div key={d.id} className="subcard">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <strong>{d.name}</strong>
              <span className="tag">{d.est_minutes}m</span>
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 8 }}>{d.focus}</div>
            {d.coaching_cue && <div style={{ color: "var(--green)", fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>💡 {d.coaching_cue}</div>}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="pill">{d.sets} × {d.reps}</span>
              <span className="pill">{d.intensity}</span>
              {d.targets.map((t) => <span key={t} className="pill accent">{t}</span>)}
            </div>
          </div>
        ))}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 14 }}>{w.notes}</p>
    </div>
  );
}
