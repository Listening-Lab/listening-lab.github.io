import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 py-12 mt-24">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
        <p>© {new Date().getFullYear()} Listening Lab NZ</p>
        <nav className="flex gap-6">
          <Link href="/about" className="hover:text-gray-600 transition-colors">About</Link>
          <Link href="/research" className="hover:text-gray-600 transition-colors">Research</Link>
          <Link href="/blog" className="hover:text-gray-600 transition-colors">Blog</Link>
          <Link href="/contact" className="hover:text-gray-600 transition-colors">Contact</Link>
        </nav>
      </div>
    </footer>
  )
}
