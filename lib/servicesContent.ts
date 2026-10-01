// Content for the /services page.

export const PATHS = [
  {
    href: '/platform',
    eyebrow: 'Platform',
    title: 'Explore and analyse it yourself',
    text: 'Free access to the Sound Map, the national model and citizen science validation, plus the Ecocommons desktop app, coming soon. Subscribe for private projects, custom models and processing at scale.',
    visual: 'platform' as const,
  },
  {
    href: '/monitoring',
    eyebrow: 'Monitoring projects',
    title: 'Have us run it for you',
    text: 'Survey design, expert validation and calibrated results on species richness, occupancy and density, with the uncertainty stated plainly.',
    visual: 'monitoring' as const,
  },
  {
    href: '/contact',
    eyebrow: 'Nature credits',
    title: 'Evidence for nature on the land',
    text: 'Independent, repeatable biodiversity measurement for nature credit schemes and sustainability reporting.',
    visual: 'credits' as const,
    comingSoon: true,
  },
]

export const PRINCIPLES = [
  {
    name: 'Researchers first',
    text: 'We are a research group developing computational methods for biodiversity monitoring. What we offer comes out of that research.',
  },
  {
    name: 'Not for profit',
    text: 'Nature Commons is a not-for-profit. All profit from subscriptions and projects goes back into conservation and research.',
  },
  {
    name: 'Open by default',
    text: 'The national model is open source, and validated public data improves it for everyone. Your own data stays yours.',
  },
]
