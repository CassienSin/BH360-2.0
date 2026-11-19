'use client'
import { Copy, Plus } from 'lucide-react'
import { Card, CardHead } from '@/components/ui/card'
import { Rows, Row } from '@/components/ui/table'
import { Tag, Status } from '@/components/ui/tag'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Avatar } from '@/components/ui/avatar'
import { Muted } from '@/components/ui/text'
import { SearchBox, ExportMenu } from '@/components/official/Toolbar'

/*
 * O09: the people in the barangay (a table with role tabs) beside the
 * invite codes. Presentation only: the page owns the search, the role
 * filter, generating codes, copying and the export.
 */

const ROLES = [
  { value: 'resident', label: 'Residents' },
  { value: 'official', label: 'Officials' },
  { value: 'tanod', label: 'Tanods' },
  { value: 'all', label: 'Everyone' },
]
const ROLE_LABEL = { resident: 'Resident', official: 'Official', tanod: 'Tanod' }
const VERIFY = {
  verified: { label: 'Verified', tone: 'ok' },
  rejected: { label: 'Not verified', tone: 'danger' },
  pending: { label: 'Waiting', tone: 'warn' },
}

function joined(at) {
  const d = new Date(at)
  if (isNaN(d.getTime())) return ''
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const y = new Date(today); y.setDate(today.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function UsersSection({
  users, filtered, search, onSearch, role, onRole, inviteCodes, generating, onGenerate, onCopy, onExport, onReview,
}) {
  const counts = Object.fromEntries(ROLES.map(r => [r.value, r.value === 'all' ? users.length : users.filter(u => u.role === r.value).length]))
  const verifyOf = u => (u.is_super_admin ? null : VERIFY[u.verification_status || 'pending'])

  return (
    <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_384px]">
      <Card className="@container !overflow-visible">
        <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3 sm:px-[18px]">
          <Segmented label="Show" value={role} onChange={onRole}
            items={ROLES.map(r => ({ value: r.value, label: r.label, count: r.value === 'all' ? undefined : counts[r.value] }))}
            className="w-full @3xl:w-auto [scrollbar-width:none]! [&::-webkit-scrollbar]:hidden" />
          <SearchBox value={search} onChange={onSearch} label="Search people" placeholder="Search people" className="min-w-48 flex-1 @5xl:max-w-64" />
          <span className="@3xl:ml-auto"><ExportMenu count={filtered.length} noun="people" onExport={onExport} /></span>
        </div>

        {filtered.length === 0 ? (
          <div className="border-t border-line px-[18px] py-6">
            <p className="text-sm font-bold text-ink">{users.length === 0 ? 'Nobody yet' : 'Nobody matches'}</p>
            <Muted className="mt-1">{users.length === 0 ? 'People who join with this barangay show up here.' : 'Try another tab or clear the search.'}</Muted>
            {users.length > 0 && <Button variant="secondary" size="sm" className="mt-3" onClick={() => { onSearch(''); onRole('all') }}>Show everyone</Button>}
          </div>
        ) : (
          <>
            <table className="hidden w-full table-fixed border-collapse text-left @3xl:table">
              <thead>
                <tr className="border-t border-line bg-surface-sunk text-xs font-bold text-muted-foreground">
                  <th scope="col" className="py-2.5 pl-[18px] font-bold">Name</th>
                  <th scope="col" className="w-[26%] px-3 py-2.5 font-bold">Address</th>
                  {role === 'all' && <th scope="col" className="w-[96px] px-3 py-2.5 font-bold">Role</th>}
                  <th scope="col" className="w-[120px] px-3 py-2.5 font-bold">Status</th>
                  <th scope="col" className="w-[118px] px-3 py-2.5 font-bold">Joined</th>
                  <th scope="col" className="w-[92px] py-2.5 pr-[18px]"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const v = verifyOf(u)
                  return (
                    <tr key={u.id} className="border-t border-line">
                      <td className="min-w-0 py-2.5 pl-[18px]">
                        <span className="flex min-w-0 items-center gap-3">
                          <Avatar name={u.full_name} src={u.avatar_url} size="sm" tone={u.role === 'tanod' && u.on_duty ? 'ok' : 'brand'} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-ink">{u.full_name || 'No name given'}</span>
                            <span className="block truncate text-xs text-muted-foreground">{u.phone || 'No phone'}</span>
                          </span>
                        </span>
                      </td>
                      <td className="truncate px-3 py-2.5 text-[13px] text-body">{u.address || '—'}</td>
                      {role === 'all' && <td className="px-3 py-2.5"><Tag tone={u.role === 'resident' ? 'quiet' : 'brand'}>{ROLE_LABEL[u.role] || u.role}</Tag></td>}
                      <td className="px-3 py-2.5">{v ? <Status tone={v.tone}>{v.label}</Status> : <span className="text-xs text-muted-foreground">Admin</span>}</td>
                      <td className="px-3 py-2.5 text-[13px] text-body">{joined(u.created_at)}</td>
                      <td className="py-2.5 pr-[18px] text-right">
                        {v && (u.verification_status || 'pending') === 'pending' && (
                          <Button size="sm" variant="secondary" onClick={() => onReview(u)}>Review</Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <Rows className="border-t border-line @3xl:hidden">
              {filtered.map(u => {
                const v = verifyOf(u)
                return (
                  <Row key={u.id} className="flex items-center gap-3">
                    <Avatar name={u.full_name} src={u.avatar_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{u.full_name || 'No name given'}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{[ROLE_LABEL[u.role], u.address, `joined ${joined(u.created_at).toLowerCase()}`].filter(Boolean).join(' · ')}</p>
                      {v && <Status tone={v.tone} className="mt-1">{v.label}</Status>}
                    </div>
                    {v && (u.verification_status || 'pending') === 'pending' && (
                      <Button size="sm" variant="secondary" onClick={() => onReview(u)}>Review</Button>
                    )}
                  </Row>
                )
              })}
            </Rows>
          </>
        )}
      </Card>

      {/* Invite codes: officials and tanods join with one */}
      <Card>
        <CardHead title="Invite codes" sub="Share each code with one new official or tanod" />
        {inviteCodes.length === 0 ? (
          <Muted className="border-t border-line px-[18px] py-4">No codes yet. Make one below.</Muted>
        ) : (
          <Rows className="max-h-[420px] overflow-y-auto border-t border-line">
            {inviteCodes.map(code => {
              const usedBy = code.used ? users.find(u => u.id === code.used_by) : null
              return (
                <Row key={code.id} className="flex items-center gap-2.5 py-2.5">
                  <span className={`font-mono text-sm font-bold tracking-[0.06em] ${code.used ? 'text-muted-foreground line-through decoration-1' : 'text-ink'}`}>{code.code}</span>
                  <Tag tone="brand">{ROLE_LABEL[code.role] || code.role}</Tag>
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {code.used ? (usedBy ? `Used by ${usedBy.full_name?.split(' ')[0]}` : 'Used') : 'Unused'}
                  </span>
                  {!code.used && (
                    <button type="button" onClick={() => onCopy(code.code)} aria-label={`Copy code ${code.code}`}
                      className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-ink outline-none hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong">
                      <Copy size={15} />
                    </button>
                  )}
                </Row>
              )
            })}
          </Rows>
        )}
        <div className="flex flex-wrap gap-2 border-t border-line px-[18px] py-3">
          <Button size="sm" variant="secondary" onClick={() => onGenerate('official')} disabled={generating}><Plus aria-hidden="true" />New official code</Button>
          <Button size="sm" variant="secondary" onClick={() => onGenerate('tanod')} disabled={generating}><Plus aria-hidden="true" />New tanod code</Button>
        </div>
      </Card>
    </div>
  )
}
