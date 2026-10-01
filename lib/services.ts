// Content for /monitoring and its subpages. The level ids match lib/pricing.ts so a subpage
// can link straight to the estimator with its level preselected.

export type ServiceSlug = 'richness' | 'occupancy' | 'density' | 'invasive'

export interface Service {
  slug: ServiceSlug
  name: string
  question: string
  short: string
  /** Not offered yet: shown greyed out, with no subpage. */
  comingSoon?: boolean
  intro?: string
  how?: string
  youGet?: string[]
  goodFor?: string[]
  design?: string
}

export const SERVICES: Service[] = [
  {
    slug: 'richness',
    name: 'Species richness',
    question: 'Which species are here?',
    short: 'A validated list of every species calling at your sites.',
    intro:
      'Richness answers the simplest question: which species are here? Every recording is run through a classifier that recognises thousands of species, and our team confirms what it found, so each species on the list has been checked.',
    how:
      'The longer you record, the more slowly new species are added. That flattening curve shows how complete the list is likely to be, and we report it with the checklist, so a short survey is not mistaken for an empty site.',
    youGet: [
      'A checklist of species for each site and period',
      'Confirmed example calls for every species listed',
      'An estimate of how complete the list is',
    ],
    goodFor: [
      'Baseline biodiversity surveys',
      'Comparing sites before and after restoration',
      'Finding species you were not looking for',
    ],
    design: 'Works with single recorders. Spreading them across habitats and recording through a full season finds the most species.',
  },
  {
    slug: 'occupancy',
    name: 'Site occupancy',
    question: 'Where and when are they?',
    short: 'Where target species occur, and how that changes across sites and seasons.',
    intro:
      "Occupancy asks where a species lives. Not hearing a species doesn't mean it isn't there: it may have been quiet, too far from the recorder, or drowned out by wind or rain.",
    how:
      'Recording at many sites on repeated days lets us estimate two things separately: how likely a species is to be heard when it is present, and how likely it is to be present at all. That gives a probability for every site, including the ones where it was never heard.',
    youGet: [
      'Probability of presence at each site, with a confidence interval',
      'How detectable each species is',
      'Change across seasons or years when repeated',
    ],
    goodFor: [
      'Tracking the spread or recovery of a species',
      'Showing likely absence, for example after pest eradication',
      'Comparing managed and unmanaged areas',
    ],
    design: 'Needs enough sites and repeat days for the species. We check this with you before recorders go out.',
  },
  {
    slug: 'density',
    name: 'Density proxy',
    question: 'How many are there?',
    short: 'How many individuals are calling, located by synchronised recorders.',
    intro:
      'Density goes a step further: how many animals are there? When recorders are synchronised in time, one call reaches each of them a fraction of a second apart, and those differences show where the caller was.',
    how:
      'Locating calls lets us tell individuals apart instead of counting calls, which one loud bird can inflate. The result is a minimum count of calling individuals and how they are spread across the area, which can be compared over time.',
    youGet: [
      'Minimum number of distinct calling individuals',
      'Where they are, as a density map',
      'Trends when the survey is repeated',
    ],
    goodFor: [
      'Territorial species that call regularly',
      'Measuring how a population responds to management',
      'Long-term monitoring of key species',
    ],
    design: 'Needs clusters of time-synchronised recorders spaced closely enough that several hear the same call.',
  },
  {
    slug: 'invasive',
    name: 'Invasive species alerts',
    question: 'Has it arrived?',
    short: 'Near-real-time alerts when a target species is heard.',
    comingSoon: true,
  },
]

export const LEVEL_SERVICES = SERVICES.filter((s) => !s.comingSoon)
