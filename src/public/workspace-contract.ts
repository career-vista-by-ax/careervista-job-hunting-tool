export const workspaceColumns = ['role', 'fit', 'company', 'location', 'compensation', 'workArrangement', 'employment', 'confidence', 'concerns', 'unknowns', 'reasons', 'review', 'application', 'followUp', 'freshness', 'createdAt', 'source'] as const;
export const comparisonColumns: (typeof workspaceColumns[number])[] = ['role', 'fit', 'company', 'location', 'compensation', 'workArrangement', 'confidence', 'concerns', 'freshness', 'source', 'review', 'application'];
export const workspaceSorts = ['title', 'company', 'location', 'workArrangement', 'employment', 'compensation', 'fit', 'confidence', 'concerns', 'unknowns', 'review', 'application', 'followUp', 'freshness', 'createdAt', 'source'] as const;
export interface WorkspaceView {
  query: string; availability: 'active' | 'all' | 'closed'; fit: 'all' | 'shortlist' | 'unassessed' | 'strong' | 'promising' | 'investigate' | 'low_fit' | 'excluded';
  provenance: 'all' | 'unknown' | 'advertised' | 'external_report' | 'model_estimate';
  review: 'all' | 'unreviewed' | 'saved' | 'dismissed'; application: 'all' | 'none' | 'applied' | 'interview' | 'offer' | 'accepted' | 'rejected' | 'withdrawn' | 'follow_up';
  sort: typeof workspaceSorts[number]; direction: 'asc' | 'desc'; columns: (typeof workspaceColumns[number])[];
  density: 'compact' | 'comfortable';
}
export const defaultWorkspaceView: WorkspaceView = { query: '', availability: 'active', fit: 'all', provenance: 'all', review: 'all', application: 'all', sort: 'fit', direction: 'asc', columns: [...comparisonColumns], density: 'compact' };
