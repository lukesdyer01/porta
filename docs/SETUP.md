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

### Send sign-in emails through Resend — required, not optional

Two reasons, and the second is a hard blocker:

1. Supabase's built-in sender is throttled to a couple of messages per hour across the
   whole project. Fine for testing alone; it fails the week twelve people sign in.
2. **Free projects on the default mail provider cannot customise email templates.** The
   stock template contains only a link, never the 6-digit code. So the code-based sign-in
   can't work until custom SMTP is on. The templates are already written
   (`supabase/templates/`) and configured in `config.toml` — they apply the moment SMTP is
   enabled and you run `supabase config push`.

Until then, sign in by tapping the link in the email, in the same browser you requested it
from.

1. Sign up at [resend.com](https://resend.com) — free tier is 3,000/month.
2. Verify a sending domain (or start with their test sender).
3. Supabase dashboard → **Project Settings → Authentication → SMTP Settings**:
   - Host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key
   - Set sender name and address
4. **Uncomment the two `[auth.email.template.*]` blocks in `supabase/config.toml`**, then
   run `supabase config push`. This applies the code-first email templates and the 60/hour
   rate limit, both currently blocked by the free default provider.

   They are commented out on purpose: a free project rejects any template change, and that
   rejection fails the *entire* auth config push — so leaving them in would block unrelated
   settings like redirect URLs from ever updating.

## Inviting the rest of the family

Sign in and use the **Members** screen (organizers only). Paste in any number of addresses
— commas, one per line, or copied straight out of a mail client — and invite them in one
go. The same screen promotes and demotes organizers and revokes access.

Access is invite-by-email only: an address is on the list or it is not. Removing someone
takes effect on their next click, and anything they wrote stays.

Two guards worth knowing about, both enforced in the database rather than the page, so a
hand-written API call cannot get around them:

- The last organizer cannot be removed or demoted — otherwise nobody could create a trip
  and only raw SQL could fix it.
- Changing anyone's role goes through a function. Members are not granted write access to
  the `role` column at all, so a member cannot promote themselves.


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
