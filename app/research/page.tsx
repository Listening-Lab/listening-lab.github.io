import { Metadata } from 'next'
import AnimatedSection from '@/components/AnimatedSection'

export const metadata: Metadata = { title: 'Research' }

const projects = [
  {
    title: 'Computational Bioacoustics',
    description: '',
    tags: ['Bioacoustics'],
  }
]

export default function ResearchPage() {
  return (
    <div className="min-h-screen bg-ocean-dark">
      <div className="max-w-5xl mx-auto px-6 py-24">
        <AnimatedSection>
          <h1 className="font-serif text-5xl text-white mb-4">Research</h1>
          <p className="text-xl text-gray-400 mb-16">
            Our work spans auditory perception, environmental acoustics, and sound design.
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-8">
          {projects.map((project, i) => (
            <AnimatedSection key={project.title} delay={i * 0.1}>
              <div className="border border-white/10 rounded-2xl p-8 hover:border-white/25 hover:bg-white/5 transition-all">
                <h2 className="font-serif text-2xl text-white mb-3">{project.title}</h2>
                <p className="text-gray-400 mb-4">{project.description}</p>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map(tag => (
                    <span key={tag} className="text-xs font-medium bg-brand-500/20 text-brand-500 px-3 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </div>
  )
}
