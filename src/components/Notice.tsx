export type NoticeState = { ok: boolean; text: string } | null

export default function Notice({ notice }: { notice: NoticeState }) {
  if (!notice) return null
  return (
    <p
      role={notice.ok ? 'status' : 'alert'}
      className={`rounded-xl px-4 py-3 text-sm ${notice.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
    >
      {notice.text}
    </p>
  )
}