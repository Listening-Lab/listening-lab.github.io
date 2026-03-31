import AnimatedSection from './AnimatedSection'
import Link from 'next/link'

const TEAL = '#4ecdc4'

const pillars = [
  {
    title: 'National-scale monitoring',
    desc:
      'Deploying passive acoustic recorder networks across New Zealand\'s forests, wetlands, and coastlines to track biodiversity change over time.',
  },
  {
    title: 'Computational bioacoustic tools',
    desc:
      'Building open-source machine learning models and signal-processing pipelines that automate species identification from large audio archives.',
  },
  {
    title: 'Ecology meets data science',
    desc:
      'Combining deep ecological knowledge with modern data science to turn terabytes of field recordings into meaningful biodiversity metrics.',
  },
  // {
  //   title: 'Conservation-ready insights',
  //   desc:
  //     'Translating acoustic indices and species detections into actionable evidence for land managers, iwi, and conservation agencies.',
  // },
]

export default function About() {
  return (
    <section className="py-24 bg-[rgb(7_17_32)]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">

          {/* ── Left: identity & mission ── */}
          <AnimatedSection>
            <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>
              Who we are
            </p>
            <h2 className="font-serif text-4xl md:text-5xl text-white leading-tight mb-6">
              Listening to nature at scale.
            </h2>
            <p className="text-gray-300 leading-relaxed mb-6">
              The Listening Lab is a multidisciplinary research group developing computational
              bioacoustic tools for conservation. We build the methods and infrastructure needed to monitor New
              Zealand's biodiversity through sound.
            </p>
            <p className="text-gray-400 leading-relaxed mb-10">
              By combining passive recording technology with automated analysis, we make it possible to track 
              wildlife populations at a scale that was previously out of reach.
            </p>
            <Link
              href="/about"
              className="inline-block border border-white/30 text-white px-8 py-3 rounded-full font-medium hover:bg-white/10 transition-colors"
            >
              Meet the team
            </Link>
          </AnimatedSection>

          {/* ── Right: aims ── */}
          <div className="space-y-8">
            <AnimatedSection>
              <p className="text-xs tracking-widest uppercase mb-6 font-medium" style={{ color: TEAL }}>
                Our aims
              </p>
            </AnimatedSection>
            {pillars.map((pillar, i) => (
              <AnimatedSection key={pillar.title} delay={i * 0.1}>
                <div className="flex gap-5">
                  <div className="mt-1 flex-shrink-0 w-0.5 self-stretch rounded-full" style={{ backgroundColor: `${TEAL}66` }} />
                  <div>
                    <h3 className="font-serif text-lg text-white mb-1">{pillar.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{pillar.desc}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
