# Listening Lab NZ

Website for the Listening Lab NZ research group, hosted on GitHub Pages.

Built with **Next.js 14**, **Tailwind CSS**, **Framer Motion**, and **MDX**.
 
## Development

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm ci` installs exactly what `package-lock.json` pins; use `npm install <pkg>` only to add or change a dependency.
Never copy `node_modules/`, `.next/` or `out/` from another machine: `node_modules` goes stale as dependencies are
added, and Turbopack's cache in `.next` holds absolute paths that panic ("Next.js package not found") anywhere else.

To use a local API instead of production, create `.env.local` (gitignored) with one line:
`NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`. Everything else in `.env` is public config and is committed.

## Adding a Research Item

Create a new folder in `content/research/` with an `index.mdx` file:

```
content/research/your-slug/index.mdx
```

With this frontmatter:

```mdx
---
title: Your Research Title
date: 2026-01-01
author: Your Name
excerpt: A one or two sentence summary shown in the research listing.
tags: [Tag1, Tag2]
image: /images/our-work/your-slug/cover.png
hideHeader: false
---

Your content here...
```

- `image` is used as the the force-graph node background.
- `date` is interpreted as the "Last updated" date. Please update this manually whenever modifying research item content.
- `tags` drive both the filter chips and the connecting edges in the research force graph — items sharing a tag are linked.
- Set `hideHeader: true` to suppress the default title/date header on the detail page (used for pages that lead with an embedded demo, e.g. `acoustic-map`, `listen`, `localisation`).
- Interactive components (`AcousticMap`, `Map`, `AudioShowcase`, `LocalisationDemo`) are available directly inside MDX content — see `app/research/[slug]/page.tsx` for the registered set.

## Deployment

Pushes to `main` automatically deploy to GitHub Pages via the GitHub Actions workflow in `.github/workflows/deploy.yml`.

Before first deploy:
1. Go to repository **Settings → Pages**
2. Set source to **GitHub Actions**

## Contact Form

The contact form uses [Formspree](https://formspree.io). Replace the form ID in `components/ContactForm.tsx` with your actual Formspree form ID.
```