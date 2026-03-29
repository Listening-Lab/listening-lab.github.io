import Hero from '@/components/Hero'
import FeaturedResearch from '@/components/FeaturedResearch'
import LatestPosts from '@/components/LatestPosts'
import AudioShowcase from '@/components/AudioShowcase'
import AcousticMap from '@/components/AcousticMap'
import Quote from '@/components/Quote'

export default function HomePage() {
  return (
    <>
      <Hero />
      <AcousticMap />
      <AudioShowcase />
      <Quote />
      {/* <FeaturedResearch /> */}
      <LatestPosts />
    </>
  )
}
