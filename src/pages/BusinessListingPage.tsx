import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import type { LucideIcon } from 'lucide-react'
import {
  BadgeDollarSign,
  Clock,
  Fish,
  Flame,
  MapPin,
  Moon,
  Navigation,
  Sparkles,
  Sun,
  UtensilsCrossed,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useGbTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { fadeUp } from '@/lib/motion'
import { cn } from '@/lib/utils'

const BUSINESS = {
  name: 'pink salt grills',
  category: 'Restaurant',
  summary:
    'A warm, charcoal-forward kitchen celebrating Filipino comfort and Asian grill classics — from smoky chicken to hearty lomi and tikka-style skewers. Designed for slow evenings, quick lunches, and everything between.',
  hours: '12:30 – 02:00',
  cuisine: 'Filipino, Asian',
  price: '3–7 BHD',
  meals: 'Breakfast, Lunch, Dinner, Snack',
  speciality: 'Charcoal Chicken and Lomi Tikka',
  foodType:
    'Non-Vegetarian, Vegetarian, Vegan, Seafood, BBQ / Grilled, Fast Food, Street Food',
  location: 'Manama, Bahrain',
  tags: ['#filipino', '#asian', '#tasty', '#delicious'],
  qrValue: 'https://gobahrain.app/listing/pink-salt-grills',
}

const MENU_IMAGES = [
  'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80',
]

const MARQUEE =
  'GO BAHRAIN • PINK SALT GRILLS • RESTAURANT • MANAMA • GO BAHRAIN • PINK SALT GRILLS • RESTAURANT • MANAMA • '

function titleCase(input: string) {
  return input
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')
}

function ListingNavLink({ to, end, children }: { to: string; end?: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative rounded-gb px-3 py-2 text-[0.95rem] font-medium transition-colors duration-200',
          isActive
            ? 'text-[var(--color-primary)] after:absolute after:left-3 after:right-3 after:bottom-1 after:h-[2px] after:rounded-full after:bg-[var(--color-primary)] after:shadow-[0_0_16px_rgba(234,179,8,0.35)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
        )
      }
    >
      {children}
    </NavLink>
  )
}

