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

- Analytics are self-hosted and anonymous: no cookies, no third parties, nothing
  tied to a person. See the Privacy page in the app.
- Locally the backend uses SQLite. In production, set `DATABASE_URL` to a Postgres
  connection string and it switches over automatically so the numbers persist.
- The physics (drag, Magnus, the chaos/sensitivity analysis) is the real thing.
  Pose analysis is an honest, single-camera read, not a biomechanics lab.
