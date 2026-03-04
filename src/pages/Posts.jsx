import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getClientsByAccount, getClientFull } from '../lib/clients'
import { getPostsByClient, createPost, updatePost, uploadPostImage } from '../lib/posts'
import { uploadEventImage } from '../lib/profileImages'
import { createEventForClient, updateEventForClient } from '../lib/events'
import HomeContentNav from '../components/HomeContentNav'

const emptyEventForm = () => ({
  event_name: '',
  name: '',
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

export default function Posts() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [posts, setPosts] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [postsLoading, setPostsLoading] = useState(false)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState('posts')
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

  const singleClient = clients.length === 1 ? clients[0] : null
  const clientId = singleClient?.client_a_uuid
  const isEventOrganizer = singleClient?.client_type === 'event_organizer'
  const sectionTabs = isEventOrganizer
    ? [{ id: 'posts', label: 'Posts' }, { id: 'events', label: 'Events' }]
    : [{ id: 'posts', label: 'Posts' }]

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
      name: ev.name || '',
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

  const businessName = singleClient?.business_name || singleClient?.name || 'Your business'

  return (
    <div className="page dashboard-v2 home-posts">
      <section className="dash-hero-v2 dash-hero-posts">
        <div className="dash-hero-v2-pattern" aria-hidden />
        <div className="dash-hero-v2-inner">
          <h1>Posts &amp; Events</h1>
          <p>{businessName} · {activeSection === 'events' ? 'Events' : 'Posts'}</p>
          <Link to="/" className="btn btn-hero btn-outline">Profile</Link>
        </div>
      </section>

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

      <div className="posts-toolbar">
        {activeSection === 'posts' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { setShowCreate(true); setError(''); setCreateForm({ description: '', priceRange: '' }); setImageFile(null); }}
          >
            Create a post
          </button>
        )}
        {isEventOrganizer && activeSection === 'events' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setError('')
              setEditingEvent(null)
              setShowCreateEvent(true)
              setEventImageFile(null)
              if (eventFileInputRef.current) eventFileInputRef.current.value = ''
              setEventForm(emptyEventForm())
            }}
          >
            Create event
          </button>
        )}
      </div>

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
        ((activeSection === 'posts' && (posts.length > 0 || showCreate)) ||
          (activeSection === 'events' && isEventOrganizer && (events.length > 0 || showCreateEvent || !!editingEvent))) && (
        <div className="posts-grid">
          {activeSection === 'events' && showCreateEvent && (
            <div className="post-card post-card-create">
              <form onSubmit={handleCreateEvent} className="post-create-form">
                <h3>New Event</h3>
                <label>
                  Event name *
                  <input
                    type="text"
                    value={eventForm.event_name}
                    onChange={(e) => setEventForm((p) => ({ ...p, event_name: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Display name
                  <input
                    type="text"
                    value={eventForm.name}
                    onChange={(e) => setEventForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Optional"
                  />
                </label>
                <label>
                  Event type
                  <input
                    type="text"
                    value={eventForm.event_type}
                    onChange={(e) => setEventForm((p) => ({ ...p, event_type: e.target.value }))}
                    placeholder="e.g. music, expo, sports"
                  />
                </label>
                <label>
                  Indoor / Outdoor
                  <select
                    value={eventForm.indoor_outdoor}
                    onChange={(e) => setEventForm((p) => ({ ...p, indoor_outdoor: e.target.value }))}
                  >
                    <option value="">Select...</option>
                    <option value="indoor">Indoor</option>
                    <option value="outdoor">Outdoor</option>
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={eventForm.status}
                    onChange={(e) => setEventForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="coming_soon">Coming Soon</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="postponed">Postponed</option>
                  </select>
                </label>
                <label>
                  Venue
                  <input
                    type="text"
                    value={eventForm.venue}
                    onChange={(e) => setEventForm((p) => ({ ...p, venue: e.target.value }))}
                  />
                </label>
                <label>
                  Image
                  <input
                    ref={eventFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => setEventImageFile(e.target.files?.[0] || null)}
                  />
                  {eventImageFile && <span className="file-name">{eventImageFile.name}</span>}
                </label>
                <div className="event-datetime-row">
                  <label>
                    Start date
                    <input
                      type="date"
                      value={eventForm.start_date}
                      onChange={(e) => setEventForm((p) => ({ ...p, start_date: e.target.value }))}
                    />
                  </label>
                  <label>
                    End date
                    <input
                      type="date"
                      value={eventForm.end_date}
                      onChange={(e) => setEventForm((p) => ({ ...p, end_date: e.target.value }))}
                    />
                  </label>
                </div>
                <div className="event-datetime-row">
                  <label>
                    Start time
                    <input
                      type="time"
                      value={eventForm.start_time}
                      onChange={(e) => setEventForm((p) => ({ ...p, start_time: e.target.value }))}
                    />
                  </label>
                  <label>
                    End time
                    <input
                      type="time"
                      value={eventForm.end_time}
                      onChange={(e) => setEventForm((p) => ({ ...p, end_time: e.target.value }))}
                    />
                  </label>
                </div>
                <div className="event-datetime-row">
                  <label>
                    Latitude
                    <input
                      type="text"
                      value={eventForm.lat}
                      onChange={(e) => setEventForm((p) => ({ ...p, lat: e.target.value }))}
                      placeholder="e.g. 26.2285"
                    />
                  </label>
                  <label>
                    Longitude
                    <input
                      type="text"
                      value={eventForm.long}
                      onChange={(e) => setEventForm((p) => ({ ...p, long: e.target.value }))}
                      placeholder="e.g. 50.5860"
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={creatingEvent}>
                    {creatingEvent ? 'Creating...' : 'Create event'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setShowCreateEvent(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
          {activeSection === 'posts' && showCreate && (
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
          {activeSection === 'posts' && posts.map((p, i) => {
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

          {isEventOrganizer && activeSection === 'events' && events.map((ev, i) => {
            const gradientClass = ['gradient-purple', 'gradient-green', 'gradient-orange'][i % 3]
            const evImage = ev.image || ''
            const when = [ev.start_date, ev.start_time].filter(Boolean).join(' ')
            const isEditing = editingEvent?.event_uuid === ev.event_uuid

            if (isEditing) {
              return (
                <div key={ev.event_uuid} className="post-card post-card-create">
                  <form onSubmit={handleUpdateEvent} className="post-create-form">
                    <h3>Update Event</h3>
                    <label>
                      Event name *
                      <input type="text" value={eventForm.event_name} onChange={(e) => setEventForm((p) => ({ ...p, event_name: e.target.value }))} required />
                    </label>
                    <label>
                      Display name
                      <input type="text" value={eventForm.name} onChange={(e) => setEventForm((p) => ({ ...p, name: e.target.value }))} />
                    </label>
                    <label>
                      Event type
                      <input type="text" value={eventForm.event_type} onChange={(e) => setEventForm((p) => ({ ...p, event_type: e.target.value }))} />
                    </label>
                    <label>
                      Indoor / Outdoor
                      <select value={eventForm.indoor_outdoor} onChange={(e) => setEventForm((p) => ({ ...p, indoor_outdoor: e.target.value }))}>
                        <option value="">Select...</option>
                        <option value="indoor">Indoor</option>
                        <option value="outdoor">Outdoor</option>
                      </select>
                    </label>
                    <label>
                      Status
                      <select value={eventForm.status} onChange={(e) => setEventForm((p) => ({ ...p, status: e.target.value }))}>
                        <option value="coming_soon">Coming Soon</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="postponed">Postponed</option>
                      </select>
                    </label>
                    <label>
                      Venue
                      <input type="text" value={eventForm.venue} onChange={(e) => setEventForm((p) => ({ ...p, venue: e.target.value }))} />
                    </label>
                    <label>
                      Image
                      <input ref={editEventFileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setEditEventImageFile(e.target.files?.[0] || null)} />
                      {editEventImageFile && <span className="file-name">{editEventImageFile.name}</span>}
                      {!editEventImageFile && evImage && <span className="file-name">Current image</span>}
                    </label>
                    <div className="event-datetime-row">
                      <label>Start date<input type="date" value={eventForm.start_date} onChange={(e) => setEventForm((p) => ({ ...p, start_date: e.target.value }))} /></label>
                      <label>End date<input type="date" value={eventForm.end_date} onChange={(e) => setEventForm((p) => ({ ...p, end_date: e.target.value }))} /></label>
                    </div>
                    <div className="event-datetime-row">
                      <label>Start time<input type="time" value={eventForm.start_time} onChange={(e) => setEventForm((p) => ({ ...p, start_time: e.target.value }))} /></label>
                      <label>End time<input type="time" value={eventForm.end_time} onChange={(e) => setEventForm((p) => ({ ...p, end_time: e.target.value }))} /></label>
                    </div>
                    <div className="event-datetime-row">
                      <label>Latitude<input type="text" value={eventForm.lat} onChange={(e) => setEventForm((p) => ({ ...p, lat: e.target.value }))} placeholder="e.g. 26.2285" /></label>
                      <label>Longitude<input type="text" value={eventForm.long} onChange={(e) => setEventForm((p) => ({ ...p, long: e.target.value }))} placeholder="e.g. 50.5860" /></label>
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn btn-primary" disabled={updatingEvent}>{updatingEvent ? 'Saving...' : 'Save'}</button>
                      <button type="button" className="btn btn-outline" onClick={() => { setEditingEvent(null); setError('') }}>Cancel</button>
                    </div>
                  </form>
                </div>
              )
            }

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
                  {when && <span className="post-card-date">{when}</span>}
                  {ev.status && <span className="post-card-price">{ev.status}</span>}
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
    </div>
  )
}
