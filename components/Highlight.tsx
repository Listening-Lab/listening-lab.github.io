import AnimatedSection from './AnimatedSection'


export default async function Highlight() {

    return (
    <section className="py-24 bg-ocean-dark">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <AnimatedSection>
          <img src='images/annotator.png'/>
        </AnimatedSection>
      </div>
    </section>
    )
}