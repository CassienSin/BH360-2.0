// app/not-found.tsx — shown for any route that doesn't exist.
// No 'use client' needed: no hooks, and Link works in Server Components,
// so this stays a lightweight server-rendered page.

import Image from 'next/image'
import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'
import AnimatedDots from '@/components/AnimatedDots'

export default function NotFound() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-brand flex items-center justify-center p-4">
      <AnimatedDots />

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(80px)', animation: 'float 8s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'white', filter: 'blur(60px)', animation: 'floatReverse 10s ease-in-out infinite' }}
        />
      </div>

      <div className="white-card p-8 sm:p-10 max-w-md w-full text-center relative z-10 fade-up">
        {/* Floating logo peeking over a giant ghost 404 */}
        <div className="relative mb-6">
          <p
            className="text-[90px] sm:text-[110px] font-black leading-none select-none"
            style={{
              background: 'linear-gradient(135deg, #f0effe, #e8e3ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-4px',
            }}
            aria-hidden="true"
          >
            404
          </p>
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20"
            style={{ animation: 'float 3s ease-in-out infinite' }}
          >
            <Image src="/logo.png" alt="BH360" fill sizes="80px" className="object-contain drop-shadow-lg" priority />
          </div>
        </div>

        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5B54E8' }}>
          Page not found
        </p>
        <h1 className="text-2xl font-black text-gray-800 mb-2" style={{ letterSpacing: '-0.5px' }}>
          Wala dito! 🧭
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          The page you're looking for doesn't exist, moved, or the link is broken. Let's get you back on track.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.4)' }}
          >
            <Home size={14} /> Back to Home
          </Link>
          <Link
            href="/help"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-105"
            style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}
          >
            <ArrowLeft size={14} /> Get Help
          </Link>
        </div>

        {/* Bouncing dots — the app's signature trio */}
        <div className="mt-8 flex items-center justify-center gap-1.5">
          <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#5B54E8', animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#7C75F0', animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#a78bfa', animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}