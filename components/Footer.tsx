import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-ocean-dark border-t border-white/10 py-12">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <p>© {new Date().getFullYear()} Listening Lab NZ - powered by Nature Commons Ltd</p>
        <nav className="flex flex-wrap justify-center gap-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/#about" className="hover:text-white transition-colors">About</Link>
          <Link href="/#research" className="hover:text-white transition-colors">Research</Link>
          <Link href="/people" className="hover:text-white transition-colors">People</Link>
          <Link href="/demo" className="hover:text-white transition-colors">Map</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
        </nav>
      </div>
    </footer>
  )
}
