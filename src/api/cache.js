// A small in-memory cache for GET requests (stale-while-revalidate).
//
// Re-opening a page shows the data it had last time straight away, then fetches it
// again in the background and swaps in the fresh copy. Kept in memory only (never
// localStorage), because the data is per user and sensitive, so a page refresh
// starts empty.
//
// The whole cache is cleared when anything changes data (any POST/PUT/PATCH/DELETE,
// see axios.js) and on login/logout, so a page never shows a saved, verified or
// deleted record in its old state for long.

const MAX_ENTRIES = 100

const store = new Map()
// bumped by clearCache(), so a GET that started before a change cannot put old data back
let generation = 0

export function clearCache() {
  store.clear()
  generation += 1
}

// key: anything JSON-able that names the request, e.g. ["scans", filters, page]
// fetcher: () => Promise of the data (one of the get* functions in src/api)
// onData(data, { stale }): called with the cached copy right away (stale: true) when
//   there is one, then with the fresh copy (stale: false) once it arrives
// The returned promise rejects only when there was no cached copy to show; a failed
// background refresh keeps the cached data on screen and is only logged.
export function cachedGet(key, fetcher, onData) {
  const k = JSON.stringify(key)
  const hit = store.has(k)
  const startedAt = generation

  if (hit) onData(store.get(k), { stale: true })

  return fetcher().then(
    (data) => {
      if (startedAt === generation) {
        store.delete(k) // re-insert so the oldest entry is the one dropped below
        store.set(k, data)
        if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value)
      }
      onData(data, { stale: false })
    },
    (err) => {
      if (!hit) throw err
      console.error("Background refresh failed; showing cached data.", err)
    },
  )
}
