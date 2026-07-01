'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'

const TEAL = '#4ecdc4'

interface ResearchCardProps {
  title: string
  excerpt: string
  slug: string
  date: string
  tags: string[]
}

export default function ResearchCard({ title, excerpt, slug, date, tags }: ResearchCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Link 
      href={`/research/${slug}`}
      className="relative block group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      <div 
        className="bg-white/5 border border-white/10 rounded-3xl p-8 overflow-hidden backdrop-blur-sm transition-colors duration-300"
        style={{
          backgroundColor: isHovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
          borderColor: isHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
        }}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium tracking-widest uppercase" style={{ color: TEAL }}>
              Updated {date}
            </span>
            <div className="flex gap-2">
              {tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[10px] uppercase tracking-wider bg-white/10 text-white/70 px-2 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          
          <h3 className="font-serif text-3xl text-white mb-2 leading-tight">
            {title}
          </h3>

          <motion.div 
            initial={false}
            animate={{ 
              opacity: isHovered ? 1 : 0, 
              height: isHovered ? 'auto' : 0,
              marginTop: isHovered ? 16 : 0
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              {excerpt}
            </p>
            <div className="flex items-center text-sm font-medium text-white">
              Explore Research
              <motion.span 
                animate={{ x: isHovered ? 4 : 0 }}
                transition={{ duration: 0.2 }}
                className="ml-2"
              >
                →
              </motion.span>
            </div>
          </motion.div>
        </div>
      </div>
    </Link>
  )
}