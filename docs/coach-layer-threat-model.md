# TopSpin Coach Layer — Threat Model (Phase 1)

Written before the schema, per the build spec. The SQL in
`supabase-coach-layer.sql` is implemented against these threats. Anything here
marked **TODO(1b)** depends on the auth migration and consent route handlers.

## Phase 1b status (what's now closed)

The parent-consent flow is implemented. Closed here: the guardian-consent
tokens and approval route (**T6**), the server-derived signup age→status
decision so a client can't self-approve (**T5/T6**), and summary deletion on
leaving a squad (**T9**) — see `supabase-coach-layer-1b.sql`, `web/lib/consent*.ts`,
and `web/app/api/consent/*`. Rate-limiting now covers the consent request/approve
routes.

The app now uses `@supabase/ssr` cookie-backed sessions (**T7**), with proxy
refresh and a server-side code-exchange callback. Consent routes authenticate
from the verified cookie session rather than accepting bearer tokens from page
code. Legacy localStorage auth entries are removed during the migration.

**Still open (flagged deferrals):** the coach dashboard route guard (**T8**)
plus `join_squad` route rate-limiting, which land with the Phase 2 dashboard and
squad-join UI. Login and magic-link throttling use Supabase Auth's limits.

## Security-audit hardening (post-1b review)

A red-team pass over the whole surface added these fixes:

- **Consent self-clearing (was critical).** The 1a `account_consent` UPDATE
  policy let the owner set `consent_status = 'not_required'`, so a `pending`
  minor could clear their own guardian gate with one client-side update.
  `account_consent` is now **read-only to the client**; every write goes through
  the service-role consent routes. (supabase-coach-layer-1b.sql §B.)
- **Self-approval loopholes.** The init route now rejects a guardian email equal
  to the account's own email, and makes a `pending`/`approved` account **sticky**
  — re-running the age gate can't downgrade it to `not_required`. You can only
  move toward *more* protection.
- **Cross-account read leak (was high).** `getSessions()`/`getCustomDrills()`
  now filter by the owner id instead of trusting RLS alone — the sessions table's
  "public sessions read" policy had made an unfiltered select return other
  public users' rows. (web/lib/history.ts.)
- **Account-switch state bleed.** The account and stats pages reset per-user
  state on identity change, so a previous account's profile/rows can't linger.
- **Misc:** approve-token length guard; on-device upload type/size guard.

**Known, accepted low-severity:** `shares` allows anonymous inserts (public
summary links) — a storage-spam vector, not a data-exposure one; bound it with a
payload-size check + pruning if it's ever abused.

## What we store, and where the wall is

| Data | Table | Who can read it |
|---|---|---|
| Raw clip / full pose / flaw breakdown | (device) + `sessions` | The player only. Never a coach, unless the player explicitly shares a clip (Phase 3). |
| Summary rows (stroke, score, drills done, time) | `player_summaries` | The player, and the coach of the squad they're in — checked on every read. |
| Display name | `profiles` | The player, and their squad coach. |
| Birth year, guardian email, consent status | `account_consent` | The player only. **Coaches cannot read this.** Server (service role) handles approval. |
| Squad code | `squads` | The coach who owns it. Players never SELECT this table. |

Column-level minimisation is done by *splitting tables*, because Postgres RLS is
row-level only. That's why consent lives apart from `profiles`, and summaries
live apart from `sessions`.

## Threats and mitigations

**T1 — A squad code leaks / is shared publicly.**
A code only lets someone *join* that squad as a player (via `join_squad()`),
which shares *their own* summary with that coach. It grants no read access to
other members. Worst case: a coach's roster gets a junk member, whom the coach
can remove (`coach removes member`). Codes are not secrets that protect other
players' data. *Residual:* spam joins — mitigated by rate-limiting the join
route **TODO(1b)** and letting coaches rotate a squad's code (Phase 2 nicety).

**T2 — A stranger guesses another player's ID to read their data.**
Every read of `player_summaries` / `profiles` by a non-owner requires an
`exists(...)` join proving the caller is the `coach_id` of a squad the target
`player_id` belongs to. Guessing a UUID gets you nothing without that link. No
policy grants blanket authenticated read on these tables.

**T3 — Coach↔player link checked only at join time, then trusted.**
It isn't. The link is re-evaluated by RLS on *every* SELECT. When a player
leaves (`player leaves squad` delete) or a coach removes them, the membership
row is gone, so the `exists(...)` check fails immediately on the next read. No
cached grant to revoke.

**T4 — Squad-table enumeration (scrape all codes / all coaches).**
`squads` has no general read policy. Joining goes through the SECURITY DEFINER
`join_squad()` function, which looks a squad up by code internally and never
returns the table to the caller. You can't list squads or map codes to coaches.

**T5 — A minor syncs data before a guardian consents.**
`player_summaries` INSERT is gated by `consent_ok()`, which is false while
`consent_status = 'pending'`. `join_squad()` also refuses to join without
consent. A minor with a pending account can use the whole app locally but
cannot sync or join. *Enforcement of the age→pending decision at signup and the
guardian-approval flip is* **TODO(1b/1c)** *(server-side, service role).*

**T6 — A player self-approves their own consent.**
The `own consent update` policy's `WITH CHECK` forbids the owner from setting
`consent_status = 'approved'`. Only the service role (guardian-approval route)
can flip it. **TODO(1c):** that route must verify a single-use, expiring token
sent to the guardian email — not just any POST.

**T7 — Session/token theft.**
Auth uses `@supabase/ssr` cookies with proxy refresh and no localStorage token.
Because the existing app performs RLS-protected Supabase queries directly from
the browser, these cookies cannot be strictly `httpOnly`: the browser SDK must
refresh and attach the session. The CSP and React escaping reduce XSS exposure.
Making tokens fully inaccessible to JavaScript requires moving every Supabase
query behind server routes; track that as a separate hardening phase rather
than claiming the current architecture provides it.

**T8 — Unauthenticated access to coach-only routes/views.**
**TODO(1b/2):** the coach dashboard route checks for an authenticated session
server-side (middleware + server component) and that the user owns ≥1 squad,
before rendering. RLS is the backstop even if a view leaks — a non-coach's
queries return nothing.

**T9 — Right to be forgotten.**
Deleting the auth user cascades (`on delete cascade`) through `account_consent`,
`squads`, `squad_members`, `player_summaries`, `sessions`, `custom_drills`,
`profiles`. Leaving a squad deletes the membership; **TODO(1b):** also delete
that player's `player_summaries` on leave so sync data doesn't linger.

## Rate-limiting checklist (TODO 1b)
- Login / magic-link request
- `join_squad` (squad-code brute force)
- Consent-request send + consent-approval endpoints
# Completed coach-layer boundaries

The final implementation is defined by `supabase-complete-app.sql`:

- Account roles are chosen once. Player and coach capabilities are checked in database RPCs.
- Squad-code attempts are throttled in Postgres, so serverless restarts do not reset the limit.
- Coach roster/history RPCs derive access from the current squad relationship on every call.
- Practice completions are private player rows. A minimal coach summary is added only while a
  valid squad membership exists.
- Full analysis breakdowns reach a coach only through the explicit player share action. Raw clips
  remain on-device.
- Coach notes are limited to the linked coach and linked player.
- Parent reports use 192-bit random ids, expire after 30 days, and expose summary fields only.
- Leaving a squad deletes coach-visible summaries, analysis shares, notes, and reports for that
  relationship. Deleting the auth account cascades all account-owned data.
- Anonymous analysis, drills, and practice history use separate browser-only keys and are never
  merged into a later signed-in account.
