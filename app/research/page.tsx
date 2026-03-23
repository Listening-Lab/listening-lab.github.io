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
    <div className="max-w-5xl mx-auto px-6 py-24">
      <AnimatedSection>
        <h1 className="font-serif text-5xl text-ocean-dark mb-4">Research</h1>
        <p className="text-xl text-gray-600 mb-16">
          Our work spans auditory perception, environmental acoustics, and sound design.
        </p>
      </AnimatedSection>

      <div className="grid md:grid-cols-2 gap-8">
        {projects.map((project, i) => (
          <AnimatedSection key={project.title} delay={i * 0.1}>
            <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <h2 className="font-serif text-2xl text-ocean-dark mb-3">{project.title}</h2>
              <p className="text-gray-600 mb-4">{project.description}</p>
              <div className="flex flex-wrap gap-2">
                {project.tags.map(tag => (
                  <span key={tag} className="text-xs font-medium bg-brand-50 text-brand-700 px-3 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </AnimatedSection>
        ))}
      </div>
    </div>
  )
}
