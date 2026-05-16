export function timeAgo(date) {
  if (!date) return ''

  const now = new Date()
  const past = new Date(date)
  const seconds = Math.floor((now - past) / 1000)

  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`

  const years = Math.floor(days / 365)
  return `${years}y ago`
}

// Long format: "2 hours ago", "Yesterday", "Last week", "March 15, 2025"
export function timeAgoLong(date) {
  if (!date) return ''

  const now = new Date()
  const past = new Date(date)
  const seconds = Math.floor((now - past) / 1000)

  if (seconds < 60) return 'Just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`

  const weeks = Math.floor(days / 7)
  if (weeks === 1) return 'Last week'
  if (weeks < 4) return `${weeks} weeks ago`

  const months = Math.floor(days / 30)
  if (months === 1) return 'Last month'
  if (months < 12) return `${months} months ago`

  return past.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Tooltip: full date and time
export function fullDate(date) {
  if (!date) return ''
  return new Date(date).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}