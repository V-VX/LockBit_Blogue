import { defineCollection, z } from 'astro:content'

const postsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    // encrypt_title: z.boolean().optional(),
    uploaded_at: z.date(),
    updated_at: z.date(),
    author: z.string(),
    draft: z.boolean().optional(),
    // is_protected: z.boolean().optional(),
    // image: z.string().optional(),
  }),
})
export const collections = {
  posts: postsCollection,
}