export default function BusinessListingPage() {
  const { theme, toggleTheme } = useGbTheme()
  const { user, logout } = useAuth()
  const reducedMotion = useReducedMotion()
  const [qrOpen, setQrOpen] = useState(false)
  const listingName = titleCase(BUSINESS.name)

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.9]"
        aria-hidden
        style={{
          background:
            theme === 'dark'
              ? 'radial-gradient(ellipse 80% 55% at 12% 0%, rgba(212,175,55,0.12) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 92% 8%, rgba(56,189,248,0.06) 0%, transparent 48%), linear-gradient(180deg, #070a10 0%, var(--color-bg) 42%)'
              : 'radial-gradient(ellipse 80% 55% at 10% 0%, rgba(184,134,11,0.12) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 92% 6%, rgba(14,165,233,0.06) 0%, transparent 48%), linear-gradient(180deg, #fdfcfa 0%, var(--color-bg) 45%)',
        }}
      />

      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_78%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-[58px] max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="font-heading text-lg font-bold tracking-tight text-[var(--color-text)] transition-colors hover:text-[var(--color-primary)] sm:text-xl"
          >
            GoBahrain
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
            <ListingNavLink to="/" end>
              Home
            </ListingNavLink>
            {user ? (
              <>
                <ListingNavLink to="/edit">Edit</ListingNavLink>
                <ListingNavLink to="/posts">Posts</ListingNavLink>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="rounded-gb px-3 py-2 text-[0.95rem] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)]"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <ListingNavLink to="/signin">Sign in</ListingNavLink>
                <ListingNavLink to="/signup">Sign up</ListingNavLink>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="ml-1 h-9 w-9 shrink-0 border-[var(--color-border-strong)]"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="relative" aria-labelledby="listing-title">
          <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start lg:gap-12">
            <motion.div {...(reducedMotion ? {} : fadeUp(0))} className="text-center lg:text-left">
              <div className="mb-6 flex justify-center lg:justify-start">
                <div
                  className={cn(
                    'flex h-20 w-20 items-center justify-center rounded-full border shadow-gb-card sm:h-24 sm:w-24',
                    theme === 'dark'
                      ? 'border-[color-mix(in_srgb,var(--color-primary)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-surface)_70%,transparent)] shadow-[0_0_40px_rgba(234,179,8,0.12)]'
                      : 'border-[var(--color-border-strong)] bg-[var(--color-surface)]',
                  )}
                >
                  <span className="font-heading text-2xl font-extrabold tracking-tight text-[var(--color-primary)] sm:text-3xl">
                    PS
                  </span>
                </div>
              </div>
              <h1
                id="listing-title"
                className="font-heading text-[clamp(2.5rem,6vw,4.25rem)] font-extrabold leading-[0.98] tracking-[-0.04em] text-[var(--color-text)]"
              >
                {listingName}
              </h1>
              <p className="mt-4 inline-flex items-center justify-center rounded-full border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_65%,transparent)] px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)] backdrop-blur-md lg:justify-start">
                {BUSINESS.category}
              </p>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-[var(--color-text-muted)] lg:mx-0 lg:text-lg">
                {BUSINESS.summary}
              </p>

              {/* Mobile: share QR in a modal instead of a giant side card */}
              <div className="mt-7 flex justify-center lg:hidden lg:justify-start">
                <Button type="button" variant="default" size="lg" onClick={() => setQrOpen(true)}>
                  Scan / Share
                </Button>
              </div>
            </motion.div>

            <motion.div
              {...(reducedMotion ? {} : fadeUp(0.08))}
              className="mx-auto hidden w-full max-w-[260px] lg:mx-0 lg:block lg:max-w-none lg:justify-self-end"
            >
              <div
                className={cn(
                  'rounded-gb-xl border p-5 shadow-gb-card backdrop-blur-xl',
                  theme === 'dark'
                    ? 'border-[color-mix(in_srgb,var(--color-primary)_22%,var(--color-border))] bg-[color-mix(in_srgb,#0c1018_82%,transparent)]'
                    : 'border-[var(--color-border-strong)] bg-[var(--color-surface)]',
                )}
              >
                <p className="text-center text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                  Scan to share
                </p>
                <div className="mt-4 flex justify-center rounded-gb-lg bg-white p-3">
                  <QRCodeSVG value={BUSINESS.qrValue} size={168} level="M" includeMargin={false} />
                </div>
                <p className="mt-3 text-center text-xs text-[var(--color-text-faint,var(--color-text-muted))]">
                  Guest-ready link for your listing
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* QR modal (mobile + optional desktop use) */}
        {qrOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Listing QR code"
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            onClick={() => setQrOpen(false)}
          >
            <div
              className={cn(
                'w-full max-w-[420px] rounded-gb-xl border p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)]',
                theme === 'dark'
                  ? 'border-[color-mix(in_srgb,var(--color-primary)_22%,var(--color-border))] bg-[color-mix(in_srgb,#0c1018_92%,transparent)]'
                  : 'border-[var(--color-border-strong)] bg-[var(--color-surface)]',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                Scan to share
              </p>
              <p className="mt-2 text-center font-heading text-xl font-extrabold tracking-tight text-[var(--color-text)]">
                {listingName}
              </p>
              <div className="mt-5 flex justify-center rounded-gb-lg bg-white p-3">
                <QRCodeSVG value={BUSINESS.qrValue} size={220} level="M" includeMargin={false} />
              </div>
              <p className="mt-3 text-center text-sm text-[var(--color-text-muted)]">
                Open the guest listing on any phone.
              </p>
              <div className="mt-6 flex justify-center">
                <Button type="button" variant="outline" size="lg" onClick={() => setQrOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Marquee */}
        <motion.div
          {...(reducedMotion ? {} : fadeUp(0.12))}
          className="relative mt-12 overflow-hidden border-y border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_55%,transparent)] py-3 backdrop-blur-md"
          aria-hidden
        >
          <div className="flex w-max animate-gb-listing-marquee whitespace-nowrap font-heading text-sm font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)]">
            <span className="pr-16">{MARQUEE}</span>
            <span className="pr-16">{MARQUEE}</span>
          </div>
        </motion.div>

        {/* Highlights — asymmetric */}
        <section className="relative mt-16 sm:mt-20" aria-labelledby="highlights-heading">
          <div className="mb-10 flex flex-col gap-3 text-center sm:text-left">
            <motion.p
              {...(reducedMotion ? {} : fadeUp(0))}
              id="highlights-heading"
              className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--color-primary)]"
            >
              Highlights
            </motion.p>
            <motion.h2
              {...(reducedMotion ? {} : fadeUp(0.05))}
              className="font-heading text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl"
            >
              Crafted like an editorial spread
            </motion.h2>
          </div>

          <div className="relative mx-auto max-w-5xl">
            <div className="grid gap-4 sm:grid-cols-12 sm:gap-5">
              <motion.article
                {...(reducedMotion ? {} : fadeUp(0.06))}
                className={cn(
                  'relative overflow-hidden rounded-gb-xl border p-6 sm:col-span-7 sm:row-span-2 sm:p-8',
                  theme === 'dark'
                    ? 'border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_78%,transparent)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]'
                    : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[0_18px_50px_rgba(0,0,0,0.06)]',
                )}
              >
                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
                  style={{
                    background:
                      theme === 'dark'
                        ? 'radial-gradient(circle, rgba(234,179,8,0.18) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(184,134,11,0.2) 0%, transparent 70%)',
                  }}
                />
                <h3 className="font-heading text-xl font-bold text-[var(--color-text)]">In your words</h3>
                <p className="relative z-[1] mt-4 text-pretty leading-relaxed text-[var(--color-text-muted)]">
                  {BUSINESS.summary}
                </p>
              </motion.article>

              <motion.div
                {...(reducedMotion ? {} : fadeUp(0.1))}
                className="relative z-[2] flex items-center justify-center sm:col-span-5 sm:col-start-8 sm:row-start-1"
              >
                <div
                  className={cn(
                    'flex h-28 w-28 flex-col items-center justify-center rounded-full border text-center shadow-gb-glow sm:h-40 sm:w-40 lg:h-44 lg:w-44',
                    theme === 'dark'
                      ? 'border-[color-mix(in_srgb,var(--color-primary)_45%,var(--color-border))] bg-[color-mix(in_srgb,#0a0f18_90%,transparent)] backdrop-blur-md'
                      : 'border-[var(--color-border-strong)] bg-[color-mix(in_srgb,var(--color-surface)_95%,transparent)]',
                  )}
                >
                  <Sparkles className="mb-2 h-5 w-5 text-[var(--color-primary)]" aria-hidden />
                  <span className="max-w-[10rem] font-heading text-sm font-bold leading-snug tracking-tight text-[var(--color-text)]">
                    What your listing says
                  </span>
                </div>
              </motion.div>

              <div className="grid gap-4 sm:col-span-5 sm:col-start-8 sm:row-start-2 sm:grid-cols-2 sm:gap-3">
                <HighlightMini icon={Clock} label="Opening Hours" value={BUSINESS.hours} delay={0} />
                <HighlightMini icon={UtensilsCrossed} label="Cuisine" value={BUSINESS.cuisine} delay={0.02} />
                <HighlightMini icon={BadgeDollarSign} label="Price Range" value={BUSINESS.price} delay={0.04} />
                <HighlightMini icon={Flame} label="Meal Type" value={BUSINESS.meals} delay={0.06} />
                <HighlightMini icon={Sparkles} label="Speciality" value={BUSINESS.speciality} delay={0.08} />
                <HighlightMini icon={Fish} label="Food Type" value={BUSINESS.foodType} delay={0.1} />
              </div>
            </div>
          </div>
        </section>

        {/* Structured details */}
        <section className="mt-20 sm:mt-24" aria-labelledby="details-heading">
          <motion.div {...(reducedMotion ? {} : fadeUp(0))} className="mb-10 text-center sm:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--color-primary)]">Details</p>
            <h2
              id="details-heading"
              className="mt-2 font-heading text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl"
            >
              Opening Hours, Pricing &amp; More
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[var(--color-text-muted)] sm:mx-0">
              Everything a visitor skims first — structured, scannable, and unmistakably Go Bahrain.
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailCard icon={BadgeDollarSign} label="Price Range" value={BUSINESS.price} delay={0.05} />
            <DetailCard icon={Clock} label="Hours" value={BUSINESS.hours} delay={0.08} />
            <DetailCard icon={UtensilsCrossed} label="Cuisine" value={BUSINESS.cuisine} delay={0.11} />
            <DetailCard icon={Flame} label="Meal Type" value={BUSINESS.meals} delay={0.14} />
            <DetailCard icon={Fish} label="Food Type" value={BUSINESS.foodType} delay={0.17} />
            <DetailCard icon={Sparkles} label="Speciality" value={BUSINESS.speciality} delay={0.2} />
          </div>
        </section>

        {/* Gallery */}
        <section className="mt-20 sm:mt-24" aria-labelledby="gallery-heading">
          <motion.div
            {...(reducedMotion ? {} : fadeUp(0))}
            className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--color-primary)]">Gallery</p>
              <h2
                id="gallery-heading"
                className="mt-2 font-heading text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl"
              >
                Menu Highlights
              </h2>
              <p className="mt-2 max-w-xl text-[var(--color-text-muted)]">Your latest posts — hover to explore.</p>
            </div>
            <Button asChild variant="default" size="lg" className="shrink-0 self-start sm:self-auto">
              <Link to="/posts">+ Create Post</Link>
            </Button>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MENU_IMAGES.map((src, i) => (
              <motion.figure
                key={src}
                {...(reducedMotion ? {} : fadeUp(0.05 + i * 0.04))}
                className="group relative overflow-hidden rounded-gb-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-gb-card"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={src}
                    alt=""
                    className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]"
                    loading="lazy"
                  />
                </div>
                <figcaption
                  className={cn(
                    'pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-4 opacity-0 transition duration-500 group-hover:opacity-100',
                  )}
                >
                  <span className="text-sm font-semibold text-white">Chef&apos;s pick {i + 1}</span>
                  <span className="text-xs text-white/80">Fresh from your feed</span>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </section>

        {/* Tags */}
        <section className="mt-20 sm:mt-24" aria-labelledby="tags-heading">
          <motion.div {...(reducedMotion ? {} : fadeUp(0))} className="mb-8 max-w-2xl">
            <h2 id="tags-heading" className="font-heading text-3xl font-bold tracking-tight text-[var(--color-text)]">
              How visitors find you
            </h2>
            <p className="mt-3 text-[var(--color-text-muted)]">
              Discovery tags mirror how guests search — keep them honest, appetizing, and on-brand.
            </p>
          </motion.div>
          <motion.ul
            {...(reducedMotion ? {} : fadeUp(0.08))}
            className="flex flex-wrap gap-3"
          >
            {BUSINESS.tags.map((tag) => (
              <li key={tag}>
                <span
                  className={cn(
                    'inline-flex rounded-full border px-4 py-2 text-sm font-semibold tracking-wide transition',
                    theme === 'dark'
                      ? 'border-[color-mix(in_srgb,var(--color-primary)_40%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-[var(--color-text)] hover:border-[var(--color-primary)]'
                      : 'border-[color-mix(in_srgb,var(--color-primary)_35%,var(--color-border-strong))] bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] text-[var(--color-text)] hover:border-[var(--color-primary)]',
                  )}
                >
                  {tag}
                </span>
              </li>
            ))}
          </motion.ul>
        </section>

        {/* Location */}
        <section className="mt-20 sm:mt-24" aria-labelledby="location-heading">
          <motion.h2
            {...(reducedMotion ? {} : fadeUp(0))}
            id="location-heading"
            className="mb-8 font-heading text-3xl font-bold tracking-tight text-[var(--color-text)] sm:text-4xl"
          >
            Where to find us
          </motion.h2>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-stretch">
            <motion.div
              {...(reducedMotion ? {} : fadeUp(0.06))}
              className={cn(
                'relative min-h-[280px] overflow-hidden rounded-gb-xl border shadow-gb-card lg:min-h-[320px]',
                theme === 'dark'
                  ? 'border-[var(--color-border)] bg-[color-mix(in_srgb,#0b1018_90%,transparent)]'
                  : 'border-[var(--color-border-strong)] bg-[var(--color-surface)]',
              )}
            >
              <iframe
                title="Map — Manama, Bahrain"
                className="absolute inset-0 h-full w-full border-0 grayscale-[20%] contrast-[1.05]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src="https://www.openstreetmap.org/export/embed.html?bbox=50.552%2C26.208%2C50.598%2C26.248&amp;layer=mapnik"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] via-transparent to-transparent" />
            </motion.div>
            <motion.div
              {...(reducedMotion ? {} : fadeUp(0.1))}
              className={cn(
                'flex flex-col justify-between rounded-gb-xl border p-8 shadow-gb-card backdrop-blur-md',
                theme === 'dark'
                  ? 'border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_75%,transparent)]'
                  : 'border-[var(--color-border-strong)] bg-[var(--color-surface)]',
              )}
            >
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  <MapPin className="h-3.5 w-3.5 text-[var(--color-primary)]" aria-hidden />
                  Location
                </div>
                <p className="mt-6 font-heading text-2xl font-bold tracking-tight text-[var(--color-text)]">
                  {BUSINESS.location}
                </p>
                <p className="mt-3 text-[var(--color-text-muted)]">
                  Set expectations before guests arrive — island traffic, parking, and the best time to visit.
                </p>
              </div>
              <a
                href="https://www.openstreetmap.org/search?query=Manama%2C%20Bahrain"
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] transition hover:gap-3"
              >
                Get directions
                <Navigation className="h-4 w-4" aria-hidden />
              </a>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="relative z-[1] border-t border-[var(--color-border)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-[var(--color-text-muted)] sm:flex-row sm:px-6 lg:px-8">
          <p>© 2026 GoBahrain. All rights reserved.</p>
          <nav className="flex flex-wrap items-center justify-center gap-6">
            <a className="transition hover:text-[var(--color-primary)]" href="#" onClick={(e) => e.preventDefault()}>
              Privacy
            </a>
            <a className="transition hover:text-[var(--color-primary)]" href="#" onClick={(e) => e.preventDefault()}>
              Terms
            </a>
            <a className="transition hover:text-[var(--color-primary)]" href="#" onClick={(e) => e.preventDefault()}>
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}

