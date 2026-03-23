import { Metadata } from 'next'
import AnimatedSection from '@/components/AnimatedSection'
import ContactForm from '@/components/ContactForm'

export const metadata: Metadata = { title: 'Contact' }

export default function ContactPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24">
      <AnimatedSection>
        <h1 className="font-serif text-5xl text-ocean-dark mb-4">Contact</h1>
        <p className="text-xl text-gray-600 mb-12">
          Get in touch with the Listening Lab — for research enquiries, collaborations, or press.
        </p>
      </AnimatedSection>

      <AnimatedSection delay={0.2}>
        <ContactForm />
      </AnimatedSection>

      <AnimatedSection delay={0.3}>
        <div className="mt-16 pt-8 border-t border-gray-100 space-y-3 text-gray-600">
          <p><strong className="text-ocean-dark">Email:</strong> benmcewen@outlook.com</p>
        </div>
      </AnimatedSection>
    </div>
  )
}
