import { useEffect, useState } from 'react'
import { Globe2, FileText, Info, Phone, MapPinned, Check, AlertCircle, Save } from 'lucide-react'
import { fetchPlatformSettings, updatePlatformSettings, type PlatformSettingsRow } from '@/lib/adminApi'

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="ss-card">
      <div className="ss-card-head">
        <span className="ss-card-icon-wrap">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h3 className="ss-card-title">{title}</h3>
          {description && <p className="ss-card-desc">{description}</p>}
        </div>
      </div>
      <div className="ss-card-body">{children}</div>
    </div>
  )
}

export default function AdminSiteSettings() {
  const [loading, setLoading]               = useState(true)
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState('')
  const [saved, setSaved]                   = useState(false)
  const [privacy, setPrivacy]               = useState('')
  const [about, setAbout]                   = useState('')
  const [contactEmail, setContactEmail]     = useState('')
  const [contactPhone, setContactPhone]     = useState('')
  const [lang, setLang]                     = useState<'en' | 'ar'>('en')
  const [bahrainInfo, setBahrainInfo]       = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchPlatformSettings()
      .then((row) => {
        if (cancelled || !row) return
        setPrivacy(row.privacy_policy ?? '')
        setAbout(row.about_us ?? '')
        setContactEmail(row.contact_email ?? '')
        setContactPhone(row.contact_phone ?? '')
        setLang(row.default_language === 'ar' ? 'ar' : 'en')
        setBahrainInfo(row.bahrain_info ?? '')
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message || 'Could not load settings') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const patch: Partial<Pick<
        PlatformSettingsRow,
        'privacy_policy' | 'about_us' | 'contact_email' | 'contact_phone' | 'default_language' | 'bahrain_info'
      >> = {
        privacy_policy: privacy,
        about_us: about,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        default_language: lang,
        bahrain_info: bahrainInfo,
      }
      await updatePlatformSettings(patch)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="ss-loading">
        <div className="ss-loading-spinner" />
        <span>Loading site settings…</span>
      </div>
    )
  }

  return (
    <div className="ss-root">

      {/* Page header */}
      <div className="ss-page-header">
        <div>
          <h2 className="ss-page-title">Site settings</h2>
          <p className="ss-page-sub">
            Manage public-facing copy, contact details, and locale defaults.
            Stored in{' '}
            <code className="ss-code">public.platform_settings</code>.
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="ss-alert ss-alert--error">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {saved && (
        <div className="ss-alert ss-alert--success">
          <Check className="h-4 w-4 shrink-0" />
          Settings saved successfully.
        </div>
      )}

      {/* Sections grid */}
      <div className="ss-grid">

        {/* Privacy policy */}
        <SectionCard
          icon={FileText}
          title="Privacy policy"
          description="Displayed on the /privacy page accessible to all users."
        >
          <textarea
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value)}
            rows={7}
            placeholder="Enter your privacy policy…"
            className="ss-textarea"
          />
        </SectionCard>

        {/* About us */}
        <SectionCard
          icon={Info}
          title="About us"
          description="Shown on the /about page and in app footers."
        >
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={6}
            placeholder="Tell visitors about SiyahaBH…"
            className="ss-textarea"
          />
        </SectionCard>

        {/* Bahrain info */}
        <SectionCard
          icon={MapPinned}
          title="Bahrain info"
          description="General travel and destination info about Bahrain."
        >
          <textarea
            value={bahrainInfo}
            onChange={(e) => setBahrainInfo(e.target.value)}
            rows={6}
            placeholder="Bahrain destination details…"
            className="ss-textarea"
          />
        </SectionCard>

        {/* Contact + Language side by side */}
        <div className="ss-side-grid">

          <SectionCard
            icon={Phone}
            title="Contact info"
            description="Publicly displayed contact details."
          >
            <div className="ss-field-group">
              <label className="ss-label">
                Public email
                <input
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  type="email"
                  placeholder="hello@siyaha.bh"
                  className="ss-input"
                />
              </label>
              <label className="ss-label">
                Phone number
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  type="tel"
                  placeholder="+973 XXXX XXXX"
                  className="ss-input"
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard
            icon={Globe2}
            title="Language settings"
            description="Default locale for new visitors."
          >
            <div className="ss-lang-opts">
              {([
                { id: 'en' as const, label: 'English', native: 'English' },
                { id: 'ar' as const, label: 'Arabic',  native: 'العربية' },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLang(opt.id)}
                  className={lang === opt.id ? 'ss-lang-btn ss-lang-btn--active' : 'ss-lang-btn'}
                >
                  {lang === opt.id && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                  <span className="ss-lang-label">{opt.label}</span>
                  <span className="ss-lang-native">{opt.native}</span>
                </button>
              ))}
            </div>
          </SectionCard>

        </div>
      </div>

      {/* Sticky save bar */}
      <div className="ss-save-bar">
        <span className="ss-save-hint">Changes are saved directly to the database.</span>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="ss-save-btn"
        >
          {saving ? (
            <>
              <span className="ss-save-spinner" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" aria-hidden />
              Save to database
            </>
          )}
        </button>
      </div>
    </div>
  )
}
