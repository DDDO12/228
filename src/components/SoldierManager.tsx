import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { ChevronDown, Edit3, Layers, Plus, Save, Search, Trash2, UserPlus, Users, X } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'
import type { Division, Section, Soldier } from '../domain/soldier'
import { formatTime } from '../utils/date'
import { matchesSearch } from '../utils/search'

interface SoldierManagerProps {
  divisions: Division[]
  sections: Section[]
  soldiers: Soldier[]
  onAdd: (input: Pick<Soldier, 'name' | 'divisionId' | 'section' | 'note'>) => Promise<boolean>
  onAddDivision: (name: string) => Promise<boolean>
  onAddSection: (name: string, divisionId?: string) => Promise<boolean>
  onDelete: (id: string) => void
  onDeleteDivision: (id: string) => void
  onDeleteSection: (id: string) => void
  onUpdate: (id: string, patch: Partial<Soldier>) => void
  onBulkUpdate: (ids: string[], patch: Partial<Soldier>) => Promise<void>
  onUpdateDivision: (id: string, name: string) => Promise<boolean>
  onUpdateSection: (id: string, name: string) => Promise<boolean>
}

type ManagerModal = 'add' | 'division' | 'bulk'
type SoldierFieldKey = 'addName' | 'addDivision' | 'addSection' | 'addNote' | 'editName' | 'editDivision' | 'editSection' | 'editNote' | 'editActive'
const addSoldierFieldOrder: SoldierFieldKey[] = ['addName', 'addDivision', 'addSection', 'addNote']
const editSoldierFieldOrder: SoldierFieldKey[] = ['editName', 'editDivision', 'editSection', 'editNote', 'editActive']

