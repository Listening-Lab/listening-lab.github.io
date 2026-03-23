# Listening Lab NZ

Website for the Listening Lab NZ research group, hosted on GitHub Pages.

Built with **Next.js 14**, **Tailwind CSS**, **Framer Motion**, and **MDX**.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding a Blog Post

Create a new `.mdx` file in `content/blog/` with this frontmatter:

```mdx
---
title: Your Post Title
date: 2024-08-01
author: Your Name
excerpt: A one or two sentence summary shown in the blog listing.
tags: [Tag1, Tag2]
---

Your content here...
```

## Deployment

Pushes to `main` automatically deploy to GitHub Pages via the GitHub Actions workflow in `.github/workflows/deploy.yml`.

Before first deploy:
1. Go to repository **Settings → Pages**
2. Set source to **GitHub Actions**

## Contact Form

The contact form uses [Formspree](https://formspree.io). Replace `YOUR_FORM_ID` in `components/ContactForm.tsx` with your actual Formspree form ID.
