'use client'

import { useState } from 'react'
import { LayoutDashboard, ClipboardList, CalendarDays } from 'lucide-react'
import TanodManagementOverview from './TanodManagementOverview'
import TanodDutyWorkspace from './TanodDutyWorkspace'
import styles from './tanod-duty.module.css'

const TABS = [['overview', 'Overview', LayoutDashboard], ['records', 'Duty Records', ClipboardList], ['schedule', 'Duty Schedule', CalendarDays]]

export default function TanodManagement(props) {
  const [tab, setTab] = useState('overview')
  if (props.profile?.role !== 'official' || !props.profile?.barangay_id) return null
  return <div className={styles.root}>
    <nav className={styles.tabs} aria-label="Tanod management sections">{TABS.map(([id, label, Icon]) => <button type="button" key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}</nav>
    {tab === 'overview' ? <TanodManagementOverview {...props} /> : <TanodDutyWorkspace key={`${props.profile.barangay_id}-${tab}`} profile={props.profile} mode={tab} />}
  </div>
}
