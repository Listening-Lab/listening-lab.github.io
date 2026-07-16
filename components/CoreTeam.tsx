import fs from 'fs'
import path from 'path'
import { MDXRemote } from 'next-mdx-remote/rsc'
import AnimatedSection from './AnimatedSection'
import Image from 'next/image'
import Link from 'next/link'
import Collaborators from './Collaborators'
import GlintCard from './GlintCard'

const TEAL = '#4ecdc4'

const team = [
  {
    name: 'Dr Ben McEwen',
    role: 'Co-lead | Postdoctoral Researcher',
    affiliation: 'University of Amsterdam',
    description: 'Machine Learning, Biodiversity',
    initials: 'BM',
    photo: '/images/team/ben_mcewen.jpg',
    accent: '#4ecdc4',
    bioFile: 'ben.md',
    links: {
      website: 'https://www.benmcewen-phd.com/',
      scholar: 'https://scholar.google.com/citations?hl=en&user=x47JZUkAAAAJ&view_op=list_works&sortby=pubdate',
      linkedin: 'https://www.linkedin.com/in/ben-mcewen-phd/',
    },
  },
  {
    name: 'Kaspar Soltero',
    role: 'Co-lead | PhD Candidate',
    affiliation: 'University of Canterbury',
    description: 'Bioacoustics, Sound Localisation',
    initials: 'KS',
    photo: '/images/team/kaspar_soltero.jpg',
    accent: '#74b9ff',
    bioFile: 'kaspar.md',
    links: {
      website: '',
      scholar: '',
      linkedin: 'https://www.linkedin.com/in/kasparsoltero/',
    },
  },
  {
    name: 'Professor Stefanie Gutschmidt',
    role: 'Co-lead | Professor',
    affiliation: 'University of Canterbury',
    description: 'Acoustics, Dynamics and Vibrations',
    initials: 'SG',
    photo: '/images/team/stefanie_gutschmidt.jpg',
    accent: '#c3a6ff',
    bioFile: 'stefanie.md',
    links: {
      website: 'https://profiles.canterbury.ac.nz/Stefanie-Gutschmidt/',
      scholar: 'https://scholar.google.com/citations?hl=en&user=eQqrBUwAAAAJ&view_op=list_works&sortby=pubdate',
      linkedin: 'https://www.linkedin.com/in/stefanie-gutschmidt-89322333/',
    },
  },
]

function WebsiteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c-2 0-3.5-4-3.5-9S10 3 12 3m0 18c2 0 3.5-4 3.5-9S14 3 12 3M3 12h18" />
    </svg>
  )
}

function ScholarIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

interface CoreTeamProps {
  showCollaborators?: boolean
  showBio?: boolean
}

export default function CoreTeam({ showCollaborators = false, showBio = false }: CoreTeamProps) {
  const teamWithBios = team.map(member => {
    const bioPath = path.join(process.cwd(), 'content/people', member.bioFile)
    const bio = showBio && fs.existsSync(bioPath) ? fs.readFileSync(bioPath, 'utf8') : null
    return { ...member, bio }
  })

  return (
    <section className="relative py-24 z-10">
      <div className="max-w-6xl mx-auto px-6">
        <AnimatedSection>
          <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>
            The people
          </p>
          <h2 className="font-serif text-4xl md:text-5xl text-white leading-tight mb-16">
            Core team.
          </h2>
        </AnimatedSection>

        <div className="grid sm:grid-cols-3 gap-8">
          {teamWithBios.map((member, i) => (
            <AnimatedSection key={member.name} delay={i * 0.1}>
              <GlintCard className="rounded-3xl h-full transition-transform duration-500 hover:-translate-y-1">
              <div className="relative group flex flex-col items-center text-center h-full p-8 rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 transition-colors duration-500 hover:bg-[#0a1628]/55 hover:border-white/25" style={{ boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)' }}>
                <div
                  className="w-24 h-24 rounded-full mx-auto mb-4 overflow-hidden border-2 transition-colors"
                  style={{ borderColor: `${member.accent}55` }}
                >
                  <Image
                    src={member.photo}
                    alt={member.name}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <h3 className="font-serif text-xl text-white mb-1">{member.name}</h3>
                <p className="text-sm font-medium mb-1" style={{ color: member.accent }}>{member.role}</p>
                <p className="text-gray-500 text-xs mb-1">{member.affiliation}</p>
                <p className="text-gray-400 text-sm mb-4">{member.description}</p>

                {showBio && member.bio && (
                  <div className="mt-2 mb-6 pt-5 w-full border-t border-white/10 text-left text-gray-300 text-sm leading-relaxed [&>p]:mb-3 [&>p:last-child]:mb-0">
                    <MDXRemote source={member.bio} />
                  </div>
                )}

                <div className="flex gap-3 justify-center mt-auto">
                  {member.links.website && (
                    <a
                      href={member.links.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-white transition-colors"
                      aria-label="Personal website"
                    >
                      <WebsiteIcon />
                    </a>
                  )}
                  {member.links.scholar && (
                    <a
                      href={member.links.scholar}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-white transition-colors"
                      aria-label="Google Scholar"
                    >
                      <ScholarIcon />
                    </a>
                  )}
                  {member.links.linkedin && (
                    <a
                      href={member.links.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-white transition-colors"
                      aria-label="LinkedIn"
                    >
                      <LinkedInIcon />
                    </a>
                  )}
                </div>
              </div>
              </GlintCard>
            </AnimatedSection>
          ))}
        </div>

        {showCollaborators ? (
          <Collaborators />
        ) : (
          <div className="text-center mt-16">
            <Link href="/people" className="inline-block bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-8 py-3 text-sm font-medium text-white hover:bg-white/20 transition-colors">
              Meet the full team & our collaborators →
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
