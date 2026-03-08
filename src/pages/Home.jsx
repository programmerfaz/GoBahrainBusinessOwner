import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Profile from './Profile'

export default function Home() {
  const { user } = useAuth()

  if (user) {
    return <Profile mode="dashboard" />
  }

  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="landing-hero-content">
          <span className="landing-badge">Kingdom of Bahrain</span>
          <h1>Showcase Your Business in Bahrain</h1>
          <p>Join Go Bahrain and connect your restaurant, venue, or event with thousands of visitors exploring the island.</p>
          <div className="landing-cta">
            <Link to="/signup" className="btn btn-primary btn-lg">Get Started Free</Link>
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="hero-card hero-card-1">
            <div className="hero-card-icon"><LandingIcon kind="restaurant" /></div>
            <span>Restaurants</span>
          </div>
          <div className="hero-card hero-card-2">
            <div className="hero-card-icon"><LandingIcon kind="place" /></div>
            <span>Places</span>
          </div>
          <div className="hero-card hero-card-3">
            <div className="hero-card-icon"><LandingIcon kind="event" /></div>
            <span>Events</span>
          </div>
        </div>
      </section>

      <section className="landing-about">
        <h2>About Go Bahrain</h2>
        <p className="landing-about-lead">
          Go Bahrain is the Tourism &amp; Business Platform for the Kingdom of Bahrain. We help visitors discover the best of the island and help business owners reach them.
        </p>
        <ul className="landing-about-list">
          <li><strong>For visitors</strong> — Find restaurants, places, and events across Bahrain in one place.</li>
          <li><strong>For business owners</strong> — Create a profile, publish posts, and get discovered by tourists and locals.</li>
        </ul>
      </section>

      <section className="landing-features">
        <div className="feature-card">
          <div className="feature-icon"><LandingIcon kind="pin" /></div>
          <h3>Create Your Profile</h3>
          <p>Set up your restaurant, place, or event with rich details, images, and pricing.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><LandingIcon kind="post" /></div>
          <h3>Publish Posts</h3>
          <p>Share updates, promotions, and images to attract more visitors.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon"><LandingIcon kind="globe" /></div>
          <h3>Reach Tourists</h3>
          <p>Your business gets discovered by travelers looking for the best of Bahrain.</p>
        </div>
      </section>
    </div>
  )
}
function LandingIcon({ kind }) {
  if (kind === 'restaurant') {
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
        <path d="M7 2v7a2 2 0 0 0 2 2v11M3 2v4m2-4v4m2-4v4M17 2v8a2 2 0 0 1-2 2h-1v10m5-20v20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'place') {
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
        <path d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  }
  if (kind === 'event') {
    return (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 3v4m8-4v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'pin') {
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
        <path d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  }
  if (kind === 'post') {
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

