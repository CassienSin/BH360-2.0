'use client'
import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import PageShell from '@/components/crafted/PageShell'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { InfrastructureIcon } from '@/components/icons/BhIcons'

export default function ScreenPreview() {
  const [title, setTitle] = useState('')
  return (
    <PageShell title="Report an incident" sub="Step 2 of 2 · Details and location" eyebrow="Sample screen"
      onBack={() => history.back()}
      actions={<IconButton kind="onband" label="More"><MoreHorizontal size={18} strokeWidth={1.9} /></IconButton>}
      footer={<>
        <p className="text-center text-xs text-muted-foreground">Saved on your phone if you lose signal.</p>
        <Button variant="danger" size="lg" full>Send report</Button>
      </>}>
      <Card lift className="flex items-center gap-3 px-[18px] py-3.5">
        <InfrastructureIcon size={20} className="text-brand-strong" />
        <p className="flex-1 text-[15px] font-extrabold text-ink">Infrastructure</p>
        <Button variant="ghost" size="sm">Change</Button>
      </Card>
      <Field label="Short title" value={title} onChange={e => setTitle(e.target.value)} placeholder="What happened, in a few words" />
      <Field label="What did you see?"><Textarea placeholder="Describe it" /></Field>
      <Card className="p-[18px]"><p className="text-sm text-body">Sample content. The band fades into the page; the first card sits on the purple.</p></Card>
    </PageShell>
  )
}
