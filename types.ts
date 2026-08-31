export type Role = 'reporter' | 'moderator' | 'admin';

export interface Profile {
  id: string;
  role: Role;
  display_name: string | null;
}

export interface Report {
  id: string;
  reporter_id: string;
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
}

export interface EvidenceItem {
  id: string;
  report_id: string;
  uploaded_by: string;
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
