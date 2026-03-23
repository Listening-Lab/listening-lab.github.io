import { Metadata } from 'next'
import AnimatedSection from '@/components/AnimatedSection'

export const metadata: Metadata = { title: 'About' }

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-24">
      <AnimatedSection>
        <h1 className="font-serif text-5xl text-ocean-dark mb-6">About the Lab</h1>
        <p className="text-xl text-gray-600 leading-relaxed mb-8">
          We are a multidisciplinary research group developing computational bioacoustic tools for conservation.
        </p>
        <p className="text-gray-700 leading-relaxed mb-6">
          We are interested in monitoring and labelling natural sounds of Aotearoa New Zealand, for which we develop species-customised classification tools.
        </p>
        {/* <p className="text-gray-700 leading-relaxed">
          Our interdisciplinary team works with communities, government agencies, and industry
          partners to translate research findings into real-world acoustic design and policy.
        </p> */}
      </AnimatedSection>
    </div>
  )
}
