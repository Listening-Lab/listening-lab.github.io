import AnimatedSection from './AnimatedSection'
import Link from 'next/link'

const areas = [
  { title: 'Psychoacoustics', desc: 'How the brain interprets complex auditory scenes.', icon: '🧠' },
  { title: 'Acoustic Ecology', desc: 'Sound relationships between organisms and environment.', icon: '🌿' },
  { title: 'Soundscape Design', desc: 'Creating spaces that support wellbeing through sound.', icon: '🏙️' },
]

export default function FeaturedResearch() {
  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <AnimatedSection>
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl text-ocean-dark mb-4">What We Study</h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              From the neuroscience of hearing to the design of acoustic environments.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {areas.map((area, i) => (
            <AnimatedSection key={area.title} delay={i * 0.1}>
              <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">{area.icon}</div>
                <h3 className="font-serif text-xl text-ocean-dark mb-2">{area.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{area.desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection>
          <div className="text-center">
            <Link href="/research" className="text-brand-600 font-medium hover:underline">
              View all research areas →
            </Link>
          </div>
        </AnimatedSection>
      </div>
    </section>
  )
}
