import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock } from 'lucide-react'
import AuthShell, { AuthHeading } from '@/components/crafted/AuthShell'
import { Field } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Crafted auth shell · BH360' }

/** /dev/crafted/auth — the auth shell with a sample (inert) sign-in card. Development only. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <AuthShell title="Sign in" below={<>Barangay officials: <Link href="#">request access</Link></>}>
      <AuthHeading title="Sign in" sub="Magandang gabi. Use the email you signed up with." />
      <form className="space-y-4" action="#">
        <Field label="Email" icon={<Mail />} type="email" placeholder="name@email.com" autoComplete="off" />
        <Field label="Password" icon={<Lock />} type="password" placeholder="Your password" autoComplete="off" />
        <Button type="button" size="lg" full>Sign in</Button>
      </form>
      <p className="mt-5 border-t border-line pt-5 text-center text-sm text-body">
        New here? <Link href="#" className="font-bold text-brand-strong hover:text-brand-deep">Create an account</Link>
      </p>
    </AuthShell>
  )
}
