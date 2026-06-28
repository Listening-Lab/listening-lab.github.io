
import { getAllResearch } from '@/lib/research'
import ResearchTrack from './ResearchTrack'
import AnimatedSection from './AnimatedSection'

const TEAL = '#4ecdc4'

export default async function ResearchSection() {
  const researchItems = await getAllResearch()
  
  return (
    <section id="research" className="pt-24 pb-12 bg-[rgb(7_17_32)] relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 mb-2">
        <AnimatedSection>
          <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>
            Publications & Projects
          </p>
          <h2 className="font-serif text-4xl md:text-5xl text-white leading-tight mb-4">Our Research.</h2>
          <p className="text-gray-400 max-w-2xl leading-relaxed text-sm md:text-base">
            We build computational bioacoustic tools and machine learning models to monitor ecosystems at scale. Explore our open-source tools, methodologies, and interactive soundscapes.
          </p>
        </AnimatedSection>
      </div>
      <ResearchTrack researchItems={researchItems} />
    </section>
  )
}