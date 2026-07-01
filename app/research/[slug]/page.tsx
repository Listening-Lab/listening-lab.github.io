import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllResearch, getResearchBySlug } from '@/lib/research'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { format } from 'date-fns'
import Link from 'next/link'
import AcousticMap from '@/components/AcousticMap'
import AudioShowcase from '@/components/AudioShowcase'
import MapClient from '@/components/MapClient'
import LocalisationDemo from '@/components/LocalisationDemo'

const mdxComponents = { AcousticMap, Map: MapClient, AudioShowcase, LocalisationDemo }

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const researchItems = await getAllResearch()
  return researchItems.map(item => ({ slug: item.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const item = await getResearchBySlug(slug)
  if (!item) return {}
  return { title: item.title, description: item.excerpt }
}

export default async function ResearchDetail({ params }: Props) {
  const { slug } = await params
  const item = await getResearchBySlug(slug)
  if (!item) notFound()

  return (
    <div className="min-h-screen bg-ocean-dark text-white pt-24 pb-32">
      <article className="max-w-4xl mx-auto px-6">
        <Link href="/#research" className="text-[#4ecdc4] text-sm hover:underline mb-12 block relative z-10">
          ← Back to Research
        </Link>

        {!item.hideHeader && (
          <header className="mb-16">
            <time className="text-sm text-gray-400 tracking-wide uppercase">
              Last updated: {format(new Date(item.date), 'MMMM d, yyyy')}
            </time>
            <h1 className="font-serif text-5xl md:text-6xl mt-4 mb-6 leading-tight">
              {item.title}
            </h1>
            {item.tags && (
              <div className="flex flex-wrap gap-2 mt-6">
                {item.tags.map(tag => (
                  <span key={tag} className="text-xs font-medium bg-white/10 text-white/80 px-3 py-1.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>
        )}

        <div className="prose-blog prose-invert max-w-none">
          <MDXRemote source={item.content} components={mdxComponents} />
        </div>
      </article>
    </div>
  )
}