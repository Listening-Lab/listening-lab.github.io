import { Metadata } from 'next'
import Link from 'next/link'
import AnimatedSection from '@/components/AnimatedSection'

export const metadata: Metadata = { title: 'Terms of Service' }

const TEAL = '#4ecdc4'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AnimatedSection className="mb-10">
      <h2 className="font-serif text-2xl text-white mb-3">{title}</h2>
      <div className="text-gray-300 leading-relaxed space-y-3">{children}</div>
    </AnimatedSection>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-white font-medium mb-2">{title}</h3>
      <div className="text-gray-300 leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-ocean-dark">
      <div className="max-w-2xl mx-auto px-6 py-24">
        <AnimatedSection>
          <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>
            Legal
          </p>
          <h1 className="font-serif text-5xl text-white mb-6">
            Data Storage, Retrieval, and Account Termination Agreement
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed mb-16">
            This Agreement governs the terms under which Nature Commons Ltd, trading as
            Listening Lab (the &ldquo;Company&rdquo;), provides data infrastructure, analytics, and
            storage services to you (the &ldquo;Client&rdquo;). By clicking &ldquo;I Agree&rdquo; and proceeding to
            use the platform, you acknowledge that cloud data transfer and storage operations
            incur structural infrastructure costs from third-party cloud providers (Google
            Cloud Platform), and you agree to the financial terms outlined herein regarding
            data retrieval, account suspension, and account termination.
          </p>
        </AnimatedSection>

        <Section title="1. Data Ownership">
          <p>
            The Client retains 100% ownership, intellectual property rights, and title to all
            acoustic recordings, metadata, and files uploaded to or analyzed by the
            Company&apos;s platform. The Company claims no ownership over Client data.
          </p>
        </Section>

        <Section title="2. Operational Models & Dynamic Cloud Pricing">
          <p>
            The Client must select or operate under one of the two following infrastructure
            models. The financial obligations for data egress (downloading) and deletion
            depend entirely on the model used.
          </p>
          <p>
            <span className="text-white font-medium">Dynamic Pricing Acknowledgment:</span>{' '}
            The Client acknowledges that third-party cloud infrastructure fees fluctuate over
            time. The specific per-gigabyte rates listed below serve as baseline estimations.
            In all circumstances, the Client will be billed at-cost according to the cloud
            provider&apos;s active, public rates at the exact time the operational event (such
            as data retrieval or deletion) occurs.
          </p>

          <SubSection title="Model A: Company-Hosted Storage">
            <p>
              Applies if the Company stores the Client&apos;s acoustic recordings within the
              Company&apos;s cloud infrastructure.
            </p>
            <p>
              <span className="text-white font-medium">Audio Compression Standard:</span> To
              minimize storage and retrieval costs, the platform utilizes FLAC (Free Lossless
              Audio Codec) as its default compression standard. This preserves 100% of the
              acoustic integrity required for specialized bat, marine, and avian bioacoustic
              analysis while reducing file sizes.
            </p>
            <p>
              <span className="text-white font-medium">Data Retrieval (Network Egress) Fees:</span>{' '}
              Downloading or exporting acoustic recordings from the platform — whether during
              active operations or upon account closure — incurs third-party network egress
              fees. The Company passes these costs directly to the Client at-cost, with no
              markup. Network transit baseline estimation is currently{' '}
              <span className="text-white">$0.12 per GB</span> downloaded.
            </p>
            <p>
              <span className="text-white font-medium">Early Deletion Fees (Minimum Retention):</span>{' '}
              To minimize monthly hosting costs, acoustic files are stored in a long-term
              &ldquo;Coldline&rdquo; storage tier which enforces a 90-day minimum retention
              period per file by the underlying cloud provider. If the Client deletes files or
              terminates their account less than 90 days after an upload occurs, the Client
              agrees to pay the pro-rated remainder of that 90-day storage window based on
              active cloud penalty rates (baseline estimation is currently{' '}
              <span className="text-white">$0.007 per GB per month</span>).
            </p>
          </SubSection>

          <SubSection title="Model B: Client-Managed Storage (Bring Your Own Bucket)">
            <p>
              Applies if the Client maintains their own Google Cloud Storage (GCS) buckets
              and grants the Company secure analytical access.
            </p>
            <p>
              <span className="text-white font-medium">Infrastructure Costs:</span> The Client
              is directly responsible for all storage, deletion, and egress costs generated
              inside their own cloud account. The Company will never bill the Client for media
              storage or media egress under this model.
            </p>
            <p>
              <span className="text-white font-medium">Regional Configuration Requirement:</span>{' '}
              To eliminate cross-region data transfer fees, the Client must configure their
              GCS bucket to reside in the same Google Cloud region as the Company&apos;s
              analytics infrastructure (Current Region: australia-southeast1). Failure to
              match regions may cause the third-party cloud provider to bill the Client
              directly for cross-region data reads during analysis.
            </p>
          </SubSection>
        </Section>

        <Section title="3. Overdue Invoices and Account Suspension">
          <p>If an invoice for the platform&apos;s services or pass-through cloud infrastructure costs becomes overdue:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <span className="text-white font-medium">Immediate Suspension:</span> The
              Client&apos;s access to paid platform features, automated analytics, and data
              processing will be suspended immediately until the account balance is settled.
            </li>
            <li>
              <span className="text-white font-medium">30-Day Data Retention Grace Period:</span>{' '}
              The Company will continue to safely host the Client&apos;s existing acoustic data
              for 30 calendar days following the suspension date.
            </li>
            <li>
              <span className="text-white font-medium">Data Purging:</span> If the invoice
              remains unpaid after 30 consecutive days of account suspension, the Company
              reserves the right to permanently and irreversibly delete all hosted acoustic
              recordings and metadata associated with the account to prevent ongoing cloud
              maintenance fees. The Client remains liable for all unpaid balances incurred up
              to the date of deletion.
            </li>
          </ul>
        </Section>

        <Section title="4. Account Termination & Voluntary Data Deletion">
          <p>Upon a formal request for account deletion initiated by a Client with no outstanding balances or overdue invoices:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <span className="text-white font-medium">Structured Data:</span> All database
              metadata, predictions, and analysis metrics stored in the Company&apos;s
              infrastructure will be erased completely and permanently at zero cost to the
              Client.
            </li>
            <li>
              <span className="text-white font-medium">Hosted Media Retrieval Window:</span>{' '}
              For Model A (Hosted) clients wishing to retrieve their files before account
              closure, the Company will calculate the total volume of data to be exported. The
              Client must settle the calculated at-cost network egress fee before the final
              data export is initiated.
            </li>
            <li>
              <span className="text-white font-medium">Purging:</span> Once data is
              successfully exported (or if the Client waives their right to retrieve copies),
              all hosted files will be permanently deleted from the Company&apos;s servers, and
              monthly storage billing will cease.
            </li>
          </ul>
        </Section>

        <Section title="5. Client Acknowledgment & Consent">
          <p>
            By clicking the confirmation button below, you certify that you have read,
            understood, and agreed to this document. You assume financial responsibility for
            any network egress or early deletion penalties triggered by your data retrieval,
            account termination, or non-payment behavior as outlined above.
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
