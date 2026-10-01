// Platform tiers for /platform. Placeholders for discussion, like lib/pricing.ts: the
// allowance is in the same units as the metered rates (docs/adr/0007-rates-and-bulk-processing.md).

export interface TierFeature {
  text: string
  comingSoon?: boolean
}

export interface Tier {
  id: 'free' | 'pro'
  name: string
  price: string
  per?: string
  summary: string
  features: TierFeature[]
}

export const PRO_ALLOWANCE = {
  audioHours: 500,
  storageGb: 50,
}

/** Free users can try an upload to see how processing works; not meant as a free tool. */
export const FREE_TRIAL_AUDIO_HOURS = 5

export const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    summary: 'Explore public sound data and the national model.',
    features: [
      { text: 'The Sound Map, with public recordings and species insights' },
      { text: 'The national model: Perch v2 with a New Zealand species filter, open source to download' },
      { text: 'Citizen science validation' },
      { text: `A trial upload of up to ${FREE_TRIAL_AUDIO_HOURS} hours of your own audio, to see how processing works` },
      { text: 'The Ecocommons desktop app, free on your own computer', comingSoon: true },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$20',
    per: 'NZD / month',
    summary: 'Run your own projects, with private data and custom models.',
    features: [
      { text: 'Everything in Free' },
      { text: 'Private projects, data management and team members' },
      { text: `${PRO_ALLOWANCE.audioHours} audio-hours processed and ${PRO_ALLOWANCE.storageGb} GB stored each month` },
      { text: 'Bulk downloads' },
      { text: 'Custom models trained with active learning' },
      { text: 'Small models for edge devices', comingSoon: true },
      { text: 'Other data types, such as camera traps', comingSoon: true },
    ],
  },
]
