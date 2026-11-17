import { User, HelpCircle, Settings } from 'lucide-react'

/**
 * Header text for the standalone pages. One definition, used by the page's
 * <PageHeader>, its loading skeleton and its loading.jsx, so the header
 * reads the same from the first paint and never changes as the page loads.
 * (A plain module, not 'use client', so server loading.jsx files can use it.)
 */
export const PAGE_HEADERS = {
  profile: { title: 'My Profile', description: 'Manage your account & activity', icon: User },
  help: { title: 'Help & Support', description: "We're here to help, 24/7", icon: HelpCircle },
  settings: { title: 'Settings', description: 'Customize your experience', icon: Settings },
}
