import React, { useState } from 'react'

interface AddDepartmentModalProps {
  onClose: () => void
}

interface FormState {
  name: string
  id: string
  emoji: string
  color: string
  description: string
  keywords: string
  sprite: string
  tools: string
}

const SPRITES = ['dev-1', 'dev-2', 'employee-1', 'employee-2', 'employee-3', 'Frontend-dev-1', 'explore-1', 'security-audit-1']

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '')
}

const INITIAL: FormState = {
  name: '',
  id: '',
  emoji: '🧩',
  color: '#607d8b',
  description: '',
  keywords: '',
  sprite: 'employee-3',
  tools: 'Read, Grep, Glob, Bash',
}

const AddDepartmentModal: React.FC<AddDepartmentModalProps> = ({ onClose }) => {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  const effectiveId = form.id.trim() ? slugify(form.id) : slugify(form.name)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setStatus('error')
      setMessage('Nama departemen wajib diisi.')
      return
    }
    setStatus('saving')
    setMessage('')
    try {
      const res = await fetch('http://127.0.0.1:3334/department', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          id: effectiveId,
          emoji: form.emoji.trim() || '🧩',
          color: form.color.trim() || '#607d8b',
          description: form.description.trim() || `Menangani tugas terkait ${form.name.trim()}`,
          keywords: form.keywords.trim() || effectiveId,
          sprite: form.sprite,
          tools: form.tools.trim() || 'Read, Grep, Glob, Bash',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Gagal menambah departemen')
      }
      setStatus('done')
      setMessage(`Departemen "${data.name}" berhasil ditambahkan. Restart office (stop-office.sh lalu start-office.sh) supaya aktif.`)
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Gagal menambah departemen')
    }
  }

  return (
    <div className="dept-modal-overlay" onClick={onClose}>
      <div className="dept-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dept-modal-header">
          <span>🏢 Tambah Departemen Baru</span>
          <button className="dept-modal-close" onClick={onClose}>✕</button>
        </div>

        {status === 'done' ? (
          <div className="dept-modal-body">
            <p className="dept-modal-success">✅ {message}</p>
            <button className="dept-modal-submit" onClick={onClose}>Tutup</button>
          </div>
        ) : (
          <form className="dept-modal-body" onSubmit={submit}>
            <label>
              Nama departemen
              <input
                type="text"
                placeholder="Marketing"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                autoFocus
              />
            </label>

            <label>
              ID role <span className="dept-modal-hint">(huruf kecil, tanpa spasi — kosongkan untuk otomatis)</span>
              <input
                type="text"
                placeholder={slugify(form.name) || 'marketing'}
                value={form.id}
                onChange={(e) => update({ id: e.target.value })}
              />
            </label>

            <div className="dept-modal-row">
              <label>
                Emoji
                <input type="text" value={form.emoji} onChange={(e) => update({ emoji: e.target.value })} maxLength={4} />
              </label>
              <label>
                Warna
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : '#607d8b'} onChange={(e) => update({ color: e.target.value })} />
              </label>
            </div>

            <label>
              Deskripsi tugas <span className="dept-modal-hint">(kapan subagent ini dipanggil)</span>
              <textarea
                placeholder="Menangani campaign marketing, konten promosi, dan analisis traffic"
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={2}
              />
            </label>

            <label>
              Kata kunci di chat <span className="dept-modal-hint">(pisah koma)</span>
              <input
                type="text"
                placeholder="marketing, campaign, promosi, iklan"
                value={form.keywords}
                onChange={(e) => update({ keywords: e.target.value })}
              />
            </label>

            <label>
              Sprite karakter
              <select value={form.sprite} onChange={(e) => update({ sprite: e.target.value })}>
                {SPRITES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            <label>
              Tools yang diizinkan
              <input type="text" value={form.tools} onChange={(e) => update({ tools: e.target.value })} />
            </label>

            {status === 'error' && <p className="dept-modal-error">⚠️ {message}</p>}

            <button className="dept-modal-submit" type="submit" disabled={status === 'saving'}>
              {status === 'saving' ? 'Menyimpan...' : 'Tambah Departemen'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default AddDepartmentModal
