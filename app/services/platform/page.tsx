import { Metadata } from 'next'
import Link from 'next/link'
import AnimatedSection from '@/components/AnimatedSection'

export const metadata: Metadata = { title: 'Build with Nature Commons' }

const TEAL = '#4ecdc4'

const PARTS = [
  {
    name: 'Upload and store',
    text: 'Send audio from your own app or devices. We store it losslessly, or it stays in your own cloud bucket.',
  },
  {
    name: 'Process',
    text: 'Species detection across your recordings, run in parallel and charged per hour of audio.',
  },
  {
    name: 'Results',
    text: 'Detections, validated labels and project summaries, returned through the same API.',
  },
  {
    name: 'Access control',
    text: 'API keys scoped to projects, with read-only keys for dashboards and partners.',
  },
]

export default function PlatformPage() {
  return (
    <div className="min-h-screen bg-ocean-dark">
      <div className="max-w-4xl mx-auto px-6 pt-28 pb-24">
        <p className="text-sm text-gray-500 mb-8">
          <Link href="/services" className="hover:text-white transition-colors">← What we do</Link>
        </p>

        <AnimatedSection className="mb-16 max-w-3xl">
          <p className="text-xs tracking-widest uppercase mb-3 font-medium" style={{ color: TEAL }}>
            For businesses and developers
          </p>
          <h1 className="font-serif text-5xl text-white mb-6">Build Nature Commons into your product</h1>
          <p className="text-lg text-gray-300 leading-relaxed">
            If you run a monitoring platform, make recording hardware, or report on biodiversity for
            clients, you can use the same processing, storage and models that power Listening Lab,
            through an API.
          </p>
        </AnimatedSection>

        <AnimatedSection className="grid sm:grid-cols-2 gap-x-10 gap-y-8 mb-16">
          {PARTS.map((p) => (
            <div key={p.name} className="pl-4 border-l border-white/15">
              <h2 className="text-white mb-1">{p.name}</h2>
              <p className="text-gray-400 leading-relaxed">{p.text}</p>
            </div>
          ))}
        </AnimatedSection>

        <AnimatedSection className="mb-16 max-w-3xl">
          <h2 className="font-serif text-2xl text-white mb-3">Pricing</h2>
          <p className="text-gray-300 leading-relaxed">
            Processing and storage are charged as used, and you set a spending cap. Expert validation
            and calibration can be added for your customers&apos; projects, priced as in our{' '}
            <Link href="/pricing" className="underline hover:text-white">estimator</Link>.
          </p>
        </AnimatedSection>

        <div className="border-t border-white/10 pt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/contact"
            className="bg-white text-ocean-dark px-5 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors"
          >
            Talk to us about access
          </Link>
          <span className="text-sm text-gray-500">API access is by arrangement while we&apos;re in early access.</span>
        </div>
      </div>
    </div>
  )
}
