import { Metadata } from 'next'
import AnimatedSection from '@/components/AnimatedSection'
import { getAllResearch } from '@/lib/research'
import ResearchCard from '@/components/ResearchCard'
import { format } from 'date-fns'

export const metadata: Metadata = { title: 'Research' }

export default async function ResearchPage() {
  const researchItems = await getAllResearch()

  return (
    <div className="min-h-screen bg-ocean-dark">
      <div className="max-w-6xl mx-auto px-6 py-32">
        <AnimatedSection className="mb-16">
          <h1 className="font-serif text-5xl md:text-6xl text-white mb-6">Our Research</h1>
          <p className="text-xl text-gray-400 max-w-2xl">
            Explore our interactive tools, soundscapes, and computational bioacoustic models.
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {researchItems.map((item, i) => (
            <AnimatedSection key={item.slug} delay={i * 0.1}>
              <ResearchCard
                title={item.title}
                excerpt={item.excerpt}
                slug={item.slug}
                date={format(new Date(item.date), 'MMM yyyy')}
                tags={item.tags}
              />
            </AnimatedSection>
          ))}
        </div>
      </div>
    </div>
  )
}