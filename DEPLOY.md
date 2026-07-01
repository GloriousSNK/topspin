# Deploying TopSpin (free: Vercel + Render)

Frontend → **Vercel** (free, fast). Backend → **Render** (free web service).
Both deploy straight from a GitHub repo — no CLI tools needed.

> Note: Render's free backend sleeps after ~15 min idle and takes ~30–50s to
> wake on the first request. Fine for a personal/demo site; upgrade to a paid
> Render instance (or Fly.io) later to remove the cold start.

---

## 1. Push the code to GitHub (one time)
The repo is already committed locally. Create an empty GitHub repo, then:

```bash
cd C:\Projects\TennisAPP
git remote add origin https://github.com/<you>/topspin.git
git branch -M main
git push -u origin main
```

## 2. Deploy the backend on Render
1. Go to <https://dashboard.render.com> → **New +** → **Blueprint**.
2. Connect your GitHub and pick this repo. Render reads `render.yaml` and
   creates the `tennis-ml` web service.
3. Click **Apply**. Wait for the build; you'll get a URL like
   `https://tennis-ml.onrender.com`. Copy it.
4. (You'll set `TENNIS_ALLOWED_ORIGINS` in step 4, after the frontend exists.)

## 3. Deploy the frontend on Vercel
1. Go to <https://vercel.com/new> → **Import** your GitHub repo.
2. Set **Root Directory** = `web` (Vercel auto-detects Next.js).
3. Add an Environment Variable:
   - `NEXT_PUBLIC_ML_URL` = the Render URL from step 2 (e.g.
     `https://tennis-ml.onrender.com`)
4. **Deploy**. You'll get a URL like `https://topspin.vercel.app`. Copy it.

## 4. Persistent analytics (so Insights don't reset)  ← required for Insights
Render's free backend has an **ephemeral disk and sleeps when idle**, so the
local SQLite analytics file gets wiped on every restart (counts fall back to 0).
Point it at a free, always-persistent Postgres instead:

1. Create a free database at <https://neon.tech> (sign in with GitHub → it makes
   a Postgres project instantly).
2. Copy its **Pooled** connection string (looks like
   `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`).
3. In Render → `tennis-ml` → **Environment** → add
   `DATABASE_URL` = that connection string. Save.

The backend auto-detects `DATABASE_URL` and uses Postgres (persistent); with it
unset it uses local SQLite. No code change needed. Counts now survive restarts.

## 5. Connect them (CORS)
1. Back in Render → `tennis-ml` → **Environment** → set
   `TENNIS_ALLOWED_ORIGINS` = your Vercel URL (e.g.
   `https://topspin.vercel.app`). Save — the backend redeploys.
2. Open your Vercel URL. Done. 🎾

---

## Redeploying after changes
Just `git push` — both Vercel and Render auto-deploy on push to `main`.

## What resets on the free backend
Uploaded clips and the analytics SQLite DB live on ephemeral disk, so they
reset when Render restarts the service. Clips are never read back (analysis is
stubbed), so nothing breaks; only the traffic counts reset. Add a Render disk
(paid) or a managed DB if you need them to persist.
