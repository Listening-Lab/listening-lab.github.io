import { Metadata } from 'next'
import Link from 'next/link'
import AnimatedSection from '@/components/AnimatedSection'
import ApiPanel from '@/components/services/ApiPanel'
import PanelVisual from '@/components/services/PanelVisual'
import { PATHS, PRINCIPLES } from '@/lib/servicesContent'

export const metadata: Metadata = { title: 'Services' }

const TEAL = '#4ecdc4'

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-ocean-dark">
      <div className="max-w-6xl mx-auto px-6 pt-28 pb-24">
        <AnimatedSection className="mb-14 max-w-3xl">
          <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>
            Services
          </p>
          <h1 className="font-serif text-5xl text-white mb-6 leading-tight">
            Acoustic monitoring, from open data to expert analysis
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed">
            Work with sound data yourself on our platform, or have us run a monitoring project for you.
          </p>
        </AnimatedSection>

        <AnimatedSection className="grid md:grid-cols-3 gap-5 mb-6">
          {PATHS.map((p) => (
            <Link
              key={p.eyebrow}
              href={p.href}
              className={`flex flex-col rounded-xl border p-5 transition-colors ${
                p.comingSoon
                  ? 'border-white/10 opacity-60 hover:opacity-80'
                  : 'border-white/10 hover:border-white/30 hover:bg-white/[0.02]'
              }`}
            >
              <div className={`mb-5 ${p.comingSoon ? 'grayscale' : ''}`}>
                <PanelVisual kind={p.visual} />
              </div>
              <p className={`text-xs tracking-widest uppercase mb-2 ${p.comingSoon ? 'text-gray-500' : ''}`} style={p.comingSoon ? undefined : { color: TEAL }}>
                {p.eyebrow}
                {p.comingSoon && <span className="normal-case tracking-normal"> · in development</span>}
              </p>
              <h2 className="font-serif text-xl text-white mb-2">{p.title}</h2>
              <p className="text-sm text-gray-400 leading-relaxed flex-1">{p.text}</p>
            </Link>
          ))}
        </AnimatedSection>

        <AnimatedSection className="mb-20">
          <ApiPanel />
        </AnimatedSection>

        <AnimatedSection className="border-t border-white/10 pt-14">
          <h2 className="font-serif text-3xl text-white mb-8">Who we are</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {PRINCIPLES.map((p) => (
              <div key={p.name}>
                <h3 className="text-white mb-2">{p.name}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </div>
  )
}
