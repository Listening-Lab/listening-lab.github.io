'use client'

interface Props {
  topColor?: string
  bottomColor?: string
}

export default function WaveBreak({ topColor = '#0a1628', bottomColor = '#0a1628' }: Props) {
  const same = topColor === bottomColor
  return (
    <div
      className="relative w-full flex items-center justify-center overflow-hidden"
      style={{
        height: '40px',
        background: same
          ? topColor
          : `linear-gradient(to bottom, ${topColor} 50%, ${bottomColor} 50%)`,
      }}
    >
      <style>{`
        @keyframes wb { 0%,100%{transform:scaleY(0.28)} 50%{transform:scaleY(0.32)} }
      `}</style>
      <div className="flex items-center gap-3 w-full max-w-lg px-8">
        <div className="flex-1 h-px bg-white/15" />
        <div className="flex items-center gap-[4px]" style={{ height: '20px' }}>
          {[{ dur: 1.1, delay: 0 }, { dur: 0.9, delay: 0.18 }, { dur: 1.1, delay: 0.36 }].map((b, i) => (
            <div
              key={i}
              className="w-[3px] h-full rounded-full"
              style={{
                backgroundColor: '#4ecdc4',
                opacity: 0.5,
                transformOrigin: 'center',
                animation: `wb ${b.dur}s ${b.delay}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
        <div className="flex-1 h-px bg-white/15" />
      </div>
    </div>
  )
}
