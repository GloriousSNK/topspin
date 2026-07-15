# TopSpin

A tennis practice app. Upload a clip of a stroke and it reads your form with
in-browser pose detection, turns what it finds into drills, and lets you play
with real ball-flight physics in the Ball Lab.

It's two pieces that run together:

- `web/` — the Next.js front end (the site and the tools)
- `ml-service/` — a FastAPI backend for the physics, drill generation, and traffic counts

The stroke analysis runs entirely in your browser, so clips never leave your
device. The backend is deliberately light and doesn't need a GPU.

## Running it locally

You'll need Node 18+ and Python 3.11+.

Backend:

```bash
cd ml-service
py -m venv .venv
./.venv/Scripts/python -m pip install -r requirements.txt
./.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Front end, in a second terminal:

```bash
cd web
npm install
npm run dev
```

Then open http://localhost:3000. Start the backend first, or the tool pages will
show a "can't reach the service" note until it's up.

## Notes

- Analytics are self-hosted and anonymous: no advertising cookies, no third
  parties, and nothing tied to a person. Signed-in accounts use essential
  Supabase session cookies. See the Privacy page in the app.
- Locally the backend uses SQLite. In production, set `DATABASE_URL` to a Postgres
  connection string and it switches over automatically so the numbers persist.
- The physics (drag, Magnus, the chaos/sensitivity analysis) is the real thing.
  Pose analysis is an honest, single-camera read, not a biomechanics lab.
## Database setup

Run the Supabase migrations in this order:

1. `supabase-setup.sql`
2. `supabase-coach-layer.sql`
3. `supabase-coach-layer-1b.sql`
4. `supabase-security-hardening.sql`
5. `supabase-complete-app.sql`
6. `supabase-squad-code-fix.sql`

The final migration adds account roles, squads, database-backed squad-code throttling,
minimal player summary sync, coach rosters, private analysis shares and notes, expiring
parent reports, and complete squad cleanup. Code that depends on it fails closed until
the migration is applied.

Server-side account deletion and guardian email require these Vercel variables in
addition to the two public Supabase variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
CONSENT_EMAIL_FROM
```

Do not prefix the service-role key with `NEXT_PUBLIC_`.
