/**
 * Nightly reminder job. Runs from GitHub Actions, not the browser.
 *
 * DRY_RUN=1 prints what it would send and records nothing, so a real schedule
 * can be watched for a few days before anything reaches the family.
 */
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  RESEND_API_KEY,
  RESEND_FROM = 'Beach Week <onboarding@resend.dev>',
  DRY_RUN = '1',
} = process.env

const dryRun = DRY_RUN !== '0'
const SITE = 'https://lukesdyer01.github.io/porta/'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Supabase secrets not set — nothing to do.')
  process.exit(0)
}
if (!dryRun && !RESEND_API_KEY) {
  console.error('DRY_RUN is off but RESEND_API_KEY is missing. Refusing to continue.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Dates are reasoned about in the trip's timezone, not the runner's UTC.
// ---------------------------------------------------------------------------
const TZ = 'America/Chicago'
// TODAY lets a run be pointed at any date to check what it would send then.
// Unset in production, so the schedule always uses the real date.
const today =
  process.env.TODAY || new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const daysUntil = (iso) =>
  Math.round((new Date(`${iso}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86_400_000)

const pretty = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

// ---------------------------------------------------------------------------
async function db(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

function wrap(heading, body, cta = 'Open beach week') {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c2b33">
  <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#6b7b84">Port Aransas</p>
  <h1 style="margin:6px 0 16px;font-size:22px">${heading}</h1>
  ${body}
  <p style="margin:24px 0 0"><a href="${SITE}" style="background:#115856;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">${cta}</a></p>
</div>`
}

// ---------------------------------------------------------------------------
async function build() {
  const out = []

  const trips = await db('trips?select=id,year,name,start_date,end_date&order=start_date')
  // The one worth writing about: happening now, or the next one ahead.
  const trip = trips.find((t) => t.start_date && t.end_date && t.end_date >= today)
  if (!trip) {
    console.log('No current or upcoming trip.')
    return out
  }

  const until = daysUntil(trip.start_date)
  console.log(`Trip ${trip.year}: starts ${trip.start_date} (${until} days), today is ${today}`)

  const houses = await db(`houses?select=name,address_line1,city,state&trip_id=eq.${trip.id}`)
  const house = houses[0]
  const where = house
    ? `${house.name || 'The house'}${house.address_line1 ? ` — ${house.address_line1}, ${house.city}, ${house.state}` : ''}`
    : null

  const rsvps = await db(`rsvps?select=profile_id,status&trip_id=eq.${trip.id}`)
  const answered = new Set(rsvps.filter((r) => r.profile_id).map((r) => r.profile_id))

  // --- 1. RSVP nudge, three weeks out ------------------------------------
  if (until === 21) {
    const invited = await db('allowed_emails?select=email')
    const profiles = await db('profiles?select=id,email,display_name,is_active&is_active=eq.true')
    const byEmail = new Map(profiles.map((p) => [p.email, p]))

    for (const { email } of invited) {
      const p = byEmail.get(email)
      if (p && answered.has(p.id)) continue
      // Somebody who has never signed in cannot RSVP yet, so the ask differs.
      const body = p
        ? `<p>The ${trip.year} trip starts ${pretty(trip.start_date)} and we still don't have your answer. It takes one tap.</p>`
        : `<p>The ${trip.year} trip starts ${pretty(trip.start_date)}. You haven't set up your account yet — do that and let everyone know if you're coming.</p>`
      out.push({
        to: email,
        kind: 'rsvp',
        refDate: trip.start_date,
        subject: `Are you coming to Port A in ${trip.year}?`,
        html: wrap('Let us know', body, p ? 'RSVP now' : 'Set up your account'),
      })
    }
  }

  // --- 2. Cooking tomorrow ------------------------------------------------
  const tomorrow = addDays(today, 1)
  if (tomorrow >= trip.start_date && tomorrow <= trip.end_date) {
    const meals = await db(
      `meals?select=meal_date,title,household_id,household:households(name)&trip_id=eq.${trip.id}&meal_date=eq.${tomorrow}&meal_type=eq.dinner`,
    )
    const meal = meals[0]
    if (meal?.household_id) {
      const cooks = await db(
        `profiles?select=email,display_name&household_id=eq.${meal.household_id}&is_active=eq.true`,
      )
      for (const c of cooks) {
        out.push({
          to: c.email,
          kind: 'cooking',
          refDate: tomorrow,
          subject: `You're cooking tomorrow`,
          html: wrap(
            `${meal.household?.name ?? 'You'} are on dinner`,
            `<p>Tomorrow, ${pretty(tomorrow)}.</p>${meal.title ? `<p><strong>${meal.title}</strong></p>` : '<p>Nothing written down yet — worth adding so people know what to expect.</p>'}`,
            'See the rotation',
          ),
        })
      }
    }
  }

  // --- 3. Trip starts in a week ------------------------------------------
  if (until === 7) {
    const going = await db(
      `rsvps?select=profile:profiles!rsvps_profile_id_fkey(email,display_name)&trip_id=eq.${trip.id}&status=eq.yes&profile_id=not.is.null`,
    )
    for (const g of going) {
      if (!g.profile?.email) continue
      out.push({
        to: g.profile.email,
        kind: 'starts_soon',
        refDate: trip.start_date,
        subject: `Port A in a week`,
        // Deliberately no gate or wifi codes: those stay behind the login
        // rather than sitting in an inbox forever.
        html: wrap(
          'One week to go',
          `<p>${pretty(trip.start_date)} to ${pretty(trip.end_date)}.</p>${where ? `<p>${where}</p>` : ''}<p>Worth a look at the packing list — claim whatever you're bringing so nobody turns up with four coolers.</p><p style="color:#6b7b84;font-size:13px">Gate and wifi codes are on the site once you're signed in.</p>`,
          'Open the trip',
        ),
      })
    }
  }

  return out.map((m) => ({ ...m, tripId: trip.id }))
}

// ---------------------------------------------------------------------------
async function main() {
  const candidates = await build()
  if (candidates.length === 0) {
    console.log('Nothing due today.')
    return
  }

  const sent = await db('reminders_sent?select=kind,recipient_email,ref_date')
  const already = new Set(sent.map((s) => `${s.kind}|${s.recipient_email}|${s.ref_date}`))
  const due = candidates.filter(
    (m) => !already.has(`${m.kind}|${m.to}|${m.refDate}`),
  )

  console.log(`${candidates.length} candidate(s), ${due.length} not yet sent.`)

  for (const m of due) {
    if (dryRun) {
      console.log(`\n--- WOULD SEND [${m.kind}] to ${m.to}\n    subject: ${m.subject}`)
      continue
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: RESEND_FROM, to: [m.to], subject: m.subject, html: m.html }),
    })
    if (!res.ok) {
      // One bad address must not stop the rest of the run.
      console.error(`FAILED ${m.kind} -> ${m.to}: ${res.status} ${await res.text()}`)
      continue
    }

    // Recorded only after a send actually succeeded, so a failure is retried
    // tomorrow rather than silently marked done.
    await db('reminders_sent', {
      method: 'POST',
      body: JSON.stringify({
        trip_id: m.tripId,
        kind: m.kind,
        recipient_email: m.to,
        ref_date: m.refDate,
      }),
    })
    console.log(`sent [${m.kind}] -> ${m.to}`)
  }

  if (dryRun) console.log('\nDRY RUN — nothing sent, nothing recorded.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
