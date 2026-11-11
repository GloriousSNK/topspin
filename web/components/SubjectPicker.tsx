"use client";

import { useCallback, useEffect, useState } from "react";
import { addStudent, listStudentFolders } from "@/lib/students";
import { ME, studentSubject, subjectStudentId, type StudentFolder, type Subject } from "@/lib/studentsLogic";

export type FoldersState = "loading" | "ready" | "setup" | "error";

// Loads a coach's student folders. Pass null for anyone who isn't a coach.
export function useStudentFolders(coachId: string | null) {
  const [folders, setFolders] = useState<StudentFolder[]>([]);
  const [state, setState] = useState<FoldersState>("loading");

  useEffect(() => {
    let alive = true;
    // Identity changed: drop the previous coach's folders before refetching.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFolders([]); setState("loading");
    if (!coachId) return;
    listStudentFolders(coachId).then((result) => {
      if (!alive) return;
      if (result.ok) { setFolders(result.data); setState("ready"); }
      else setState(result.error === "setup" ? "setup" : "error");
    });
    return () => { alive = false; };
  }, [coachId]);

  const add = useCallback(async (name: string): Promise<StudentFolder | null> => {
    if (!coachId) return null;
    const result = await addStudent(coachId, name);
    if (!result.ok) { if (result.error === "setup") setState("setup"); return null; }
    const folder: StudentFolder = { ...result.data, analyses: 0, latest_score: null, last_active: null, starred: 0 };
    setFolders((all) => [...all, folder]);
    return folder;
  }, [coachId]);

  const nameOf = useCallback((subject: Subject) => {
    const id = subjectStudentId(subject);
    return id ? folders.find((f) => f.id === id)?.name ?? "Student" : null;
  }, [folders]);

  return { folders, state, add, nameOf };
}

const NEW = "__new__";

// "Who's in this clip?" — the coach's own history, or one of their student folders.
export default function SubjectPicker({
  id, label = "Who's in this clip?", value, onChange, folders, state, onAdd, disabled, compact,
}: {
  id: string;
  label?: string;
  value: Subject;
  onChange: (subject: Subject) => void;
  folders: StudentFolder[];
  state: FoldersState;
  onAdd: (name: string) => Promise<StudentFolder | null>;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sorted = [...folders].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true); setError(null);
    const folder = await onAdd(name);
    setBusy(false);
    if (!folder) { setError("Couldn't create that folder."); return; }
    onChange(studentSubject(folder.id));
    setName(""); setAdding(false);
  }

  if (state === "setup") {
    return (
      <div className="subject-picker">
        {!compact && <span className="label">{label}</span>}
        <p className="subject-hint">Student folders need the <code>supabase-coach-students.sql</code> migration. Analyses save to your own history until it&apos;s run.</p>
      </div>
    );
  }

  return (
    <div className="subject-picker">
      {!compact && <label className="label" htmlFor={id}>{label}</label>}
      {adding ? (
        <div className="subject-new">
          <input id={id} className="select" autoFocus maxLength={60} placeholder="First name or nickname"
            value={name} disabled={busy} aria-label="New student name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") { setAdding(false); setName(""); } }} />
          <button type="button" className="btn" onClick={create} disabled={busy || !name.trim()}>{busy ? "Adding…" : "Add"}</button>
          <button type="button" className="btn btn-ghost" onClick={() => { setAdding(false); setName(""); setError(null); }} disabled={busy}>Cancel</button>
        </div>
      ) : (
        <select id={id} className="select subject-select" value={value} disabled={disabled || state === "loading"}
          aria-label={compact ? label : undefined}
          onChange={(e) => { if (e.target.value === NEW) setAdding(true); else onChange(e.target.value as Subject); }}>
          <option value={ME}>Me · my own history</option>
          {sorted.length > 0 && (
            <optgroup label="Students">
              {sorted.map((f) => <option key={f.id} value={studentSubject(f.id)}>{f.name}</option>)}
            </optgroup>
          )}
          <option value={NEW}>+ New student…</option>
        </select>
      )}
      {error && <div role="alert" className="subject-error">{error}</div>}
    </div>
  );
}
