import { getSubscription } from '@/lib/push'

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

/**
 * Whether this device receives Web Push. When it does, the push service
 * already delivers every notification the database writes, app open or
 * closed. A page that also showed its own (its tab in the background)
 * posted the same notification again under the same tag a moment later,
 * replacing the push's with its own copy: on Android the badge turned into
 * the Chrome logo, and ticket replies (different tags) showed twice.
 * Never waits more than a moment: without a service worker,
 * serviceWorker.ready would not settle at all.
 */
async function deviceReceivesPush() {
  try {
    const subscription = await Promise.race([
      getSubscription(),
      new Promise(resolve => setTimeout(() => resolve(null), 1500)),
    ])
    return Boolean(subscription)
  } catch {
    return false
  }
}

// Show a system notification from the page: for devices without push.
export async function showNotification(title, options = {}) {
  if (!isSupported() || Notification.permission !== 'granted') return null

  // Only show if tab is not visible. Pass { force: true } to bypass that
  // (it does not bypass the push check below).
  const { force = false, onClick, ...notifOptions } = options
  if (!force && typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return null
  }

  // With push on this device, the push shows it; the page only updates the
  // bell and its toasts.
  if (await deviceReceivesPush()) return null

  const finalOptions = {
    // The same images the service worker uses for a push.
    icon: '/icon-192.png',
    badge: '/badge-96.png', // white on transparent: Android uses only its shape
    silent: false,
    requireInteraction: false,
    ...notifOptions,
  }

  // Use page-created notifications when supported.
  try {
    const notification = new Notification(title, finalOptions)

    let autoCloseTimer = null
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
    // Fall back to the service worker on browsers that require it.
  }

  // Service-worker notification clicks use the URL in options.data.
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

// Notification for critical incidents
export function notifyCriticalIncident(incident) {
  return showNotification(`Critical report: ${incident.title}`, {
    body: [incident.location, incident.profiles?.full_name && `Reported by ${incident.profiles.full_name}`].filter(Boolean).join(' · '),
    tag: `critical-${incident.id}`,
    requireInteraction: true,
    data: { url: '/', incidentId: incident.id },
  })
}

// Notification for new incident
export function notifyNewIncident(incident) {
  const lead = incident.priority === 'Critical' ? 'Critical report' : 'New report'
  return showNotification(`${lead}: ${incident.title}`, {
    body: [incident.priority && `${incident.priority} priority`, incident.location].filter(Boolean).join(' · '),
    tag: `incident-${incident.id}`,
    data: { url: '/', incidentId: incident.id },
  })
}

// Notification for new assignment (Tanod)
export function notifyNewAssignment(incident) {
  return showNotification(`New assignment: ${incident.title}`, {
    body: [incident.priority && `${incident.priority} priority`, incident.location].filter(Boolean).join(' · '),
    tag: `assignment-${incident.id}`,
    requireInteraction: incident.priority === 'Critical',
    data: { url: '/', incidentId: incident.id },
  })
}

// Notification for new announcement (Resident)
export function notifyNewAnnouncement(announcement) {
  const content = announcement.content || ''

  return showNotification(`Announcement: ${announcement.title}`, {
    body: content.slice(0, 100) + (content.length > 100 ? '…' : ''),
    tag: `announcement-${announcement.id}`,
    data: { url: '/', announcementId: announcement.id },
  })
}

// Notification for incident status update (Resident)
export function notifyStatusUpdate(incident, newStatus) {
  const messages = {
    assigned: {
      title: 'A tanod is on the way',
      body: `A tanod is responding to “${incident.title}”.`,
    },
    resolved: {
      title: 'Your report was resolved',
      body: `“${incident.title}” is resolved. You can rate the response in the app.`,
    },
  }

  const msg = messages[newStatus]
  if (!msg) return null

  return showNotification(msg.title, {
    body: msg.body,
    tag: `status-${incident.id}-${newStatus}`,
    data: { url: '/', incidentId: incident.id },
  })
}

// Reminder for an official's appointment
export function notifyAppointmentReminder(appointment) {
  const startsAt = appointment.starts_at
    ? new Date(appointment.starts_at).toLocaleString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Upcoming appointment'

  const participant = appointment.participant_name
    ? ` · ${appointment.participant_name}`
    : ''

  return showNotification(`Upcoming appointment: ${appointment.title}`, {
    body: `${startsAt}${participant}`,
    tag: `appointment-${appointment.id}`,
    onClick: () =>
      window.location.assign('/official/calendar/appointments'),
    data: {
      url: '/official/calendar/appointments',
      appointmentId: appointment.id,
    },
  })
}