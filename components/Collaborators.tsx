'use client'
import { useRef } from 'react'
import Image from 'next/image'
import AnimatedSection from './AnimatedSection'
import GlintCard from './GlintCard'

const TEAL = '#4ecdc4'

// Same accent family used across AcousticMap / ResearchTrack, cycled per card
const ACCENTS = [
  '#4ecdc4', '#74b9ff', '#c3a6ff', '#ffe66d', '#ff9f43', '#fd79a8', '#a8e6cf', '#00cec9',
]

const people = [
  { name: 'Dr Tadeu Siqueira', role: 'São Paulo State University (UNESP) · Visiting Scholar, Univ. of Canterbury', focus: 'Metacommunity Ecology, Freshwater Biodiversity', mark: 'TS', photo: undefined as string | undefined },
  { name: 'Prof Jim Briskie', role: 'Professor, Biological Sciences', focus: 'Avian Reproductive Behaviour, Conservation', mark: 'JB', photo: undefined as string | undefined },
  { name: 'A/Prof Andrew Bainbridge-Smith', role: 'Assoc. Professor, CSSE', focus: 'Retinal Imaging, Digital Logical Circuits', mark: 'AB', photo: undefined as string | undefined },
  { name: 'Prof Richard Green', role: 'Professor, CSSE', focus: 'Computer Vision, AI, Robotics', mark: 'RG', photo: undefined as string | undefined },
  { name: 'Isaac Cone', role: 'Summer Research Scholar', focus: 'Invasive Species Bioacoustic Annotation', mark: 'IC', photo: undefined as string | undefined },
  { name: 'Mikayla Franco', role: 'Summer Research Scholar', focus: 'Invasive Species Bioacoustic Annotation', mark: 'MF', photo: undefined as string | undefined },
]

const groups = [
  { name: 'Predator Free 2050', role: 'National Conservation Mission', focus: 'Eradicating introduced predators by 2050', mark: 'PF', photo: undefined as string | undefined },
  { name: 'Department of Conservation', role: 'Te Papa Atawhai', focus: 'New Zealand natural and historical heritage', mark: 'DOC', photo: undefined as string | undefined },
  { name: 'Manaaki Whenua', role: 'Landcare Research', focus: 'Land, water, and biodiversity science', mark: 'MW', photo: undefined as string | undefined },
]

interface CollabCardProps {
  name: string
  role: string
  focus: string
  mark: string
  photo?: string
  shape: 'circle' | 'square'
  color: string
}

function CollabCard({ name, role, focus, mark, photo, shape, color }: CollabCardProps) {
  return (
    <GlintCard className="rounded-3xl h-full transition-transform duration-500 hover:-translate-y-1">
    <div className="relative group flex flex-col items-center text-center h-full p-8 rounded-3xl bg-[#0a1628]/55 backdrop-blur-md border border-white/10 transition-colors duration-500 hover:bg-black/60 hover:border-white/25"
         style={{ boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)' }}>
      <div
        className={`w-24 h-24 mx-auto mb-4 overflow-hidden border-2 bg-white/5 flex items-center justify-center transition-colors ${
          shape === 'circle' ? 'rounded-full' : 'rounded-xl'
        }`}
        style={{ borderColor: `${color}55` }}
      >
        {photo ? (
          <Image src={photo} alt={name} width={96} height={96} className="w-full h-full object-cover object-top" />
        ) : (
          <span className="font-serif text-xl" style={{ color }}>{mark}</span>
        )}
      </div>
      <h4 className="font-serif text-xl text-white mb-1">{name}</h4>
      <p className="text-sm font-medium mb-1" style={{ color }}>{role}</p>
      <p className="text-gray-400 text-sm mb-4">{focus}</p>
    </div>
    </GlintCard>
  )
}

export default function Collaborators() {
  return (
    <div className="mt-16 pt-12 border-t border-white/10">
      <AnimatedSection>
        <p className="text-xs tracking-widest uppercase mb-6 font-medium text-white/40">People we've worked with</p>
      </AnimatedSection>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
        {people.map((p, i) => (
          <AnimatedSection key={p.name} delay={i * 0.1}>
            <CollabCard {...p} shape="circle" color={ACCENTS[i % ACCENTS.length]} />
          </AnimatedSection>
        ))}
      </div>

      <AnimatedSection>
        <p className="text-xs tracking-widest uppercase mb-6 font-medium text-white/40">Groups we work with</p>
      </AnimatedSection>
      <div className="grid sm:grid-cols-3 gap-8">
        {groups.map((g, i) => (
          <AnimatedSection key={g.name} delay={i * 0.1}>
            <CollabCard {...g} shape="square" color={ACCENTS[(i + 3) % ACCENTS.length]} />
          </AnimatedSection>
        ))}
      </div>
    </div>
  )
}