/* eslint-disable @next/next/no-img-element -- static export, plain images are fine here */
// Photo-and-overlay visuals for the two /services panels. The overlays are illustrative:
// they show the kind of thing each offering produces, not real results.

const TEAL = '#4ecdc4'

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div className={`absolute rounded-lg bg-ocean-dark/90 backdrop-blur border border-white/15 px-3 py-2 text-xs shadow-lg ${className}`}>
      {children}
    </div>
  )
}

function PlatformVisual() {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-ocean-dark">
      <img
        src="/images/our-work/acoustic-map/map-zoomed.png"
        alt="The Sound Map: public recordings, coloured by region"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <Chip className="left-3 top-3">
        <div className="text-white">Tūī</div>
        <div className="text-gray-400 tabular-nums">1,240 detections nearby</div>
      </Chip>
      <Chip className="right-3 bottom-3 flex items-center gap-2">
        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-ocean-dark" style={{ background: TEAL }}>✓</span>
        <span className="text-gray-200">Is this a tūī? Yes</span>
      </Chip>
    </div>
  )
}

function MonitoringVisual() {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-ocean-dark">
      <img
        src="/images/birds/andrea-lightfoot-0MU2XZbkGZ8-unsplash-tui.jpg"
        alt="A tūī"
        className="absolute inset-0 w-full h-full object-cover object-[50%_30%]"
      />
    </div>
  )
}

function CreditsVisual() {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-ocean-dark">
      <img
        src="/images/joshua-harris-BIIfuwj7gEw-unsplash.jpg"
        alt="Coastal grassland at dusk"
        className="absolute inset-0 w-full h-full object-cover object-[65%_50%]"
      />
      <Chip className="left-3 bottom-3">
        <div className="text-white">Biodiversity, year on year</div>
        <div className="flex items-end gap-1 h-6 mt-1.5">
          {[0.35, 0.45, 0.5, 0.62, 0.7].map((v, i) => (
            <span key={i} className="w-2.5 rounded-sm" style={{ height: `${v * 100}%`, background: TEAL }} />
          ))}
        </div>
      </Chip>
    </div>
  )
}

export default function PanelVisual({ kind }: { kind: 'platform' | 'monitoring' | 'credits' }) {
  if (kind === 'platform') return <PlatformVisual />
  if (kind === 'monitoring') return <MonitoringVisual />
  return <CreditsVisual />
}
