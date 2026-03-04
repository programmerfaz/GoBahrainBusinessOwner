import { supabase } from './supabase'

const PROFILE_BUCKET = 'gobahrain-profile-images'
const EVENT_IMAGES_BUCKET = 'event-images'

/**
 * Ensure the profile images bucket exists. Create manually if needed: Storage → New bucket → gobahrain-profile-images (Public: ON)
 */
export async function ensureProfileImagesBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets()
    if (buckets?.some((b) => b.name === PROFILE_BUCKET)) return
    await supabase.storage.createBucket(PROFILE_BUCKET, { public: true })
  } catch (e) {
    console.warn('[Profile images] Could not ensure bucket. Create in Supabase: Storage → New bucket →', PROFILE_BUCKET, e?.message)
  }
}

/**
 * Ensure the event-images bucket exists. Create manually if needed: Storage → New bucket → event-images (Public: ON)
 */
export async function ensureEventImagesBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets()
    if (buckets?.some((b) => b.name === EVENT_IMAGES_BUCKET)) return
    await supabase.storage.createBucket(EVENT_IMAGES_BUCKET, { public: true })
  } catch (e) {
    console.warn('[Event images] Could not ensure bucket. Create in Supabase: Storage → New bucket →', EVENT_IMAGES_BUCKET, e?.message)
  }
}

/**
 * Upload event image to Supabase Storage (event-images bucket)
 * @param {File} file - image file
 * @param {string} accountUuid - account or client uuid for path
 * @returns {Promise<string>} public URL
 */
export async function uploadEventImage(file, accountUuid) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, 'jpg')
  const path = `${accountUuid}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(EVENT_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from(EVENT_IMAGES_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Upload profile (client) image to Supabase Storage (gobahrain-profile-images bucket)
 * @param {File} file - image file
 * @param {string} accountUuid - account or client uuid for path
 * @returns {Promise<string>} public URL
 */
export async function uploadProfileImage(file, accountUuid) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, 'jpg')
  const path = `profiles/${accountUuid}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(PROFILE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
