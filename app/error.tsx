'use client'
// app/error.tsx — catches unhandled exceptions in any route below it and
// shows this instead of Next's default white error screen.
// Must be a Client Component (Next.js requirement for error boundaries).

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { RefreshCw, Home } from 'lucide-react'

const DOTS = Array.from({ length: 20 }, (_, i) => ({
  size: ((i * 7) % 6) + 3,
  left: (i * 17 + 13) % 100,
  top: (i * 23 + 7) % 100,
  duration: ((i * 3) % 6) + 4,
  delay: (i * 0.7) % 4,
}))

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface the real error for debugging (and any future error reporting)
    console.error('Unhandled application error:', error)
  }, [error])

  return (
    <div className="min-h-screen relative overflow-hidden bg-brand flex items-center justify-center p-4">
      {/* Animated background dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {DOTS.map((dot, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.4)',
              left: `${dot.left}%`,
              top: `${dot.top}%`,
              animation: `float ${dot.duration}s ease-in-out infinite`,
              animationDelay: `${dot.delay}s`,
              filter: 'blur(0.5px)',
            }}
          />
        ))}
      </div>

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
        {/* Floating logo with a wobbly "oops" shadow */}
        <div className="relative w-24 h-24 mx-auto mb-6" style={{ animation: 'float 3s ease-in-out infinite' }}>
          <div
            className="absolute inset-0 rounded-3xl opacity-20"
            style={{
              background: 'linear-gradient(135deg, #5B54E8, #7C75F0)',
              filter: 'blur(20px)',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
          <Image src="/logo.png" alt="BH360" fill sizes="96px" className="object-contain relative" priority />
        </div>

        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5B54E8' }}>
          Something went wrong
        </p>
        <h1 className="text-2xl font-black text-gray-800 mb-2" style={{ letterSpacing: '-0.5px' }}>
          Naku! We hit a snag 😅
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-1">
          An unexpected error occurred. It's not you — it's us. Try again, and if it keeps happening, head back home.
        </p>
        {error.digest && (
          <p className="text-[10px] text-gray-300 mb-6">Error reference: {error.digest}</p>
        )}
        {!error.digest && <div className="mb-6" />}

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #5B54E8, #7C75F0)', boxShadow: '0 8px 32px rgba(91,84,232,0.4)' }}
          >
            <RefreshCw size={14} /> Try Again
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-105"
            style={{ background: '#f0effe', color: '#5B54E8', border: '1px solid #e8e3ff' }}
          >
            <Home size={14} /> Go Home
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