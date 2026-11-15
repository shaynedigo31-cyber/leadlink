import { Info } from 'lucide-react'

export default function MockBanner() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
      <Info size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <p>Sample data. This screen is not connected to a database or a real account yet.</p>
    </div>
  )
}
