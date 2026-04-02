import { Metadata } from 'next'
import AnimatedSection from '@/components/AnimatedSection'

export const metadata: Metadata = { title: 'Team' }

const team = [
  {
    name: 'Dr. Ben McEwen',
    role: 'Co-lead | Postdoctoral Researcher',
    bio: '',
    initials: 'BM',
  },
  {
    name: 'Kaspar Soltero',
    role: 'Co-lead | PhD Candidate',
    bio: '',
    initials: 'KS',
  },
  {
    name: 'Professor Stefanie Gutschmidt',
    role: 'Co-lead | Professor',
    bio: '',
    initials: 'SG',
  }
]

const TEAL = '#4ecdc4'

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-[rgb(7_17_32)] px-6 py-24">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection>
          <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>
            The people
          </p>
          <h1 className="font-serif text-5xl text-white mb-4">Team</h1>
          <p className="text-xl text-gray-400 mb-16">The people behind the research.</p>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
          {team.map((member, i) => (
            <AnimatedSection key={member.name} delay={i * 0.1}>
              <div className="text-center p-8 border border-white/10 rounded-xl hover:border-white/20 transition-colors">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-serif mx-auto mb-4 border border-white/20" style={{ backgroundColor: `${TEAL}22`, color: TEAL }}>
                  {member.initials}
                </div>
                <h2 className="font-serif text-xl text-white mb-1">{member.name}</h2>
                <p className="text-sm font-medium mb-3" style={{ color: TEAL }}>{member.role}</p>
                <p className="text-gray-400 text-sm leading-relaxed">{member.bio}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>

        {/* <AnimatedSection>
          <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>Collaborators</p>
          <div className="w-0.5 h-8 rounded-full mb-8" style={{ backgroundColor: `${TEAL}66` }} />
        </AnimatedSection>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
          {collaborators.map((member, i) => (
            <AnimatedSection key={member.name} delay={i * 0.1}>
              <div className="text-center p-8 border border-white/10 rounded-xl hover:border-white/20 transition-colors">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-serif mx-auto mb-4 border border-white/20" style={{ backgroundColor: `${TEAL}22`, color: TEAL }}>
                  {member.initials}
                </div>
                <h2 className="font-serif text-xl text-white mb-1">{member.name}</h2>
                <p className="text-sm font-medium mb-3" style={{ color: TEAL }}>{member.role}</p>
                <p className="text-gray-400 text-sm leading-relaxed">{member.bio}</p>
              </div>
            </AnimatedSection>
          ))}
        </div> */}

        {/* <AnimatedSection>
          <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>Alumni</p>
          <div className="w-0.5 h-8 rounded-full mb-8" style={{ backgroundColor: `${TEAL}66` }} />
        </AnimatedSection>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {alumi.map((member, i) => (
            <AnimatedSection key={member.name + i} delay={i * 0.1}>
              <div className="text-center p-8 border border-white/10 rounded-xl hover:border-white/20 transition-colors">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-serif mx-auto mb-4 border border-white/20" style={{ backgroundColor: `${TEAL}11`, color: `${TEAL}99` }}>
                  {member.initials}
                </div>
                <h2 className="font-serif text-xl text-white/70 mb-1">{member.name}</h2>
                <p className="text-sm font-medium mb-3" style={{ color: `${TEAL}99` }}>{member.role}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{member.bio}</p>
              </div>
            </AnimatedSection>
          ))}
        </div> */}
      </div>
    </div>
  )
}
