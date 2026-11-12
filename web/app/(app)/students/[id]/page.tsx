"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useStudentFolders } from "@/components/SubjectPicker";
import ContactSkeleton from "@/components/ContactSkeleton";
import PageSkeleton from "../../_components/PageSkeleton";
import {
  deleteStudent, deleteStudentAnalysis, getStudentFolder, refile, renameStudent, setStudentNote,
  updateStudentAnalysis, type AnalysisPatch,
} from "@/lib/students";
import {
  analysisTitle, sortAnalyses, studentSubject, ME,
  type AnalysisSort, type StudentAnalysisRow, type StudentFolder, type StudentRow, type Subject,
} from "@/lib/studentsLogic";

type LoadState = "loading" | "ready" | "missing" | "setup" | "error";

export default function StudentFolderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading, role, roleLoading } = useAuth();
  const coachId = user && role === "coach" ? user.id : null;
  const { folders } = useStudentFolders(coachId);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [rows, setRows] = useState<StudentAnalysisRow[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [sort, setSort] = useState<AnalysisSort>("newest");
  const [starredOnly, setStarredOnly] = useState(false);
  const [stroke, setStroke] = useState("all");
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const active = useRef<string | null>(coachId);

  useEffect(() => {
    active.current = coachId;
    let alive = true;
    // New coach or folder: clear the previous one before the refetch lands.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStudent(null); setRows([]); setState("loading");
    if (!coachId || !id) return;
    getStudentFolder(coachId, id).then((result) => {
      if (!alive) return;
      if (!result.ok) { setState(result.error === "setup" ? "setup" : "error"); return; }
      if (!result.data) { setState("missing"); return; }
      setStudent(result.data.student); setRows(result.data.analyses); setState("ready");
    });
    return () => { alive = false; };
  }, [coachId, id]);

  const strokes = useMemo(() => [...new Set(rows.map((r) => r.stroke).filter((s): s is string => !!s))].sort(), [rows]);
  const shown = useMemo(() => sortAnalyses(
    rows.filter((r) => (!starredOnly || r.starred) && (stroke === "all" || r.stroke === stroke)), sort,
  ), [rows, sort, starredOnly, stroke]);
  // Folder stats are derived once per data change (up to 1000 rows), not on every
  // render — filters, notices and note typing re-render this page often.
  const { average, best, chrono, latest } = useMemo(() => {
    const scored = rows.filter((r) => typeof r.form_score === "number") as (StudentAnalysisRow & { form_score: number })[];
    const chrono = [...scored].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return {
      chrono,
      average: scored.length ? Math.round(scored.reduce((n, r) => n + r.form_score, 0) / scored.length) : null,
      best: scored.length ? Math.max(...scored.map((r) => r.form_score)) : null,
      latest: chrono.length ? chrono[chrono.length - 1].form_score : null,
    };
  }, [rows]);
  const moveTargets = useMemo(
    () => folders.filter((f) => f.id !== id).sort((a, b) => a.name.localeCompare(b.name)),
    [folders, id],
  );

  async function patch(analysisId: string, change: AnalysisPatch): Promise<boolean> {
    if (!coachId) return false;
    const before = rows;
    setRows((all) => all.map((r) => r.id === analysisId ? { ...r, ...change } as StudentAnalysisRow : r));
    const ok = await updateStudentAnalysis(coachId, analysisId, change).catch(() => false);
    if (active.current !== coachId) return false;
    if (!ok) { setRows(before); setNotice({ text: "Couldn't save that change.", error: true }); }
    return ok;
  }

  async function removeAnalysis(row: StudentAnalysisRow) {
    if (!coachId || !confirm(`Delete "${analysisTitle(row)}"? This can't be undone.`)) return;
    // Optimistic: the row goes immediately and comes back if the delete fails.
    setRows((all) => all.filter((r) => r.id !== row.id));
    const ok = await deleteStudentAnalysis(coachId, row.id).catch(() => false);
    if (active.current !== coachId) return;
    if (!ok) { restore(row); setNotice({ text: "Couldn't delete that analysis.", error: true }); }
  }

  // Put a row back after a failed optimistic change (the list is re-sorted on render).
  function restore(row: StudentAnalysisRow) {
    setRows((all) => all.some((r) => r.id === row.id) ? all : [...all, row]);
  }

  async function move(row: StudentAnalysisRow, to: Subject) {
    if (!coachId || !student) return;
    if (to === ME && (row.note || row.title || row.starred)
      && !confirm("Your own history doesn't keep titles, stars or notes. Move it anyway?")) return;
    setRows((all) => all.filter((r) => r.id !== row.id)); // optimistic, rolled back below on failure
    const moved = await refile(coachId, { subject: studentSubject(student.id), id: row.id }, to).catch(() => null);
    if (active.current !== coachId) return;
    if (!moved) { restore(row); setNotice({ text: "Couldn't move that analysis.", error: true }); return; }
    const target = to === ME ? "your own history" : `${folders.find((f) => studentSubject(f.id) === to)?.name ?? "the other"}'s folder`;
    setNotice({ text: `Moved "${analysisTitle(row)}" to ${target}.` });
  }

  async function rename(next: string) {
    if (!coachId || !student) return false;
    const ok = await renameStudent(coachId, student.id, next).catch(() => false);
    if (ok && active.current === coachId) setStudent({ ...student, name: next.replace(/\s+/g, " ").trim() });
    return ok;
  }

  async function removeFolder() {
    if (!coachId || !student) return;
    const n = rows.length;
    if (!confirm(`Delete ${student.name}'s folder${n ? ` and all ${n} ${n === 1 ? "analysis" : "analyses"} in it` : ""}? This can't be undone.`)) return;
    setDeletingFolder(true);
    const ok = await deleteStudent(coachId, student.id).catch(() => false);
    if (active.current !== coachId) return;
    if (ok) { router.push("/students"); return; }
    setDeletingFolder(false);
    setNotice({ text: "Couldn't delete this folder.", error: true });
  }

  if (loading || roleLoading || (coachId && state === "loading")) {
    return <PageSkeleton title="Student" backLink={<Link href="/students" className="back-link">← Students</Link>}
      blocks={[56, 140, 120, 96, 96]} />;
  }
  if (!user || role !== "coach") return <Message text="Sign in with a coach account to open student folders." />;
  if (state === "setup") return <Message text="Student folders need the supabase-coach-students.sql migration. Run it in Supabase, then refresh." />;
  if (state === "missing") return <Message text="This folder doesn't exist, or it belongs to another account." />;
  if (state === "error" || !student) return <Message text="We couldn't load this folder. Refresh and try again." />;


  return (
    <div>
      <Link href="/students" className="back-link">← Students</Link>
      <FolderHeading name={student.name} onRename={rename} onDelete={removeFolder} deleting={deletingFolder} />
      <p className="lead">
        {rows.length ? `${rows.length} ${rows.length === 1 ? "analysis" : "analyses"} filed here.` : "No analyses filed here yet."}{" "}
        Only you can see this folder.
      </p>

      <div className="students-actions">
        <Link className="btn" href={`/analyze?student=${student.id}`}>Analyse a clip for {student.name} →</Link>
        <Link className="btn btn-ghost" href={`/batch`}>Batch a whole lesson</Link>
      </div>

      {notice && (
        <p role={notice.error ? "alert" : "status"} className="students-notice" style={{ color: notice.error ? "var(--danger)" : "var(--ink-soft)" }}>
          {notice.error ? "⚠" : "✓"} {notice.text}
          <button className="icon-btn" aria-label="Dismiss" onClick={() => setNotice(null)}>✕</button>
        </p>
      )}

      {rows.length > 0 && (
        <div className="grid grid-4" style={{ marginBottom: 18 }}>
          <Stat value={rows.length} label="Analyses" />
          <Stat value={latest ?? "--"} label="Latest form" accent />
          <Stat value={average ?? "--"} label="Average form" />
          <Stat value={best ?? "--"} label="Best form" />
        </div>
      )}

      {chrono.length >= 2 && (
        <div className="lp-panel" style={{ marginBottom: 18 }}>
          <div className="lp-panel-head"><span>Form score over time</span><span className="val">AVG {average}</span></div>
          <div style={{ padding: "0 18px 18px" }}>
            <div className="score-line" aria-label={`${student.name}'s form score history`}>
              {chrono.map((r) => <span key={r.id} style={{ height: `${Math.max(4, r.form_score)}%` }}
                title={`${analysisTitle(r)} · ${r.form_score}/100`} />)}
            </div>
          </div>
          <div className="lp-panel-foot">
            <span>{new Date(chrono[0].created_at).toLocaleDateString()}</span>
            <span>{new Date(chrono[chrono.length - 1].created_at).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      <FolderNote key={student.id} initial={student.note ?? ""}
        onSave={async (note) => {
          if (!coachId) return false;
          const ok = await setStudentNote(coachId, student.id, note).catch(() => false);
          if (ok && active.current === coachId) setStudent({ ...student, note: note.trim() || null });
          return ok;
        }} />

      {rows.length > 0 && (
        <div className="students-toolbar">
          <span className="students-count">{shown.length} of {rows.length}</span>
          <button type="button" className={`chip ${starredOnly ? "on" : ""}`} aria-pressed={starredOnly}
            onClick={() => setStarredOnly((v) => !v)}>★ Starred</button>
          {strokes.length > 1 && (
            <select className="select" aria-label="Filter by stroke" value={stroke} onChange={(e) => setStroke(e.target.value)}>
              <option value="all">All strokes</option>
              {strokes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select className="select" aria-label="Sort analyses" value={sort} onChange={(e) => setSort(e.target.value as AnalysisSort)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="best">Highest form</option>
            <option value="worst">Lowest form</option>
          </select>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <p style={{ color: "var(--ink-soft)", marginBottom: 6 }}>Nothing here yet.</p>
          <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>
            Analyse a clip with {student.name} picked, or move one in from your <Link href="/stats" style={{ color: "var(--court)" }}>Stats history</Link>.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <div className="card"><p style={{ color: "var(--ink-soft)" }}>No analyses match these filters.</p></div>
      ) : (
        <div className="analysis-list">
          {shown.map((row) => (
            <AnalysisItem key={row.id} row={row} studentName={student.name} moveTargets={moveTargets}
              onPatch={(change) => patch(row.id, change)}
              onDelete={() => removeAnalysis(row)}
              onMove={(to) => move(row, to)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderHeading({ name, onRename, onDelete, deleting }: {
  name: string; onRename: (name: string) => Promise<boolean>; onDelete: () => void; deleting: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [failed, setFailed] = useState(false);
  async function save() {
    const next = value.replace(/\s+/g, " ").trim();
    if (!next || next === name) { setValue(name); setEditing(false); return; }
    const ok = await onRename(next);
    setFailed(!ok);
    if (ok) setEditing(false);
  }
  return (
    <div className="folder-heading">
      {editing ? (
        <input className="select folder-rename" autoFocus maxLength={60} value={value} aria-label="Student name"
          onChange={(e) => setValue(e.target.value)} onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setValue(name); setEditing(false); } }} />
      ) : (
        <h1 className="h1" style={{ marginBottom: 0 }}>{name}</h1>
      )}
      <div className="folder-heading-actions">
        {!editing && <button className="btn btn-ghost" onClick={() => { setValue(name); setEditing(true); }}>Rename</button>}
        <button className="btn btn-danger" onClick={onDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete folder"}</button>
      </div>
      {failed && <div role="alert" style={{ color: "var(--danger)", fontSize: 13, width: "100%" }}>Couldn&apos;t rename. Try again.</div>}
    </div>
  );
}

function FolderNote({ initial, onSave }: { initial: string; onSave: (note: string) => Promise<boolean> }) {
  const [note, setNote] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  async function save() {
    setState("saving");
    const ok = await onSave(note);
    setState(ok ? "saved" : "failed");
    if (ok) setSaved(note);
  }
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <label className="card-title" htmlFor="folder-note" style={{ display: "block" }}>Coach notes</label>
      <textarea id="folder-note" className="select note-area" maxLength={2000} value={note}
        placeholder="Grip, goals, what you're working on next lesson…"
        onChange={(e) => { setNote(e.target.value); setState("idle"); }} />
      <div className="note-foot">
        <button className="btn btn-ghost" onClick={save} disabled={state === "saving" || note === saved}>
          {state === "saving" ? "Saving…" : state === "saved" && note === saved ? "Saved" : "Save notes"}
        </button>
        {state === "failed" && <span role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>Couldn&apos;t save.</span>}
      </div>
    </div>
  );
}

function AnalysisItem({ row, studentName, moveTargets, onPatch, onDelete, onMove }: {
  row: StudentAnalysisRow;
  studentName: string;
  moveTargets: StudentFolder[];
  onPatch: (change: AnalysisPatch) => Promise<boolean>;
  onDelete: () => void;
  onMove: (to: Subject) => void;
}) {
  const title = analysisTitle(row);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(title);
  const [note, setNote] = useState(row.note ?? "");
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const flaws = row.flaws ?? [];
  const joints = row.joint_feedback ?? [];

  async function saveName() {
    const next = name.replace(/\s+/g, " ").trim();
    setEditing(false);
    if (!next || next === title) { setName(title); return; }
    if (!(await onPatch({ title: next }))) setName(title);
  }
  async function saveNote() {
    setNoteState("saving");
    setNoteState(await onPatch({ note }) ? "saved" : "failed");
  }

  return (
    <article className={`analysis-item ${row.starred ? "starred" : ""}`}>
      <div className="analysis-head">
        <button type="button" className={`star-btn ${row.starred ? "on" : ""}`} aria-pressed={row.starred}
          aria-label={row.starred ? "Unstar" : "Star"} title={row.starred ? "Unstar" : "Star"}
          onClick={() => onPatch({ starred: !row.starred })}>{row.starred ? "★" : "☆"}</button>
        {editing ? (
          <input className="select" style={{ flex: 1, minWidth: 160, padding: "4px 8px" }} autoFocus maxLength={80}
            value={name} aria-label="Analysis title" onChange={(e) => setName(e.target.value)} onBlur={saveName}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setName(title); setEditing(false); } }} />
        ) : (
          <button type="button" className="analysis-title" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <span aria-hidden="true" className="analysis-caret">{open ? "▾" : "▸"}</span>{title}
          </button>
        )}
        <div className="analysis-tools">
          {typeof row.form_score === "number" && <span className="pill accent">{row.form_score}/100</span>}
          <button className="icon-btn" title="Rename" aria-label="Rename" onClick={() => { setName(title); setEditing(true); }}>✎</button>
          <button className="icon-btn" title="Delete" aria-label="Delete" onClick={onDelete} style={{ color: "var(--danger)" }}>✕</button>
        </div>
      </div>

      <div className="analysis-meta">
        <span>{new Date(row.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
        {row.stroke && <span className="tag" style={{ textTransform: "capitalize" }}>{row.stroke}</span>}
        {row.serve_speed ? <span className="tag">~{row.serve_speed} km/h</span> : null}
        {!open && <span className="analysis-flaws">{flaws.map((f) => f.label).join(" · ") || "No major flags"}</span>}
      </div>

      {!open && row.note && <p className="analysis-note-preview">“{row.note}”</p>}

      {open && (
        <div className="analysis-body">
          <div className="grid grid-2">
            <div>
              <div className="card-title">What we saw</div>
              {flaws.length === 0 ? (
                <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Nothing major at contact.</p>
              ) : flaws.map((f) => (
                <div key={f.id} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{f.label}</div>
                  <div className="bar-track"><div className="bar-fill" style={{
                    width: `${f.severity * 100}%`,
                    background: f.severity > 0.6 ? "var(--danger)" : f.severity > 0.4 ? "var(--warn)" : "var(--accent)",
                  }} /></div>
                  <div style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 5 }}>💡 {f.coaching_cue}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="card-title">{studentName}&apos;s contact position</div>
              {row.skeleton && Object.keys(row.skeleton).length > 0 && <ContactSkeleton skeleton={row.skeleton} caption="contact frame" />}
              {joints.length > 0 && (
                <div className="table-wrap" style={{ marginTop: 12 }}>
                  <table className="data">
                    <thead><tr><th>Check</th><th>Reading</th><th></th></tr></thead>
                    <tbody>{joints.map((j) => (
                      <tr key={j.joint}><td>{j.joint}</td><td className="mono">{j.reading}</td>
                        <td><span className={`pill ${j.status === "good" ? "good" : j.status === "minor" ? "warn" : "off"}`}>{j.status}</span></td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <label className="label" htmlFor={`note-${row.id}`} style={{ marginTop: 16 }}>Your notes on this clip</label>
          <textarea id={`note-${row.id}`} className="select note-area" maxLength={2000} value={note}
            placeholder="What you told them, what to try next time…"
            onChange={(e) => { setNote(e.target.value); setNoteState("idle"); }} />
          <div className="note-foot">
            <button className="btn btn-ghost" onClick={saveNote} disabled={noteState === "saving" || note === (row.note ?? "")}>
              {noteState === "saving" ? "Saving…" : noteState === "saved" && note === (row.note ?? "") ? "Saved" : "Save note"}
            </button>
            {noteState === "failed" && <span role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>Couldn&apos;t save.</span>}
            <select className="select move-select" aria-label="Move to another folder" value=""
              onChange={(e) => { if (e.target.value) onMove(e.target.value as Subject); }}>
              <option value="">Move to…</option>
              {moveTargets.length > 0 && (
                <optgroup label="Students">
                  {moveTargets.map((f) =>
                    <option key={f.id} value={studentSubject(f.id)}>{f.name}</option>)}
                </optgroup>
              )}
              <option value={ME}>My own history</option>
            </select>
          </div>
        </div>
      )}
    </article>
  );
}

function Stat({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return <div className="card" style={{ padding: 16 }}><div className="stat">
    <span className="stat-value" style={{ fontSize: 24, color: accent ? "var(--court)" : "var(--ink)" }}>{value}</span>
    <span className="stat-label">{label}</span></div></div>;
}

function Message({ text }: { text: string }) {
  return (
    <div>
      <Link href="/students" className="back-link">← Students</Link>
      <h1 className="h1" style={{ marginTop: 12 }}>Student</h1>
      <div className="card"><p style={{ color: "var(--ink-soft)" }}>{text}</p></div>
    </div>
  );
}
