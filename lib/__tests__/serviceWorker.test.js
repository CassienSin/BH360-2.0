import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// The real public/sw.js, run against fake browser objects. It only
// registers listeners at the top level, so loading it has no side effects.
const SOURCE = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8')
const ORIGIN = 'https://bh.example'
const TICKET = '/resident/ticket/t1'

// A window of the site. `url` is the address the page was loaded at (what
// Client.url reports); `here` is where the page really is now, which it
// tells the worker when asked (null: it does not answer).
function fakeWindow(name, log, { url, here = url, visible = true, focused = false, controlled = true, focusRefused = false } = {}) {
  return {
    url: ORIGIN + url,
    visibilityState: visible ? 'visible' : 'hidden',
    focused,
    postMessage(message, ports) {
      log.push([name, 'message', message.type, message.url].filter(Boolean))
      if (message.type === 'BH360_WHERE' && here && ports?.[0]) ports[0].postMessage({ path: here, visible })
    },
    async focus() {
      log.push([name, 'focus'])
      if (focusRefused) throw new Error('Not allowed to focus a window.')
      return this
    },
    async navigate(to) {
      log.push([name, 'navigate', to])
      if (!controlled) throw new TypeError('This service worker is not the client\'s active service worker.')
      return this
    },
  }
}

function loadWorker(windows) {
  const handlers = {}
  const shown = []
  const opened = []
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, handler) => { handlers[type] = handler },
    clients: {
      matchAll: async () => windows,
      openWindow: async (url) => { opened.push(url); return null },
      claim: async () => {},
    },
    registration: { showNotification: async (title, options) => { shown.push({ title, ...options }) } },
    skipWaiting: () => {},
  }
  vm.runInContext(SOURCE, vm.createContext({ self, caches: {}, URL, MessageChannel, setTimeout, clearTimeout, console }))
  function fire(type, init) {
    let work = Promise.resolve()
    handlers[type]({ ...init, waitUntil: (promise) => { work = promise } })
    return work
  }
  const push = (payload) => fire('push', { data: { json: () => payload, text: () => JSON.stringify(payload) } })
  const tap = (url) => fire('notificationclick', { notification: { close() {}, data: { url } } })
  return { push, tap, shown, opened }
}

const reply = { title: 'New reply on your ticket', body: 'Kgd. Maria Santos: …', url: `${TICKET}?nid=n1`, tag: 'ticket-t1' }

describe('sw.js push: a reply to a conversation that is on screen', () => {
  it('is skipped when the page is on that ticket, though it was loaded elsewhere (opened by an in-app tap)', async () => {
    const log = []
    const worker = loadWorker([fakeWindow('home', log, { url: '/resident', here: TICKET })])
    await worker.push(reply)
    expect(worker.shown).toEqual([])
  })

  it('is shown when the page has left that ticket in-app, though it was loaded on it', async () => {
    const log = []
    const worker = loadWorker([fakeWindow('tab', log, { url: TICKET, here: '/resident' })])
    await worker.push(reply)
    expect(worker.shown.map(n => n.title)).toEqual(['New reply on your ticket'])
  })

  it('is shown when the page does not answer, even if Chrome lists it as visible on that ticket', async () => {
    // A page paused in the background (or still loading, or on old code)
    // cannot confirm it is on screen; Chrome's own record may be stale.
    const log = []
    const worker = loadWorker([fakeWindow('paused page', log, { url: TICKET, here: null, visible: true })])
    await worker.push(reply)
    expect(worker.shown.map(n => n.title)).toEqual(['New reply on your ticket'])
  })

  it('is shown when the page answers that it is no longer on screen', async () => {
    const log = []
    const page = fakeWindow('backgrounded', log, { url: TICKET })
    // Chrome still lists it as visible; the page itself knows it is hidden.
    page.postMessage = (message, ports) => ports?.[0]?.postMessage({ path: TICKET, visible: false })
    const worker = loadWorker([page])
    await worker.push(reply)
    expect(worker.shown).toHaveLength(1)
  })

  it('is shown when no page of the site is on screen', async () => {
    const log = []
    const worker = loadWorker([fakeWindow('background', log, { url: TICKET, visible: false })])
    await worker.push(reply)
    expect(worker.shown).toHaveLength(1)
    expect(worker.shown[0]).toMatchObject({ tag: 'ticket-t1', badge: '/badge-96.png', icon: '/icon-192.png' })
  })
})

describe('sw.js notificationclick', () => {
  const target = ORIGIN + `${TICKET}?nid=n1`

  it('brings the open window forward before changing its page', async () => {
    const log = []
    const worker = loadWorker([fakeWindow('app', log, { url: '/resident', visible: false })])
    await worker.tap(`${TICKET}?nid=n1`)
    expect(log).toEqual([['app', 'focus'], ['app', 'navigate', target]])
    expect(worker.opened).toEqual([])
  })

  it('uses the window on screen over one listed before it', async () => {
    const log = []
    const worker = loadWorker([
      fakeWindow('hidden', log, { url: '/resident', visible: false }),
      fakeWindow('visible', log, { url: '/settings', visible: true }),
    ])
    await worker.tap(`${TICKET}?nid=n1`)
    expect(log).toEqual([['visible', 'focus'], ['visible', 'navigate', target]])
  })

  it('still changes the page when focus is refused', async () => {
    const log = []
    const worker = loadWorker([fakeWindow('app', log, { url: '/resident', visible: false, focusRefused: true })])
    await worker.tap(`${TICKET}?nid=n1`)
    expect(log).toEqual([['app', 'focus'], ['app', 'navigate', target]])
  })

  it('asks the page to load the link when the worker cannot navigate it', async () => {
    const log = []
    const worker = loadWorker([fakeWindow('uncontrolled', log, { url: '/resident', controlled: false })])
    await worker.tap(`${TICKET}?nid=n1`)
    expect(log).toEqual([
      ['uncontrolled', 'focus'],
      ['uncontrolled', 'navigate', target],
      ['uncontrolled', 'message', 'BH360_OPEN', target],
    ])
  })

  it('opens a new window when none of the site is open', async () => {
    const worker = loadWorker([])
    await worker.tap(`${TICKET}?nid=n1`)
    expect(worker.opened).toEqual([target])
  })
})
