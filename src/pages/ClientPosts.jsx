import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getClientFull } from '../lib/clients'
import { getPostsByClient, createPost } from '../lib/posts'

export default function ClientPosts() {
  const { clientId } = useParams()
  const { user } = useAuth()
  const [client, setClient] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', content: '', imageUrl: '' })

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
    if (!createForm.title?.trim()) {
      setError('Title is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createPost({
        clientUuid: clientId,
        title: createForm.title.trim(),
        content: createForm.content.trim() || null,
        imageUrl: createForm.imageUrl?.trim() || null,
      })
      const updated = await getPostsByClient(clientId)
      setPosts(updated)
      setCreateForm({ title: '', content: '', imageUrl: '' })
      setShowCreate(false)
    } catch (err) {
      setError(err.message || 'Failed to create post')
    } finally {
      setSaving(false)
    }
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
          onClick={() => { setShowCreate(true); setError(''); setCreateForm({ title: '', content: '', imageUrl: '' }); }}
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
                  Title *
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Post title"
                    required
                  />
                </label>
                <label>
                  Content
                  <textarea
                    value={createForm.content}
                    onChange={(e) => setCreateForm((p) => ({ ...p, content: e.target.value }))}
                    placeholder="Post content..."
                    rows={4}
                  />
                </label>
                <label>
                  Image URL
                  <input
                    type="text"
                    value={createForm.imageUrl}
                    onChange={(e) => setCreateForm((p) => ({ ...p, imageUrl: e.target.value }))}
                    placeholder="https://..."
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
            return (
              <div key={p.post_uuid} className={`post-card post-card-item ${gradientClass}`}>
                <div className="post-card-top">
                  {p.image_url && (
                    <div className="post-card-image">
                      <img src={p.image_url} alt="" />
                    </div>
                  )}
                  {!p.image_url && <div className="post-card-image-placeholder" />}
                  <span className="post-card-date">{created}</span>
                  <h3 className="post-card-title">{p.title}</h3>
                </div>
                <div className="post-card-bottom">
                  {p.content && <p className="post-card-content">{String(p.content).slice(0, 80)}{p.content?.length > 80 ? '…' : ''}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
