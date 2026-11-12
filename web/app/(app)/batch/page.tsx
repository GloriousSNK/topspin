"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import type { PoseAnalysis } from "@/lib/pose";
import { saveSession } from "@/lib/history";
import { syncPlayerSummary } from "@/lib/coach";
import { saveLocalSession } from "@/lib/localHistory";
import { rememberSubject, recallSubject, saveStudentAnalysis } from "@/lib/students";
import { ME, subjectStudentId, type Subject } from "@/lib/studentsLogic";
import SubjectPicker, { useStudentFolders } from "@/components/SubjectPicker";
import { usePoseWarmup } from "@/lib/usePoseWarmup";

type BatchItem = { id: string; file: File; state: "queued" | "running" | "done" | "failed"; result?: PoseAnalysis; error?: string; saved?: boolean };

export default function BatchAnalysis() {
  const { user, role } = useAuth();
  const coachId = user && role === "coach" ? user.id : null;
  const students = useStudentFolders(coachId);
  const [chosen, setChosen] = useState<Subject>(ME);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [stroke, setStroke] = useState("auto");
  const [running, setRunning] = useState(false);
  const userId = user?.id ?? null;
  const owner = useRef<string | null>(userId);
  useEffect(() => { owner.current = userId; }, [userId]);
  const chosenStudent = subjectStudentId(chosen);
  const subject: Subject = !coachId || (chosenStudent && !(students.state === "ready" && students.folders.some((f) => f.id === chosenStudent))) ? ME : chosen;
  const subjectName = students.nameOf(subject);
  const [filedTo, setFiledTo] = useState<Subject>(ME);
  // Load the pose model on idle (or when clips are picked) so "Analyse" starts straight away.
  const warmModel = usePoseWarmup();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is external state
    if (coachId) setChosen(recallSubject(coachId) ?? ME);
  }, [coachId]);

  function add(files: FileList | null) {
    if (!files) return;
    warmModel();
    const incoming = Array.from(files).filter((f) => !f.type || f.type.startsWith("video/")).slice(0, Math.max(0, 8 - items.length));
    setItems((old) => [...old, ...incoming.map((file) => ({ id: crypto.randomUUID(), file, state: "queued" as const }))]);
  }

  async function run() {
    if (!items.length || running) return;
    const accountId = owner.current;
    const studentId = subjectStudentId(subject);
    setFiledTo(subject);
    setRunning(true);
    const update = (id: string, patch: Partial<BatchItem>) =>
      setItems((all) => all.map((x) => x.id === id ? { ...x, ...patch } : x));
    // Saving a clip is network-bound and analysing the next one is on-device, so
    // the saves run in the background while the queue keeps moving.
    const saves: Promise<void>[] = [];
    const save = async (id: string, result: PoseAnalysis) => {
      let saved = true;
      if (accountId && studentId) {
        saved = !!(await saveStudentAnalysis(accountId, studentId, result).catch(() => null));
      } else if (accountId) {
        // Independent writes, so run them together instead of back to back.
        const [sessionId] = await Promise.all([
          saveSession(result, accountId).catch(() => null),
          syncPlayerSummary(accountId, result.stroke, result.formScore).catch(() => false),
        ]);
        saved = !!sessionId;
      } else saveLocalSession(result);
      if (!accountId || owner.current === accountId) update(id, { saved });
    };
    try {
      const { analyzeStroke } = await import("@/lib/pose");
      for (const original of items) {
        update(original.id, { state: "running", saved: undefined, error: undefined });
        try {
          const result = await analyzeStroke(original.file, stroke);
          if (accountId && owner.current !== accountId) break;
          update(original.id, { state: "done", result });
          saves.push(save(original.id, result));
        } catch (error) {
          update(original.id, { state: "failed", error: error instanceof Error ? error.message : "Analysis failed" });
        }
      }
      await Promise.all(saves);
    } finally {
      setRunning(false);
    }
  }

  return <div>
    <span className="eyebrow">Session mode</span>
    <h1 className="h1">Batch analysis</h1>
    <p className="lead">Queue up to eight clips. TopSpin runs the same on-device analysis one clip at a time, so your browser stays responsive.{coachId && subjectName ? ` Every clip will be filed in ${subjectName}'s folder.` : ""}</p>
    <div className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        {coachId && <SubjectPicker id="batch-subject" label="Whose clips are these?" value={subject}
          onChange={(next) => { setChosen(next); rememberSubject(coachId, next); }}
          folders={students.folders} state={students.state} onAdd={students.add} disabled={running} />}
        <div><label className="label" htmlFor="batch-stroke">Stroke</label><select id="batch-stroke" className="select" value={stroke} onChange={(e) => setStroke(e.target.value)}><option value="auto">Auto</option><option value="forehand">Forehand</option><option value="backhand">Backhand</option><option value="serve">Serve</option><option value="volley">Volley</option><option value="slice">Slice</option></select></div>
        <label className="btn btn-ghost" style={{ cursor: "pointer" }} onPointerEnter={warmModel}>Add clips<input type="file" accept="video/*" multiple hidden onChange={(e) => add(e.target.files)} /></label>
        <button className="btn" onClick={run} disabled={running || !items.length}>{running ? "Analysing..." : `Analyse ${items.length || ""} clips`}</button>
        <button className="btn btn-ghost" onClick={() => setItems([])} disabled={running || !items.length}>Clear</button>
      </div>
    </div>
    {!items.length ? <div className="card" style={{ textAlign: "center", padding: 40 }}><p style={{ color: "var(--ink-soft)" }}>Add a few clips from the same practice session to begin.</p></div> :
      <div className="batch-list">{items.map((item, index) => <div className="batch-row" key={item.id}>
        <span className="batch-index">{String(index + 1).padStart(2, "0")}</span><div style={{ minWidth: 0, flex: 1 }}><strong className="truncate">{item.file.name}</strong><div style={{ color: item.state === "failed" ? "var(--danger)" : "var(--ink-soft)", fontSize: 12 }}>{item.state === "done" ? `${item.result?.stroke} · ${item.result?.formScore}/100${item.saved === false ? " · not saved" : item.saved === undefined ? " · saving…" : ""}` : item.error ?? item.state}</div></div>
        {item.result && (subjectStudentId(filedTo)
          ? <Link className="btn btn-ghost" href={`/students/${subjectStudentId(filedTo)}`}>Folder</Link>
          : <Link className="btn btn-ghost" href="/stats">Stats</Link>)}
      </div>)}</div>}
  </div>;
}
