import { useMemo, useState } from 'react'
import { Edit3, Plus, Save, Search, Trash2, X } from 'lucide-react'
import type { Division, Soldier } from '../domain/soldier'
import { formatTime } from '../utils/date'

interface SoldierManagerProps {
  divisions: Division[]
  soldiers: Soldier[]
  onAdd: (input: Pick<Soldier, 'name' | 'divisionId' | 'note'>) => Promise<boolean>
  onAddDivision: (name: string) => Promise<boolean>
  onDelete: (id: string) => void
  onDeleteDivision: (id: string) => void
  onUpdate: (id: string, patch: Partial<Soldier>) => void
  onUpdateDivision: (id: string, name: string) => Promise<boolean>
}

export function SoldierManager({
  divisions,
  soldiers,
  onAdd,
  onAddDivision,
  onDelete,
  onDeleteDivision,
  onUpdate,
  onUpdateDivision,
}: SoldierManagerProps) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [divisionName, setDivisionName] = useState('')
  const [editingDivisionId, setEditingDivisionId] = useState<string>()
  const [editingDivisionName, setEditingDivisionName] = useState('')
  const [query, setQuery] = useState('')

  const divisionMap = useMemo(() => new Map(divisions.map((division) => [division.id, division.name])), [divisions])

  const filtered = soldiers.filter((soldier) => {
    const term = query.trim().toLowerCase()
    const division = divisionMap.get(soldier.divisionId ?? '') ?? '미지정'
    return (
      !term ||
      soldier.name.toLowerCase().includes(term) ||
      division.toLowerCase().includes(term) ||
      soldier.note?.toLowerCase().includes(term)
    )
  })

  const duplicateNames = new Set(
    soldiers
      .filter((soldier, index) =>
        soldiers.findIndex((item) => item.name === soldier.name && item.divisionId === soldier.divisionId) !== index,
      )
      .map((soldier) => `${soldier.divisionId}:${soldier.name}`),
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    const ok = await onAdd({ name, divisionId: divisionId || undefined, note })
    if (ok) {
      setName('')
      setNote('')
    }
  }

  async function handleAddDivision(event: React.FormEvent) {
    event.preventDefault()
    const ok = await onAddDivision(divisionName)
    if (ok) setDivisionName('')
  }

  async function saveDivisionName(id: string) {
    const ok = await onUpdateDivision(id, editingDivisionName)
    if (ok) {
      setEditingDivisionId(undefined)
      setEditingDivisionName('')
    }
  }

  return (
    <div className="stack">
      <section className="panel manager-form">
        <form className="field-line" onSubmit={handleAddDivision}>
          <input onChange={(event) => setDivisionName(event.target.value)} placeholder="새 분과 이름" value={divisionName} />
          <button className="primary-button" type="submit">
            <Plus size={18} /> 분과 추가
          </button>
        </form>
        <div className="division-grid">
          {divisions.map((division) => (
            <article className="division-card" key={division.id}>
              {editingDivisionId === division.id ? (
                <>
                  <input
                    autoFocus
                    onChange={(event) => setEditingDivisionName(event.target.value)}
                    value={editingDivisionName}
                  />
                  <div className="icon-row">
                    <button aria-label="저장" onClick={() => void saveDivisionName(division.id)} type="button">
                      <Save size={17} />
                    </button>
                    <button aria-label="취소" onClick={() => setEditingDivisionId(undefined)} type="button">
                      <X size={17} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong>{division.name}</strong>
                    <small>{soldiers.filter((soldier) => soldier.divisionId === division.id).length}명</small>
                  </div>
                  <div className="icon-row">
                    <button
                      aria-label="분과 수정"
                      onClick={() => {
                        setEditingDivisionId(division.id)
                        setEditingDivisionName(division.name)
                      }}
                      type="button"
                    >
                      <Edit3 size={17} />
                    </button>
                    <button
                      aria-label="분과 삭제"
                      onClick={() => {
                        if (window.confirm(`${division.name} 분과를 삭제할까요?`)) onDeleteDivision(division.id)
                      }}
                      type="button"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      </section>

      <form className="panel manager-form" onSubmit={handleSubmit}>
        <div className="field-line">
          <input onChange={(event) => setName(event.target.value)} placeholder="이름" value={name} />
          <select onChange={(event) => setDivisionId(event.target.value)} value={divisionId}>
            <option value="">미지정</option>
            {divisions.map((division) => (
              <option key={division.id} value={division.id}>
                {division.name}
              </option>
            ))}
          </select>
        </div>
        <input onChange={(event) => setNote(event.target.value)} placeholder="메모 선택 입력" value={note} />
        <button className="primary-button" type="submit">
          <Plus size={18} /> 인원 추가
        </button>
      </form>

      <label className="search-box">
        <Search size={18} />
        <input onChange={(event) => setQuery(event.target.value)} placeholder="이름, 분과, 메모 검색" value={query} />
      </label>

      <div className="soldier-grid">
        {filtered.map((soldier) => {
          const currentDivision = soldier.divisionId ?? ''
          const duplicateKey = `${soldier.divisionId}:${soldier.name}`
          return (
            <article className={`soldier-card ${soldier.active ? '' : 'inactive'}`} key={soldier.id}>
              <div className="soldier-card-top">
                <div>
                  <strong>{soldier.name}</strong>
                  <small>
                    {divisionMap.get(currentDivision) ?? '미지정'} · 수정 {formatTime(soldier.updatedAt)}
                    {duplicateNames.has(duplicateKey) ? ' · 중복 이름' : ''}
                  </small>
                </div>
                <div className="soldier-card-actions">
                  <label className="switch">
                    <input
                      checked={soldier.active}
                      onChange={(event) => onUpdate(soldier.id, { active: event.target.checked })}
                      type="checkbox"
                    />
                    <span />
                  </label>
                  <button
                    aria-label="인원 삭제"
                    onClick={() => {
                      if (window.confirm(`${soldier.name} 인원을 삭제할까요?`)) onDelete(soldier.id)
                    }}
                    type="button"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
              <select
                onChange={(event) => onUpdate(soldier.id, { divisionId: event.target.value || undefined })}
                value={currentDivision}
              >
                <option value="">미지정</option>
                {divisions.map((division) => (
                  <option key={division.id} value={division.id}>
                    {division.name}
                  </option>
                ))}
              </select>
              {soldier.note && <p>{soldier.note}</p>}
            </article>
          )
        })}
      </div>
    </div>
  )
}
