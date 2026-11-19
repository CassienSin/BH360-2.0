import { User, HelpCircle, Settings } from 'lucide-react'

/**
 * Header text for the standalone pages. One definition, used by the page's
 * <PageHeader>, its loading skeleton and its loading.jsx, so the header
 * reads the same from the first paint and never changes as the page loads.
 * (A plain module, not 'use client', so server loading.jsx files can use it.)
 */
export const PAGE_HEADERS = {
  profile: { title: 'My profile', description: 'Your account, your details and your activity', icon: User },
  help: { title: 'Help', description: 'Answers, guides and hotlines', icon: HelpCircle },
  settings: { title: 'Settings', description: 'Notifications, language and your account', icon: Settings },
}
