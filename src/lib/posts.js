import { supabase } from './supabase'

/**
 * Fetch all posts for a client
 */
export async function getPostsByClient(clientUuid) {
  const { data, error } = await supabase.rpc('get_posts_for_client', {
    p_client_uuid: clientUuid,
  })

  if (error) throw error
  const arr = typeof data === 'string' ? JSON.parse(data || '[]') : (data ?? [])
  return Array.isArray(arr) ? arr : []
}

/**
 * Create a new post for a client
 */
export async function createPost({ clientUuid, title, content, imageUrl }) {
  const { data, error } = await supabase.rpc('create_post', {
    p_client_uuid: clientUuid,
    p_title: title || '',
    p_content: content ?? null,
    p_image_url: imageUrl ?? null,
  })

  if (error) throw error
  return typeof data === 'string' ? JSON.parse(data) : data
}
