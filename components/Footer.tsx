import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-ocean-dark border-t border-white/10 py-12">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <p>© {new Date().getFullYear()} Listening Lab NZ</p>
        <nav className="flex gap-6">
          <Link href="/about" className="hover:text-white transition-colors">About</Link>
          <Link href="/research" className="hover:text-white transition-colors">Research</Link>
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
        </nav>
      </div>
    </footer>
  )
}
