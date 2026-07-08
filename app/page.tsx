
import HeroV4 from '@/components/HeroV4'
import Quote from '@/components/Quote'
import About from '@/components/About'
import ResearchSection from '@/components/ResearchSection'
import CoreTeam from '@/components/CoreTeam'
import AcousticMap from '@/components/AcousticMap'

export default function HomePage() {
  return (
    <>
      <HeroV4 />
      <AcousticMap />
      <div className="relative bg-ocean-dark overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-ocean-dark to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-ocean-dark to-transparent z-10 pointer-events-none" />
        <div id="about" className="relative z-20">
          <About />
        </div>
        <div className="relative z-20">
          <ResearchSection />
        </div>
        <div className="relative z-20">
          <CoreTeam />
        </div>
      </div>
      <Quote />
    </>
  )
}
