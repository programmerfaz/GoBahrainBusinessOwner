/**
 * Any signed-in account (except platform admins) is blocked when `owner_profile_disabled` is true.
 * Pending approval applies only to business owners (`account_type === 'client'`).
 */
const BUSINESS_OWNER_ACCOUNT_TYPE = 'client'

export type OwnerBusinessRestriction = 'none' | 'pending_approval' | 'profile_disabled'

export function ownerBusinessRestriction(user: unknown): OwnerBusinessRestriction {
  const u = user as {
    is_platform_admin?: boolean
    account_approved?: boolean
    account_type?: string | null
    owner_profile_disabled?: boolean
  } | null | undefined
  if (!u || u.is_platform_admin) return 'none'
  if (u.owner_profile_disabled === true) return 'profile_disabled'
  const t = String(u.account_type || '').toLowerCase()
  if (t === BUSINESS_OWNER_ACCOUNT_TYPE && u.account_approved === false) return 'pending_approval'
  return 'none'
}

export function isOwnerFeatureEnabled(user: unknown): boolean {
  return ownerBusinessRestriction(user) === 'none'
}

/** Short label for tooltips when editing is blocked */
export function ownerRestrictionShortLabel(user: unknown): string {
  switch (ownerBusinessRestriction(user)) {
    case 'profile_disabled':
      return 'Profile disabled by admin'
    case 'pending_approval':
      return 'Pending admin approval'
    default:
      return ''
  }
}
