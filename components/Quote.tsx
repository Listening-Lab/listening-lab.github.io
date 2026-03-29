import AnimatedSection from './AnimatedSection'


export default async function Quote() {

    return (
    <section className="py-24 bg-ocean-dark">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <AnimatedSection>
          <div className="flex flex-col">
            <span className="font-serif text-7xl leading-none text-brand-500 select-none self-start">&ldquo;</span>
            <p className="font-serif text-2xl md:text-3xl text-white leading-relaxed -mt-4">
              The sounds of nature, and the absence of it, are a powerful lens through which to monitor biodiversity.
            </p>
            <span className="font-serif text-7xl leading-none text-brand-500 select-none self-end -mt-4">&rdquo;</span>
          </div>
          <div className="mt-6">
            <p className="text-gray-400 text-sm tracking-widest uppercase">Author Name</p>
            <p className="text-gray-500 text-sm mt-1">Title / Affiliation</p>
          </div>
        </AnimatedSection>
      </div>
    </section>
    )
}