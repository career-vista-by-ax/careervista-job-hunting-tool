export const workspaceColumns = ['role', 'company', 'location', 'compensation', 'fit', 'review', 'application', 'freshness', 'source'] as const;
export const workspaceSorts = ['title', 'company', 'location', 'workArrangement', 'compensation', 'fit', 'confidence', 'review', 'application', 'freshness', 'createdAt', 'source'] as const;
export interface WorkspaceView {
  query: string; availability: 'active' | 'all' | 'closed'; fit: 'all' | 'unassessed' | 'strong' | 'promising' | 'investigate' | 'low_fit' | 'excluded';
  provenance: 'all' | 'unknown' | 'advertised' | 'external_report' | 'model_estimate';
  review: 'all' | 'unreviewed' | 'saved' | 'dismissed'; application: 'all' | 'none' | 'applied' | 'interview' | 'offer' | 'accepted' | 'rejected' | 'withdrawn' | 'follow_up';
  sort: typeof workspaceSorts[number]; direction: 'asc' | 'desc'; columns: (typeof workspaceColumns[number])[];
}
export const defaultWorkspaceView: WorkspaceView = { query: '', availability: 'active', fit: 'all', provenance: 'all', review: 'all', application: 'all', sort: 'createdAt', direction: 'desc', columns: [...workspaceColumns] };