function HighlightMini({
  icon: Icon,
  label,
  value,
  delay,
}: {
  icon: LucideIcon
  label: string
  value: string
  delay: number
}) {
  const reducedMotion = useReducedMotion()
  const { theme } = useGbTheme()
  return (
    <motion.div
      {...(reducedMotion ? {} : fadeUp(delay))}
      className={cn(
        'rounded-gb-lg border p-4 backdrop-blur-md transition duration-300 hover:-translate-y-0.5',
        theme === 'dark'
          ? 'border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_82%,transparent)] hover:border-[color-mix(in_srgb,var(--color-primary)_35%,var(--color-border))]'
          : 'border-[var(--color-border-strong)] bg-[color-mix(in_srgb,var(--color-surface)_96%,transparent)] hover:border-[color-mix(in_srgb,var(--color-primary)_45%,var(--color-border-strong))]',
      )}
    >
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-snug text-[var(--color-text)]">{value}</p>
      <Icon className="mt-3 h-4 w-4 text-[var(--color-primary)]" aria-hidden />
    </motion.div>
  )
}

function DetailCard({
  icon: Icon,
  label,
  value,
  delay,
}: {
  icon: LucideIcon
  label: string
  value: string
  delay: number
}) {
  const reducedMotion = useReducedMotion()
  const { theme } = useGbTheme()
  return (
    <motion.article
      {...(reducedMotion ? {} : fadeUp(delay))}
      className={cn(
        'flex gap-4 rounded-gb-xl border p-5 shadow-gb-card transition duration-300 hover:-translate-y-0.5',
        theme === 'dark'
          ? 'border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_78%,transparent)] hover:border-[color-mix(in_srgb,var(--color-primary)_28%,var(--color-border))]'
          : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:border-[color-mix(in_srgb,var(--color-primary)_35%,var(--color-border-strong))]',
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-gb border border-[color-mix(in_srgb,var(--color-primary)_35%,var(--color-border))] bg-[var(--color-primary-muted)] text-[var(--color-primary)]">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</h3>
        <p className="mt-2 text-base font-semibold leading-snug text-[var(--color-text)]">{value}</p>
      </div>
    </motion.article>
  )
}
