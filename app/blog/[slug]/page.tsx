import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllPosts, getPostBySlug } from '@/lib/posts'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { format } from 'date-fns'
import Link from 'next/link'

interface Props {
  params: { slug: string }
}

export async function generateStaticParams() {
  const posts = await getAllPosts()
  return posts.map(post => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPostBySlug(params.slug)
  if (!post) return {}
  return { title: post.title, description: post.excerpt }
}

export default async function BlogPostPage({ params }: Props) {
  const post = await getPostBySlug(params.slug)
  if (!post) notFound()

  return (
    <article className="max-w-3xl mx-auto px-6 py-24">
      <Link href="/blog" className="text-brand-600 text-sm hover:underline mb-8 block">
        ← Back to blog
      </Link>

      <header className="mb-12">
        <time className="text-sm text-gray-400 tracking-wide uppercase">
          {format(new Date(post.date), 'MMMM d, yyyy')}
        </time>
        <h1 className="font-serif text-5xl text-ocean-dark mt-3 mb-4 leading-tight">
          {post.title}
        </h1>
        {post.author && (
          <p className="text-gray-500">By {post.author}</p>
        )}
        {post.tags && (
          <div className="flex flex-wrap gap-2 mt-4">
            {post.tags.map(tag => (
              <span key={tag} className="text-xs font-medium bg-brand-50 text-brand-700 px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="prose-blog">
        <MDXRemote source={post.content} />
      </div>
    </article>
  )
}
