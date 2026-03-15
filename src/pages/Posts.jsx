import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getClientsByAccount, getClientFull } from '../lib/clients'
import { getPostsByClient, createPost, updatePost, uploadPostImage } from '../lib/posts'
import { uploadEventImage } from '../lib/profileImages'
import { createEventForClient, updateEventForClient } from '../lib/events'
import HomeContentNav from '../components/HomeContentNav'

const emptyEventForm = () => ({
  event_name: '',
  status: 'coming_soon',
  venue: '',
  image: '',
  lat: '',
  long: '',
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  event_type: '',
  indoor_outdoor: '',
})

export default function Posts({ initialSection = 'posts', showTabs = true }) {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [posts, setPosts] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [postsLoading, setPostsLoading] = useState(false)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState(initialSection)
  const [showCreate, setShowCreate] = useState(false)
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [editingPost, setEditingPost] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [saving, setSaving] = useState(false)
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [updatingEvent, setUpdatingEvent] = useState(false)
  const [createForm, setCreateForm] = useState({ description: '', priceRange: '' })
  const [editForm, setEditForm] = useState({ description: '', priceRange: '' })
  const [eventForm, setEventForm] = useState(emptyEventForm())
  const [imageFile, setImageFile] = useState(null)
  const [editImageFile, setEditImageFile] = useState(null)
  const [eventImageFile, setEventImageFile] = useState(null)
  const [editEventImageFile, setEditEventImageFile] = useState(null)
  const fileInputRef = useRef(null)
  const editFileInputRef = useRef(null)
  const eventFileInputRef = useRef(null)
  const editEventFileInputRef = useRef(null)
  const [composePhotoPreview, setComposePhotoPreview] = useState(null)
  const [eventPhotoPreview, setEventPhotoPreview] = useState(null)

  const composeFile = editingPost ? editImageFile : imageFile
  useEffect(() => {
    if (!composeFile) {
      setComposePhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(composeFile)
    setComposePhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [composeFile])

  const eventComposeFile = editingEvent ? editEventImageFile : eventImageFile
  useEffect(() => {
    if (eventComposeFile) {
      const url = URL.createObjectURL(eventComposeFile)
      setEventPhotoPreview(url)
      return () => URL.revokeObjectURL(url)
    }
    if (editingEvent && (eventForm.image || editingEvent.image)) {
      setEventPhotoPreview(eventForm.image || editingEvent.image)
      return
    }
    setEventPhotoPreview(null)
  }, [eventComposeFile, editingEvent, eventForm.image])

  const singleClient = clients.length === 1 ? clients[0] : null
  const clientId = singleClient?.client_a_uuid
  const isEventOrganizer = singleClient?.client_type === 'event_organizer'
  const sectionTabs = isEventOrganizer && showTabs
    ? [{ id: 'posts', label: 'Posts' }, { id: 'events', label: 'Events' }]
    : [{ id: 'posts', label: 'Posts' }]

  // When tabs are hidden (posts-only or events-only pages), force section to match the initialSection
  useEffect(() => {
    if (!showTabs && activeSection !== initialSection) {
      setActiveSection(initialSection)
    }
  }, [showTabs, initialSection, activeSection])

  useEffect(() => {
    if (!user?.account_uuid) return
    setLoading(true)
    setError('')
    getClientsByAccount(user.account_uuid)
      .then(setClients)
      .catch((err) => setError(err.message || 'Failed to load profile'))
      .finally(() => setLoading(false))
  }, [user?.account_uuid])

  useEffect(() => {
    if (!clientId) {
      setPosts([])
      return
    }
    setPostsLoading(true)
    getPostsByClient(clientId)
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setPostsLoading(false))
  }, [clientId])

  useEffect(() => {
    if (!clientId || !isEventOrganizer) {
      setEvents([])
      return
    }
    setEventsLoading(true)
    getClientFull(clientId)
      .then((profile) => setEvents(Array.isArray(profile?.events) ? profile.events : []))
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false))
  }, [clientId, isEventOrganizer])

  useEffect(() => {
    if (!isEventOrganizer && activeSection !== 'posts') {
      setActiveSection('posts')
    }
  }, [isEventOrganizer, activeSection])

  async function handleCreatePost(e) {
    e.preventDefault()
    if (!clientId || !createForm.description?.trim()) {
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
    if (!clientId || !editingPost) return
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

  async function handleCreateEvent(e) {
    e.preventDefault()
    if (!clientId || !isEventOrganizer) {
      setError('Create event is available only for event organizer profile')
      return
    }
    if (!eventForm.event_name?.trim()) {
      setError('Event name is required')
      return
    }
    setCreatingEvent(true)
    setError('')
    try {
      let eventImageUrl = eventForm.image?.trim() || ''
      if (eventImageFile) {
        eventImageUrl = await uploadEventImage(eventImageFile, clientId)
      }
      await createEventForClient(clientId, {
        ...eventForm,
        image: eventImageUrl || null,
      })
      const refreshedProfile = await getClientFull(clientId)
      setEvents(Array.isArray(refreshedProfile?.events) ? refreshedProfile.events : [])
      setShowCreateEvent(false)
      setEventImageFile(null)
      if (eventFileInputRef.current) eventFileInputRef.current.value = ''
      setEventForm(emptyEventForm())
    } catch (err) {
      setError(err.message || 'Failed to create event')
    } finally {
      setCreatingEvent(false)
    }
  }

  function startEditEvent(ev) {
    setEditingEvent(ev)
    setEditEventImageFile(null)
    setEventForm({
      event_name: ev.event_name || '',
      status: ev.status || 'coming_soon',
      venue: ev.venue || '',
      image: ev.image || '',
      lat: ev.lat != null ? String(ev.lat) : '',
      long: ev.long != null ? String(ev.long) : '',
      start_date: ev.start_date || '',
      end_date: ev.end_date || '',
      start_time: ev.start_time || '',
      end_time: ev.end_time || '',
      event_type: ev.event_type || '',
      indoor_outdoor: ev.indoor_outdoor || '',
    })
    setError('')
  }

  async function handleUpdateEvent(e) {
    e.preventDefault()
    if (!clientId || !editingEvent?.event_uuid) return
    if (!eventForm.event_name?.trim()) {
      setError('Event name is required')
      return
    }
    setUpdatingEvent(true)
    setError('')
    try {
      let eventImageUrl = eventForm.image?.trim() || ''
      if (editEventImageFile) {
        eventImageUrl = await uploadEventImage(editEventImageFile, clientId)
      }
      await updateEventForClient(clientId, editingEvent.event_uuid, {
        ...eventForm,
        image: eventImageUrl || null,
      })
      const refreshedProfile = await getClientFull(clientId)
      setEvents(Array.isArray(refreshedProfile?.events) ? refreshedProfile.events : [])
      setEditingEvent(null)
      setEditEventImageFile(null)
      if (editEventFileInputRef.current) editEventFileInputRef.current.value = ''
      setEventForm(emptyEventForm())
    } catch (err) {
      setError(err.message || 'Failed to update event')
    } finally {
      setUpdatingEvent(false)
    }
  }

  // No profile yet — link to home (profile page)
  if (!loading && clients.length === 0) {
    return (
      <div className="page dashboard-v2">
        <section className="dash-hero-v2">
          <div className="dash-hero-v2-pattern" aria-hidden />
          <div className="dash-hero-v2-inner">
            <h1>Welcome, {user?.name}</h1>
            <p>Create your business profile to start adding posts.</p>
            <Link to="/" className="btn btn-hero">Create your profile</Link>
          </div>
        </section>
        {error && <div className="auth-error">{error}</div>}
      </div>
    )
  }

  function openCreate() {
    setError('')
    if (activeSection === 'posts') {
      setCreateForm({ description: '', priceRange: '' })
      setImageFile(null)
      setShowCreate(true)
    } else if (isEventOrganizer && activeSection === 'events') {
      setEditingEvent(null)
      setShowCreateEvent(true)
      setEventImageFile(null)
      if (eventFileInputRef.current) eventFileInputRef.current.value = ''
      setEventForm(emptyEventForm())
    }
  }

  // Loading profile
  if (loading && clients.length === 0) {
    return (
      <div className="page dashboard-v2">
        <section className="dash-hero-v2">
          <div className="dash-hero-v2-inner">
            <h1>Welcome, {user?.name}</h1>
            <p className="clients-loading">Loading...</p>
          </div>
        </section>
      </div>
    )
  }

  const showFab = activeSection === 'posts' || (isEventOrganizer && activeSection === 'events')

  return (
    <div className="page dashboard-v2 home-posts">
      {sectionTabs.length > 1 && (
        <HomeContentNav
          tabs={sectionTabs}
          activeTab={activeSection}
          onChange={(section) => {
            setActiveSection(section)
            setError('')
            setShowCreate(false)
            setShowCreateEvent(false)
            setEditingPost(null)
            setEditingEvent(null)
          }}
        />
      )}

      {error && <div className="auth-error">{error}</div>}

      {(loading || postsLoading) && clients.length < 1 && <p className="clients-loading">Loading...</p>}
      {activeSection === 'posts' && clientId && postsLoading && <p className="clients-loading">Loading posts...</p>}
      {activeSection === 'events' && isEventOrganizer && clientId && eventsLoading && <p className="clients-loading">Loading events...</p>}
      {!loading && activeSection === 'posts' && clientId && !postsLoading && posts.length === 0 && !showCreate && (
        <p className="clients-empty">No posts yet. Create your first post.</p>
      )}
      {!loading && activeSection === 'events' && isEventOrganizer && clientId && !eventsLoading && events.length === 0 && !showCreateEvent && !editingEvent && (
        <p className="clients-empty">No events yet. Create your first event.</p>
      )}

      {clientId && (
        ((activeSection === 'posts' && posts.length > 0) ||
          (activeSection === 'events' && isEventOrganizer && events.length > 0)) && (
        <div className="posts-grid">
          {activeSection === 'posts' && posts.map((p, i) => {
            const gradientClass = ['post-card-dark-1', 'post-card-dark-2', 'post-card-dark-3'][i % 3]
            const created = p.created_at ? new Date(p.created_at).toLocaleDateString() : ''
            const img = p.post_image || p.image_url
            const isEditing = editingPost?.post_uuid === p.post_uuid

            return (
              <div key={p.post_uuid} className={`post-card post-card-item ${gradientClass}`}>
                <div className="post-card-top">
                  {img && (
                    <div className="post-card-image">
                      <img src={img} alt="" />
                    </div>
                  )}
                  {!img && <div className="post-card-image-placeholder" />}
                  <div className="post-card-meta">
                    {created && <span className="post-card-date">{created}</span>}
                    {p.price_range && <span className="post-card-price">{p.price_range}</span>}
                  </div>
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

          {isEventOrganizer && activeSection === 'events' && events.map((ev, i) => {
            const gradientClass = ['post-card-dark-1', 'post-card-dark-2', 'post-card-dark-3'][i % 3]
            const evImage = ev.image || ''
            const when = [ev.start_date, ev.start_time].filter(Boolean).join(' ')

            return (
              <div key={ev.event_uuid} className={`post-card post-card-item ${gradientClass}`}>
                <div className="post-card-top">
                  {evImage ? (
                    <div className="post-card-image">
                      <img src={evImage} alt={ev.event_name || 'Event'} />
                    </div>
                  ) : (
                    <div className="post-card-image-placeholder" />
                  )}
                  <div className="post-card-meta">
                    {when && <span className="post-card-date">{when}</span>}
                    {ev.status && <span className="post-card-price">{ev.status}</span>}
                  </div>
                  <button type="button" className="post-card-update-btn" onClick={() => startEditEvent(ev)} title="Update">
                    Update
                  </button>
                </div>
                <div className="post-card-bottom">
                  <p className="post-card-content">
                    <strong>{ev.event_name || 'Untitled event'}</strong>
                    {ev.venue ? ` · ${ev.venue}` : ''}
                    {ev.event_type ? ` · ${ev.event_type}` : ''}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {!loading && clients.length > 1 && (
        <section className="dash-unified">
          <p>You have more than one profile. Manage them from <Link to="/">Profile</Link>.</p>
        </section>
      )}

      {showFab &&
        createPortal(
          <button
            type="button"
            className="posts-fab"
            onClick={openCreate}
            aria-label={activeSection === 'posts' ? 'Create a post' : 'Create event'}
          >
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>,
          document.body
        )}

      {/* Post compose modal (new post or update) – portaled for correct centering */}
      {activeSection === 'posts' && (showCreate || editingPost) &&
        createPortal(
          <div
            className="post-compose-backdrop"
            onClick={() => {
              setShowCreate(false)
              setEditingPost(null)
              setError('')
            }}
            role="presentation"
          >
            <div
              className="post-compose-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="post-compose-title"
              aria-modal="true"
            >
              <div className="post-compose-header">
                <h2 id="post-compose-title" className="post-compose-title">
                  {editingPost ? 'Update post' : 'New post'}
                </h2>
                <button
                  type="button"
                  className="post-compose-close"
                  onClick={() => { setShowCreate(false); setEditingPost(null); setError(''); }}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={editingPost ? handleUpdatePost : handleCreatePost}
                className="post-compose-form"
              >
                <div className="post-compose-photo">
                  <input
                    ref={editingPost ? editFileInputRef : fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      if (editingPost) setEditImageFile(file)
                      else setImageFile(file)
                    }}
                    id="post-compose-file"
                    className="post-compose-file-input"
                  />
                  <label htmlFor="post-compose-file" className="post-compose-photo-label">
                    {composePhotoPreview ? (
                      <img src={composePhotoPreview} alt="" className="post-compose-photo-preview" />
                    ) : (editingPost?.post_image || editingPost?.image_url) ? (
                      <img
                        src={editingPost.post_image || editingPost.image_url}
                        alt=""
                        className="post-compose-photo-preview"
                      />
                    ) : (
                      <>
                        <span className="post-compose-photo-icon">📷</span>
                        <span className="post-compose-photo-text">Add photo</span>
                      </>
                    )}
                  </label>
                </div>

                <div className="post-compose-field">
                  <label htmlFor="post-compose-desc">What's this about? *</label>
                  <textarea
                    id="post-compose-desc"
                    required
                    rows={4}
                    placeholder="Describe your post..."
                    value={editingPost ? editForm.description : createForm.description}
                    onChange={(e) =>
                      editingPost
                        ? setEditForm((prev) => ({ ...prev, description: e.target.value }))
                        : setCreateForm((p) => ({ ...p, description: e.target.value }))
                    }
                  />
                </div>

                <div className="post-compose-field post-compose-price-wrap">
                  <label htmlFor="post-compose-price">Price (optional)</label>
                  <input
                    id="post-compose-price"
                    type="text"
                    placeholder="e.g. 5–20 BHD"
                    value={editingPost ? editForm.priceRange : createForm.priceRange}
                    onChange={(e) =>
                      editingPost
                        ? setEditForm((prev) => ({ ...prev, priceRange: e.target.value }))
                        : setCreateForm((p) => ({ ...p, priceRange: e.target.value }))
                    }
                  />
                </div>

                <div className="post-compose-actions">
                  <button
                    type="button"
                    className="post-compose-cancel"
                    onClick={() => { setShowCreate(false); setEditingPost(null); setError(''); }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="post-compose-submit" disabled={saving}>
                    {saving ? (editingPost ? 'Saving...' : 'Publishing...') : (editingPost ? 'Save changes' : 'Publish')}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {activeSection === 'events' && (showCreateEvent || editingEvent) &&
        createPortal(
          <div
            className="post-compose-backdrop"
            onClick={() => {
              setShowCreateEvent(false)
              setEditingEvent(null)
              setError('')
            }}
            role="presentation"
          >
            <div
              className="post-compose-modal post-compose-modal-events"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="event-compose-title"
              aria-modal="true"
            >
            <div className="post-compose-header">
              <h2 id="event-compose-title" className="post-compose-title">
                {editingEvent ? 'Update event' : 'New event'}
              </h2>
              <button
                type="button"
                className="post-compose-close"
                onClick={() => { setShowCreateEvent(false); setEditingEvent(null); setError(''); }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={editingEvent ? handleUpdateEvent : handleCreateEvent}
              className="post-compose-form event-compose-form"
            >
              <div className="event-compose-photo post-compose-photo">
                <input
                  ref={editingEvent ? editEventFileInputRef : eventFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    if (editingEvent) setEditEventImageFile(file)
                    else setEventImageFile(file)
                  }}
                  id="event-compose-file"
                  className="post-compose-file-input"
                />
                <label htmlFor="event-compose-file" className="post-compose-photo-label">
                  {eventPhotoPreview ? (
                    <img src={eventPhotoPreview} alt="" className="post-compose-photo-preview" />
                  ) : (editingEvent?.image) ? (
                    <img
                      src={editingEvent.image}
                      alt=""
                      className="post-compose-photo-preview"
                    />
                  ) : (
                    <>
                      <span className="post-compose-photo-icon">📷</span>
                      <span className="post-compose-photo-text">Add photo</span>
                    </>
                  )}
                </label>
              </div>

              <div className="event-compose-field">
                <label htmlFor="event-compose-name">Event name *</label>
                <input
                  id="event-compose-name"
                  type="text"
                  required
                  placeholder="e.g. Summer Concert"
                  value={eventForm.event_name}
                  onChange={(e) => setEventForm((p) => ({ ...p, event_name: e.target.value }))}
                />
              </div>

              <div className="event-compose-field">
                <label htmlFor="event-compose-venue">Venue</label>
                <input
                  id="event-compose-venue"
                  type="text"
                  placeholder="e.g. Bahrain International Circuit"
                  value={eventForm.venue}
                  onChange={(e) => setEventForm((p) => ({ ...p, venue: e.target.value }))}
                />
              </div>

              <div className="event-compose-field">
                <label htmlFor="event-compose-type">Event type</label>
                <input
                  id="event-compose-type"
                  type="text"
                  placeholder="e.g. music, expo, sports"
                  value={eventForm.event_type}
                  onChange={(e) => setEventForm((p) => ({ ...p, event_type: e.target.value }))}
                />
              </div>

              <div className="event-compose-field">
                <label htmlFor="event-compose-indoor">Indoor / Outdoor</label>
                <select
                  id="event-compose-indoor"
                  value={eventForm.indoor_outdoor}
                  onChange={(e) => setEventForm((p) => ({ ...p, indoor_outdoor: e.target.value }))}
                >
                  <option value="">Select...</option>
                  <option value="indoor">Indoor</option>
                  <option value="outdoor">Outdoor</option>
                </select>
              </div>

              <div className="event-compose-field">
                <label htmlFor="event-compose-status">Status</label>
                <select
                  id="event-compose-status"
                  value={eventForm.status}
                  onChange={(e) => setEventForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="coming_soon">Coming Soon</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="postponed">Postponed</option>
                </select>
              </div>

              <div className="event-compose-field">
                <label>Start date</label>
                <input
                  type="date"
                  value={eventForm.start_date}
                  onChange={(e) => setEventForm((p) => ({ ...p, start_date: e.target.value }))}
                />
              </div>
              <div className="event-compose-field">
                <label>End date</label>
                <input
                  type="date"
                  value={eventForm.end_date}
                  onChange={(e) => setEventForm((p) => ({ ...p, end_date: e.target.value }))}
                />
              </div>
              <div className="event-compose-field">
                <label>Start time</label>
                <input
                  type="time"
                  value={eventForm.start_time}
                  onChange={(e) => setEventForm((p) => ({ ...p, start_time: e.target.value }))}
                />
              </div>
              <div className="event-compose-field">
                <label>End time</label>
                <input
                  type="time"
                  value={eventForm.end_time}
                  onChange={(e) => setEventForm((p) => ({ ...p, end_time: e.target.value }))}
                />
              </div>
              <div className="event-compose-field">
                <label>Latitude</label>
                <input
                  type="text"
                  value={eventForm.lat}
                  onChange={(e) => setEventForm((p) => ({ ...p, lat: e.target.value }))}
                  placeholder="e.g. 26.2285"
                />
              </div>
              <div className="event-compose-field">
                <label>Longitude</label>
                <input
                  type="text"
                  value={eventForm.long}
                  onChange={(e) => setEventForm((p) => ({ ...p, long: e.target.value }))}
                  placeholder="e.g. 50.5860"
                />
              </div>

              <div className="post-compose-actions event-compose-actions">
                <button
                  type="button"
                  className="post-compose-cancel"
                  onClick={() => { setShowCreateEvent(false); setEditingEvent(null); setError(''); }}
                >
                  Cancel
                </button>
                <button type="submit" className="post-compose-submit" disabled={creatingEvent || updatingEvent}>
                  {creatingEvent ? 'Creating...' : updatingEvent ? 'Saving...' : editingEvent ? 'Save changes' : 'Create event'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
        )}
    </div>
  )
}
