import { Metadata } from 'next'
import Link from 'next/link'
import AnimatedSection from '@/components/AnimatedSection'

export const metadata: Metadata = { title: 'Privacy Statement' }

const TEAL = '#4ecdc4'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AnimatedSection className="mb-10">
      <h2 className="font-serif text-2xl text-white mb-3">{title}</h2>
      <div className="text-gray-300 leading-relaxed space-y-2">{children}</div>
    </AnimatedSection>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-ocean-dark">
      <div className="max-w-2xl mx-auto px-6 py-24">
        <AnimatedSection>
          <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>
            Legal
          </p>
          <h1 className="font-serif text-5xl text-white mb-6">Privacy Statement</h1>
          <p className="text-xl text-gray-300 leading-relaxed mb-16">
            Listening Lab is operated by Nature Commons Ltd, a New Zealand company. This
            statement explains how we handle personal information under the Privacy Act 2020.
          </p>
        </AnimatedSection>

        <Section title="What we collect">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Your name and contact information (e.g. email address), if you sign up or contact us</li>
            <li>How you interact with our website and platform (pages visited, clicks, time on site)</li>
            <li>Device and browser information, and your approximate location (city/country) based on your IP address</li>
            <li>A cookie identifier used to recognise return visits</li>
          </ul>
        </Section>

        <Section title="Why we collect it">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>To understand how people use our website and platform, so we can improve them</li>
            <li>To create and manage user accounts and provide platform features</li>
            <li>To respond to enquiries and messages</li>
          </ul>
        </Section>

        <Section title="Who we share it with">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <span className="text-white font-medium">Google</span>, which provides our
              analytics (Google Analytics) and user authentication (Firebase), to analyse how
              people use our website and platform and to manage user accounts. See{' '}
              <a
                href="https://policies.google.com/technologies/partner-sites"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: TEAL }}
              >
                How Google uses information from sites that use its services
              </a>
              .
            </li>
            <li>
              <span className="text-white font-medium">GitHub</span>, which hosts our website
              and may log visitor IP addresses for security purposes.
            </li>
          </ul>
          <p className="pt-2">
            These providers may store and process information outside New Zealand, including
            in the United States.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Signing up is optional. If you choose not to give us your name and email
              address, we can&apos;t create an account for you or provide features that
              require one.
            </li>
            <li>
              You can opt out of analytics by blocking cookies or installing{' '}
              <a
                href="https://tools.google.com/dlpage/gaoptout"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: TEAL }}
              >
                Google&apos;s opt-out add-on
              </a>
              . The website will still work fully.
            </li>
          </ul>
        </Section>

        <Section title="Your rights">
          <p>
            You can ask for a copy of the personal information we hold about you, and ask for
            it to be corrected if you think it is wrong. Contact us at{' '}
            <a href="mailto:info@nature-commons.com" className="hover:underline" style={{ color: TEAL }}>
              info@nature-commons.com
            </a>
            .
          </p>
          <p>
            If you&apos;re not satisfied with our response, you can complain to the{' '}
            <a
              href="https://www.privacy.org.nz"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: TEAL }}
            >
              Office of the Privacy Commissioner
            </a>
            .
          </p>
        </Section>

        <p className="text-sm text-gray-500 pt-4 border-t border-white/10">
          Last updated: September 2026
        </p>

        <p className="text-sm text-gray-500 mt-8">
          <Link href="/" className="hover:text-white transition-colors">← Back to Home</Link>
        </p>
      </div>
    </div>
  )
}
