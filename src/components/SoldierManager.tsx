import { useMemo, useState } from 'react'
import { Edit3, Layers, Plus, Save, Search, Trash2, UserPlus, Users, X } from 'lucide-react'
import type { Division, Section, Soldier } from '../domain/soldier'
import { formatTime } from '../utils/date'
import { matchesSearch } from '../utils/search'

interface SoldierManagerProps {
  divisions: Division[]
  sections: Section[]
  soldiers: Soldier[]
  onAdd: (input: Pick<Soldier, 'name' | 'divisionId' | 'section' | 'note'>) => Promise<boolean>
  onAddDivision: (name: string) => Promise<boolean>
  onAddSection: (name: string) => Promise<boolean>
  onDelete: (id: string) => void
  onDeleteDivision: (id: string) => void
  onDeleteSection: (id: string) => void
  onUpdate: (id: string, patch: Partial<Soldier>) => void
  onBulkUpdate: (ids: string[], patch: Partial<Soldier>) => Promise<void>
  onUpdateDivision: (id: string, name: string) => Promise<boolean>
  onUpdateSection: (id: string, name: string) => Promise<boolean>
}

type ManagerModal = 'add' | 'division' | 'section' | 'bulk'

export function SoldierManager({
  divisions,
  sections,
  soldiers,
  onAdd,
  onAddDivision,
  onAddSection,
  onDelete,
  onDeleteDivision,
  onDeleteSection,
  onUpdate,
  onBulkUpdate,
  onUpdateDivision,
  onUpdateSection,
}: SoldierManagerProps) {
  const [modal, setModal] = useState<ManagerModal>()
  const [name, setName] = useState('')
  const [section, setSection] = useState('')
  const [note, setNote] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [divisionName, setDivisionName] = useState('')
  const [sectionName, setSectionName] = useState('')
  const [editingDivisionId, setEditingDivisionId] = useState<string>()
  const [editingDivisionName, setEditingDivisionName] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<string>()
  const [editingSectionName, setEditingSectionName] = useState('')
  const [query, setQuery] = useState('')
  const [divisionFilterId, setDivisionFilterId] = useState<string | 'all' | 'unassigned'>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDivisionId, setBulkDivisionId] = useState('')
  const [bulkSection, setBulkSection] = useState('')
  const [editingSoldier, setEditingSoldier] = useState<Soldier>()

  const divisionMap = useMemo(() => new Map(divisions.map((division) => [division.id, division.name])), [divisions])
  const sectionNames = useMemo(() => sections.map((item) => item.name).sort(), [sections])

  const filtered = soldiers
    .filter((soldier) => {
      const division = divisionMap.get(soldier.divisionId ?? '') ?? '포대 미지정'
      if (divisionFilterId === 'unassigned' && soldier.divisionId) return false
      if (divisionFilterId !== 'all' && divisionFilterId !== 'unassigned' && soldier.divisionId !== divisionFilterId) return false
      return matchesSearch(query, [soldier.name, division, soldier.section, soldier.note])
    })
    .sort((a, b) => {
      return a.name.localeCompare(b.name, 'ko')
    })

  const filteredIds = filtered.map((soldier) => soldier.id)
  const selectedFilteredCount = filteredIds.filter((id) => selectedIds.includes(id)).length
  const hasUnassignedSoldiers = soldiers.some((soldier) => !soldier.divisionId)
  const duplicateNames = new Set(
    soldiers
      .filter((soldier, index) =>
        soldiers.findIndex((item) => item.name === soldier.name && item.divisionId === soldier.divisionId) !== index,
      )
      .map((soldier) => `${soldier.divisionId}:${soldier.name}`),
  )

  function closeModal() {
    setModal(undefined)
    setEditingDivisionId(undefined)
    setEditingSectionId(undefined)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    const ok = await onAdd({ name, divisionId: divisionId || undefined, section: section || undefined, note })
    if (ok) {
      setName('')
      setSection('')
      setNote('')
      closeModal()
    }
  }

  async function handleAddDivision(event: React.FormEvent) {
    event.preventDefault()
    const ok = await onAddDivision(divisionName)
    if (ok) setDivisionName('')
  }

  async function handleAddSection(event: React.FormEvent) {
    event.preventDefault()
    const ok = await onAddSection(sectionName)
    if (ok) setSectionName('')
  }

  async function saveDivisionName(id: string) {
    const ok = await onUpdateDivision(id, editingDivisionName)
    if (ok) {
      setEditingDivisionId(undefined)
      setEditingDivisionName('')
    }
  }

  async function saveSectionName(id: string) {
    const ok = await onUpdateSection(id, editingSectionName)
    if (ok) {
      setEditingSectionId(undefined)
      setEditingSectionName('')
    }
  }

  function submitOnEnter(event: React.KeyboardEvent, action: () => void | Promise<void>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    void action()
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  function toggleAllFiltered() {
    setSelectedIds((current) =>
      selectedFilteredCount === filteredIds.length
        ? current.filter((id) => !filteredIds.includes(id))
        : Array.from(new Set([...current, ...filteredIds])),
    )
  }

  async function applyBulkDivision() {
    await onBulkUpdate(selectedIds, { divisionId: bulkDivisionId || undefined })
    setSelectedIds([])
  }

  async function applyBulkSection() {
    await onBulkUpdate(selectedIds, { section: bulkSection || undefined })
    setSelectedIds([])
  }

  function updateEditingSoldier(patch: Partial<Soldier>) {
    if (!editingSoldier) return
    setEditingSoldier({ ...editingSoldier, ...patch })
  }

  function saveSoldierEdit() {
    if (!editingSoldier) return
    onUpdate(editingSoldier.id, {
      name: editingSoldier.name.trim(),
      divisionId: editingSoldier.divisionId || undefined,
      section: editingSoldier.section || undefined,
      note: editingSoldier.note?.trim() || undefined,
      active: editingSoldier.active,
    })
    setEditingSoldier(undefined)
  }

  function handleSoldierEditSubmit(event: React.FormEvent) {
    event.preventDefault()
    saveSoldierEdit()
  }

  return (
    <div className="stack">
      <section className="panel manager-toolbar">
        <div className="manager-toolbar-summary">
          <strong>인원 {soldiers.length}명</strong>
          <span>선택 {selectedIds.length}명 · 표시 {filtered.length}명</span>
        </div>
        <div className="manager-action-grid">
          <button onClick={() => setModal('add')} type="button">
            <UserPlus size={18} /> 인원 추가
          </button>
          <button onClick={() => setModal('bulk')} type="button">
            <Users size={18} /> 일괄 적용
          </button>
          <button onClick={() => setModal('division')} type="button">
            <Layers size={18} /> 포대 관리
          </button>
          <button onClick={() => setModal('section')} type="button">
            <Plus size={18} /> 분과 관리
          </button>
        </div>
      </section>

      <label className="search-box">
        <Search size={18} />
        <input onChange={(event) => setQuery(event.target.value)} placeholder="이름, 포대, 분과, 메모 검색" value={query} />
      </label>

      <div className="chip-row division-filter-row" aria-label="포대별 인원 필터">
        <button className={divisionFilterId === 'all' ? 'active' : ''} onClick={() => setDivisionFilterId('all')} type="button">
          전체
        </button>
        {divisions.map((division) => (
          <button
            className={divisionFilterId === division.id ? 'active' : ''}
            key={division.id}
            onClick={() => setDivisionFilterId(division.id)}
            type="button"
          >
            {division.name}
          </button>
        ))}
        {hasUnassignedSoldiers && (
          <button
            className={divisionFilterId === 'unassigned' ? 'active' : ''}
            onClick={() => setDivisionFilterId('unassigned')}
            type="button"
          >
            미지정
          </button>
        )}
      </div>

      <div className="soldier-grid">
        {filtered.map((soldier) => {
          const currentDivision = soldier.divisionId ?? ''
          const duplicateKey = `${soldier.divisionId}:${soldier.name}`
          return (
            <article className={`soldier-card ${soldier.active ? '' : 'inactive'}`} key={soldier.id}>
              <div className="soldier-card-top">
                <button
                  className={`soldier-select-line ${selectedIds.includes(soldier.id) ? 'selected' : ''}`}
                  onClick={() => toggleSelection(soldier.id)}
                  type="button"
                >
                  <span className="soldier-select-dot" />
                  <span>
                    <strong>{soldier.name}</strong>
                    <small>
                      {divisionMap.get(currentDivision) ?? '포대 미지정'} · {soldier.section || '분과 미지정'} · 수정{' '}
                      {formatTime(soldier.updatedAt)}
                      {duplicateNames.has(duplicateKey) ? ' · 중복 이름' : ''}
                    </small>
                  </span>
                </button>
                <div className="soldier-card-actions">
                  <label className="switch">
                    <input
                      checked={soldier.active}
                      onChange={(event) => onUpdate(soldier.id, { active: event.target.checked })}
                      type="checkbox"
                    />
                    <span />
                  </label>
                  <button aria-label="인원 수정" onClick={() => setEditingSoldier(soldier)} type="button">
                    <Edit3 size={17} />
                  </button>
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
              {soldier.note && <p>{soldier.note}</p>}
            </article>
          )
        })}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <section className="modal manager-modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <div>
                <span>인원관리</span>
                <h2>
                  {modal === 'add' && '인원 추가'}
                  {modal === 'bulk' && '일괄 적용'}
                  {modal === 'division' && '포대 관리'}
                  {modal === 'section' && '분과 관리'}
                </h2>
              </div>
              <button aria-label="닫기" className="icon-button" onClick={closeModal} type="button">
                <X size={20} />
              </button>
            </header>

            {modal === 'add' && (
              <form className="manager-form" onSubmit={handleSubmit}>
                <input onChange={(event) => setName(event.target.value)} placeholder="이름" value={name} />
                <div className="field-line">
                  <select onChange={(event) => setDivisionId(event.target.value)} value={divisionId}>
                    <option value="">포대 미지정</option>
                    {divisions.map((division) => (
                      <option key={division.id} value={division.id}>
                        {division.name}
                      </option>
                    ))}
                  </select>
                  <select onChange={(event) => setSection(event.target.value)} value={section}>
                    <option value="">분과 미지정</option>
                    {sectionNames.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <input onChange={(event) => setNote(event.target.value)} placeholder="메모 선택 입력" value={note} />
                <button className="primary-button" type="submit">
                  <Plus size={18} /> 추가
                </button>
              </form>
            )}

            {modal === 'bulk' && (
              <div className="manager-form">
                <div className="bulk-editor-title">
                  <strong>선택 {selectedIds.length}명</strong>
                  <span>현재 목록 {filtered.length}명</span>
                </div>
                <button className="ghost-button" disabled={filtered.length === 0} onClick={toggleAllFiltered} type="button">
                  {selectedFilteredCount === filteredIds.length && filtered.length > 0 ? '현재 목록 선택 해제' : '현재 목록 전체 선택'}
                </button>
                <div className="field-line">
                  <select onChange={(event) => setBulkDivisionId(event.target.value)} value={bulkDivisionId}>
                    <option value="">포대 미지정</option>
                    {divisions.map((division) => (
                      <option key={division.id} value={division.id}>
                        {division.name}
                      </option>
                    ))}
                  </select>
                  <button className="secondary-button" disabled={selectedIds.length === 0} onClick={() => void applyBulkDivision()} type="button">
                    포대 적용
                  </button>
                </div>
                <div className="field-line">
                  <select onChange={(event) => setBulkSection(event.target.value)} value={bulkSection}>
                    <option value="">분과 미지정</option>
                    {sectionNames.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <button className="secondary-button" disabled={selectedIds.length === 0} onClick={() => void applyBulkSection()} type="button">
                    분과 적용
                  </button>
                </div>
              </div>
            )}

            {modal === 'division' && (
              <div className="manager-form">
                <form className="field-line" onSubmit={handleAddDivision}>
                  <input onChange={(event) => setDivisionName(event.target.value)} placeholder="새 포대 이름" value={divisionName} />
                  <button className="primary-button" type="submit">
                    <Plus size={18} /> 추가
                  </button>
                </form>
                <div className="management-list">
                  {divisions.map((division) => (
                    <article className="division-card" key={division.id}>
                      {editingDivisionId === division.id ? (
                        <>
                          <input
                            autoFocus
                            onChange={(event) => setEditingDivisionName(event.target.value)}
                            onKeyDown={(event) => submitOnEnter(event, () => saveDivisionName(division.id))}
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
                              aria-label="포대 수정"
                              onClick={() => {
                                setEditingDivisionId(division.id)
                                setEditingDivisionName(division.name)
                              }}
                              type="button"
                            >
                              <Edit3 size={17} />
                            </button>
                            <button
                              aria-label="포대 삭제"
                              onClick={() => {
                                if (window.confirm(`${division.name} 포대를 삭제할까요?`)) onDeleteDivision(division.id)
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
              </div>
            )}

            {modal === 'section' && (
              <div className="manager-form">
                <form className="field-line" onSubmit={handleAddSection}>
                  <input onChange={(event) => setSectionName(event.target.value)} placeholder="새 분과 이름" value={sectionName} />
                  <button className="primary-button" type="submit">
                    <Plus size={18} /> 추가
                  </button>
                </form>
                <div className="management-list">
                  {sections.length === 0 && <p className="muted-copy">분과를 추가하면 인원 등록, 수정, 일괄 적용에서 선택할 수 있습니다.</p>}
                  {sections.map((item) => (
                    <article className="division-card" key={item.id}>
                      {editingSectionId === item.id ? (
                        <>
                          <input
                            autoFocus
                            onChange={(event) => setEditingSectionName(event.target.value)}
                            onKeyDown={(event) => submitOnEnter(event, () => saveSectionName(item.id))}
                            value={editingSectionName}
                          />
                          <div className="icon-row">
                            <button aria-label="저장" onClick={() => void saveSectionName(item.id)} type="button">
                              <Save size={17} />
                            </button>
                            <button aria-label="취소" onClick={() => setEditingSectionId(undefined)} type="button">
                              <X size={17} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <strong>{item.name}</strong>
                            <small>{soldiers.filter((soldier) => soldier.section === item.name).length}명</small>
                          </div>
                          <div className="icon-row">
                            <button
                              aria-label="분과 수정"
                              onClick={() => {
                                setEditingSectionId(item.id)
                                setEditingSectionName(item.name)
                              }}
                              type="button"
                            >
                              <Edit3 size={17} />
                            </button>
                            <button
                              aria-label="분과 삭제"
                              onClick={() => {
                                if (window.confirm(`${item.name} 분과를 삭제할까요? 해당 인원은 분과 미지정으로 변경됩니다.`)) {
                                  onDeleteSection(item.id)
                                }
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
              </div>
            )}
          </section>
        </div>
      )}

      {editingSoldier && (
        <div className="modal-backdrop" onClick={() => setEditingSoldier(undefined)}>
          <form className="modal soldier-edit-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleSoldierEditSubmit}>
            <header className="modal-header">
              <div>
                <span>인원 수정</span>
                <h2>{editingSoldier.name}</h2>
              </div>
              <button aria-label="닫기" className="icon-button" onClick={() => setEditingSoldier(undefined)} type="button">
                <X size={20} />
              </button>
            </header>
            <input onChange={(event) => updateEditingSoldier({ name: event.target.value })} placeholder="이름" value={editingSoldier.name} />
            <select
              onChange={(event) => updateEditingSoldier({ divisionId: event.target.value || undefined })}
              value={editingSoldier.divisionId ?? ''}
            >
              <option value="">포대 미지정</option>
              {divisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.name}
                </option>
              ))}
            </select>
            <select
              onChange={(event) => updateEditingSoldier({ section: event.target.value || undefined })}
              value={editingSoldier.section ?? ''}
            >
              <option value="">분과 미지정</option>
              {sectionNames.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              onChange={(event) => updateEditingSoldier({ note: event.target.value })}
              placeholder="메모"
              value={editingSoldier.note ?? ''}
            />
            <label className="toggle-line">
              <input
                checked={editingSoldier.active}
                onChange={(event) => updateEditingSoldier({ active: event.target.checked })}
                type="checkbox"
              />
              활성 인원
            </label>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setEditingSoldier(undefined)} type="button">
                취소
              </button>
              <button className="primary-button" type="submit">
                저장
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
