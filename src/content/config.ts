import { defineCollection, z } from 'astro:content'

const postsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    uploaded_at: z.date(),
    updated_at: z.date(),
    author: z.string(),
    draft: z.boolean().optional(),
    is_protected: z.boolean().optional(),
    isProtected: z.boolean().optional(),
    description: z.string().optional(),
    access_envelopes: z.record(z.string()).optional(),
  }),
})

const authorsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    avatar: z.string(),
  }),
})

export const collections = {
  posts: postsCollection,
  authors: authorsCollection,
}
