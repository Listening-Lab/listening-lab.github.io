import Hero from '@/components/Hero'
import FeaturedResearch from '@/components/FeaturedResearch'
import LatestPosts from '@/components/LatestPosts'
import AudioShowcase from '@/components/AudioShowcase'

export default function HomePage() {
  return (
    <>
      <Hero />
      <AudioShowcase />
      {/* <FeaturedResearch /> */}
      <LatestPosts />
    </>
  )
}
