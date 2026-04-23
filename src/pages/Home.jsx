import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import Profile from './Profile'

const easeOut = [0.22, 1, 0.36, 1]

function useReveal(delay = 0) {
  return {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-40px' },
    transition: { duration: 0.55, delay, ease: easeOut },
  }
}

export default function Home() {
  const { user } = useAuth()

  if (user) {
    return <Profile mode="dashboard" />
  }

  return (
    <div className="gb-home">
      <section className="gb-home-hero" aria-labelledby="gb-home-hero-title">
        <div className="gb-home-hero-bg" aria-hidden="true" />
        <div className="gb-home-hero-grid">
          <motion.div className="gb-home-hero-copy" {...useReveal(0)}>
            <span className="gb-home-kicker">
              <span className="gb-home-kicker-dot" aria-hidden />
              Kingdom of Bahrain
            </span>
            <h1 id="gb-home-hero-title" className="gb-home-title">
              <span className="gb-home-title-line">Showcase your</span>
              <span className="gb-home-title-accent">business</span>
              <span className="gb-home-title-line">on the island</span>
            </h1>
            <p className="gb-home-lead">
              Join SiyahaBH and connect your restaurant, venue, or event with visitors and locals exploring the Kingdom.
            </p>
            <div className="gb-home-actions">
              <Link to="/signup" className="btn btn-primary btn-lg gb-home-btn-primary">Get started free</Link>
              <Link to="/signin" className="btn btn-outline btn-lg gb-home-btn-ghost">Sign in</Link>
            </div>
            <ul className="gb-home-trust" aria-label="Highlights">
              <li>Profile &amp; media</li>
              <li>Posts &amp; updates</li>
              <li>Discovery-ready</li>
            </ul>
            <p className="gb-home-sample-listing">
              <Link to="/listing/pink-salt-grills" className="gb-home-sample-listing-link">
                See sample restaurant listing
              </Link>
            </p>
          </motion.div>

          <motion.div className="gb-home-bento" {...useReveal(0.08)}>
            <div className="gb-home-bento-card gb-home-bento-main">
              <div className="gb-home-bento-glow" aria-hidden />
              <div className="gb-home-bento-icon"><LandingIcon kind="restaurant" /></div>
              <div>
                <span className="gb-home-bento-label">Restaurants</span>
                <p className="gb-home-bento-desc">Menus, hours, cuisine &amp; specials in one polished listing.</p>
              </div>
            </div>
            <div className="gb-home-bento-card">
              <div className="gb-home-bento-icon"><LandingIcon kind="place" /></div>
              <span className="gb-home-bento-label">Places</span>
              <p className="gb-home-bento-desc">Attractions &amp; venues with maps and visitor context.</p>
            </div>
            <div className="gb-home-bento-card">
              <div className="gb-home-bento-icon"><LandingIcon kind="event" /></div>
              <span className="gb-home-bento-label">Events</span>
              <p className="gb-home-bento-desc">Dates, venue, and status for organizers on the go.</p>
            </div>
            <div className="gb-home-bento-strip" aria-hidden="true">
              <span>SiyahaBH</span>
              <span className="gb-home-strip-sep">◆</span>
              <span>Tourism &amp; business</span>
              <span className="gb-home-strip-sep">◆</span>
              <span>One platform</span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="gb-home-marquee" aria-hidden="true">
        <div className="gb-home-marquee-track">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="gb-home-marquee-item">
              Manama · Saar · Riffa · Amwaj · Juffair · Bahrain Bay ·
            </span>
          ))}
        </div>
      </section>

      <section className="gb-home-about" aria-labelledby="gb-home-about-title">
        <motion.div className="gb-home-about-inner" {...useReveal(0)}>
          <p className="gb-home-section-eyebrow" id="gb-home-about-title">About</p>
          <h2 className="gb-home-section-title">Built for discovery on the island</h2>
          <p className="gb-home-about-lead">
            Go Bahrain is the tourism and business platform for the Kingdom of Bahrain. We help visitors find great experiences and help owners present them beautifully.
          </p>
          <div className="gb-home-pill-row">
            <span className="gb-home-pill">Visitors</span>
            <span className="gb-home-pill">Owners</span>
            <span className="gb-home-pill">Search-ready</span>
          </div>
          <ul className="gb-home-about-list">
            <li>
              <strong>For visitors</strong>
              <span>Restaurants, places, and events in one place — clear hours, pricing cues, and maps.</span>
            </li>
            <li>
              <strong>For business owners</strong>
              <span>Profiles, posts, and imagery that feel premium without a heavy setup.</span>
            </li>
          </ul>
        </motion.div>
      </section>

      <section className="gb-home-features" aria-labelledby="gb-home-features-title">
        <motion.div className="gb-home-features-head" {...useReveal(0)}>
          <p className="gb-home-section-eyebrow" id="gb-home-features-title">Product</p>
          <h2 className="gb-home-section-title">Everything you need to stand out</h2>
        </motion.div>
        <div className="gb-home-feature-grid">
          <motion.article className="gb-home-feature gb-home-feature-wide" {...useReveal(0.05)}>
            <div className="gb-home-feature-icon"><LandingIcon kind="pin" /></div>
            <h3>Rich profiles</h3>
            <p>Hours, pricing, cuisine, locations, and imagery — structured so guests skim fast and book faster.</p>
          </motion.article>
          <motion.article className="gb-home-feature" {...useReveal(0.1)}>
            <div className="gb-home-feature-icon"><LandingIcon kind="post" /></div>
            <h3>Posts &amp; highlights</h3>
            <p>Share specials, new dishes, and event updates in a feed that feels like your brand.</p>
          </motion.article>
          <motion.article className="gb-home-feature" {...useReveal(0.14)}>
            <div className="gb-home-feature-icon"><LandingIcon kind="globe" /></div>
            <h3>Tourist-ready</h3>
            <p>Language-friendly layout and emphasis on what travelers need first: where, when, and what it costs.</p>
          </motion.article>
        </div>
      </section>

      <section className="gb-home-bottom-cta" aria-label="Call to action">
        <motion.div className="gb-home-bottom-inner" {...useReveal(0)}>
          <h2 className="gb-home-bottom-title">Ready to go live?</h2>
          <p className="gb-home-bottom-text">Create your free account and publish your first profile in minutes.</p>
          <Link to="/signup" className="btn btn-primary btn-lg">Create free account</Link>
        </motion.div>
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

