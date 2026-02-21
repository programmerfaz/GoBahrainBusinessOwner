import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getClientFull } from '../lib/clients'
import { getPostsByClient, createPost, updatePost, uploadPostImage } from '../lib/posts'

export default function ClientPosts() {
  const { clientId } = useParams()
  const { user } = useAuth()
  const [client, setClient] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingPost, setEditingPost] = useState(null)
  const [saving, setSaving] = useState(false)
  const [createForm, setCreateForm] = useState({ description: '', priceRange: '' })
  const [editForm, setEditForm] = useState({ description: '', priceRange: '' })
  const [imageFile, setImageFile] = useState(null)
  const [editImageFile, setEditImageFile] = useState(null)
  const fileInputRef = useRef(null)
  const editFileInputRef = useRef(null)

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    setError('')
    Promise.all([
      getClientFull(clientId).then(setClient).catch(() => setClient(null)),
      getPostsByClient(clientId).then(setPosts).catch(() => setPosts([])),
    ]).finally(() => setLoading(false))
  }, [clientId])

  async function handleCreatePost(e) {
    e.preventDefault()
    if (!createForm.description?.trim()) {
      setError('Description is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      let postImageUrl = null
      if (imageFile) {
        postImageUrl = await uploadPostImage(imageFile, clientId)
      }
      await createPost({
        clientUuid: clientId,
        description: createForm.description.trim(),
        priceRange: createForm.priceRange?.trim() || null,
        postImage: postImageUrl,
      })
      const updated = await getPostsByClient(clientId)
      setPosts(updated)
      setCreateForm({ description: '', priceRange: '' })
      setImageFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setShowCreate(false)
    } catch (err) {
      setError(err.message || 'Failed to create post')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdatePost(e) {
    e.preventDefault()
    if (!editingPost) return
    if (!editForm.description?.trim()) {
      setError('Description is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      let postImageUrl = editingPost.post_image || editingPost.image_url || null
      if (editImageFile) {
        postImageUrl = await uploadPostImage(editImageFile, clientId)
      }
      await updatePost({
        postUuid: editingPost.post_uuid,
        description: editForm.description.trim(),
        priceRange: editForm.priceRange?.trim() || null,
        postImage: postImageUrl,
      })
      const updated = await getPostsByClient(clientId)
      setPosts(updated)
      setEditingPost(null)
      setEditForm({ description: '', priceRange: '' })
      setEditImageFile(null)
      if (editFileInputRef.current) editFileInputRef.current.value = ''
    } catch (err) {
      setError(err.message || 'Failed to update post')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(p) {
    setEditingPost(p)
    setEditForm({
      description: p.description || p.content || '',
      priceRange: p.price_range || '',
    })
    setEditImageFile(null)
    setError('')
  }

  if (!user) return null
  const name = client?.business_name || client?.name || 'Business'

  return (
    <div className="page client-posts">
      <div className="client-posts-header">
        <Link to="/profile" className="back-link">← Back to Profile</Link>
        <h1>Posts — {name}</h1>
        <p className="subtitle">Manage posts for this business.</p>
      </div>

      <div className="posts-toolbar">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { setShowCreate(true); setError(''); setCreateForm({ description: '', priceRange: '' }); setImageFile(null); }}
        >
          Create a post
        </button>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {loading && <p className="clients-loading">Loading posts...</p>}

      {!loading && posts.length === 0 && !showCreate && (
        <p className="clients-empty">No posts yet. Create your first post.</p>
      )}

      {!loading && (posts.length > 0 || showCreate) && (
        <div className="posts-grid">
          {showCreate && (
            <div className="post-card post-card-create">
              <form onSubmit={handleCreatePost} className="post-create-form">
                <h3>New Post</h3>
                <label>
                  Description *
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Describe your post..."
                    rows={4}
                    required
                  />
                </label>
                <label>
                  Image
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  />
                  {imageFile && <span className="file-name">{imageFile.name}</span>}
                </label>
                <label>
                  Price range
                  <input
                    type="text"
                    value={createForm.priceRange}
                    onChange={(e) => setCreateForm((p) => ({ ...p, priceRange: e.target.value }))}
                    placeholder="e.g. 5-20 BHD"
                  />
                </label>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Creating...' : 'Create'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
          {posts.map((p, i) => {
            const gradientClass = ['gradient-purple', 'gradient-green', 'gradient-orange'][i % 3]
            const created = p.created_at ? new Date(p.created_at).toLocaleDateString() : ''
            const img = p.post_image || p.image_url
            const isEditing = editingPost?.post_uuid === p.post_uuid

            if (isEditing) {
              return (
                <div key={p.post_uuid} className="post-card post-card-create">
                  <form onSubmit={handleUpdatePost} className="post-create-form">
                    <h3>Update Post</h3>
                    <label>
                      Description *
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe your post..."
                        rows={4}
                        required
                      />
                    </label>
                    <label>
                      Image
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
                      />
                      {editImageFile && <span className="file-name">{editImageFile.name}</span>}
                      {img && !editImageFile && <span className="file-name">Current image</span>}
                    </label>
                    <label>
                      Price range
                      <input
                        type="text"
                        value={editForm.priceRange}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, priceRange: e.target.value }))}
                        placeholder="e.g. 5-20 BHD"
                      />
                    </label>
                    <div className="form-actions">
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button type="button" className="btn btn-outline" onClick={() => { setEditingPost(null); setError(''); }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )
            }

            return (
              <div key={p.post_uuid} className={`post-card post-card-item ${gradientClass}`}>
                <div className="post-card-top">
                  {img && (
                    <div className="post-card-image">
                      <img src={img} alt="" />
                    </div>
                  )}
                  {!img && <div className="post-card-image-placeholder" />}
                  <span className="post-card-date">{created}</span>
                  {p.price_range && <span className="post-card-price">{p.price_range}</span>}
                  <button
                    type="button"
                    className="post-card-update-btn"
                    onClick={() => startEdit(p)}
                    title="Update"
                  >
                    Update
                  </button>
                </div>
                <div className="post-card-bottom">
                  {(p.description || p.content) && (
                    <p className="post-card-content">
                      {String(p.description || p.content || '').slice(0, 120)}
                      {(p.description || p.content)?.length > 120 ? '…' : ''}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
