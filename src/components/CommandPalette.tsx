import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import type { NavItem } from '../lib/nav'

export default function CommandPalette({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(
    () => items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  )

  const go = (to: string) => {
    setOpen(false)
    setQuery('')
    navigate(to)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2 text-sm text-muted transition-all duration-200 hover:bg-brand-light"
        aria-label="Open quick jump"
      >
        <Search size={16} strokeWidth={1.75} />
        <span className="hidden sm:inline">Quick jump</span>
        <kbd className="hidden rounded-md bg-canvas px-1.5 py-0.5 text-xs sm:inline">Ctrl K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-4 pt-24 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Quick jump">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && results[0] && go(results[0].to)}
              placeholder="Jump to a page"
              className="w-full border-b border-hairline px-4 py-3.5 text-sm focus:outline-none"
            />
            <ul className="max-h-72 overflow-y-auto p-2">
              {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No pages match “{query}”.</li>}
              {results.map((r) => (
                <li key={r.to}>
                  <button onClick={() => go(r.to)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-brand-light">
                    <r.icon size={16} strokeWidth={1.75} className="text-brand" />
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
