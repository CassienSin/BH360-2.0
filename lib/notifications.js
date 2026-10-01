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
export async function showNotification(title, options = {}) {
  if (!isSupported() || Notification.permission !== 'granted') return null

  // Only show if tab is not visible. Pass { force: true } to bypass.
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
  return showNotification(`🚨 CRITICAL: ${incident.title}`, {
    body: `${incident.location}\nReported by ${incident.profiles?.full_name || 'a resident'}`,
    tag: `critical-${incident.id}`,
    requireInteraction: true,
    data: { url: '/', incidentId: incident.id },
  })
}

// Notification for new incident
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

// Notification for new assignment (Tanod)
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

// Notification for new announcement (Resident)
export function notifyNewAnnouncement(announcement) {
  const content = announcement.content || ''

  return showNotification(`📢 ${announcement.title}`, {
    body: content.slice(0, 100) + (content.length > 100 ? '…' : ''),
    tag: `announcement-${announcement.id}`,
    data: { url: '/', announcementId: announcement.id },
  })
}

// Notification for incident status update (Resident)
export function notifyStatusUpdate(incident, newStatus) {
  const messages = {
    assigned: {
      title: '🛡️ Tanod Dispatched',
      body: `Help is on the way for: ${incident.title}`,
    },
    resolved: {
      title: '✅ Incident Resolved',
      body: `Your incident "${incident.title}" has been resolved!`,
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

  return showNotification(`📅 Appointment reminder: ${appointment.title}`, {
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