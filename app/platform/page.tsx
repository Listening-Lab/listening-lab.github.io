import { Metadata } from 'next'
import Link from 'next/link'
import AnimatedSection from '@/components/AnimatedSection'
import ApiPanel from '@/components/services/ApiPanel'
import { TIERS } from '@/lib/platform'

export const metadata: Metadata = { title: 'Platform' }

const TEAL = '#4ecdc4'

export default function PlatformPage() {
  return (
    <div className="min-h-screen bg-ocean-dark">
      <div className="max-w-5xl mx-auto px-6 pt-28 pb-24">
        <p className="text-sm text-gray-500 mb-8">
          <Link href="/services" className="hover:text-white transition-colors">← Services</Link>
        </p>

        <AnimatedSection className="mb-14 max-w-3xl">
          <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>
            Platform
          </p>
          <h1 className="font-serif text-5xl text-white mb-6 leading-tight">Explore, analyse and validate</h1>
          <p className="text-xl text-gray-300 leading-relaxed">
            Explore New Zealand&apos;s public sound data, run the national model and help validate it, free.
            Subscribe when you need private projects, custom models or processing at scale.
          </p>
        </AnimatedSection>

        <AnimatedSection className="grid md:grid-cols-2 gap-5 mb-6">
          {TIERS.map((t) => (
            <div
              key={t.id}
              className={`flex flex-col rounded-xl border p-6 ${t.id === 'pro' ? 'border-[#4ecdc4]/40 bg-[#4ecdc4]/[0.04]' : 'border-white/10'}`}
            >
              <h2 className="text-white text-lg">{t.name}</h2>
              <p className="text-sm text-gray-400 mb-4">{t.summary}</p>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-medium text-white">{t.price}</span>
                {t.per && <span className="text-sm text-gray-400">{t.per}</span>}
              </div>
              <ul className="space-y-2.5 text-sm flex-1">
                {t.features.map((f) => (
                  <li key={f.text} className={`flex gap-2.5 ${f.comingSoon ? 'text-gray-500' : 'text-gray-300'}`}>
                    <span style={{ color: f.comingSoon ? undefined : TEAL }}>{f.comingSoon ? '○' : '✓'}</span>
                    <span>
                      {f.text}
                      {f.comingSoon && <span className="text-xs text-gray-600"> · coming soon</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {t.id === 'free' ? (
                  <Link href="/login" className="inline-block bg-white text-ocean-dark px-5 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors">
                    Sign up free
                  </Link>
                ) : (
                  <Link href="/contact" className="inline-block text-white border border-white/20 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-white/10 transition-colors">
                    Join early access
                  </Link>
                )}
              </div>
            </div>
          ))}
        </AnimatedSection>

        <p className="text-sm text-gray-400 mb-20 max-w-3xl leading-relaxed">
          Use beyond the Pro allowance is charged as used, at published rates per audio-hour and per GB
          stored, and you set a spending cap. Pro is included for the length of any{' '}
          <Link href="/monitoring" className="underline hover:text-white">monitoring project</Link>.
        </p>

        <AnimatedSection className="mb-20 rounded-xl border border-white/10 bg-white/[0.03] p-8 grid md:grid-cols-[auto_1fr] gap-8 items-start">
          <div className="w-14 h-14 rounded-xl border border-white/15 bg-ocean-mid flex items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke={TEAL} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="12" rx="1.5" />
              <path d="M8 20h8M12 16v4" />
              <path d="M6.5 11h1.5l1-3 2 6 1.5-4 1 2h4" />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
              <h2 className="font-serif text-3xl text-white">Ecocommons desktop app</h2>
              <span className="text-xs rounded-full border border-white/15 px-2.5 py-0.5 text-gray-400">In development · free</span>
            </div>
            <div className="text-gray-300 leading-relaxed space-y-3 max-w-3xl">
              <p>
                Our fullest set of tools, including active learning you can tune to your own data and
                locating calls with synchronised recorders.
              </p>
              <p className="text-gray-400">
                It runs on your own computer and connects to the Nature Commons platform. Work done on
                your own hardware is free; you only need Pro when you use our cloud for large storage or
                processing.
              </p>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection className="grid md:grid-cols-[1fr_2fr] gap-10 mb-20">
          <h2 className="font-serif text-3xl text-white">Every check helps everyone</h2>
          <div className="text-gray-300 leading-relaxed space-y-4">
            <p>
              Validated data improves the national model&apos;s performance and calibration for everyone who
              uses it. That includes checks from citizen scientists, and from projects whose owners opt in
              to model contribution.
            </p>
            <p className="text-gray-400">
              Your recordings belong to you. We look after them; we don&apos;t own them. Private data is
              only used to improve the model if you opt in, and data held by iwi and hapū is only shared
              on terms agreed with them.
            </p>
          </div>
        </AnimatedSection>

        <AnimatedSection>
          <ApiPanel />
        </AnimatedSection>
      </div>
    </div>
  )
}
