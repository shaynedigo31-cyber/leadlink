// TEMPORARY SAMPLE DATA. Nothing here comes from a database.
// It is replaced by real Supabase data starting in Phase 2.
export const mockOrgs = [
  { id: 'sample-council', name: 'Sample Student Council', role: 'President' },
  { id: 'sample-club', name: 'Sample Tech Club', role: 'Member' },
]

export const mockStats = [
  { label: 'Active members', value: '48', hint: 'sample' },
  { label: 'Upcoming events', value: '3', hint: 'sample' },
  { label: 'Open tasks', value: '12', hint: 'sample' },
  { label: 'Library files', value: '126', hint: 'sample' },
]

export const mockEvents = [
  { title: 'General assembly', date: 'Dec 2', tag: 'Public' },
  { title: 'Officers planning workshop', date: 'Dec 9', tag: 'Restricted' },
  { title: 'Year-end outreach', date: 'Dec 18', tag: 'Public' },
]

export const mockTasks = [
  { title: 'Finalize program flow', owner: 'Secretary', progress: 80 },
  { title: 'Submit project proposal', owner: 'Project head', progress: 45 },
  { title: 'Update officer roster', owner: 'President', progress: 20 },
]
