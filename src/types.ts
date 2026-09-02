export type Role = 'reporter' | 'moderator' | 'admin';

export interface Profile {
  id: string;
  role: Role;
  display_name: string | null;
  terms_version: string | null;
  terms_accepted_at: string | null;
}

export interface Report {
  id: string;
  reporter_id: string | null;
  entity_id: string | null;
  context: string | null;
  incident_category: string | null;
  incident_occurred_at: string | null;
  general_location: string | null;
  narrative: string | null;
  reported_to_police: boolean | null;
  reported_to_platform: boolean | null;
  reported_to_employer: boolean | null;
  reported_to_other: boolean | null;
  report_status: string | null;
  evidence_status: string | null;
  legal_status: string | null;
  reporter_identity_protected: boolean | null;
  created_at: string;
  submission_channel: 'account' | 'verified_email' | 'anonymous';
  contact_email: string | null;
  recovery_token_hash: string | null;
  terms_version: string;
  terms_accepted_at: string;
}

export interface EvidenceItem {
  id: string;
  report_id: string;
  uploaded_by: string | null;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  status: string;
  created_at: string;
}

export interface ModerationCase {
  id: string;
  report_id: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
}

export interface TrustedContact {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
}

export interface SafeZone {
  id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  active: boolean;
}

export interface CrimeHotspot {
  id: string;
  latitude: number;
  longitude: number;
  category: string;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_by: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  created_at: string;
}

export interface ModerationAction {
  id: string;
  case_id: string;
  actor_id: string;
  action: string;
  from_value: string | null;
  to_value: string | null;
  rationale: string;
  created_at: string;
}
export interface SharedRide {
  id: string;
  user_id: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  destination_label: string | null;
  expected_duration_minutes: number;
  share_token_hash: string;
  status: 'active' | 'arrived' | 'deviated' | 'overdue' | 'cancelled';
  last_lat: number | null;
  last_lng: number | null;
  last_ping_at: string | null;
  started_at: string;
  ended_at: string | null;
}
