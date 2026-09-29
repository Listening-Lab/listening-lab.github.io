import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AnimatedSection from '@/components/AnimatedSection'
import ServiceFigure from '@/components/services/Figures'
import { LEVEL_SERVICES } from '@/lib/services'

const TEAL = '#4ecdc4'

export function generateStaticParams() {
  return LEVEL_SERVICES.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return { title: LEVEL_SERVICES.find((s) => s.slug === slug)?.name ?? 'What we do' }
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="text-white mb-3">{title}</h2>
      <ul className="space-y-2 text-gray-300">
        {items.map((i) => (
          <li key={i} className="pl-4 border-l border-white/15">{i}</li>
        ))}
      </ul>
    </div>
  )
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const s = LEVEL_SERVICES.find((x) => x.slug === slug)
  if (!s) notFound()
  const others = LEVEL_SERVICES.filter((x) => x.slug !== s.slug)

  return (
    <div className="min-h-screen bg-ocean-dark">
      <div className="max-w-4xl mx-auto px-6 pt-28 pb-24">
        <p className="text-sm text-gray-500 mb-8">
          <Link href="/services" className="hover:text-white transition-colors">← What we do</Link>
        </p>

        <AnimatedSection className="grid md:grid-cols-[3fr_2fr] gap-10 items-center mb-16">
          <div>
            <p className="text-xs tracking-widest uppercase mb-3 font-medium" style={{ color: TEAL }}>
              {s.question}
            </p>
            <h1 className="font-serif text-5xl text-white mb-6">{s.name}</h1>
            <p className="text-lg text-gray-300 leading-relaxed">{s.intro}</p>
          </div>
          <ServiceFigure slug={s.slug} className="w-full h-auto" />
        </AnimatedSection>

        <AnimatedSection className="mb-14 max-w-3xl">
          <h2 className="font-serif text-2xl text-white mb-3">How it works</h2>
          <p className="text-gray-300 leading-relaxed">{s.how}</p>
        </AnimatedSection>

        <AnimatedSection className="grid sm:grid-cols-2 gap-10 mb-14">
          <List title="What you get" items={s.youGet ?? []} />
          <List title="Good for" items={s.goodFor ?? []} />
        </AnimatedSection>

        <AnimatedSection className="mb-16 max-w-3xl">
          <h2 className="font-serif text-2xl text-white mb-3">Study design</h2>
          <p className="text-gray-300 leading-relaxed">{s.design}</p>
        </AnimatedSection>

        <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-8">
          <Link
            href={`/pricing?levels=${s.slug}`}
            className="bg-white text-ocean-dark px-5 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors"
          >
            Estimate a project
          </Link>
          <span className="text-sm text-gray-500 ml-auto">
            Also:{' '}
            {others.map((o, i) => (
              <span key={o.slug}>
                {i > 0 && ' · '}
                <Link href={`/services/${o.slug}`} className="text-gray-300 hover:text-white">{o.name}</Link>
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  )
}
