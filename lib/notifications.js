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

  const permission = await Notification.requestPermission()
  return permission
}

// Show a notification
export function showNotification(title, options = {}) {
  if (!isSupported() || Notification.permission !== 'granted') return null

  // Only show if tab is not visible (don't spam if user is looking at the app)
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return null
  }

  const notification = new Notification(title, {
    icon: '/logo.png',
    badge: '/logo.png',
    silent: false,
    requireInteraction: false,
    ...options,
  })

  // Click handler - focus the tab when clicked
  notification.onclick = (event) => {
    event.preventDefault()
    window.focus()
    notification.close()
    if (options.onClick) options.onClick()
  }

  // Auto-close after 8 seconds (browsers handle this differently)
  setTimeout(() => notification.close(), 8000)

  return notification
}

// Helper: Notification for critical incidents
export function notifyCriticalIncident(incident) {
  return showNotification(`🚨 CRITICAL: ${incident.title}`, {
    body: `${incident.location}\nReported by ${incident.profiles?.full_name || 'a resident'}`,
    tag: `critical-${incident.id}`, // prevents duplicates
    requireInteraction: true, // stays until user clicks
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
  })
}

// Helper: Notification for new announcement (Resident)
export function notifyNewAnnouncement(announcement) {
  return showNotification(`📢 ${announcement.title}`, {
    body: announcement.content?.slice(0, 100) + (announcement.content?.length > 100 ? '...' : ''),
    tag: `announcement-${announcement.id}`,
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
  })
}