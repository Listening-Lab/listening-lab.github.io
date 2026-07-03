import { Metadata } from 'next'
import CoreTeam from '@/components/CoreTeam'

export const metadata: Metadata = { title: 'People' }

export default function PeoplePage() {
  return (
    <div className="min-h-screen bg-ocean-dark">
      <CoreTeam showCollaborators />
    </div>
  )
}