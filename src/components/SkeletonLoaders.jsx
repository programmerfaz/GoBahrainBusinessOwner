import './SkeletonLoaders.css'

export function SkeletonText({ width = '100%', height = '1rem', className = '' }) {
  return (
    <div 
      className={`skeleton-shimmer ${className}`}
      style={{ width, height, borderRadius: '4px' }}
    />
  )
}

export function SkeletonCircle({ size = '3rem', className = '' }) {
  return (
    <div 
      className={`skeleton-shimmer ${className}`}
      style={{ width: size, height: size, borderRadius: '50%' }}
    />
  )
}

export function SkeletonRect({ width = '100%', height = '200px', radius = '12px', className = '' }) {
  return (
    <div 
      className={`skeleton-shimmer ${className}`}
      style={{ width, height, borderRadius: radius }}
    />
  )
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`skeleton-card ${className}`}>
      <SkeletonRect height="180px" radius="12px 12px 0 0" />
      <div className="skeleton-card-body">
        <SkeletonText width="70%" height="1.25rem" />
        <SkeletonText width="90%" height="0.875rem" />
        <SkeletonText width="50%" height="0.875rem" />
        <div className="skeleton-card-footer">
          <SkeletonCircle size="2rem" />
          <SkeletonText width="40%" height="0.75rem" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonProfileHero({ className = '' }) {
  return (
    <div className={`skeleton-profile-hero ${className}`}>
      <div className="skeleton-hero-bg skeleton-shimmer" />
      <div className="skeleton-hero-content">
        <SkeletonCircle size="120px" className="skeleton-avatar" />
        <SkeletonText width="60%" height="2.5rem" className="skeleton-name" />
        <SkeletonText width="30%" height="1rem" className="skeleton-type" />
        <div className="skeleton-hero-actions">
          <SkeletonRect width="120px" height="40px" radius="20px" />
          <SkeletonRect width="120px" height="40px" radius="20px" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonDetailRow({ className = '' }) {
  return (
    <div className={`skeleton-detail-row ${className}`}>
      <SkeletonCircle size="42px" />
      <div className="skeleton-detail-text">
        <SkeletonText width="40%" height="0.7rem" />
      </div>
      <SkeletonText width="30%" height="1rem" />
    </div>
  )
}

export function SkeletonDetailsGrid({ count = 6, className = '' }) {
  return (
    <div className={`skeleton-details-grid ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonDetailRow key={i} />
      ))}
    </div>
  )
}

export function SkeletonGallery({ className = '' }) {
  return (
    <div className={`skeleton-gallery ${className}`}>
      <SkeletonRect height="280px" radius="12px" className="skeleton-gallery-main" />
      <SkeletonRect height="135px" radius="12px" />
      <SkeletonRect height="135px" radius="12px" />
    </div>
  )
}

export function SkeletonPage({ className = '' }) {
  return (
    <div className={`skeleton-page ${className}`}>
      <SkeletonProfileHero />
      <div className="skeleton-section">
        <SkeletonText width="120px" height="0.75rem" />
        <SkeletonText width="60%" height="2rem" />
        <SkeletonText width="80%" height="1rem" />
        <SkeletonDetailsGrid count={6} />
      </div>
      <div className="skeleton-section">
        <SkeletonText width="100px" height="0.75rem" />
        <SkeletonText width="50%" height="2rem" />
        <SkeletonGallery />
      </div>
    </div>
  )
}

export function SkeletonListItem({ className = '' }) {
  return (
    <div className={`skeleton-list-item ${className}`}>
      <SkeletonCircle size="48px" />
      <div className="skeleton-list-content">
        <SkeletonText width="60%" height="1rem" />
        <SkeletonText width="40%" height="0.75rem" />
      </div>
      <SkeletonRect width="80px" height="32px" radius="16px" />
    </div>
  )
}

export function Skeleton3DLoader({ className = '' }) {
  return (
    <div className={`skeleton-3d-loader ${className}`}>
      <div className="skeleton-3d-ring">
        <div className="skeleton-3d-ring-inner" />
      </div>
      <SkeletonText width="80px" height="0.75rem" className="skeleton-3d-text" />
    </div>
  )
}
