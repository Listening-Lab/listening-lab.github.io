import { Metadata } from 'next'
import Link from 'next/link'
import { getAllPosts } from '@/lib/posts'
import AnimatedSection from '@/components/AnimatedSection'
import { format } from 'date-fns'

export const metadata: Metadata = { title: 'Blog' }

export default async function BlogPage() {
  const posts = await getAllPosts()

  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <AnimatedSection>
        <h1 className="font-serif text-5xl text-ocean-dark mb-4">Blog</h1>
        <p className="text-xl text-gray-600 mb-16">
          Dispatches from the lab — research updates, field notes, and essays on sound.
        </p>
      </AnimatedSection>

      <div className="space-y-12">
        {posts.map((post, i) => (
          <AnimatedSection key={post.slug} delay={i * 0.08}>
            <article className="border-b border-gray-100 pb-12">
              <time className="text-sm text-gray-400 tracking-wide uppercase">
                {format(new Date(post.date), 'MMMM d, yyyy')}
              </time>
              <h2 className="font-serif text-3xl text-ocean-dark mt-2 mb-3">
                <Link href={`/blog/${post.slug}`} className="hover:text-brand-600 transition-colors">
                  {post.title}
                </Link>
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">{post.excerpt}</p>
              <div className="flex items-center gap-4">
                {post.tags?.map(tag => (
                  <span key={tag} className="text-xs font-medium bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          </AnimatedSection>
        ))}
      </div>
    </div>
  )
}
