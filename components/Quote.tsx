import AnimatedSection from './AnimatedSection'
import Image from 'next/image'


export default function Quote() {

    const TEAL = '#4ecdc4'

    return (
    <section className="relative min-h-screen flex items-center py-24 bg-ocean-dark overflow-hidden">

      {/* ── Background image ── */}
      <div className="absolute inset-0 pointer-events-none">
        <Image
          src="/images/joshua-harris-BIIfuwj7gEw-unsplash.jpg"
          alt=""
          fill
          className="object-cover object-center"
        />
        {/* Dark overall tint */}
        <div className="absolute inset-0 bg-ocean-dark/65" />
        {/* Fade top out of Core Team section */}
        <div
          className="absolute top-0 left-0 right-0 h-48"
          style={{
            background: 'linear-gradient(to bottom, #0a1628 0%, transparent 100%)',
          }}
        />
        {/* Fade bottom into footer */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, transparent 0%, transparent 85%, #0a1628 100%)',
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