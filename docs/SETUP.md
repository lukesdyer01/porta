# One-time setup

Roughly 20 minutes. Do these in order — step 4 depends on step 3.

---

## 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) (free).
2. **New project.** Name it `porta`. Pick region **East US (North Virginia)** — closest to Texas.
3. Save the database password it generates somewhere safe. You won't need it often, but
   it cannot be recovered later.

Wait for the project to finish provisioning (~2 minutes).

## 2. Create the tables

1. Left sidebar → **SQL Editor** → **New query**.
2. Paste the entire contents of [`../supabase/setup.sql`](../supabase/setup.sql) and **Run**.
3. Expect "Success. No rows returned."

Then add yourself to the invite list — **replace the address with your own**:

```sql
insert into public.allowed_emails (email, note)
values ('you@example.com', 'organizer - bootstrap');
```

> Use whichever address you actually want to sign in with. It's the one that
> receives your codes.

## 3. Turn on the signup gate

Without this, anyone who finds the site could create an account. Because any signed-in
member can read the house's gate and wifi codes, **this step is the security boundary.**

1. **Authentication → Hooks**.
2. Under **Before User Created**, choose **Postgres function**.
3. Select schema `public`, function `hook_restrict_signup`. **Enable**, then save.

Verify it works: try signing in later with an address that is *not* on the allowlist. It
should be refused.

## 4. Send sign-in emails through Resend

Supabase's built-in email sender is development-only and throttled to a handful of
messages **per hour, across the whole project**. Twelve people signing in the week of the
trip would hit that wall and see a generic failure.

1. Sign up at [resend.com](https://resend.com) (free tier is 3,000/month).
2. Add and verify your sending domain, or use their test sender to start.
3. In Supabase: **Project Settings → Authentication → SMTP Settings** → enable custom SMTP.
   - Host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key.
   - Set the sender name and address.

Then make the code itself prominent in the email — **Authentication → Emails → Magic Link**.
Make sure the template includes the token, not only the link:

```html
<h2>Your sign-in code</h2>
<p style="font-size:28px;letter-spacing:6px;font-weight:600">{{ .Token }}</p>
<p>Enter this on the beach week site. It expires in an hour.</p>
```

## 5. Point the site at the project

1. Supabase: **Project Settings → API**. Copy the **Project URL** and the **anon / publishable**
   key.
2. GitHub: `https://github.com/lukesdyer01/porta` → **Settings → Secrets and variables →
   Actions → New repository secret**. Add both:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | the anon key |

3. **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**, to rebuild with them.

> These two values are public by design — they ship inside the JavaScript bundle. All real
> protection comes from the row-level security policies, not from hiding them.

## 6. Allow the site to complete sign-in

**Authentication → URL Configuration**:

- **Site URL:** `https://lukesdyer01.github.io/porta/`
- **Redirect URLs:** add `https://lukesdyer01.github.io/porta/**` and, for local work,
  `http://localhost:5173/**`

## 7. Sign in, then promote yourself

Open https://lukesdyer01.github.io/porta/ and sign in with the address from step 2.

Then, back in the SQL editor — this is what lets you create trips and manage the invite list:

```sql
update public.profiles set role = 'organizer' where email = 'you@example.com';
```

Reload the site.

---

## After any future migration

Run **Advisors → Security Advisor** and treat these three as build failures. Each one
silently disables protections rather than erroring:

- `security_definer_view` — a view that ignores every policy
- `rls_disabled_in_public` — an unprotected table
- `function_search_path_mutable` — a hijackable helper

## Local development

```bash
cp .env.example .env.local   # paste the same two values from step 5
npm install
npm run dev
```
