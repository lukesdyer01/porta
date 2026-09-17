# Setup

Most of this is already done. What's finished, what's left, and how to redo it if the
project is ever rebuilt.

## Already configured

Applied to project `jubvaqrnciojmigzyegx` (`porta`, us-east-2, Postgres 17) via the
Supabase CLI:

- **Schema** — all migrations in `supabase/migrations/` pushed (`supabase db push`)
- **Signup gate** — the `before_user_created` hook points at `public.hook_restrict_signup`,
  so an address that isn't on the invite list is refused at signup. Verified: a
  non-allowlisted address gets HTTP 403.
- **Site and redirect URLs** — `https://lukesdyer01.github.io/porta/`, plus
  `http://localhost:5173/**` for local work
- **OTP length 6**, matching the sign-in screen
- **Email rate limit raised to 60/hour** — the default of 2 would strand people the week
  everyone signs in. Takes effect once custom SMTP is on.
- **GitHub secrets** — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set on the repo
- **Anon lockdown verified** — with the public key, an anonymous caller gets HTTP 401 on
  every table (`profiles`, `households`, `allowed_emails`, `trips`, `houses`, `house_info`,
  `heartbeat`). Only `ping()` is reachable, which is what the keep-alive needs.

## Still to do

### Send emails through Resend — optional now

Sign-in no longer uses email at all: people register with an email, a password and the
family code, and a session is issued immediately. Nothing is emailed, so nothing can fail
to arrive.

Resend is still worth setting up eventually, for password resets and any future
notifications. Until then, password resets will not work.

1. Sign up at [resend.com](https://resend.com) — free tier is 3,000/month.
2. Supabase dashboard → **Project Settings → Authentication → SMTP Settings**:
   host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key.
3. Uncomment the two `[auth.email.template.*]` blocks in `supabase/config.toml` and run
   `supabase config push`. They are commented out because a free project rejects template
   changes, and that rejection fails the entire auth config push.


## Inviting the rest of the family

**Text them the family code.** They enter their email, the site asks for the code, and
they're in — no action from you. Anyone who joins that way is written into the allowlist,
so you keep a per-person record and can still revoke individually.

Manage the code on the **Members** screen: add one, turn it off, or delete it. Avoid
anything guessable from the site itself — "king" is written on every page.

The same screen invites people directly by email (paste any number at once), promotes and
demotes organizers, and removes access.

Two guards live in the database rather than the page, so a hand-written API call cannot get
around them:

- The last organizer cannot be removed or demoted — otherwise nobody could create a trip
  and only raw SQL could fix it.
- Role changes go through a function. Members are not granted write access to the `role`
  column at all, so a member cannot promote themselves.


## After any future migration

`supabase db push`, then **Advisors → Security Advisor**. Treat these as build failures —
each silently disables protection rather than erroring:

- `security_definer_view` — a view that ignores every policy
- `rls_disabled_in_public` — an unprotected table
- `function_search_path_mutable` — a hijackable helper

## Local development

`.env.local` already holds the project URL and anon key (gitignored).

```bash
npm install
npm run dev
```
