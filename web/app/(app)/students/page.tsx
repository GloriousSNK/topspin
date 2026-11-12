"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useStudentFolders } from "@/components/SubjectPicker";
import { sortFolders, type FolderSort } from "@/lib/studentsLogic";
import PageSkeleton from "../_components/PageSkeleton";

export default function StudentsPage() {
  const { user, loading, role, roleLoading } = useAuth();
  const coachId = user && role === "coach" ? user.id : null;
  const { folders, state, add } = useStudentFolders(coachId);
  const [sort, setSort] = useState<FolderSort>("recent");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortFolders(q ? folders.filter((f) => f.name.toLowerCase().includes(q)) : folders, sort);
  }, [folders, sort, query]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || adding) return;
    setAdding(true); setError(null);
    const folder = await add(name);
    setAdding(false);
    if (!folder) { setError("Couldn't create that folder. Try again."); return; }
    setName("");
    router.push(`/students/${folder.id}`);
  }

  if (loading || roleLoading || (coachId && state === "loading")) {
    return <PageSkeleton eyebrow="Coach desk" title={<>Your <em>students</em></>} blocks={[92, 72, 72, 72]} />;
  }
  if (!user) return <Message text="Sign in with a coach account to keep folders for the students you film." />;
  if (role !== "coach") return <Message text="Student folders are for coach accounts. As a player, every analysis you run is filed as your own." />;
  if (state === "setup") return <Message text="Student folders need one more database step: run supabase-coach-students.sql in Supabase, then refresh." />;
  if (state === "error") return <Message text="We couldn't load your students. Refresh and try again." />;

  const total = folders.reduce((n, f) => n + f.analyses, 0);

  return (
    <div>
      <span className="eyebrow">Coach desk</span>
      <h1 className="h1">Your <em>students</em></h1>
      <p className="lead">
        One folder per student, kept on your account. Pick a student before you analyse a clip and it lands here,
        not in your own stats. Your students don&apos;t need an account, and no video is ever uploaded.
      </p>

      <form className="card students-add" onSubmit={create}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="label" htmlFor="new-student">New student</label>
          <input id="new-student" className="select" style={{ width: "100%" }} maxLength={60}
            placeholder="First name or nickname" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={adding || !name.trim()}>{adding ? "Adding…" : "Add student"}</button>
        {error && <div role="alert" style={{ color: "var(--danger)", fontSize: 13, width: "100%" }}>{error}</div>}
      </form>

      {folders.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "44px 24px" }}>
          <h2 className="students-empty-title">No folders yet</h2>
          <p style={{ color: "var(--ink-soft)", maxWidth: 460, margin: "0 auto 18px" }}>
            Add your first student above, or pick &ldquo;+ New student&rdquo; when you analyse a clip.
            Old clips of students in your <Link href="/stats" style={{ color: "var(--court)" }}>Stats history</Link> can be moved in from there.
          </p>
          <Link className="btn btn-ghost" href="/analyze">Analyse a clip</Link>
        </div>
      ) : (
        <>
          <div className="students-toolbar">
            <span className="students-count">{folders.length} {folders.length === 1 ? "student" : "students"} · {total} analyses</span>
            <input className="select" type="search" placeholder="Find a student" aria-label="Find a student"
              value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="select" aria-label="Sort students" value={sort} onChange={(e) => setSort(e.target.value as FolderSort)}>
              <option value="recent">Recently active</option>
              <option value="name">Name A–Z</option>
              <option value="count">Most analyses</option>
            </select>
          </div>
          {shown.length === 0 ? (
            <div className="card"><p style={{ color: "var(--ink-soft)" }}>No student matches &ldquo;{query}&rdquo;.</p></div>
          ) : (
            <div className="roster-list">
              {shown.map((f) => (
                <Link key={f.id} href={`/students/${f.id}`} className="roster-row lift">
                  <div className="roster-avatar">{f.name.charAt(0).toUpperCase()}</div>
                  <div className="roster-main">
                    <strong>{f.name}</strong>
                    <span>{f.analyses} {f.analyses === 1 ? "analysis" : "analyses"}{f.starred ? ` · ★ ${f.starred}` : ""}{f.note ? " · has notes" : ""}</span>
                  </div>
                  <div className="roster-metric"><span>Latest</span><strong>{f.latest_score ?? "--"}</strong></div>
                  <time>{f.last_active ? new Date(f.last_active).toLocaleDateString() : "No clips yet"}</time>
                  <span aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Message({ text }: { text: string }) {
  return (
    <div>
      <h1 className="h1">Students</h1>
      <div className="card"><p style={{ color: "var(--ink-soft)" }}>{text}</p>
        <Link href="/account" className="btn" style={{ marginTop: 14 }}>Open account</Link></div>
    </div>
  );
}
