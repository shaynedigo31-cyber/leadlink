import { Bell, CalendarDays, Folders, GraduationCap, History, Repeat, ShieldCheck, Users } from 'lucide-react'

const features = [
  { icon: Users, title: 'Members and officers', text: 'Applications, custom positions, committees and permissions for each organization.', status: 'Planned' },
  { icon: CalendarDays, title: 'Events and projects', text: 'Create official events, assign people and tasks, track progress, attach reports.', status: 'Planned' },
  { icon: Bell, title: 'Announcements', text: 'Organization-wide updates, reminders and a notification history.', status: 'Planned' },
  { icon: Folders, title: 'LEADLINK Library', text: 'Folders with per-folder access, version history, recovery and activity logs.', status: 'Planned' },
  { icon: History, title: 'Organization legacy', text: 'Timeline, yearbook and past administrations, with approval before publishing.', status: 'Planned' },
  { icon: Repeat, title: 'Leadership turnover', text: 'Checklists, transfers and acknowledgment between outgoing and incoming officers.', status: 'Planned' },
  { icon: GraduationCap, title: 'LEADSPIRE', text: 'Leadership resources and training material.', status: 'Planned' },
  { icon: ShieldCheck, title: 'Built-in security', text: 'Access rules enforced in the database, not just hidden buttons.', status: 'Planned' },
]

export default function Features() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-extrabold">Features</h1>
      <p className="mt-3 max-w-xl text-muted">What LEADLINK is being built to do. Everything below is planned; none of it works yet.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="card flex gap-4 p-5">
            <span className="icon-chip shrink-0"><f.icon size={20} strokeWidth={1.75} /></span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold">{f.title}</h3>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{f.status}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
