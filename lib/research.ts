import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const researchDirectory = path.join(process.cwd(), 'content/research')

export interface ResearchMeta {
  slug: string
  title: string
  date: string
  author: string
  excerpt: string
  tags: string[]
  image?: string
  content: string
  hideHeader?: boolean
}

export async function getAllResearch(): Promise<ResearchMeta[]> {
  if (!fs.existsSync(researchDirectory)) return []
  
  const folders = fs.readdirSync(researchDirectory)
  const researchItems = folders.map(folder => {
    const fullFolderPath = path.join(researchDirectory, folder)
    if (!fs.statSync(fullFolderPath).isDirectory()) return null

    const fullPath = path.join(fullFolderPath, 'index.mdx')
    if (!fs.existsSync(fullPath)) return null
    
    const fileContents = fs.readFileSync(fullPath, 'utf8')
    const { data, content } = matter(fileContents)
    
    return {
      slug: folder,
      title: data.title,
      date: data.date,
      author: data.author,
      excerpt: data.excerpt,
      tags: data.tags || [],
      image: data.image || null,
      hideHeader: data.hideHeader || false,
      content,
    } as ResearchMeta
  }).filter(Boolean) as ResearchMeta[]

  return researchItems.sort((a, b) => (new Date(a.date) < new Date(b.date) ? 1 : -1))
}

export async function getResearchBySlug(slug: string): Promise<ResearchMeta | null> {
  const fullPath = path.join(researchDirectory, slug, 'index.mdx')
  if (!fs.existsSync(fullPath)) return null
  
  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)
  
  return {
    slug,
    title: data.title,
    date: data.date,
    author: data.author,
    excerpt: data.excerpt,
    tags: data.tags || [],
    image: data.image || null,
    hideHeader: data.hideHeader || false,
    content,
  }
}