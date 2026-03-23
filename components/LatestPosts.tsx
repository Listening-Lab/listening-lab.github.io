import AnimatedSection from './AnimatedSection'
import Link from 'next/link'
import { getAllPosts } from '@/lib/posts'
import { format } from 'date-fns'

export default async function LatestPosts() {
  const posts = (await getAllPosts()).slice(0, 3)

  if (posts.length === 0) return null

  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <AnimatedSection>
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="font-serif text-4xl text-ocean-dark mb-2">From the Blog</h2>
              <p className="text-gray-600">Research updates, field notes, and reflections.</p>
            </div>
            <Link href="/blog" className="text-brand-600 text-sm font-medium hover:underline hidden sm:block">
              All posts →
            </Link>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8">
          {posts.map((post, i) => (
            <AnimatedSection key={post.slug} delay={i * 0.1}>
              <article className="group">
                <time className="text-xs text-gray-400 uppercase tracking-wide">
                  {format(new Date(post.date), 'MMM d, yyyy')}
                </time>
                <h3 className="font-serif text-xl text-ocean-dark mt-2 mb-2 group-hover:text-brand-600 transition-colors">
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">{post.excerpt}</p>
              </article>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  )
}
