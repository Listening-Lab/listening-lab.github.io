import HeroV4 from '@/components/HeroV4'
import FeaturedResearch from '@/components/FeaturedResearch'
import LatestPosts from '@/components/LatestPosts'
import AudioShowcase from '@/components/AudioShowcase'
import AcousticMap from '@/components/AcousticMap'
import Region from '@/components/Map'
import Quote from '@/components/Quote'

export default function HomePage() {
  return (
    <>
      <HeroV4 />
      {/* <Region /> */}
      <AcousticMap />
      <AudioShowcase />
      <Quote />
      {/* <FeaturedResearch /> */}
      <LatestPosts />
    </>
  )
}
