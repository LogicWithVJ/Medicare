import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { api } from './api'
import type {
  AvailabilityUpdate,
  DiagnosticRecommendation,
  Facility,
  FacilityService,
  IntakeRecord,
  Patient,
  PatientDetail,
  Referral,
  ReferralStatus,
  ReportedAvailability,
} from './types'
import './App.css'

type Page = 'overview' | 'referrals' | 'facilities' | 'patients'
type IconName =
  | 'overview'
  | 'referrals'
  | 'facilities'
  | 'patients'
  | 'search'
  | 'bell'
  | 'refresh'
  | 'arrow'
  | 'plus'
  | 'clock'
  | 'check'
  | 'close'
  | 'location'
  | 'calendar'
  | 'external'
  | 'chevron'
  | 'activity'

const navigation: { id: Page; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'referrals', label: 'Referral queue', icon: 'referrals' },
  { id: 'facilities', label: 'Facilities', icon: 'facilities' },
  { id: 'patients', label: 'Patient records', icon: 'patients' },
]

function Icon({
  name,
  size = 18,
}: {
  name: IconName
  size?: number
}) {
  const paths: Record<IconName, ReactNode> = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    referrals: (
      <>
        <path d="M8 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
        <path d="M16 3h5v5M21 3l-9 9M7 10h4M7 14h3" />
      </>
    ),
    facilities: (
      <>
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 21v-4h4v4" />
        <path d="M12 5v4M10 7h4" />
      </>
    ),
    patients: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" />
      </>
    ),
    arrow: <path d="M5 12h14m-7-7 7 7-7 7" />,
    plus: <path d="M12 5v14m-7-7h14" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m18 6-12 12M6 6l12 12" />,
    location: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    external: (
      <>
        <path d="M14 3h7v7M10 14 21 3" />
        <path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
      </>
    ),
    chevron: <path d="m7 10 5 5 5-5" />,
    activity: (
      <>
        <path d="M3 12h4l3-8 4 16 3-8h4" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(value: string | null | undefined) {
  if (!value) return 'No update yet'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'No update yet'
    : date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function StatusBadge({ status }: { status: ReferralStatus | string }) {
  const labels: Record<string, string> = {
    pending_review: 'Awaiting review',
    approved: 'Approved',
    rejected: 'Declined',
    patient_arrived: 'Arrived',
    service_completed: 'Completed',
    cancelled: 'Cancelled',
    available: 'Available',
    unavailable: 'Unavailable',
    outdated: 'Outdated',
    unknown: 'Unknown',
  }
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {labels[status] ?? status.replaceAll('_', ' ')}
    </span>
  )
}

function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: IconName
  title: string
  detail: string
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  )
}

