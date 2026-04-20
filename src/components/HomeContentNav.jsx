import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'

export default function HomeContentNav({ tabs, activeTab, onChange }) {
  const reduced = useReducedMotion()

  return (
    <LayoutGroup id="home-content-nav">
      <div className="home-content-nav" role="tablist" aria-label="Home content sections">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`home-content-nav-btn ${isActive ? 'active' : ''}`}
              data-reduced-motion={reduced ? 'true' : undefined}
              onClick={() => onChange(tab.id)}
            >
              {isActive && !reduced && (
                <motion.span
                  layoutId="home-content-nav-pill"
                  className="home-content-nav-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  aria-hidden
                />
              )}
              <span className="home-content-nav-label">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}
