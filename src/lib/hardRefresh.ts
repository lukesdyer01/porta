/**
 * Force the browser to fetch a fresh index.html.
 *
 * The JS and CSS filenames carry content hashes, so they are never stale — the
 * problem is index.html itself being cached and still pointing at yesterday's
 * hashes. A plain location.reload() is allowed to serve that from cache, and
 * reload(true) has been ignored by browsers for years.
 *
 * So: empty any Cache Storage, drop any service worker, then navigate with a
 * changing query string, which cannot be served from a cache entry keyed on
 * the old URL. The hash route is preserved so you land back where you were.
 */
export async function hardRefresh(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    // Blocked in some private modes; the query string below still does the job.
  }

  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.()
    await Promise.all((regs ?? []).map((r) => r.unregister()))
  } catch {
    // No service worker today, but harmless insurance if one is ever added.
  }

  const url = new URL(window.location.href)
  url.searchParams.set('fresh', Date.now().toString(36))
  window.location.replace(url.toString())
}

/** Build stamp, shown so a refresh can be seen to have worked. */
export function buildStamp(): string {
  try {
    return new Date(__BUILD_TIME__).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return 'unknown'
  }
}