function App() {
  const [page, setPage] = useState<Page>('overview')
  const [patients, setPatients] = useState<Patient[]>([])
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null)
  const [reviewPatientData, setReviewPatientData] = useState<{
    referralId: string
    patient: PatientDetail
  } | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [workingReferralId, setWorkingReferralId] = useState<string | null>(null)
  const [referralFilter, setReferralFilter] = useState('all')
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [selectedPatientData, setSelectedPatientData] = useState<{
    patientId: string
    patient: PatientDetail
  } | null>(null)
  const [selectedFacilityId, setSelectedFacilityId] = useState('')
  const [facilityServiceData, setFacilityServiceData] = useState<{
    facilityId: string
    services: FacilityService[]
  } | null>(null)
  const [facilityServiceLoadErrorId, setFacilityServiceLoadErrorId] = useState<string | null>(null)
  const [serviceName, setServiceName] = useState('')
  const [availability, setAvailability] = useState<ReportedAvailability>('available')
  const [equipmentStatus, setEquipmentStatus] = useState('')
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [facilityName, setFacilityName] = useState('')
  const [facilityAddress, setFacilityAddress] = useState('')
  const [facilityHours, setFacilityHours] = useState('')
  const [facilityCreateLoading, setFacilityCreateLoading] = useState(false)
  const [recommendationQuery, setRecommendationQuery] = useState('')
  const [recommendations, setRecommendations] = useState<DiagnosticRecommendation[] | null>(null)
  const [recommendationLoading, setRecommendationLoading] = useState(false)
  const [historyByService, setHistoryByService] = useState<Record<string, AvailabilityUpdate[]>>({})
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null)

  const activeFacilityId = facilities.some((item) => item.id === selectedFacilityId)
    ? selectedFacilityId
    : facilities[0]?.id ?? ''
  const facilityServices =
    facilityServiceData?.facilityId === activeFacilityId ? facilityServiceData.services : []
  const facilityLoading =
    Boolean(activeFacilityId) &&
    facilityServiceData?.facilityId !== activeFacilityId &&
    facilityServiceLoadErrorId !== activeFacilityId
  const selectedPatient =
    selectedPatientData?.patientId === selectedPatientId ? selectedPatientData.patient : null
  const reviewPatient =
    selectedReferral && reviewPatientData?.referralId === selectedReferral.id
      ? reviewPatientData.patient
      : null

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [patientData, referralData, facilityData] = await Promise.all([
        api.listPatients(),
        api.listReferrals(),
        api.listFacilities(),
      ])
      setPatients(patientData)
      setReferrals(referralData)
      setFacilities(facilityData)
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Could not load dashboard data.',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (active) return refresh()
    })
    return () => {
      active = false
    }
  }, [refresh])

  useEffect(() => {
    if (!activeFacilityId) return
    let active = true
    api
      .getFacilityServices(activeFacilityId)
      .then((result) => {
        if (active) {
          setFacilityServiceData({ facilityId: activeFacilityId, services: result.services })
          setFacilityServiceLoadErrorId(null)
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setFacilityServiceLoadErrorId(activeFacilityId)
          setNotice({
            kind: 'error',
            text: error instanceof Error ? error.message : 'Could not load facility services.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [activeFacilityId])

  useEffect(() => {
    if (!selectedPatientId) return
    let active = true
    api
      .getPatient(selectedPatientId)
      .then((patient) => {
        if (active) setSelectedPatientData({ patientId: selectedPatientId, patient })
      })
      .catch((error: unknown) => {
        if (active) {
          setNotice({
            kind: 'error',
            text: error instanceof Error ? error.message : 'Could not load patient record.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [selectedPatientId])

  useEffect(() => {
    if (!selectedReferral) return
    let active = true
    api
      .getPatient(selectedReferral.patient_id)
      .then((patient) => {
        if (active) setReviewPatientData({ referralId: selectedReferral.id, patient })
      })
      .catch((error: unknown) => {
        if (active) {
          setNotice({
            kind: 'error',
            text: error instanceof Error ? error.message : 'Could not load patient details.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [selectedReferral])

  const patientById = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient])),
    [patients],
  )
  const pendingCount = referrals.filter((item) => item.status === 'pending_review').length
  const approvedCount = referrals.filter((item) => item.status === 'approved').length
  const visibleReferrals = referrals.filter(
    (item) => referralFilter === 'all' || item.status === referralFilter,
  )
  const activeFacility = facilities.find((item) => item.id === selectedFacilityId) ?? null
  const filteredPatients = patients.filter((patient) => {
    const query = patientSearch.trim().toLowerCase()
    return (
      !query ||
      patient.full_name.toLowerCase().includes(query) ||
      (patient.village ?? '').toLowerCase().includes(query)
    )
  })

  function setSuccess(text: string) {
    setNotice({ kind: 'success', text })
  }

  async function handleReview(decision: 'approved' | 'rejected') {
    if (!selectedReferral) return
    setReviewLoading(true)
    try {
      await api.reviewReferral(selectedReferral.id, decision, reviewNote.trim())
      setSelectedReferral(null)
      setReviewNote('')
      setSuccess(decision === 'approved' ? 'Referral approved.' : 'Referral declined.')
      await refresh()
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Could not update referral.',
      })
    } finally {
      setReviewLoading(false)
    }
  }

  async function handleReferralStatus(
    referral: Referral,
    status: 'patient_arrived' | 'service_completed',
  ) {
    setWorkingReferralId(referral.id)
    try {
      await api.updateReferralStatus(referral.id, status)
      setSuccess(status === 'patient_arrived' ? 'Arrival recorded.' : 'Service completion recorded.')
      await refresh()
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Could not update referral status.',
      })
    } finally {
      setWorkingReferralId(null)
    }
  }

  async function handleCreateFacility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFacilityCreateLoading(true)
    const name = facilityName.trim()
    const address = facilityAddress.trim()
    const operatingHours = facilityHours.trim()
    try {
      const facility = await api.createFacility({
        name,
        ...(address ? { address } : {}),
        ...(operatingHours ? { operating_hours: operatingHours } : {}),
      })
      setFacilityName('')
      setFacilityAddress('')
      setFacilityHours('')
      setSuccess(`${facility.name} added to facilities.`)
      await refresh()
      setSelectedFacilityId(facility.id)
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Could not create facility.',
      })
    } finally {
      setFacilityCreateLoading(false)
    }
  }

  async function handleAvailabilityUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeFacilityId) return
    setAvailabilityLoading(true)
    try {
      await api.updateAvailability(activeFacilityId, {
        service_name: serviceName.trim(),
        status: availability,
        ...(equipmentStatus.trim() ? { equipment_status: equipmentStatus.trim() } : {}),
        updated_by: 'demo-facility-staff',
      })
      setServiceName('')
      setEquipmentStatus('')
      setSuccess('Diagnostic availability updated with a server timestamp.')
      const result = await api.getFacilityServices(activeFacilityId)
      setFacilityServiceData({ facilityId: activeFacilityId, services: result.services })
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Could not update availability.',
      })
    } finally {
      setAvailabilityLoading(false)
    }
  }

  async function handleRecommendations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = recommendationQuery.trim()
    if (!query) return
    setRecommendationLoading(true)
    try {
      setRecommendations(await api.recommendFacilities(query))
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Could not find diagnostic facilities.',
      })
    } finally {
      setRecommendationLoading(false)
    }
  }

  async function toggleHistory(service: FacilityService) {
    if (!activeFacilityId) return
    if (historyByService[service.id]) {
      setHistoryByService((current) => {
        const next = { ...current }
        delete next[service.id]
        return next
      })
      return
    }
    setHistoryLoadingId(service.id)
    try {
      const history = await api.availabilityHistory(activeFacilityId, service.id)
      setHistoryByService((current) => ({ ...current, [service.id]: history }))
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Could not load availability history.',
      })
    } finally {
      setHistoryLoadingId(null)
    }
  }

  const pageTitle: Record<Page, string> = {
    overview: 'Good morning, Doctor',
    referrals: 'Referral queue',
    facilities: 'Facility network',
    patients: 'Patient records',
  }
  const pageDescription: Record<Page, string> = {
    overview: 'Here is the latest care coordination activity across your network.',
    referrals: 'Review requests and follow each patient through to service completion.',
    facilities: 'Keep diagnostic services and their availability current.',
    patients: 'Browse registered patients and worker-confirmed intake records.',
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#overview"
          className="brand"
          onClick={(event) => {
            event.preventDefault()
            setPage('overview')
          }}
        >
          <span className="brand-mark">
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <path d="M20 4v32M4 20h32" />
              <path d="M9 9c6-5 16-5 22 0M9 31c6 5 16 5 22 0" />
            </svg>
          </span>
          <span>
            <strong>RuralCare</strong>
            <small>CONNECT</small>
          </span>
        </a>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              aria-label={item.label}
              onClick={() => setPage(item.id)}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.id === 'referrals' && pendingCount > 0 && (
                <span className="nav-count">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-support">
          <div className="support-art">
            <span className="support-sun" />
            <span className="support-hill hill-one" />
            <span className="support-hill hill-two" />
            <span className="support-cross">+</span>
          </div>
          <strong>Care, connected.</strong>
          <p>Every update helps the next health worker make a better-informed handoff.</p>
        </div>
        <div className="sidebar-user">
          <div className="user-avatar">DR</div>
          <div className="user-details">
            <strong>Demo workspace</strong>
            <span>Doctor view · Not authenticated</span>
          </div>
          <Icon name="chevron" size={16} />
        </div>
        <p className="sidebar-footnote">Prototype only · Use synthetic records</p>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            <span>RuralCare</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{navigation.find((item) => item.id === page)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="environment-tag">
              <span className="environment-dot" />
              DEMO ENVIRONMENT
            </span>
            <button
              className="icon-button notification-button"
              type="button"
              aria-label="Notifications"
              onClick={() => setPage('referrals')}
            >
              <Icon name="bell" />
              {pendingCount > 0 && <span className="notification-dot" />}
            </button>
            <div className="topbar-avatar" aria-label="Doctor demo profile">
              DR
            </div>
          </div>
        </header>

        <div className="page-content">
          {notice && (
            <div className={`notice notice-${notice.kind}`} role="status">
              <span>{notice.text}</span>
              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() => setNotice(null)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}

          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                Care coordination
              </div>
              <h1>{pageTitle[page]}</h1>
              <p>{pageDescription[page]}</p>
            </div>
            <div className="heading-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing}
              >
                <Icon name="refresh" size={16} />
                {refreshing ? 'Refreshing' : 'Refresh'}
              </button>
              {page === 'overview' && (
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => setPage('referrals')}
                >
                  Review referrals
                  <Icon name="arrow" size={16} />
                </button>
              )}
            </div>
          </section>

          {loading ? (
            <div className="loading-panel">
              <span className="loading-spinner" />
              <span>Connecting to the care network…</span>
            </div>
          ) : (
            <>
              {page === 'overview' && (
                <OverviewPage
                  patients={patients}
                  referrals={referrals}
                  facilities={facilities}
                  patientById={patientById}
                  pendingCount={pendingCount}
                  approvedCount={approvedCount}
                  onOpenReferral={setSelectedReferral}
                  onUpdateStatus={handleReferralStatus}
                  workingReferralId={workingReferralId}
                  onViewReferrals={() => setPage('referrals')}
                  onViewFacilities={() => setPage('facilities')}
                />
              )}
              {page === 'referrals' && (
                <ReferralsPage
                  referrals={visibleReferrals}
                  patientById={patientById}
                  filter={referralFilter}
                  onFilter={setReferralFilter}
                  onOpenReferral={setSelectedReferral}
                  onUpdateStatus={handleReferralStatus}
                  workingReferralId={workingReferralId}
                />
              )}
              {page === 'facilities' && (
                <FacilitiesPage
                  facilities={facilities}
                  selectedFacilityId={activeFacilityId}
                  activeFacility={activeFacility}
                  services={facilityServices}
                  facilityLoading={facilityLoading}
                  facilityName={facilityName}
                  facilityAddress={facilityAddress}
                  facilityHours={facilityHours}
                  onFacilityName={setFacilityName}
                  onFacilityAddress={setFacilityAddress}
                  onFacilityHours={setFacilityHours}
                  onSelectFacility={setSelectedFacilityId}
                  onCreateFacility={handleCreateFacility}
                  facilityCreateLoading={facilityCreateLoading}
                  serviceName={serviceName}
                  onServiceName={setServiceName}
                  availability={availability}
                  onAvailability={setAvailability}
                  equipmentStatus={equipmentStatus}
                  onEquipmentStatus={setEquipmentStatus}
                  onUpdateAvailability={handleAvailabilityUpdate}
                  availabilityLoading={availabilityLoading}
                  recommendationQuery={recommendationQuery}
                  onRecommendationQuery={setRecommendationQuery}
                  recommendations={recommendations}
                  recommendationLoading={recommendationLoading}
                  onFindRecommendations={handleRecommendations}
                  historyByService={historyByService}
                  historyLoadingId={historyLoadingId}
                  onToggleHistory={toggleHistory}
                />
              )}
              {page === 'patients' && (
                <PatientsPage
                  patients={filteredPatients}
                  allPatients={patients}
                  search={patientSearch}
                  onSearch={setPatientSearch}
                  selectedPatient={selectedPatient}
                  selectedPatientId={selectedPatientId}
                  onSelectPatient={setSelectedPatientId}
                />
              )}
            </>
          )}

          <footer className="page-footer">
            <span>RuralCare Connect <span className="footer-divider">·</span> Supporting public healthcare teams</span>
            <span>Prototype build 0.3 <span className="footer-divider">·</span> No clinical decisions are automated</span>
          </footer>
        </div>
      </main>

      {selectedReferral && (
        <ReviewModal
          referral={selectedReferral}
          patient={reviewPatient}
          note={reviewNote}
          loading={reviewLoading}
          onNote={setReviewNote}
          onClose={() => {
            setSelectedReferral(null)
            setReviewNote('')
          }}
          onReview={handleReview}
        />
      )}
    </div>
  )
}

function OverviewPage({
  patients,
  referrals,
  facilities,
  patientById,
  pendingCount,
  approvedCount,
  onOpenReferral,
  onUpdateStatus,
  workingReferralId,
  onViewReferrals,
  onViewFacilities,
}: {
  patients: Patient[]
  referrals: Referral[]
  facilities: Facility[]
  patientById: Map<string, Patient>
  pendingCount: number
  approvedCount: number
  onOpenReferral: (referral: Referral) => void
  onUpdateStatus: (referral: Referral, status: 'patient_arrived' | 'service_completed') => void
  workingReferralId: string | null
  onViewReferrals: () => void
  onViewFacilities: () => void
}) {
  const recentReferrals = referrals.slice(0, 5)
  const recentPatients = patients.slice(0, 4)

  return (
    <>
      <section className="welcome-banner">
        <div className="welcome-copy">
          <span className="welcome-kicker">YOUR CARE NETWORK, AT A GLANCE</span>
          <h2>Small steps. Stronger continuity.</h2>
          <p>
            Keep referrals moving, stay in touch with nearby facilities, and help every patient
            reach their next point of care.
          </p>
          <button type="button" className="welcome-link" onClick={onViewReferrals}>
            Go to referral queue <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="welcome-illustration" aria-hidden="true">
          <span className="illustration-sun" />
          <span className="illustration-cloud cloud-one" />
          <span className="illustration-cloud cloud-two" />
          <span className="illustration-hill hill-back" />
          <span className="illustration-hill hill-front" />
          <span className="illustration-clinic">
            <span className="clinic-roof" />
            <span className="clinic-body">
              <span className="clinic-cross">+</span>
              <span className="clinic-window" />
              <span className="clinic-door" />
            </span>
          </span>
        </div>
      </section>

      <section className="stat-grid" aria-label="Network summary">
        <StatCard
          icon="referrals"
          tint="blue"
          label="Needs your review"
          value={pendingCount}
          helper="Referral requests waiting"
          onClick={onViewReferrals}
        />
        <StatCard
          icon="activity"
          tint="green"
          label="In progress"
          value={approvedCount}
          helper="Approved referrals"
          onClick={onViewReferrals}
        />
        <StatCard
          icon="facilities"
          tint="peach"
          label="Connected facilities"
          value={facilities.length}
          helper="Participating care points"
          onClick={onViewFacilities}
        />
        <StatCard
          icon="patients"
          tint="lavender"
          label="Registered patients"
          value={patients.length}
          helper="Records in this workspace"
        />
      </section>

      <div className="dashboard-columns">
        <section className="panel referral-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">CARE COORDINATION</span>
              <h2>Recent referrals</h2>
            </div>
            <button type="button" className="text-button" onClick={onViewReferrals}>
              View queue <Icon name="arrow" size={15} />
            </button>
          </div>
          {recentReferrals.length === 0 ? (
            <EmptyState
              icon="referrals"
              title="No referrals yet"
              detail="New referral requests will appear here."
            />
          ) : (
            <div className="referral-list">
              {recentReferrals.map((referral) => (
                <ReferralRow
                  key={referral.id}
                  referral={referral}
                  patient={patientById.get(referral.patient_id)}
                  onOpen={() => onOpenReferral(referral)}
                  onUpdateStatus={onUpdateStatus}
                  working={workingReferralId === referral.id}
                />
              ))}
            </div>
          )}
        </section>

        <section className="panel network-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">LOCAL NETWORK</span>
              <h2>Care points</h2>
            </div>
            <button type="button" className="round-link" aria-label="View facilities" onClick={onViewFacilities}>
              <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="network-summary">
            <span className="network-icon"><Icon name="facilities" size={20} /></span>
            <div><strong>{facilities.length} facilities</strong><span>in the connected network</span></div>
          </div>
          {facilities.length === 0 ? (
            <p className="network-empty">Register a participating facility to begin tracking services.</p>
          ) : (
            <div className="mini-facility-list">
              {facilities.slice(0, 4).map((facility) => (
                <div className="mini-facility" key={facility.id}>
                  <span className="facility-avatar"><Icon name="facilities" size={15} /></span>
                  <span className="mini-facility-name">{facility.name}</span>
                  <span className="mini-facility-place">{facility.address || 'Location not set'}</span>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="network-bottom-link" onClick={onViewFacilities}>
            Manage facilities and services <Icon name="arrow" size={15} />
          </button>
        </section>
      </div>

      <section className="panel recent-patients-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">PATIENT INTAKE</span>
            <h2>Recently registered</h2>
          </div>
          <span className="subtle-count">{patients.length} total records</span>
        </div>
        {recentPatients.length === 0 ? (
          <EmptyState
            icon="patients"
            title="No patient records yet"
            detail="Synthetic development records will appear here after registration."
          />
        ) : (
          <div className="patient-strip">
            {recentPatients.map((patient, index) => (
              <div className="patient-chip" key={patient.id}>
                <span className={`patient-avatar avatar-${index % 4}`}>{initials(patient.full_name)}</span>
                <span><strong>{patient.full_name}</strong><small>{patient.village || 'Village not recorded'}</small></span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function StatCard({
  icon,
  tint,
  label,
  value,
  helper,
  onClick,
}: {
  icon: IconName
  tint: string
  label: string
  value: number
  helper: string
  onClick?: () => void
}) {
  const content = (
    <>
      <div className={`stat-icon tint-${tint}`}><Icon name={icon} size={18} /></div>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value.toLocaleString('en-IN')}</strong>
      <span className="stat-helper">{helper}</span>
    </>
  )
  return onClick ? (
    <button type="button" className="stat-card stat-card-button" onClick={onClick}>{content}</button>
  ) : (
    <div className="stat-card">{content}</div>
  )
}

function ReferralRow({
  referral,
  patient,
  onOpen,
  onUpdateStatus,
  working,
}: {
  referral: Referral
  patient?: Patient
  onOpen: () => void
  onUpdateStatus: (referral: Referral, status: 'patient_arrived' | 'service_completed') => void
  working: boolean
}) {
  return (
    <article className="referral-row">
      <div className="referral-person">
        <span className="patient-avatar avatar-blue">{initials(patient?.full_name || 'Patient')}</span>
        <span className="referral-person-info">
          <strong>{patient?.full_name || `Patient ${referral.patient_id.slice(0, 8)}`}</strong>
          <small>{patient?.village || 'Village not recorded'}</small>
        </span>
      </div>
      <div className="referral-service">
        <strong>{referral.requested_service}</strong>
        <small>{referral.reason}</small>
      </div>
      <div className="referral-date"><Icon name="calendar" size={14} />{formatDate(referral.created_at)}</div>
      <StatusBadge status={referral.status} />
      <div className="row-actions">
        {referral.status === 'pending_review' ? (
          <button type="button" className="button button-small button-outline" onClick={onOpen}>Review</button>
        ) : referral.status === 'approved' ? (
          <button type="button" className="button button-small button-outline" disabled={working} onClick={() => onUpdateStatus(referral, 'patient_arrived')}>
            {working ? 'Saving…' : 'Mark arrived'}
          </button>
        ) : referral.status === 'patient_arrived' ? (
          <button type="button" className="button button-small button-outline" disabled={working} onClick={() => onUpdateStatus(referral, 'service_completed')}>
            {working ? 'Saving…' : 'Complete'}
          </button>
        ) : (
          <span className="row-dash">—</span>
        )}
      </div>
    </article>
  )
}

function ReferralsPage({
  referrals,
  patientById,
  filter,
  onFilter,
  onOpenReferral,
  onUpdateStatus,
  workingReferralId,
}: {
  referrals: Referral[]
  patientById: Map<string, Patient>
  filter: string
  onFilter: (filter: string) => void
  onOpenReferral: (referral: Referral) => void
  onUpdateStatus: (referral: Referral, status: 'patient_arrived' | 'service_completed') => void
  workingReferralId: string | null
}) {
  const filters = [
    { id: 'all', label: 'All referrals' },
    { id: 'pending_review', label: 'Needs review' },
    { id: 'approved', label: 'Approved' },
    { id: 'patient_arrived', label: 'Arrived' },
    { id: 'service_completed', label: 'Completed' },
  ]
  return (
    <section className="panel full-panel">
      <div className="panel-heading referrals-heading">
        <div>
          <span className="panel-kicker">DOCTOR WORKSPACE</span>
          <h2>Referral requests <span className="heading-count">{referrals.length}</span></h2>
        </div>
        <div className="table-context"><span className="live-dot" />Synced from care network</div>
      </div>
      <div className="filter-tabs" role="tablist" aria-label="Filter referrals">
        {filters.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            className={filter === item.id ? 'selected' : ''}
            key={item.id}
            onClick={() => onFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="table-head referral-table-head">
        <span>PATIENT</span><span>REQUESTED SERVICE</span><span>REQUEST DATE</span><span>STATUS</span><span />
      </div>
      {referrals.length === 0 ? (
        <EmptyState icon="referrals" title="Nothing in this view" detail="Try another status filter or refresh the referral queue." />
      ) : (
        <div className="referral-list referral-list-large">
          {referrals.map((referral) => (
            <ReferralRow
              key={referral.id}
              referral={referral}
              patient={patientById.get(referral.patient_id)}
              onOpen={() => onOpenReferral(referral)}
              onUpdateStatus={onUpdateStatus}
              working={workingReferralId === referral.id}
            />
          ))}
        </div>
      )}
      <div className="panel-footnote">
        <Icon name="activity" size={15} />
        Status changes are timestamped by the API. Staff identity is not authenticated in this prototype.
      </div>
    </section>
  )
}

function ReviewModal({
  referral,
  patient,
  note,
  loading,
  onNote,
  onClose,
  onReview,
}: {
  referral: Referral
  patient: PatientDetail | null
  note: string
  loading: boolean
  onNote: (note: string) => void
  onClose: () => void
  onReview: (decision: 'approved' | 'rejected') => void
}) {
  const intake = patient?.intakes.find((item) => item.id === referral.intake_id)
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) onClose()
    }}>
      <section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <div className="modal-heading">
          <div>
            <span className="panel-kicker">DOCTOR REVIEW</span>
            <h2 id="review-title">Review referral</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close review" onClick={onClose} disabled={loading}>
            <Icon name="close" />
          </button>
        </div>
        <div className="review-patient">
          <span className="patient-avatar avatar-blue">{initials(patient?.full_name || 'Patient')}</span>
          <div>
            <strong>{patient?.full_name || 'Loading patient record…'}</strong>
            <span>{patient?.village || 'Village not recorded'}{patient?.date_of_birth ? ` · Born ${formatDate(patient.date_of_birth)}` : ''}</span>
          </div>
        </div>
        <div className="review-request">
          <span className="field-label">REQUESTED SERVICE</span>
          <strong>{referral.requested_service}</strong>
          <span className="field-label">REFERRAL REASON</span>
          <p>{referral.reason}</p>
        </div>
        <div className="clinical-summary">
          <div className="clinical-summary-heading"><Icon name="activity" size={16} /><strong>Worker-confirmed intake</strong></div>
          {intake ? (
            <dl>
              <div><dt>Symptoms</dt><dd>{intake.symptoms}</dd></div>
              <div><dt>Duration</dt><dd>{intake.duration || 'Not recorded'}</dd></div>
              <div><dt>Relevant history</dt><dd>{intake.relevant_history || 'Not recorded'}</dd></div>
            </dl>
          ) : (
            <p className="clinical-empty">No intake record is linked to this referral. Do not infer missing clinical information.</p>
          )}
          <span className="confirmation-note">
            {intake?.confirmed_by_worker
              ? 'Intake confirmed by a worker before saving.'
              : 'No worker confirmation is recorded for this intake.'}
          </span>
        </div>
        <label className="form-field">
          <span>Review note <small>Optional</small></span>
          <textarea
            value={note}
            maxLength={2000}
            onChange={(event) => onNote(event.target.value)}
            placeholder="Add a note for the care team"
            rows={3}
          />
        </label>
        <div className="modal-safety-note">Prototype identity only: this action is not authenticated or a substitute for clinical judgment.</div>
        <div className="modal-actions">
          <button type="button" className="button button-secondary" disabled={loading || !patient} onClick={() => onReview('rejected')}>
            Decline request
          </button>
          <button type="button" className="button button-primary" disabled={loading || !patient} onClick={() => onReview('approved')}>
            <Icon name="check" size={16} />{loading ? 'Saving…' : 'Approve referral'}
          </button>
        </div>
      </section>
    </div>
  )
}

function FacilitiesPage({
  facilities,
  selectedFacilityId,
  activeFacility,
  services,
  facilityLoading,
  facilityName,
  facilityAddress,
  facilityHours,
  onFacilityName,
  onFacilityAddress,
  onFacilityHours,
  onSelectFacility,
  onCreateFacility,
  facilityCreateLoading,
  serviceName,
  onServiceName,
  availability,
  onAvailability,
  equipmentStatus,
  onEquipmentStatus,
  onUpdateAvailability,
  availabilityLoading,
  recommendationQuery,
  onRecommendationQuery,
  recommendations,
  recommendationLoading,
  onFindRecommendations,
  historyByService,
  historyLoadingId,
  onToggleHistory,
}: {
  facilities: Facility[]
  selectedFacilityId: string
  activeFacility: Facility | null
  services: FacilityService[]
  facilityLoading: boolean
  facilityName: string
  facilityAddress: string
  facilityHours: string
  onFacilityName: (value: string) => void
  onFacilityAddress: (value: string) => void
  onFacilityHours: (value: string) => void
  onSelectFacility: (value: string) => void
  onCreateFacility: (event: FormEvent<HTMLFormElement>) => void
  facilityCreateLoading: boolean
  serviceName: string
  onServiceName: (value: string) => void
  availability: ReportedAvailability
  onAvailability: (value: ReportedAvailability) => void
  equipmentStatus: string
  onEquipmentStatus: (value: string) => void
  onUpdateAvailability: (event: FormEvent<HTMLFormElement>) => void
  availabilityLoading: boolean
  recommendationQuery: string
  onRecommendationQuery: (value: string) => void
  recommendations: DiagnosticRecommendation[] | null
  recommendationLoading: boolean
  onFindRecommendations: (event: FormEvent<HTMLFormElement>) => void
  historyByService: Record<string, AvailabilityUpdate[]>
  historyLoadingId: string | null
  onToggleHistory: (service: FacilityService) => void
}) {
  return (
    <div className="facility-page">
      <section className="panel facility-toolbar">
        <div>
          <span className="panel-kicker">PARTICIPATING FACILITY</span>
          <h2>Diagnostic service directory</h2>
        </div>
        {facilities.length > 0 && (
          <label className="select-wrap">
            <span className="visually-hidden">Select facility</span>
            <select value={selectedFacilityId} onChange={(event) => onSelectFacility(event.target.value)}>
              {facilities.map((facility) => <option value={facility.id} key={facility.id}>{facility.name}</option>)}
            </select>
            <Icon name="chevron" size={15} />
          </label>
        )}
      </section>

      <div className="facility-columns">
        <div className="facility-main-column">
          {activeFacility ? (
            <>
              <section className="facility-profile panel">
                <div className="facility-profile-icon"><Icon name="facilities" size={23} /></div>
                <div className="facility-profile-copy">
                  <span className="panel-kicker">FACILITY PROFILE</span>
                  <h2>{activeFacility.name}</h2>
                  <div className="facility-meta">
                    <span><Icon name="location" size={14} />{activeFacility.address || 'Address not recorded'}</span>
                    <span><Icon name="clock" size={14} />{activeFacility.operating_hours || 'Hours not recorded'}</span>
                  </div>
                </div>
                <span className="facility-profile-tag"><span className="live-dot" />Connected</span>
              </section>

              <section className="panel service-panel">
                <div className="panel-heading">
                  <div>
                    <span className="panel-kicker">SERVICE STATUS</span>
                    <h2>Availability updates</h2>
                  </div>
                  <span className="subtle-count">{services.length} listed</span>
                </div>
                {facilityLoading ? (
                  <div className="inline-loading"><span className="loading-spinner" />Loading facility services…</div>
                ) : services.length === 0 ? (
                  <EmptyState icon="activity" title="No diagnostic services listed" detail="Add an update to register a service at this facility." />
                ) : (
                  <div className="service-list">
                    {services.map((service) => (
                      <div className="service-item-wrap" key={service.id}>
                        <div className="service-item">
                          <span className="service-icon"><Icon name="activity" size={17} /></span>
                          <div className="service-item-name">
                            <strong>{service.service_name}</strong>
                            <span>{service.equipment_status || 'Equipment details not recorded'}</span>
                          </div>
                          <div className="service-item-freshness">
                            <StatusBadge status={service.effective_status} />
                            <small>{formatTime(service.updated_at)}</small>
                          </div>
                          <button
                            type="button"
                            className="history-button"
                            disabled={historyLoadingId === service.id}
                            onClick={() => onToggleHistory(service)}
                          >
                            {historyLoadingId === service.id ? 'Loading…' : historyByService[service.id] ? 'Hide history' : 'History'}
                          </button>
                        </div>
                        {historyByService[service.id] && (
                          <div className="availability-history">
                            {historyByService[service.id].map((update) => (
                              <div className="history-row" key={update.id}>
                                <StatusBadge status={update.reported_status} />
                                <span>{update.equipment_status || update.note || 'No additional note'}</span>
                                <small>{formatTime(update.created_at)} · {update.updated_by}</small>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="panel recommendation-panel">
                <div className="panel-heading">
                  <div>
                    <span className="panel-kicker">DIAGNOSTIC COORDINATION</span>
                    <h2>Find a service</h2>
                  </div>
                  <span className="recommendation-badge">Freshness-aware</span>
                </div>
                <form className="recommendation-form" onSubmit={onFindRecommendations}>
                  <label className="search-field">
                    <Icon name="search" size={17} />
                    <input
                      value={recommendationQuery}
                      onChange={(event) => onRecommendationQuery(event.target.value)}
                      placeholder="Search a diagnostic service"
                      maxLength={120}
                      required
                    />
                  </label>
                  <button type="submit" className="button button-primary" disabled={recommendationLoading}>
                    {recommendationLoading ? 'Searching…' : 'Find facilities'}
                    <Icon name="arrow" size={16} />
                  </button>
                </form>
                {recommendations && (
                  recommendations.length === 0 ? (
                    <p className="recommendation-empty">No facility has registered this service yet.</p>
                  ) : (
                    <div className="recommendation-list">
                      {recommendations.map((item) => (
                        <article className="recommendation-item" key={item.facility_id}>
                          <div className="recommendation-facility-icon"><Icon name="facilities" size={17} /></div>
                          <div className="recommendation-copy">
                            <strong>{item.facility_name}</strong>
                            <span>{item.address || 'Address not recorded'}{item.distance_km !== null ? ` · ${item.distance_km.toFixed(1)} km` : ''}</span>
                            <small>{item.reason}</small>
                          </div>
                          <StatusBadge status={item.effective_status} />
                        </article>
                      ))}
                    </div>
                  )
                )}
                <p className="freshness-disclaimer">
                  Outdated and unknown reports are shown as such, never as confirmed availability. Recommendations are coordination support, not clinical advice.
                </p>
              </section>
            </>
          ) : (
            <section className="panel create-facility-panel">
              <div className="panel-heading">
                <div><span className="panel-kicker">GET STARTED</span><h2>Register a facility</h2></div>
                <span className="facility-profile-icon"><Icon name="facilities" size={22} /></span>
              </div>
              <p className="form-intro">Create a synthetic facility record to start listing its diagnostic services.</p>
              <FacilityForm
                name={facilityName}
                address={facilityAddress}
                hours={facilityHours}
                onName={onFacilityName}
                onAddress={onFacilityAddress}
                onHours={onFacilityHours}
                onSubmit={onCreateFacility}
                loading={facilityCreateLoading}
                submitLabel="Register facility"
              />
            </section>
          )}
        </div>

        <aside className="facility-side-column">
          {activeFacility && (
            <section className="panel update-panel">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">FACILITY STAFF</span>
                  <h2>Update availability</h2>
                </div>
                <span className="update-panel-icon"><Icon name="plus" size={17} /></span>
              </div>
              <p className="form-intro">Every report receives a timestamp from the server. Keep service status current.</p>
              <form className="stacked-form" onSubmit={onUpdateAvailability}>
                <label className="form-field">
                  <span>Diagnostic service</span>
                  <input value={serviceName} onChange={(event) => onServiceName(event.target.value)} placeholder="e.g. Blood test" maxLength={120} required />
                </label>
                <label className="form-field">
                  <span>Availability</span>
                  <select value={availability} onChange={(event) => onAvailability(event.target.value as ReportedAvailability)}>
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="unknown">Unknown / not confirmed</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Equipment status <small>Optional</small></span>
                  <input value={equipmentStatus} onChange={(event) => onEquipmentStatus(event.target.value)} placeholder="e.g. Operational" maxLength={300} />
                </label>
                <div className="form-helper"><Icon name="clock" size={14} />Update time is recorded automatically.</div>
                <button type="submit" className="button button-primary button-wide" disabled={availabilityLoading}>
                  {availabilityLoading ? 'Saving update…' : 'Save availability update'}
                </button>
                <p className="auth-caveat">Demo staff label only; staff authentication and authorization are not implemented.</p>
              </form>
            </section>
          )}

          {activeFacility && (
            <section className="panel add-facility-panel">
              <div className="compact-heading"><span className="add-facility-icon"><Icon name="plus" size={16} /></span><div><strong>Add another facility</strong><small>Expand your care network</small></div></div>
              <details className="facility-details">
                <summary>Register facility <Icon name="chevron" size={15} /></summary>
                <div className="details-content">
                  <FacilityForm
                    name={facilityName}
                    address={facilityAddress}
                    hours={facilityHours}
                    onName={onFacilityName}
                    onAddress={onFacilityAddress}
                    onHours={onFacilityHours}
                    onSubmit={onCreateFacility}
                    loading={facilityCreateLoading}
                    submitLabel="Add facility"
                  />
                </div>
              </details>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function FacilityForm({
  name,
  address,
  hours,
  onName,
  onAddress,
  onHours,
  onSubmit,
  loading,
  submitLabel,
}: {
  name: string
  address: string
  hours: string
  onName: (value: string) => void
  onAddress: (value: string) => void
  onHours: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  loading: boolean
  submitLabel: string
}) {
  return (
    <form className="stacked-form" onSubmit={onSubmit}>
      <label className="form-field"><span>Facility name</span><input value={name} onChange={(event) => onName(event.target.value)} placeholder="e.g. Community Health Centre" maxLength={160} required /></label>
      <label className="form-field"><span>Address <small>Optional</small></span><input value={address} onChange={(event) => onAddress(event.target.value)} placeholder="Village, district" maxLength={500} /></label>
      <label className="form-field"><span>Operating hours <small>Optional</small></span><input value={hours} onChange={(event) => onHours(event.target.value)} placeholder="e.g. Mon–Sat, 9am–5pm" maxLength={300} /></label>
      <button type="submit" className="button button-primary button-wide" disabled={loading}>{loading ? 'Saving…' : submitLabel}<Icon name="arrow" size={15} /></button>
    </form>
  )
}

function PatientsPage({
  patients,
  allPatients,
  search,
  onSearch,
  selectedPatient,
  selectedPatientId,
  onSelectPatient,
}: {
  patients: Patient[]
  allPatients: Patient[]
  search: string
  onSearch: (value: string) => void
  selectedPatient: PatientDetail | null
  selectedPatientId: string | null
  onSelectPatient: (patientId: string | null) => void
}) {
  return (
    <div className="patient-records-layout">
      <section className="panel patient-directory">
        <div className="panel-heading">
          <div><span className="panel-kicker">REGISTERED RECORDS</span><h2>Patients <span className="heading-count">{allPatients.length}</span></h2></div>
        </div>
        <label className="search-field patient-search">
          <Icon name="search" size={17} />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search name or village" />
        </label>
        {patients.length === 0 ? (
          <EmptyState icon="patients" title="No matching patients" detail="Try a different name or village." />
        ) : (
          <div className="patient-directory-list">
            {patients.map((patient, index) => (
              <button
                type="button"
                className={`patient-directory-item ${selectedPatientId === patient.id ? 'selected' : ''}`}
                key={patient.id}
                onClick={() => onSelectPatient(patient.id)}
              >
                <span className={`patient-avatar avatar-${index % 4}`}>{initials(patient.full_name)}</span>
                <span className="patient-directory-copy"><strong>{patient.full_name}</strong><small>{patient.village || 'Village not recorded'}</small></span>
                <Icon name="arrow" size={15} />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel patient-detail-panel">
        {!selectedPatientId ? (
          <EmptyState icon="patients" title="Select a patient" detail="Choose a record to review worker-confirmed intake details." />
        ) : !selectedPatient ? (
          <div className="inline-loading"><span className="loading-spinner" />Loading patient record…</div>
        ) : (
          <>
            <div className="patient-detail-header">
              <span className="patient-avatar avatar-blue">{initials(selectedPatient.full_name)}</span>
              <div><span className="panel-kicker">PATIENT RECORD</span><h2>{selectedPatient.full_name}</h2><span className="patient-detail-meta">{selectedPatient.village || 'Village not recorded'} · Registered {formatDate(selectedPatient.created_at)}</span></div>
            </div>
            <div className="patient-detail-facts">
              <div><span>Date of birth</span><strong>{formatDate(selectedPatient.date_of_birth)}</strong></div>
              <div><span>Intake records</span><strong>{selectedPatient.intakes.length}</strong></div>
              <div><span>Record ID</span><strong className="record-id">{selectedPatient.id.slice(0, 12)}…</strong></div>
            </div>
            <div className="intake-section-heading"><div><span className="panel-kicker">CARE HISTORY</span><h3>Worker-confirmed intake</h3></div><span className="subtle-count">{selectedPatient.intakes.length} entries</span></div>
            {selectedPatient.intakes.length === 0 ? (
              <EmptyState icon="activity" title="No intake information" detail="No structured intake has been recorded for this patient." />
            ) : (
              <div className="intake-list">
                {[...selectedPatient.intakes].reverse().map((intake) => <IntakeCard intake={intake} key={intake.id} />)}
              </div>
            )}
            <div className="patient-safety-note">Clinical information is displayed as entered and confirmed. This dashboard does not diagnose or recommend treatment.</div>
          </>
        )}
      </section>
    </div>
  )
}

function IntakeCard({ intake }: { intake: IntakeRecord }) {
  return (
    <article className="intake-card">
      <div className="intake-card-top">
        <span className="intake-date"><Icon name="calendar" size={14} />{formatTime(intake.created_at)}</span>
        <span className={`confirmation-status ${intake.confirmed_by_worker ? 'confirmed' : 'unconfirmed'}`}>
          <Icon name={intake.confirmed_by_worker ? 'check' : 'close'} size={13} />
          {intake.confirmed_by_worker ? 'Worker confirmed' : 'Not confirmed'}
        </span>
      </div>
      <div className="intake-detail-grid">
        <div><span>Symptoms</span><p>{intake.symptoms}</p></div>
        <div><span>Duration</span><p>{intake.duration || 'Not recorded'}</p></div>
        <div className="history-detail"><span>Relevant history</span><p>{intake.relevant_history || 'Not recorded'}</p></div>
      </div>
    </article>
  )
}

export default App
