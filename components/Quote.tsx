import AnimatedSection from './AnimatedSection'
import Image from 'next/image'


export default function Quote() {

    const TEAL = '#4ecdc4'

    return (
    <section className="relative py-24 bg-ocean-dark overflow-hidden">

      {/* ── Left image ── */}
      <div className="absolute left-0 top-0 w-1/2 h-full pointer-events-none">
        <Image
          src="/images/joshua-harris-BIIfuwj7gEw-unsplash.jpg"
          alt=""
          fill
          className="object-cover object-center"
        />
        {/* Dark overall tint */}
        <div className="absolute inset-0 bg-ocean-dark/50" />
        {/* Fade toward right — reaches solid well before centre so text sits on clean bg */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(10,22,40,0.1) 0%, rgba(10,22,40,0.6) 55%, rgba(10,22,40,0.9) 75%, #0a1628 90%)',
          }}
        />
        {/* Fade top & bottom — matches section bg exactly */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, #0a1628 0%, transparent 22%, transparent 78%, #0a1628 100%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <AnimatedSection>
          <div className="flex flex-col">
            <span className="font-serif text-7xl leading-none select-none self-start" style={{ color: TEAL }}>&ldquo;</span>
            <p className="font-serif text-2xl md:text-3xl text-white leading-relaxed -mt-4">
              The sounds of nature, and the absence of it, are a powerful lens through which to monitor biodiversity.
            </p>
            <span className="font-serif text-7xl leading-none select-none self-end mt-2" style={{ color: TEAL }}>&rdquo;</span>
          </div>
          <div className="mt-6">
            <p className="text-gray-400 text-sm tracking-widest uppercase">Dr Ben McEwen</p>
            <p className="text-gray-500 text-sm mt-1">Researcher / Co-lead of the Listening Lab</p>
          </div>
        </AnimatedSection>
      </div>
    </section>
    )
}