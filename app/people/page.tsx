import { Metadata } from 'next'
import CoreTeam from '@/components/CoreTeam'
import AmbientBackground from '@/components/AmbientBackground'

export const metadata: Metadata = { title: 'People' }

export default function PeoplePage() {
  return (
    <div className="relative min-h-screen bg-ocean-dark overflow-hidden">
      <AmbientBackground />
      <CoreTeam showCollaborators showBio />
    </div>
  )
}