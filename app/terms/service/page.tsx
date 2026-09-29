import { Metadata } from 'next'
import Link from 'next/link'
import AnimatedSection from '@/components/AnimatedSection'

export const metadata: Metadata = { title: 'Service Terms' }

const TEAL = '#4ecdc4'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AnimatedSection className="mb-10">
      <h2 className="font-serif text-2xl text-white mb-3">{title}</h2>
      <div className="text-gray-300 leading-relaxed space-y-3">{children}</div>
    </AnimatedSection>
  )
}

/** Marks a clause still being decided. Remove each one as it is settled. */
function Open({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-amber-300/90 border-l-2 border-amber-300/50 pl-3">Open: {children}</p>
}

export default function ServiceTermsPage() {
  return (
    <div className="min-h-screen bg-ocean-dark">
      <div className="max-w-2xl mx-auto px-6 py-24">
        <AnimatedSection>
          <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>
            Legal
          </p>
          <h1 className="font-serif text-5xl text-white mb-6">Analysis Service Terms</h1>
          <div className="rounded-lg border border-amber-300/40 bg-amber-300/5 px-4 py-3 text-sm text-amber-200 mb-8">
            Draft for discussion. Not in force, and not yet reviewed by a lawyer.
          </div>
          <p className="text-xl text-gray-300 leading-relaxed mb-16">
            These terms cover the analysis service that Nature Commons Ltd, trading as Listening Lab
            (the &ldquo;Company&rdquo;), provides to you (the &ldquo;Client&rdquo;). Storage, data
            retrieval and account closure are covered by the{' '}
            <Link href="/terms" className="underline hover:text-white">Data Storage, Retrieval, and Account Termination Agreement</Link>,
            which also applies.
          </p>
        </AnimatedSection>

        <Section title="1. The service">
          <p>
            The Company processes the Client&apos;s acoustic recordings with machine-learning models,
            validates a sample of the detections by expert review, calibrates the results, and reports
            them at the measurement level the Client chooses: species richness, site occupancy, or
            density proxy.
          </p>
          <p>
            The scope of each project (measurement level, target species, devices, recording period and
            deliverables) is agreed in writing before analysis begins.
          </p>
        </Section>

        <Section title="2. Study design">
          <p>
            Study design advice is included with any commissioned analysis, up to 10 hours per project.
            Further advice is charged at the Company&apos;s hourly rate, agreed in advance.
          </p>
          <p>
            Before analysis begins, the Company will tell the Client if it believes the design is
            unlikely to answer the Client&apos;s question. The Client may proceed regardless.
          </p>
          <Open>whether the 10 hours applies when the Client doesn&apos;t go on to commission analysis, and the hourly rate beyond it.</Open>
        </Section>

        <Section title="3. Fees">
          <p>
            <span className="text-white font-medium">Analysis fee.</span> Set from the measurement level,
            number of target species and number of devices recording at the same time, as shown in the
            estimate. It is fixed once the scope is agreed, and subject to a minimum engagement fee.
          </p>
          <p>
            <span className="text-white font-medium">Processing and storage.</span> Charged as used, at the
            Company&apos;s published rates: processing per hour of audio, storage per gigabyte per month.
            The Client sees the processing cost of each batch before it runs and may set a spending cap.
            A batch that would exceed the cap does not start until the cap is raised or the batch reduced.
          </p>
          <p>
            <span className="text-white font-medium">Hardware.</span> Recorders sourced through the Company
            are charged at cost.
          </p>
          <p>
            Rates may change with 30 days&apos; notice. Agreed analysis fees do not change.
          </p>
          <Open>payment terms, deposit on multi-year projects, and whether multi-year projects are scoped per reporting year or as a whole.</Open>
        </Section>

        <Section title="4. Results and uncertainty">
          <p>
            Results are calibrated against the expert-validated sample and reported with confidence
            intervals. They describe what the recordings support, conditional on that sample.
          </p>
          <p>
            Acoustic methods cannot detect species that do not call, and some designs will not give a
            conclusive answer. The fee covers the analysis and its honestly reported uncertainty. It does
            not guarantee a detection, a particular result, or a conclusive one.
          </p>
          <p>
            The Client is responsible for how results are used, including in regulatory or published
            work. The Company will explain the methods and their limits on request.
          </p>
          <Open>wording for regulatory absence claims and &ldquo;peer-review ready&rdquo; reports, and a liability cap. Needs a lawyer.</Open>
        </Section>

        <Section title="5. Data ownership and sharing">
          <p>
            The Client owns its recordings, metadata and results. The Client chooses one of: private (used
            only for the Client&apos;s analyses), model contribution (anonymised samples may train and
            evaluate the Company&apos;s models), or open (released publicly).
          </p>
          <p>
            Model contribution is never the default. For data held by or relating to iwi and hapū, the
            Company will agree how the data is used, shared and stored with the kaitiaki before any
            processing, consistent with Māori data sovereignty principles.
          </p>
          <p>
            Recordings are processed and stored in Google Cloud&apos;s{' '}
            <code className="text-gray-200">australia-southeast1</code> (Sydney) region, or in a Client-owned
            bucket in the same region.
          </p>
          <Open>whether a New Zealand hosting region is needed before working with NZ clients.</Open>
        </Section>

        <Section title="6. Outside these terms">
          <p>
            Bat (ultrasonic) and marine surveys, and near-real-time biosecurity alerting, are quoted and
            contracted separately.
          </p>
        </Section>

        <p className="text-sm text-gray-500 border-t border-white/10 pt-6">
          Questions about these terms: <Link href="/contact" className="underline hover:text-white">contact us</Link>.
        </p>
      </div>
    </div>
  )
}
