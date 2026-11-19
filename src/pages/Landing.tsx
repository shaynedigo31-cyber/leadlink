import { Link } from 'react-router-dom'
import { CalendarDays, Folders, GraduationCap, History, Repeat, Users } from 'lucide-react'

const highlights = [
  { icon: Folders, title: 'LEADLINK Library', text: 'Proposals, templates and reports stay with the organization, not with whoever held the files last.' },
  { icon: Repeat, title: 'Leadership turnover', text: 'Hand over documents, projects and responsibilities with a checklist the next officers sign off on.' },
  { icon: History, title: 'Organization legacy', text: 'A timeline and yearbook of past administrations, events and milestones.' },
  { icon: Users, title: 'Members and officers', text: 'Custom positions, committees and permissions per organization.' },
  { icon: CalendarDays, title: 'Events and projects', text: 'Plan, assign, track and report in one place.' },
  { icon: GraduationCap, title: 'LEADSPIRE', text: 'Leadership guides and training material that grows with your members.' },
]

export default function Landing() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pt-24">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">
            Every leader builds. Every generation continues.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            LEADLINK keeps your student organization’s members, events, documents and history in one place, so new officers never start from zero.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className="btn-primary">Create an account</Link>
            <Link to="/login" className="btn-ghost">Log in</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((h) => (
            <div key={h.title} className="card p-5 transition-all duration-200 hover:-translate-y-0.5">
              <span className="icon-chip"><h.icon size={20} strokeWidth={1.75} /></span>
              <h3 className="mt-4 text-lg font-bold">{h.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{h.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
