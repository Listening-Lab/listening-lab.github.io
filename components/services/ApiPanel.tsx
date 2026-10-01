import Link from 'next/link'

const TEAL = '#4ecdc4'

/** Link to the API / business page, shared by /services, /platform and /monitoring. */
export default function ApiPanel() {
  return (
    <Link
      href="/platform/api"
      className="block rounded-xl border border-white/10 bg-white/[0.03] px-6 py-6 hover:border-white/30 transition-colors"
    >
      <p className="text-xs text-gray-500 mb-1">For businesses and developers</p>
      <div className="flex items-center justify-between gap-6">
        <div>
          <h2 className="text-white text-lg mb-1">Build Nature Commons into your own product</h2>
          <p className="text-sm text-gray-400">Use our processing, storage and models through an API.</p>
        </div>
        <span className="text-sm shrink-0" style={{ color: TEAL }}>Learn more →</span>
      </div>
    </Link>
  )
}
