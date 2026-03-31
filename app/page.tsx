import dynamic from 'next/dynamic'
import HeroV4 from '@/components/HeroV4'
import AudioShowcase from '@/components/AudioShowcase'
import Quote from '@/components/Quote'
import About from '@/components/About'
import WaveBreak from '@/components/WaveBreak'

const AcousticMap = dynamic(() => import('@/components/AcousticMap'), { ssr: false })

export default function HomePage() {
  return (
    <>
      <HeroV4 />
      <div id="acoustic-map">
        <AcousticMap />
      </div>
      <AudioShowcase />
      {/* <WaveBreak topColor="#0a1628" bottomColor="rgb(7 17 32)" /> */}
      <div id="about">
        <About />
      </div>
      {/* <WaveBreak topColor="rgb(7 17 32)" bottomColor="#0a1628" /> */}
      <Quote />
    </>
  )
}
