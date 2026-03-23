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
  },
    {
    name: 'Dr. Tadeu Siqueira',
    role: '',
    bio: '',
    initials: 'TS',
  },
]

export default function TeamPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-24">
      <AnimatedSection>
        <h1 className="font-serif text-5xl text-ocean-dark mb-4">Team</h1>
        <p className="text-xl text-gray-600 mb-16">The people behind the research.</p>
      </AnimatedSection>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {team.map((member, i) => (
          <AnimatedSection key={member.name} delay={i * 0.1}>
            <div className="text-center p-8">
              <div className="w-20 h-20 rounded-full bg-ocean-dark text-white flex items-center justify-center text-2xl font-serif mx-auto mb-4">
                {member.initials}
              </div>
              <h2 className="font-serif text-xl text-ocean-dark mb-1">{member.name}</h2>
              <p className="text-brand-600 text-sm font-medium mb-3">{member.role}</p>
              <p className="text-gray-600 text-sm leading-relaxed">{member.bio}</p>
            </div>
          </AnimatedSection>
        ))}
      </div>
    </div>
  )
}