const sectionCollator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' })

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
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>({})
  const [editingDivisionId, setEditingDivisionId] = useState<string>()
  const [editingDivisionName, setEditingDivisionName] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<string>()
  const [editingSectionName, setEditingSectionName] = useState('')
  const [query, setQuery] = useState('')
  const [divisionFilterId, setDivisionFilterId] = useState<string | 'all' | 'unassigned'>('all')
  const [sectionFilter, setSectionFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDivisionId, setBulkDivisionId] = useState('')
  const [bulkSection, setBulkSection] = useState('')
  const [editingSoldier, setEditingSoldier] = useState<Soldier>()
  const [inlineSectionSoldierId, setInlineSectionSoldierId] = useState<string>()
  const [confirmDeleteSoldier, setConfirmDeleteSoldier] = useState<Soldier>()
  const [confirmDeleteDivision, setConfirmDeleteDivision] = useState<Division>()
  const [confirmDeleteSection, setConfirmDeleteSection] = useState<{ id: string; name: string; divisionName: string }>()
  const [activeField, setActiveField] = useState<SoldierFieldKey>('addName')

  const divisionMap = useMemo(() => new Map(divisions.map((division) => [division.id, division.name])), [divisions])
  const sectionNames = useMemo(
    () =>
      Array.from(new Set([...sections.map((item) => item.name), ...soldiers.map((soldier) => soldier.section).filter(Boolean)]))
        .filter((item): item is string => Boolean(item))
        .sort(sectionCollator.compare),
    [sections, soldiers],
  )
  const sectionNamesByDivision = useMemo(() => {
    const map = new Map<string, string[]>()
    sections.forEach((item) => {
      const key = item.divisionId ?? ''
      const names = map.get(key) ?? []
      if (!names.includes(item.name)) names.push(item.name)
      map.set(key, names)
    })
    soldiers.forEach((soldier) => {
      const name = soldier.section?.trim()
      if (!name) return
      const key = soldier.divisionId ?? ''
      const names = map.get(key) ?? []
      if (!names.includes(name)) names.push(name)
      map.set(key, names)
    })
    map.forEach((names) => names.sort(sectionCollator.compare))
    return map
  }, [sections, soldiers])

  const sectionNamesForDivision = (targetDivisionId?: string) =>
    targetDivisionId ? (sectionNamesByDivision.get(targetDivisionId) ?? []) : sectionNames

  const sectionNamesForFilter = (targetDivisionFilterId: typeof divisionFilterId) => {
    if (targetDivisionFilterId === 'all') return sectionNames
    if (targetDivisionFilterId === 'unassigned') return sectionNamesByDivision.get('') ?? []
    return sectionNamesByDivision.get(targetDivisionFilterId) ?? []
  }

  const hasUnassignedSectionsForFilter = (targetDivisionFilterId: typeof divisionFilterId) =>
    soldiers.some((soldier) => {
      if (soldier.section) return false
      if (targetDivisionFilterId === 'all') return true
      if (targetDivisionFilterId === 'unassigned') return !soldier.divisionId
      return soldier.divisionId === targetDivisionFilterId
    })

  const visibleSectionNames = sectionNamesForFilter(divisionFilterId)

  const filtered = soldiers
    .filter((soldier) => {
      const division = divisionMap.get(soldier.divisionId ?? '') ?? '포대 미지정'
      const soldierSection = soldier.section?.trim() ?? ''
      if (divisionFilterId === 'unassigned' && soldier.divisionId) return false
      if (divisionFilterId !== 'all' && divisionFilterId !== 'unassigned' && soldier.divisionId !== divisionFilterId) return false
      if (sectionFilter === 'unassigned' && soldierSection) return false
      if (sectionFilter.startsWith('section:') && soldierSection !== sectionFilter.replace(/^section:/u, '')) return false
      return matchesSearch(query, [soldier.name, division, soldier.section, soldier.note])
    })
    .sort((a, b) => {
      return a.name.localeCompare(b.name, 'ko')
    })

  const filteredIds = filtered.map((soldier) => soldier.id)
  const selectedFilteredCount = filteredIds.filter((id) => selectedIds.includes(id)).length
  const hasUnassignedSoldiers = soldiers.some((soldier) => !soldier.divisionId)
  const hasUnassignedSections = hasUnassignedSectionsForFilter(divisionFilterId)
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
    setActiveField('addName')
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    await submitAddSoldier()
  }

  async function submitAddSoldier() {
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

  async function handleAddSection(event: React.FormEvent, targetDivisionId?: string) {
    event.preventDefault()
    const draftKey = targetDivisionId ?? ''
    const ok = await onAddSection(sectionDrafts[draftKey] ?? '', targetDivisionId)
    if (ok) setSectionDrafts((drafts) => ({ ...drafts, [draftKey]: '' }))
  }

  function setSectionDraft(targetDivisionId: string | undefined, value: string) {
    const draftKey = targetDivisionId ?? ''
    setSectionDrafts((drafts) => ({ ...drafts, [draftKey]: value }))
  }

  function changeDivisionFilter(nextDivisionFilterId: typeof divisionFilterId) {
    setDivisionFilterId(nextDivisionFilterId)
    const nextSectionNames = sectionNamesForFilter(nextDivisionFilterId)
    if (sectionFilter.startsWith('section:') && !nextSectionNames.includes(sectionFilter.replace(/^section:/u, ''))) {
      setSectionFilter('all')
      return
    }
    if (sectionFilter === 'unassigned' && !hasUnassignedSectionsForFilter(nextDivisionFilterId)) setSectionFilter('all')
  }

  function changeAddDivision(nextDivisionId: string) {
    setDivisionId(nextDivisionId)
    if (section && !sectionNamesForDivision(nextDivisionId || undefined).includes(section)) setSection('')
  }

  function changeBulkDivision(nextDivisionId: string) {
    setBulkDivisionId(nextDivisionId)
    if (bulkSection && !sectionNamesForDivision(nextDivisionId || undefined).includes(bulkSection)) setBulkSection('')
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

  function focusSoldierField(field?: SoldierFieldKey) {
    if (!field) return
    setActiveField(field)
    const target = document.querySelector<HTMLElement>(`[data-field-key="${field}"]`)
    if (target instanceof HTMLElement) requestAnimationFrame(() => target.focus())
  }

  function handleSequentialEnter(
    event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    order: SoldierFieldKey[],
    currentField: SoldierFieldKey,
    onComplete: () => void,
  ) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    const currentIndex = order.indexOf(currentField)
    const nextField = order[currentIndex + 1]
    if (!nextField) {
      onComplete()
      return
    }
    focusSoldierField(nextField)
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

  function changeEditingSoldierDivision(nextDivisionId: string) {
    if (!editingSoldier) return
    const nextSection = sectionNamesForDivision(nextDivisionId || undefined).includes(editingSoldier.section ?? '')
      ? editingSoldier.section
      : undefined
    setEditingSoldier({ ...editingSoldier, divisionId: nextDivisionId || undefined, section: nextSection })
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

  function assignSectionInline(soldierId: string, sectionName: string | undefined) {
    onUpdate(soldierId, { section: sectionName || undefined })
    setInlineSectionSoldierId(undefined)
  }

  useEffect(() => {
    if (!inlineSectionSoldierId) return
    function handleOutside(event: MouseEvent) {
      if (!(event.target as Element).closest('.soldier-section-row')) {
        setInlineSectionSoldierId(undefined)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [inlineSectionSoldierId])

  return (
    <div className="stack">
      <section className="panel manager-toolbar">
        <div className="manager-toolbar-summary">
          <strong>인원 {soldiers.length}명</strong>
          <span>선택 {selectedIds.length}명 · 표시 {filtered.length}명</span>
        </div>
        <div className="manager-action-grid">
          <button onClick={() => { setModal('add'); setActiveField('addName') }} type="button">
            <UserPlus size={18} /> 인원 추가
          </button>
          <button onClick={() => setModal('bulk')} type="button">
            <Users size={18} /> 일괄 적용
          </button>
          <button onClick={() => setModal('division')} type="button">
            <Layers size={18} /> 포대 관리
          </button>
        </div>
      </section>

      <label className="search-box">
        <Search size={18} />
        <input onChange={(event) => setQuery(event.target.value)} placeholder="이름, 포대, 분과, 메모 검색" value={query} />
      </label>

      <div className="manager-filter-stack">
        <div>
          <span className="manager-filter-label">포대</span>
          <div className="chip-row division-filter-row" aria-label="포대별 인원 필터">
            <button className={divisionFilterId === 'all' ? 'active' : ''} onClick={() => changeDivisionFilter('all')} type="button">
              전체
            </button>
            {divisions.map((division) => (
              <button
                className={divisionFilterId === division.id ? 'active' : ''}
                key={division.id}
                onClick={() => changeDivisionFilter(division.id)}
                type="button"
              >
                {division.name}
              </button>
            ))}
            {hasUnassignedSoldiers && (
              <button
                className={divisionFilterId === 'unassigned' ? 'active' : ''}
                onClick={() => changeDivisionFilter('unassigned')}
                type="button"
              >
                미지정
              </button>
            )}
          </div>
        </div>

        <div>
          <span className="manager-filter-label">분과</span>
          <div className="chip-row division-filter-row" aria-label="분과별 인원 필터">
            <button className={sectionFilter === 'all' ? 'active' : ''} onClick={() => setSectionFilter('all')} type="button">
              전체
            </button>
            {visibleSectionNames.map((item) => (
              <button
                className={sectionFilter === `section:${item}` ? 'active' : ''}
                key={item}
                onClick={() => setSectionFilter(`section:${item}`)}
                type="button"
              >
                {item}
              </button>
            ))}
            {hasUnassignedSections && (
              <button
                className={sectionFilter === 'unassigned' ? 'active' : ''}
                onClick={() => setSectionFilter('unassigned')}
                type="button"
              >
                미지정
              </button>
            )}
          </div>
        </div>
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
                      {divisionMap.get(currentDivision) ?? '포대 미지정'} · 수정{' '}
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
                  <button aria-label="인원 수정" onClick={() => { setEditingSoldier(soldier); setActiveField('editName') }} type="button">
                    <Edit3 size={17} />
                  </button>
                  <button
                    aria-label="인원 삭제"
                    onClick={() => setConfirmDeleteSoldier(soldier)}
                    type="button"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
              <div className="soldier-section-row">
                <button
                  className={`section-inline-chip${!soldier.section ? ' unassigned' : ''}`}
                  onClick={() => setInlineSectionSoldierId((id) => (id === soldier.id ? undefined : soldier.id))}
                  type="button"
                >
                  {soldier.section || '분과 미지정'}
                  <ChevronDown size={11} />
                </button>
                {inlineSectionSoldierId === soldier.id && (
                  <div className="section-quick-pills">
                    {soldier.section && (
                      <button className="section-pill" onClick={() => assignSectionInline(soldier.id, undefined)} type="button">
                        미지정
                      </button>
                    )}
                    {sectionNamesForDivision(soldier.divisionId).length === 0 ? (
                      <span className="section-pill-empty">포대 관리에서 분과를 추가하세요</span>
                    ) : (
                      sectionNamesForDivision(soldier.divisionId).map((sectionName) => (
                        <button
                          className={`section-pill${soldier.section === sectionName ? ' active' : ''}`}
                          key={sectionName}
                          onClick={() => assignSectionInline(soldier.id, sectionName)}
                          type="button"
                        >
                          {sectionName}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {soldier.note && <p className="soldier-note">{soldier.note}</p>}
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
                  {modal === 'division' && '포대/분과 관리'}
                </h2>
              </div>
              <button aria-label="닫기" className="icon-button" onClick={closeModal} type="button">
                <X size={20} />
              </button>
            </header>

            {modal === 'add' && (
              <form className="manager-form" onSubmit={handleSubmit}>
                <div className={`field-focus-shell ${activeField === 'addName' ? 'active' : ''}`}>
                  <input
                    autoFocus
                    data-field-key="addName"
                    onChange={(event) => setName(event.target.value)}
                    onFocus={() => setActiveField('addName')}
                    onKeyDown={(event) => handleSequentialEnter(event, addSoldierFieldOrder, 'addName', () => focusSoldierField('addDivision'))}
                    placeholder="이름"
                    value={name}
                  />
                </div>
                <div className="field-line">
                  <select
                    className={activeField === 'addDivision' ? 'field-focus-active' : ''}
                    data-field-key="addDivision"
                    onChange={(event) => changeAddDivision(event.target.value)}
                    onFocus={() => setActiveField('addDivision')}
                    onKeyDown={(event) => handleSequentialEnter(event, addSoldierFieldOrder, 'addDivision', () => focusSoldierField('addSection'))}
                    value={divisionId}
                  >
                    <option value="">포대 미지정</option>
                    {divisions.map((division) => (
                      <option key={division.id} value={division.id}>
                        {division.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={activeField === 'addSection' ? 'field-focus-active' : ''}
                    data-field-key="addSection"
                    onChange={(event) => setSection(event.target.value)}
                    onFocus={() => setActiveField('addSection')}
                    onKeyDown={(event) => handleSequentialEnter(event, addSoldierFieldOrder, 'addSection', () => focusSoldierField('addNote'))}
                    value={section}
                  >
                    <option value="">분과 미지정</option>
                    {sectionNamesForDivision(divisionId || undefined).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={`field-focus-shell ${activeField === 'addNote' ? 'active' : ''}`}>
                  <input
                    data-field-key="addNote"
                    onChange={(event) => setNote(event.target.value)}
                    onFocus={() => setActiveField('addNote')}
                    onKeyDown={(event) => handleSequentialEnter(event, addSoldierFieldOrder, 'addNote', () => void submitAddSoldier())}
                    placeholder="메모 선택 입력"
                    value={note}
                  />
                </div>
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
                  <select onChange={(event) => changeBulkDivision(event.target.value)} value={bulkDivisionId}>
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
                    {sectionNamesForDivision(bulkDivisionId || undefined).map((item) => (
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
                  {divisions.map((division) => {
                    const divisionSections = sections
                      .filter((item) => item.divisionId === division.id)
                      .sort((a, b) => sectionCollator.compare(a.name, b.name))
                    const sectionDraft = sectionDrafts[division.id] ?? ''
                    return (
                      <article className="division-management-card" key={division.id}>
                        <div className="division-card">
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
                                  onClick={() => setConfirmDeleteDivision(division)}
                                  type="button"
                                >
                                  <Trash2 size={17} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="division-section-manager">
                          <div className="division-section-title">
                            <span>분과</span>
                            <small>{divisionSections.length}개</small>
                          </div>
                          <form className="division-section-form" onSubmit={(event) => handleAddSection(event, division.id)}>
                            <input
                              onChange={(event) => setSectionDraft(division.id, event.target.value)}
                              placeholder={`${division.name} 분과 추가`}
                              value={sectionDraft}
                            />
                            <button className="secondary-button" type="submit">
                              <Plus size={16} /> 추가
                            </button>
                          </form>
                          <div className="division-section-list">
                            {divisionSections.length === 0 && <p className="muted-copy">아직 묶인 분과가 없습니다.</p>}
                            {divisionSections.map((item) => (
                              <article className="section-chip-card" key={item.id}>
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
                                      <small>
                                        {soldiers.filter((soldier) => soldier.divisionId === division.id && soldier.section === item.name).length}
                                        명
                                      </small>
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
                                        onClick={() => setConfirmDeleteSection({ id: item.id, name: item.name, divisionName: division.name })}
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
                      </article>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {confirmDeleteSoldier && (
        <ConfirmDialog
          body="이 인원의 모든 취식 기록도 함께 삭제됩니다."
          confirmLabel="삭제"
          onCancel={() => setConfirmDeleteSoldier(undefined)}
          onConfirm={() => {
            onDelete(confirmDeleteSoldier.id)
            setConfirmDeleteSoldier(undefined)
          }}
          title={`${confirmDeleteSoldier.name} 인원을 삭제할까요?`}
        />
      )}
      {confirmDeleteDivision && (
        <ConfirmDialog
          body="포대 소속 인원은 포대 미지정으로 변경됩니다."
          confirmLabel="삭제"
          onCancel={() => setConfirmDeleteDivision(undefined)}
          onConfirm={() => {
            onDeleteDivision(confirmDeleteDivision.id)
            setConfirmDeleteDivision(undefined)
          }}
          title={`${confirmDeleteDivision.name} 포대를 삭제할까요?`}
        />
      )}
      {confirmDeleteSection && (
        <ConfirmDialog
          body="해당 인원은 분과 미지정으로 변경됩니다."
          confirmLabel="삭제"
          onCancel={() => setConfirmDeleteSection(undefined)}
          onConfirm={() => {
            onDeleteSection(confirmDeleteSection.id)
            setConfirmDeleteSection(undefined)
          }}
          title={`${confirmDeleteSection.divisionName} ${confirmDeleteSection.name} 분과를 삭제할까요?`}
        />
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
            <div className={`field-focus-shell ${activeField === 'editName' ? 'active' : ''}`}>
              <input
                autoFocus
                data-field-key="editName"
                onChange={(event) => updateEditingSoldier({ name: event.target.value })}
                onFocus={() => setActiveField('editName')}
                onKeyDown={(event) => handleSequentialEnter(event, editSoldierFieldOrder, 'editName', () => focusSoldierField('editDivision'))}
                placeholder="이름"
                value={editingSoldier.name}
              />
            </div>
            <select
              className={activeField === 'editDivision' ? 'field-focus-active' : ''}
              data-field-key="editDivision"
              onChange={(event) => changeEditingSoldierDivision(event.target.value)}
              onFocus={() => setActiveField('editDivision')}
              onKeyDown={(event) => handleSequentialEnter(event, editSoldierFieldOrder, 'editDivision', () => focusSoldierField('editSection'))}
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
              className={activeField === 'editSection' ? 'field-focus-active' : ''}
              data-field-key="editSection"
              onChange={(event) => updateEditingSoldier({ section: event.target.value || undefined })}
              onFocus={() => setActiveField('editSection')}
              onKeyDown={(event) => handleSequentialEnter(event, editSoldierFieldOrder, 'editSection', () => focusSoldierField('editNote'))}
              value={editingSoldier.section ?? ''}
            >
              <option value="">분과 미지정</option>
              {sectionNamesForDivision(editingSoldier.divisionId).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <div className={`field-focus-shell ${activeField === 'editNote' ? 'active' : ''}`}>
              <input
                data-field-key="editNote"
                onChange={(event) => updateEditingSoldier({ note: event.target.value })}
                onFocus={() => setActiveField('editNote')}
                onKeyDown={(event) => handleSequentialEnter(event, editSoldierFieldOrder, 'editNote', () => focusSoldierField('editActive'))}
                placeholder="메모"
                value={editingSoldier.note ?? ''}
              />
            </div>
            <label className={`toggle-line ${activeField === 'editActive' ? 'field-active-block' : ''}`}>
              <input
                checked={editingSoldier.active}
                data-field-key="editActive"
                onChange={(event) => updateEditingSoldier({ active: event.target.checked })}
                onFocus={() => setActiveField('editActive')}
                onKeyDown={(event) => handleSequentialEnter(event, editSoldierFieldOrder, 'editActive', saveSoldierEdit)}
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
