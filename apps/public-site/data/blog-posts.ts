// Blog Content Loader
// Reads individual .md files from content/blog/ with YAML frontmatter
// Posts only appear on the site when publishDate <= today

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface BlogPost {
    slug: string;
    title: string;
    description: string;
    publishDate: string; // ISO date — post only visible when this date <= today
    readTime: string;
    category: string;
    content: string;
    /** Optional lead magnet to render at the bottom of the post */
    leadMagnet?: {
        magnetName: string;
        title: string;
        description: string;
        ctaText?: string;
        variant?: 'blue' | 'green' | 'dark';
        downloadUrl?: string;
    };
}

const postsDir = path.join(process.cwd(), 'content', 'blog');

// Cache: loaded once per process (Next.js caches server modules)
let _cache: BlogPost[] | null = null;

function loadAllPosts(): BlogPost[] {
    if (_cache) return _cache;

    const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));

    _cache = files.map(filename => {
        const raw = fs.readFileSync(path.join(postsDir, filename), 'utf-8');
        const { data, content } = matter(raw);
        return {
            slug: filename.replace('.md', ''),
            title: data.title,
            description: data.description,
            publishDate: data.publishDate,
            readTime: data.readTime,
            category: data.category,
            content: content.trim(),
            ...(data.leadMagnet ? { leadMagnet: data.leadMagnet } : {}),
        } as BlogPost;
    });

    return _cache;
}

// Helper: returns only published posts (publishDate <= today)
export function getPublishedPosts(): BlogPost[] {
    const today = new Date().toISOString().split('T')[0];
    return loadAllPosts()
        .filter(p => p.publishDate <= today)
        .sort((a, b) => b.publishDate.localeCompare(a.publishDate));
}

export function getPost(slug: string): BlogPost | undefined {
    const today = new Date().toISOString().split('T')[0];
    const post = loadAllPosts().find(p => p.slug === slug);
    if (!post || post.publishDate > today) return undefined;
    return post;
}

export function getAllSlugs(): string[] {
    return loadAllPosts().map(p => p.slug);
}

// Keep BLOG_POSTS export for any code that references it directly
export const BLOG_POSTS = loadAllPosts();
