
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
      <div id="about">
        <About />
      </div>
      <ResearchSection />
      <div>
        <CoreTeam />
      </div>
      <Quote />
    </>
  )
}
