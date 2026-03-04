export default function HomeContentNav({ tabs, activeTab, onChange }) {
  return (
    <div className="home-content-nav" role="tablist" aria-label="Home content sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`home-content-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
