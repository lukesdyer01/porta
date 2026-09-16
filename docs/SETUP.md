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

### Send sign-in emails through Resend

Supabase's built-in sender is development-only and throttled to a couple of messages per
hour across the whole project. It's fine for testing alone; it will fail the week twelve
people sign in.

1. Sign up at [resend.com](https://resend.com) — free tier is 3,000/month.
2. Verify a sending domain (or start with their test sender).
3. Supabase dashboard → **Project Settings → Authentication → SMTP Settings**:
   - Host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key
   - Set sender name and address
4. Re-run `supabase config push` so the 60/hour rate limit applies.

### Put the code in the email

**Authentication → Emails → Magic Link.** The default template only shows a link. The code
is the primary path, so it needs to be prominent:

```html
<h2>Your sign-in code</h2>
<p style="font-size:28px;letter-spacing:6px;font-weight:600">{{ .Token }}</p>
<p>Enter this on the beach week site. It expires in an hour.</p>
```

## Inviting the rest of the family

Until the admin screen exists, add people in the SQL editor:

```sql
insert into public.allowed_emails (email, note)
values ('aunt.sue@example.com', 'Sue');
```

Removing someone revokes access on their next click:

```sql
delete from public.allowed_emails where email = 'someone@example.com';
```

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
