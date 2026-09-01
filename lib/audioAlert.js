/**
 * The emergency siren, and the browser rule that kept it quiet.
 *
 * Chrome, Safari and Firefox all refuse to let a page make noise until the
 * person has interacted with it — an AudioContext built before then starts
 * `suspended`, and calling resume() outside a user gesture does not lift it.
 * A siren created inside a React effect is therefore silent by construction,
 * which is the worst possible failure for the one alert that has to be heard.
 *
 * (The old symptom: nothing on the first critical incident, then sound the
 * moment you pressed Mute and Unmute — because that click was the gesture
 * the audio was waiting for all along.)
 *
 * So the context is unlocked ahead of time, on the first click or keypress
 * anywhere in the dashboard, long before an emergency arrives. By the time
 * one does, it is already running and the siren sounds on the first blast.
 *
 * When even that has not happened — an official who loaded the page and
 * touched nothing — playSiren() reports the failure instead of swallowing
 * it, so the alert can say the sound is off rather than pretend it played.
 */

let ctx = null
let unlocked = false
const listeners = new Set()

function announce() {
  for (const fn of listeners) {
    try { fn(unlocked) } catch { /* a listener must not break the siren */ }
  }
}

function setUnlocked(next) {
  if (next === unlocked) return
  unlocked = next
  announce()
}

function getContext() {
  if (ctx) return ctx
  if (typeof window === 'undefined') return null
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  try {
    ctx = new AudioCtx()
  } catch {
    return null
  }
  return ctx
}

/** Whether the browser will currently let us make a sound. */
export function isAudioUnlocked() {
  return unlocked
}

/** Called when that answer changes, so the UI can offer a way to fix it. */
export function onAudioUnlockChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Try to bring the audio context to `running`. Safe to call repeatedly and
 * safe to call outside a gesture — it simply fails and reports so.
 */
export async function primeAudio() {
  const c = getContext()
  if (!c) {
    setUnlocked(false)
    return false
  }
  if (c.state === 'suspended') {
    try { await c.resume() } catch { /* no user gesture yet */ }
  }
  setUnlocked(c.state === 'running')
  return unlocked
}

// touchend rather than touchstart: iOS only counts a completed touch as the
// gesture that may start audio.
const GESTURES = ['pointerdown', 'keydown', 'touchend']

/**
 * Listen for the first interaction and unlock on it. Returns a cleanup
 * function; mount this wherever a critical alert can appear.
 *
 * The listeners stay attached rather than firing once, because mobile
 * browsers suspend the context again when the tab is backgrounded and the
 * next interaction is what gets it back.
 */
export function installAudioPrimer() {
  if (typeof window === 'undefined') return () => {}

  const handler = () => { primeAudio() }
  for (const g of GESTURES) window.addEventListener(g, handler, { passive: true })

  // A reload inside an installed PWA can arrive already-activated, and a
  // second dashboard mount inherits a context that is running already.
  primeAudio()

  return () => {
    for (const g of GESTURES) window.removeEventListener(g, handler)
  }
}

/**
 * One two-tone rise-and-fall blast — the shape people read as an emergency.
 * Synthesized rather than an mp3: no asset to 404 and no network round-trip
 * at the exact moment it is needed.
 *
 * Resolves true if it actually sounded.
 */
export async function playSiren({ volume = 0.28 } = {}) {
  const c = getContext()
  if (!c) return false

  if (c.state === 'suspended') {
    try { await c.resume() } catch { /* still blocked */ }
  }
  if (c.state !== 'running') {
    setUnlocked(false)
    return false
  }
  setUnlocked(true)

  try {
    // Read the clock AFTER the resume above. Reading it while suspended
    // schedules the envelope against a frozen time, which lands in the past
    // once the context starts and clips the note to nothing.
    const now = c.currentTime
    const osc = c.createOscillator()
    const gain = c.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, now)
    osc.frequency.linearRampToValueAtTime(880, now + 0.35)
    osc.frequency.linearRampToValueAtTime(660, now + 0.7)

    // Fade in and out so it does not click.
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(volume, now + 0.05)
    gain.gain.setValueAtTime(volume, now + 0.6)
    gain.gain.linearRampToValueAtTime(0, now + 0.75)

    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(now)
    osc.stop(now + 0.8)
    return true
  } catch {
    // Audio is a layer of the alert, never the alert itself.
    return false
  }
}
