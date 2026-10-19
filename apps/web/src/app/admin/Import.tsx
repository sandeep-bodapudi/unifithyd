// MIG-1 to MIG-4: import existing members from a CSV, preview first
import { useState } from 'react'
import { api } from '../api'
import { Button, Card, PageHead, useAction } from '../ui'

const TEMPLATE = 'holderName,email,phone,profileName,dob,plan,paidUntil,notes\nPriya Rao,priya@example.com,9876543210,Arjun Rao,2016-03-10,KIDS,2026-11-30,\n'

type Preview = { preview: true; total: number; valid: number; errors: { line: number; error: string }[] }

export default function Import() {
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [done, setDone] = useState<number | null>(null)
  const { busy, run } = useAction()
  const template = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`
  return (
    <div>
      <PageHead title="Import members" sub="Bring your current members and their paid-until dates into the app" />
      <Card>
        <ol className="steps2">
          <li>
            Download the <a href={template} download="unifit-import-template.csv">CSV template</a> and fill one row per person who trains. Children use the parent's email and phone as the holder.
          </li>
          <li>
            <code>plan</code> is the plan short code (KIDS, ADULT, GROUP). Dates are YYYY-MM-DD.
          </li>
          <li>Preview first. Fix any errors, then import. Everyone imported gets an invite to log in and accept the documents.</li>
        </ol>
        <label className="af">
          <span className="af__label">CSV file</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0]?.text().then((t) => (setCsv(t), setPreview(null), setDone(null)))} />
        </label>
        <div className="arow">
          <Button variant="ghost" busy={busy === 'p'} disabled={!csv} onClick={() => run('p', () => api.post<Preview>('/admin/import', { csv, commit: false })).then((r) => r && setPreview(r))}>
            Preview
          </Button>
          <Button busy={busy === 'c'} disabled={!preview || preview.errors.length > 0 || !preview.valid} onClick={() => confirm(`Import ${preview!.valid} members?`) && run('c', () => api.post<{ imported: number }>('/admin/import', { csv, commit: true })).then((r) => r && (setDone(r.imported), setPreview(null)))}>
            Import
          </Button>
        </div>
      </Card>
      {preview && (
        <Card>
          <p>
            <strong>{preview.valid}</strong> of {preview.total} rows are ready.
          </p>
          {preview.errors.length > 0 && (
            <ul className="mini">
              {preview.errors.map((e) => (
                <li key={e.line} className="aerror small">
                  Line {e.line}: {e.error}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {done !== null && (
        <Card>
          <strong>Imported {done} members.</strong> Invites are on their way.
        </Card>
      )}
    </div>
  )
}
