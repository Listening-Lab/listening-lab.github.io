import { Metadata } from 'next'
import Link from 'next/link'
import AnimatedSection from '@/components/AnimatedSection'
import ApiPanel from '@/components/services/ApiPanel'
import ServiceFigure from '@/components/services/Figures'
import { SERVICES } from '@/lib/services'

export const metadata: Metadata = { title: 'Monitoring projects' }

const TEAL = '#4ecdc4'

const STEPS = [
  { name: 'Efficient validation', text: 'Experts validate detections using optimised sampling, so fewer checks give reliable results.' },
  { name: 'Calibration', text: 'Those reviews turn model scores into detection probabilities for your recordings.' },
  { name: 'Estimation', text: 'Statistical models carry that uncertainty through, so every result has a confidence interval.' },
]

export default function MonitoringPage() {
  return (
    <div className="min-h-screen bg-ocean-dark">
      <div className="max-w-5xl mx-auto px-6 pt-28 pb-24">
        <p className="text-sm text-gray-500 mb-8">
          <Link href="/services" className="hover:text-white transition-colors">← Services</Link>
        </p>
        <AnimatedSection className="mb-16 max-w-3xl">
          <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>
            Monitoring projects
          </p>
          <h1 className="font-serif text-5xl text-white mb-6 leading-tight">
            From Raw Data to Robust Ecological Inference
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed">
            We help design your survey, process the audio and deliver calibrated results, with the
            uncertainty stated plainly, so you know what your data can and can&apos;t tell you.
          </p>
          <div className="flex gap-4 mt-8">
            <Link href="/pricing" className="bg-white text-ocean-dark px-5 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors">
              Estimate a project
            </Link>
            <Link href="/contact" className="text-white border border-white/20 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-white/10 transition-colors">
              Talk to us
            </Link>
          </div>
        </AnimatedSection>

        <AnimatedSection className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
          {SERVICES.map((s) => {
            const body = (
              <>
                <ServiceFigure slug={s.slug} className="w-full h-auto mb-4" />
                <p className="text-xs text-gray-500 mb-1">{s.question}</p>
                <h2 className="text-white font-medium mb-2">{s.name}</h2>
                <p className="text-sm text-gray-400 leading-relaxed flex-1">{s.short}</p>
                <p className="text-sm mt-4" style={{ color: s.comingSoon ? undefined : TEAL }}>
                  {s.comingSoon ? <span className="text-gray-500">In development</span> : 'Learn more →'}
                </p>
              </>
            )
            return s.comingSoon ? (
              <div key={s.slug} className="flex flex-col rounded-xl border border-white/10 p-5 opacity-50" aria-disabled="true">
                {body}
              </div>
            ) : (
              <Link
                key={s.slug}
                href={`/monitoring/${s.slug}`}
                className="flex flex-col rounded-xl border border-white/10 p-5 hover:border-white/30 hover:bg-white/[0.02] transition-colors"
              >
                {body}
              </Link>
            )
          })}
        </AnimatedSection>

        <AnimatedSection className="grid md:grid-cols-[1fr_2fr] gap-10 mb-20">
          <div>
            <h2 className="font-serif text-3xl text-white mb-3">How we get there</h2>
            <p className="text-gray-400 leading-relaxed">
              A classifier&apos;s confidence score is not a probability. Three steps turn it into one.
            </p>
          </div>
          <ol className="grid sm:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <li key={step.name}>
                <span className="block text-xs text-gray-500 mb-2 tabular-nums">0{i + 1}</span>
                <span className="block text-white mb-1">{step.name}</span>
                <span className="text-sm text-gray-400 leading-relaxed">{step.text}</span>
              </li>
            ))}
          </ol>
        </AnimatedSection>

        <AnimatedSection className="mb-20 max-w-3xl">
          <h2 className="font-serif text-3xl text-white mb-3">Study design is included</h2>
          <p className="text-gray-300 leading-relaxed">
            How recorders are placed and scheduled matters more than anything done afterwards. We help
            you choose hardware, layout and schedules, and check a design can answer your question
            before anything goes in the ground. We can also tell you what recordings you already have
            can support.
          </p>
        </AnimatedSection>

        <AnimatedSection>
          <ApiPanel />
        </AnimatedSection>

        <p className="text-sm text-gray-500 mt-12">
          Every project includes the <Link href="/platform" className="underline hover:text-white">Pro platform</Link> for
          its duration. Scope, data ownership and specialist surveys are covered in the{' '}
          <Link href="/terms/service" className="underline hover:text-white">service terms</Link>.
        </p>
      </div>
    </div>
  )
}
