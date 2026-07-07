// Check if browser supports notifications
export function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

// Get current permission status
export function getPermission() {
  if (!isSupported()) return 'unsupported'
  return Notification.permission // 'default', 'granted', 'denied'
}

// Request permission from user
export async function requestPermission() {
  if (!isSupported()) return 'unsupported'

  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'

  try {
    // Older Safari (<16) implements the legacy callback form and doesn't
    // return a promise. Resolving from both paths covers every browser;
    // whichever fires first wins and the duplicate resolve is a no-op.
    return await new Promise((resolve, reject) => {
      try {
        const maybePromise = Notification.requestPermission(resolve)
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(resolve, reject)
        }
      } catch (err) {
        reject(err)
      }
    })
  } catch (err) {
    console.error('requestPermission failed:', err)
    return 'default'
  }
}

// Show a notification.
//
// Now async: on Android Chrome, `new Notification()` THROWS ("Illegal
// constructor") — pages there must go through the service worker's
// showNotification() instead. Given how mobile-heavy your users are,
// the old code was silently crashing for a large share of them.
// Callers can keep fire-and-forgetting this; nothing needs to await it.
export async function showNotification(title, options = {}) {
  if (!isSupported() || Notification.permission !== 'granted') return null

  // Only show if tab is not visible (don't spam if user is looking at
  // the app). Pass { force: true } to bypass, e.g. for critical alerts.
  const { force = false, onClick, ...notifOptions } = options
  if (!force && typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return null
  }

  const finalOptions = {
    icon: '/logo.png',
    badge: '/logo.png',
    silent: false,
    requireInteraction: false,
    ...notifOptions,
  }

  // Preferred path: page-created notification (desktop browsers).
  // Gives us the onclick handler and auto-close control.
  try {
    const notification = new Notification(title, finalOptions)

    let autoCloseTimer = null
    // Only auto-close notifications that DIDN'T ask to stay. Previously the
    // 8s timer ran unconditionally, so requireInteraction: true (used for
    // critical incidents, meant to persist until clicked) was silently
    // defeated — critical alerts vanished like everything else.
    if (!finalOptions.requireInteraction) {
      autoCloseTimer = setTimeout(() => notification.close(), 8000)
    }

    notification.onclick = (event) => {
      event.preventDefault()
      if (autoCloseTimer) clearTimeout(autoCloseTimer)
      window.focus()
      notification.close()
      if (onClick) onClick()
    }
    notification.onclose = () => {
      if (autoCloseTimer) clearTimeout(autoCloseTimer)
    }

    return notification
  } catch {
    // Fall through to the service worker path (Android Chrome etc.)
  }

  // Fallback path: service worker notification. Clicks are handled by the
  // 'notificationclick' event in sw.js, not here — put any routing info
  // in options.data (e.g. { data: { url: '/incidents/123' } }).
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.showNotification(title, finalOptions)
        return true
      }
    }
  } catch (err) {
    console.error('showNotification failed:', err)
  }
  return null
}

// Helper: Notification for critical incidents
export function notifyCriticalIncident(incident) {
  return showNotification(`🚨 CRITICAL: ${incident.title}`, {
    body: `${incident.location}\nReported by ${incident.profiles?.full_name || 'a resident'}`,
    tag: `critical-${incident.id}`, // prevents duplicates
    requireInteraction: true, // stays until user clicks (actually works now)
    data: { url: '/', incidentId: incident.id },
  })
}

// Helper: Notification for new incident
export function notifyNewIncident(incident) {
  const priorityEmoji = {
    Critical: '🔴',
    High: '🟠',
    Medium: '🔵',
    Low: '🟢',
  }
  const emoji = priorityEmoji[incident.priority] || '🆕'
  return showNotification(`${emoji} New Incident: ${incident.title}`, {
    body: `${incident.location}\nReported by ${incident.profiles?.full_name || 'a resident'}`,
    tag: `incident-${incident.id}`,
    data: { url: '/', incidentId: incident.id },
  })
}

// Helper: Notification for new assignment (Tanod)
export function notifyNewAssignment(incident) {
  const priorityEmoji = {
    Critical: '🚨',
    High: '⚠️',
    Medium: '🛡️',
    Low: '🛡️',
  }
  const emoji = priorityEmoji[incident.priority] || '🛡️'
  return showNotification(`${emoji} New Assignment: ${incident.title}`, {
    body: `📍 ${incident.location}`,
    tag: `assignment-${incident.id}`,
    requireInteraction: incident.priority === 'Critical',
    data: { url: '/', incidentId: incident.id },
  })
}

// Helper: Notification for new announcement (Resident)
export function notifyNewAnnouncement(announcement) {
  // The old string concat produced the literal body "undefined" when an
  // announcement had no content.
  const content = announcement.content || ''
  return showNotification(`📢 ${announcement.title}`, {
    body: content.slice(0, 100) + (content.length > 100 ? '…' : ''),
    tag: `announcement-${announcement.id}`,
    data: { url: '/', announcementId: announcement.id },
  })
}

// Helper: Notification for incident status update (Resident)
export function notifyStatusUpdate(incident, newStatus) {
  const messages = {
    assigned: { title: '🛡️ Tanod Dispatched', body: `Help is on the way for: ${incident.title}` },
    resolved: { title: '✅ Incident Resolved', body: `Your incident "${incident.title}" has been resolved!` },
  }
  const msg = messages[newStatus]
  if (!msg) return null

  return showNotification(msg.title, {
    body: msg.body,
    tag: `status-${incident.id}-${newStatus}`,
    data: { url: '/', incidentId: incident.id },
  })
}