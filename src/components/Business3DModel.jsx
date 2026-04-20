function AnimatedIcon({ type }) {
  const icons = {
    restaurant: (
      <svg viewBox="0 0 100 100" className="model-icon">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        <path d="M30 35 L30 65 M35 35 L35 50 C35 55 40 55 40 50 L40 35 M50 35 L50 65 M70 35 L70 65 M60 45 C60 40 75 40 75 45 L75 50 C75 55 60 55 60 50 Z" 
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
    place: (
      <svg viewBox="0 0 100 100" className="model-icon">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        <path d="M50 25 L50 20 M50 25 C65 25 70 40 70 50 C70 65 50 80 50 80 C50 80 30 65 30 50 C30 40 35 25 50 25 Z" 
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="50" cy="48" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
    event: (
      <svg viewBox="0 0 100 100" className="model-icon">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        <rect x="25" y="30" width="50" height="45" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <line x1="25" y1="45" x2="75" y2="45" stroke="currentColor" strokeWidth="2" />
        <line x1="35" y1="25" x2="35" y2="35" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="65" y1="25" x2="65" y2="35" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="50" cy="58" r="3" fill="currentColor" />
      </svg>
    ),
    default: (
      <svg viewBox="0 0 100 100" className="model-icon">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <ellipse cx="50" cy="50" rx="25" ry="10" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="50" y1="25" x2="50" y2="75" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      </svg>
    )
  }
  
  return icons[type] || icons.default
}

export default function Business3DModel({ type = 'default', className = '' }) {
  return (
    <div className={`business-3d-model ${className}`}>
      <div className="model-animated-icon">
        <AnimatedIcon type={type} />
      </div>
    </div>
  )
}
