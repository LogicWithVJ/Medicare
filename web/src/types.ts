export type ReferralStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'patient_arrived'
  | 'service_completed'
  | 'cancelled'

export type EffectiveAvailability = 'available' | 'unavailable' | 'outdated' | 'unknown'
export type ReportedAvailability = 'available' | 'unavailable' | 'unknown'

export interface Patient {
  id: string
  full_name: string
  date_of_birth: string | null
  village: string | null
  created_at: string
}

export interface IntakeRecord {
  id: string
  patient_id: string
  symptoms: string
  duration: string | null
  relevant_history: string | null
  confirmed_by_worker: boolean
  created_at: string
}

export interface PatientDetail extends Patient {
  intakes: IntakeRecord[]
}

export interface Referral {
  id: string
  patient_id: string
  intake_id: string | null
  target_facility_id: string | null
  requested_service: string
  reason: string
  requested_by: string
  status: ReferralStatus
  created_at: string
  updated_at: string
}

export interface Facility {
  id: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  operating_hours: string | null
  created_at: string
}

export interface FacilityService {
  id: string
  service_name: string
  effective_status: EffectiveAvailability
  latest_reported_status: ReportedAvailability | null
  equipment_status: string | null
  updated_at: string | null
}

export interface FacilityServices {
  facility: Facility
  services: FacilityService[]
}

export interface AvailabilityUpdate {
  id: string
  facility_service_id: string
  reported_status: ReportedAvailability
  equipment_status: string | null
  updated_by: string
  note: string | null
  created_at: string
}

export interface DiagnosticRecommendation {
  facility_id: string
  facility_name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  service_name: string
  effective_status: EffectiveAvailability
  latest_reported_status: ReportedAvailability | null
  equipment_status: string | null
  availability_updated_at: string | null
  distance_km: number | null
  reason: string
}
