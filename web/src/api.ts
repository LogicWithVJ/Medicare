import type {
  AvailabilityUpdate,
  DiagnosticRecommendation,
  Facility,
  FacilityServices,
  Patient,
  PatientDetail,
  Referral,
  ReportedAvailability,
} from './types'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000').replace(
  /\/$/,
  '',
)

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body: unknown = await response.json()
      if (
        typeof body === 'object' &&
        body !== null &&
        'detail' in body &&
        typeof body.detail === 'string'
      ) {
        message = body.detail
      }
    } catch {
      message = `${message}: ${response.statusText || 'unexpected response'}`
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export const api = {
  listPatients: () => request<Patient[]>('/patients?limit=100'),
  getPatient: (patientId: string) => request<PatientDetail>(`/patients/${patientId}`),
  listReferrals: () => request<Referral[]>('/referrals?limit=100'),
  listFacilities: () => request<Facility[]>('/facilities?limit=100'),
  getFacilityServices: (facilityId: string) =>
    request<FacilityServices>(`/facilities/${facilityId}/services`),
  createFacility: (data: {
    name: string
    address?: string
    latitude?: number
    longitude?: number
    operating_hours?: string
  }) =>
    request<Facility>('/facilities', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAvailability: (
    facilityId: string,
    data: {
      service_name: string
      status: ReportedAvailability
      equipment_status?: string
      updated_by: string
    },
  ) =>
    request<AvailabilityUpdate>(`/facilities/${facilityId}/services/availability`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  availabilityHistory: (facilityId: string, serviceId: string) =>
    request<AvailabilityUpdate[]>(
      `/facilities/${facilityId}/services/${serviceId}/availability-history`,
    ),
  recommendFacilities: (service: string) =>
    request<DiagnosticRecommendation[]>(
      `/diagnostics/recommendations?service=${encodeURIComponent(service)}`,
    ),
  reviewReferral: (
    referralId: string,
    decision: 'approved' | 'rejected',
    note: string,
  ) =>
    request<Referral>(`/referrals/${referralId}/review`, {
      method: 'POST',
      body: JSON.stringify({
        decision,
        reviewed_by: 'demo-doctor',
        note: note || undefined,
      }),
    }),
  updateReferralStatus: (
    referralId: string,
    status: 'patient_arrived' | 'service_completed',
  ) =>
    request<Referral>(`/referrals/${referralId}/status`, {
      method: 'POST',
      body: JSON.stringify({
        status,
        updated_by: 'demo-facility-staff',
      }),
    }),
}

export const apiBaseUrl = API_BASE_URL
