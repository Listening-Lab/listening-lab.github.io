
import HeroV4 from '@/components/HeroV4'
import Quote from '@/components/Quote'
import About from '@/components/About'
import ResearchSection from '@/components/ResearchSection'
import CoreTeam from '@/components/CoreTeam'

export default function HomePage() {
  return (
    <>
      <HeroV4 />
      <div id="about">
        <About />
      </div>
      <ResearchSection />
      <div id="people">
        <CoreTeam />
      </div>
      <Quote />
    </>
  )
}
