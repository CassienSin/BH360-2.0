import { AlertCircle, FileQuestion, FileText, Star } from 'lucide-react'

// Single source of truth for the incident/ticket taxonomy styling.
// These used to be copy-pasted into every page that rendered an incident
// or ticket, which let the copies drift (some had `bg`, some renamed
// `icon` to `emoji`). Add new categories HERE and every view picks them up.

export const CATEGORY_CONFIG = {
  Noise: { icon: '🔊', color: '#f97316', bg: '#fff7ed' },
  Theft: { icon: '🚨', color: '#ef4444', bg: '#fef2f2' },
  Violence: { icon: '⚠️', color: '#dc2626', bg: '#fef2f2' },
  Fire: { icon: '🔥', color: '#ea580c', bg: '#fff7ed' },
  Flood: { icon: '🌊', color: '#3b82f6', bg: '#eff6ff' },
  Infrastructure: { icon: '🛠️', color: '#8b5cf6', bg: '#f5f3ff' },
  Animals: { icon: '🐕', color: '#a16207', bg: '#fefce8' },
  Medical: { icon: '🚑', color: '#dc2626', bg: '#fef2f2' },
  Traffic: { icon: '🚦', color: '#0891b2', bg: '#ecfeff' },
  Vandalism: { icon: '🎨', color: '#7c3aed', bg: '#f5f3ff' },
  Drugs: { icon: '💊', color: '#be185d', bg: '#fdf2f8' },
  Other: { icon: '📝', color: '#6b7280', bg: '#f9fafb' },
}

// `order` ranks severity for sorting (higher = more urgent).
export const PRIORITY_CONFIG = {
  Low: { color: '#22c55e', bg: '#f0fdf4', icon: '🟢', order: 1 },
  Medium: { color: '#3b82f6', bg: '#eff6ff', icon: '🔵', order: 2 },
  High: { color: '#f97316', bg: '#fff7ed', icon: '🟠', order: 3 },
  Critical: { color: '#dc2626', bg: '#fef2f2', icon: '🔴', order: 4 },
}

// Support-ticket categories (lucide components, not emoji — these render
// inside ticket detail headers).
export const TICKET_CATEGORY_CONFIG = {
  inquiry: { label: 'Inquiry', icon: FileQuestion, color: '#3b82f6', bg: '#eff6ff' },
  request: { label: 'Request', icon: FileText, color: '#5B54E8', bg: '#f0effe' },
  complaint: { label: 'Complaint', icon: AlertCircle, color: '#f97316', bg: '#fff7ed' },
  feedback: { label: 'Feedback', icon: Star, color: '#22c55e', bg: '#f0fdf4' },
}
