import dynamic from 'next/dynamic'
import HeroV4 from '@/components/HeroV4'
import AudioShowcase from '@/components/AudioShowcase'
import Quote from '@/components/Quote'
import About from '@/components/About'

// Three.js components are lazy-loaded so they don't block the initial JS bundle.
// Without this, the browser waits for ~600 KB of Three.js to compile before
// any page content renders (visible as a blank page on cold dev-server starts).
const AcousticMap = dynamic(() => import('@/components/AcousticMap'), { ssr: false })

export default function HomePage() {
  return (
    <>
      <HeroV4 />
      <div id="acoustic-map">
        <AcousticMap />
      </div>
      <AudioShowcase />
      <div id="about">
        <About />
      </div>
      <Quote />
    </>
  )
}
