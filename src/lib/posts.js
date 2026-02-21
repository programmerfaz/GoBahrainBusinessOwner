import { supabase } from './supabase'

const BUCKET = 'gobahrain-post-images'

/**
 * Upload post image to Supabase Storage
 * @param {File} file - image file
 * @param {string} clientUuid - for path organization
 * @returns {Promise<string>} public URL
 */
export async function uploadPostImage(file, clientUuid) {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${clientUuid}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Ensure Storage bucket exists (call once on app load if needed)
 */
export async function ensurePostImagesBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true })
  }
}

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
export async function createPost({ clientUuid, description, priceRange, postImage }) {
  const { data, error } = await supabase.rpc('create_post', {
    p_client_uuid: clientUuid,
    p_description: description ?? null,
    p_price_range: priceRange ?? null,
    p_post_image: postImage ?? null,
  })

  if (error) throw error
  return typeof data === 'string' ? JSON.parse(data) : data
}

/**
 * Update an existing post
 */
export async function updatePost({ postUuid, description, priceRange, postImage }) {
  const { data, error } = await supabase.rpc('update_post', {
    p_post_uuid: postUuid,
    p_description: description ?? null,
    p_price_range: priceRange ?? null,
    p_post_image: postImage ?? null,
  })

  if (error) throw error
  return typeof data === 'string' ? JSON.parse(data) : data
}
