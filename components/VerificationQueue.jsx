'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Check, ChevronLeft, Loader2, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { timeAgo, fullDate } from '@/lib/timeAgo'
import { Card } from '@/components/ui/card'
import { Status } from '@/components/ui/tag'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Notice } from '@/components/ui/notice'
import { Muted } from '@/components/ui/text'
import { Textarea } from '@/components/ui/textarea'
import { SearchBox, FilterSelect } from '@/components/official/Toolbar'

// O06: a split view. The list filters by where people stand.
const TABS = [
  { value: 'pending', label: 'Waiting' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Not verified' },
  { value: 'all', label: 'Everyone' },
]
const STATUS_LABEL = { pending: 'Waiting', verified: 'Verified', rejected: 'Not verified' }
const STATUS_TONE = { pending: 'warn', verified: 'ok', rejected: 'danger' }

/**
 * Manual account verification, done by a barangay official.
 *
 * The decision is a judgement about whether a person actually lives in this
 * barangay, which is exactly the kind of thing a signup form cannot decide
 * and a named official can. Both outcomes are written through the
 * set_verification_status RPC — the client cannot touch the columns
 * directly, and nobody can verify their own account.
 */
export default function VerificationQueue({ profile, users, onUpdated }) {
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState('pending')
  const [search, setSearch] = useState('')
  const [working, setWorking] = useState(null)     // id being written
  const [rejecting, setRejecting] = useState(null) // the account being rejected
  const [reason, setReason] = useState('')
  const [openId, setOpenId] = useState(null)       // the person opened on a phone

  // The official's own row is excluded: self-verification is refused by the
  // database anyway, and showing the button would just invite the error.
  const candidates = useMemo(
    () => users.filter(u => u.id !== profile?.id && !u.is_super_admin),
    [users, profile?.id]
  )

  const counts = useMemo(() => ({
    pending: candidates.filter(u => (u.verification_status || 'pending') === 'pending').length,
    verified: candidates.filter(u => u.verification_status === 'verified').length,
    rejected: candidates.filter(u => u.verification_status === 'rejected').length,
  }), [candidates])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return candidates
      .filter(u => tab === 'all' || (u.verification_status || 'pending') === tab)
      .filter(u => !q ||
        u.full_name?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.address?.toLowerCase().includes(q))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) // oldest waiting first
  }, [candidates, tab, search])

  async function decide(user, status, note) {
    if (working) return
    setWorking(user.id)
    const { error } = await supabase.rpc('set_verification_status', {
      target_user: user.id,
      new_status: status,
      note: note ?? null,
    })
    setWorking(null)

    if (error) {
      toast.error(error.message || 'Could not update verification')
      return
    }

    onUpdated?.(user.id, {
      verification_status: status,
      verification_note: note?.trim() || null,
      verified_by: profile?.id ?? null,
      verified_at: new Date().toISOString(),
    })
    setRejecting(null)
    setReason('')
    toast.success(
      status === 'verified' ? `${user.full_name} is now verified`
        : status === 'rejected' ? `${user.full_name} was not verified`
        : `${user.full_name} moved back to pending`
    )
  }

  // The person shown on the right. Wide screens fall back to the first in
  // the list; on phones the list and the person take turns (`openId`).
  const selected = shown.find(u => u.id === openId) || shown[0] || null
  const ageLabel = u => `signed up ${timeAgo(u.created_at)}`
  const tone = u => STATUS_TONE[u.verification_status || 'pending']
  const busy = selected && working === selected.id

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
      {/* Left: who is waiting */}
      <Card lift className={`!overflow-visible ${openId ? 'hidden lg:block' : ''}`}>
        <div className="flex items-center gap-2 px-3.5 py-3 sm:px-[18px]">
          <FilterSelect label="Show" value={tab} onChange={v => { setTab(v); setOpenId(null) }} className="shrink-0"
            options={TABS.map(t => ({ value: t.value, label: `${t.label} · ${t.value === 'all' ? candidates.length : counts[t.value]}` }))} />
          <SearchBox value={search} onChange={setSearch} label="Search accounts" placeholder="Search" className="min-w-0 flex-1" />
        </div>
        {shown.length === 0 ? (
          <div className="border-t border-line px-[18px] py-5">
            <Muted>{candidates.length === 0 ? 'Nobody has joined yet. New accounts show up here for review.'
              : search ? 'Nobody matches that search.' : tab === 'pending' ? 'Nobody is waiting. New sign-ups show up here.' : 'Nobody in this list.'}</Muted>
            {search && <Button variant="secondary" size="sm" className="mt-3" onClick={() => setSearch('')}>Clear search</Button>}
          </div>
        ) : (
          <ul className="border-t border-line">
            {shown.map(u => {
              const on = selected?.id === u.id
              return (
                <li key={u.id} className="border-b border-line last:border-b-0">
                  <button type="button" onClick={() => setOpenId(u.id)} aria-current={on ? 'true' : undefined}
                    className={`flex w-full items-center gap-3 px-[18px] py-3 text-left outline-none transition-colors focus-visible:bg-surface-sunk ${on ? 'lg:bg-brand-soft lg:shadow-[inset_3px_0_0_var(--brand-strong)]' : 'hover:bg-surface-sunk'}`}>
                    <Avatar name={u.full_name} src={u.avatar_url} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{u.full_name || 'No name given'}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{[u.address, ageLabel(u)].filter(Boolean).join(' · ')}</span>
                    </span>
                    {tab === 'all' && <Status tone={tone(u)} className="shrink-0">{STATUS_LABEL[u.verification_status || 'pending']}</Status>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* Right: the person, the facts, the decision */}
      {selected ? (
        <Card lift className={openId ? '' : 'hidden lg:block'}>
          <div className="flex items-start gap-3 px-[18px] pt-4">
            <button type="button" onClick={() => setOpenId(null)} aria-label="Back to the list"
              className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-line text-ink outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-brand-strong lg:hidden">
              <ChevronLeft size={18} />
            </button>
            <Avatar name={selected.full_name} src={selected.avatar_url} size="lg" className="hidden sm:flex" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-extrabold text-ink">{selected.full_name || 'No name given'}</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Signed up {fullDate(selected.created_at)}</p>
              <Status tone={tone(selected)} className="mt-1.5">{STATUS_LABEL[selected.verification_status || 'pending']}</Status>
            </div>
          </div>

          <dl className="mx-[18px] mt-4 border-t border-line text-sm">
            {[
              ['Full name', selected.full_name || 'Not given'],
              ['Account', selected.role ? selected.role[0].toUpperCase() + selected.role.slice(1) : 'Resident'],
              ['Address given', selected.address || 'No address on file'],
              ['Phone', selected.phone || 'No phone on file'],
              selected.verified_at && ['Reviewed', fullDate(selected.verified_at)],
            ].filter(Boolean).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-line py-2.5 sm:grid-cols-[160px_minmax(0,1fr)]">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="min-w-0 font-bold break-words text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="space-y-3 px-[18px] py-4">
            {selected.verification_note && (
              <Notice tone={selected.verification_status === 'rejected' ? 'danger' : 'info'} title="Note on the decision">{selected.verification_note}</Notice>
            )}

            {rejecting === selected.id ? (
              <div className="space-y-2.5">
                <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                  aria-label={`Reason for not verifying ${selected.full_name}`}
                  placeholder="Why can this account not be verified? The resident will see this." />
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => { setRejecting(null); setReason('') }}>Cancel</Button>
                  <Button variant="danger" onClick={() => decide(selected, 'rejected', reason)} disabled={busy || !reason.trim()} aria-busy={busy || undefined}>
                    {busy && <Loader2 className="animate-spin" aria-hidden="true" />}Not a resident
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
                  Verifying confirms they live in {profile?.barangays?.name || 'the barangay'} (RA 7160, Sec. 394). Verified residents can request documents; anyone can still report an emergency.
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.verification_status && selected.verification_status !== 'pending' && (
                    <Button variant="secondary" onClick={() => decide(selected, 'pending', null)} disabled={busy}>
                      <RotateCcw aria-hidden="true" />Back to waiting
                    </Button>
                  )}
                  {selected.verification_status !== 'rejected' && (
                    <Button variant="secondary" onClick={() => { setRejecting(selected.id); setReason('') }} disabled={busy}>
                      Not a resident
                    </Button>
                  )}
                  {selected.verification_status !== 'verified' && (
                    <Button onClick={() => decide(selected, 'verified', null)} disabled={busy} aria-busy={busy || undefined}>
                      {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}Verify resident
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="hidden px-8 py-12 text-center lg:block">
          <p className="text-[15px] font-extrabold text-ink">Nobody to review</p>
          <Muted className="mt-1">Pick another list on the left, or wait for new sign-ups.</Muted>
        </Card>
      )}
    </div>
  )
}
