// ADM-8: owner manages coaches and admins
import { useState } from 'react'
import { api } from '../api'
import { useSession } from '../session'
import { Button, Card, Check, ErrorNote, Field, Loading, PageHead, Pill, Select, Sheet, useAction, useLoad } from '../ui'

type StaffRow = { id: string; name: string; email: string; phone: string; disabled: boolean; roles: string[]; programs: { id: string; name: string }[] }

export default function Staff() {
  const { me } = useSession()
  const owner = me!.account.roles.includes('OWNER')
  const { data, error, loading, reload } = useLoad(() => api.get<{ staff: StaffRow[] }>('/admin/staff'))
  const meta = useLoad(() => api.get<{ programs: { id: string; name: string }[] }>('/staff/meta'))
  const [add, setAdd] = useState(false)
  const [edit, setEdit] = useState<StaffRow | null>(null)
  const [temp, setTemp] = useState<{ name: string; pw: string } | null>(null)
  const { busy, run } = useAction()
  if (loading && !data) return <Loading />
  return (
    <div>
      <PageHead title="Staff" sub={owner ? 'Add coaches and admins. Each logs in with a password and an email code.' : 'Only the owner can change staff.'} action={owner && <Button size="sm" onClick={() => setAdd(true)}>+ Add staff</Button>} />
      <ErrorNote error={error} />
      <ul className="hist">
        {data?.staff.map((s) => (
          <li key={s.id} className="acard hist__row">
            <div>
              <strong>{s.name}</strong> {s.roles.filter((r) => r !== 'MEMBER').map((r) => <Pill key={r} status="INFO" label={r.toLowerCase()} />)} {s.disabled && <Pill status="CANCELLED" label="Disabled" />}
              <p className="muted small">
                {s.email} · {s.phone}
              </p>
              {s.programs.length > 0 && <p className="small">Programs: {s.programs.map((p) => p.name).join(', ')}</p>}
            </div>
            {owner && !s.roles.includes('OWNER') && (
              <div className="arow arow--wrap">
                <Button size="sm" variant="ghost" onClick={() => setEdit(s)}>
                  Edit
                </Button>
                <Button size="sm" variant="quiet" busy={busy === 'pw' + s.id} onClick={() => confirm(`Reset ${s.name}'s password? They will be logged out.`) && run('pw' + s.id, async () => { const r = await api.post<{ tempPassword: string }>(`/admin/staff/${s.id}/reset-password`); setTemp({ name: s.name, pw: r.tempPassword }) })}>
                  Reset password
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {add && meta.data && (
        <StaffForm programs={meta.data.programs} onClose={() => setAdd(false)} onDone={(name, pw) => (setAdd(false), pw && setTemp({ name, pw }), void reload())} />
      )}
      {edit && meta.data && <EditStaff s={edit} programs={meta.data.programs} onClose={() => setEdit(null)} onDone={() => (setEdit(null), void reload())} />}
      {temp && (
        <Sheet title="Temporary password" onClose={() => setTemp(null)}>
          <p>
            Give this to <strong>{temp.name}</strong> in person or by phone. It is shown only once. They should change it after logging in.
          </p>
          <Card>
            <code className="bigcode">{temp.pw}</code>
          </Card>
        </Sheet>
      )}
    </div>
  )
}

function StaffForm({ programs, onClose, onDone }: { programs: { id: string; name: string }[]; onClose: () => void; onDone: (name: string, pw: string | null) => void }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', role: 'COACH', programIds: [] as string[] })
  const { busy, run } = useAction()
  return (
    <Sheet title="Add staff" onClose={onClose}>
      <Field label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Field label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <Field label="Mobile" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(-10) })} />
      <Select label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
        <option value="COACH">Coach</option>
        <option value="ADMIN">Admin</option>
      </Select>
      <fieldset className="afieldset">
        <legend>Programs they run</legend>
        {programs.map((p) => (
          <Check key={p.id} label={p.name} checked={f.programIds.includes(p.id)} onChange={(e) => setF({ ...f, programIds: e.target.checked ? [...f.programIds, p.id] : f.programIds.filter((x) => x !== p.id) })} />
        ))}
      </fieldset>
      <Button block busy={!!busy} onClick={() => run('a', () => api.post<{ tempPassword: string | null }>('/admin/staff', f)).then((r) => r && onDone(f.name, r.tempPassword))}>
        Add
      </Button>
    </Sheet>
  )
}

function EditStaff({ s, programs, onClose, onDone }: { s: StaffRow; programs: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const [roles, setRoles] = useState<string[]>(s.roles.filter((r) => r === 'COACH' || r === 'ADMIN'))
  const [programIds, setProgramIds] = useState(s.programs.map((p) => p.id))
  const [disabled, setDisabled] = useState(s.disabled)
  const { busy, run } = useAction()
  return (
    <Sheet title={`Edit ${s.name}`} onClose={onClose}>
      <fieldset className="afieldset">
        <legend>Roles</legend>
        {['COACH', 'ADMIN'].map((r) => (
          <Check key={r} label={r === 'COACH' ? 'Coach' : 'Admin'} checked={roles.includes(r)} onChange={(e) => setRoles(e.target.checked ? [...roles, r] : roles.filter((x) => x !== r))} />
        ))}
      </fieldset>
      <fieldset className="afieldset">
        <legend>Programs</legend>
        {programs.map((p) => (
          <Check key={p.id} label={p.name} checked={programIds.includes(p.id)} onChange={(e) => setProgramIds(e.target.checked ? [...programIds, p.id] : programIds.filter((x) => x !== p.id))} />
        ))}
      </fieldset>
      <Check label="Disabled (cannot log in)" checked={disabled} onChange={(e) => setDisabled(e.target.checked)} />
      <Button block busy={!!busy} onClick={() => run('e', () => api.patch(`/admin/staff/${s.id}`, { roles, programIds, disabled }), 'Saved').then((r) => r && onDone())}>
        Save
      </Button>
    </Sheet>
  )
}
