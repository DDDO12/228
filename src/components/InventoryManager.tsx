import { useState } from 'react'
import { Minus, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'
import type { InventoryItem } from '../domain/inventory'
import { isLowStock } from '../domain/inventory'
import { formatTime } from '../utils/date'

interface InventoryManagerProps {
  items: InventoryItem[]
  onAdd: (input: Pick<InventoryItem, 'name' | 'unit' | 'quantity' | 'minimumQuantity' | 'note'>) => Promise<boolean>
  onAdjust: (id: string, delta: number) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, patch: Partial<InventoryItem>) => void
}

type AddStep = 0 | 1 | 2 | 3

const units = ['개', 'KG', 'L', '박스']

export function InventoryManager({ items, onAdd, onAdjust, onDelete, onUpdate }: InventoryManagerProps) {
  const [query, setQuery] = useState('')
  const [editingItem, setEditingItem] = useState<InventoryItem>()
  const [draft, setDraft] = useState<InventoryItem>()
  const [addOpen, setAddOpen] = useState(false)
  const [addStep, setAddStep] = useState<AddStep>(0)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('개')
  const [customUnit, setCustomUnit] = useState('')
  const [quantity, setQuantity] = useState(0)
  const [minimumQuantity, setMinimumQuantity] = useState(0)
  const [note, setNote] = useState('')

  const filtered = items.filter((item) => {
    const term = query.trim().toLowerCase()
    return !term || item.name.toLowerCase().includes(term) || item.note?.toLowerCase().includes(term)
  })

  function resetAddForm() {
    setAddOpen(false)
    setAddStep(0)
    setName('')
    setUnit('개')
    setCustomUnit('')
    setQuantity(0)
    setMinimumQuantity(0)
    setNote('')
  }

  async function submitAdd() {
    const resolvedUnit = unit === '직접입력' ? customUnit : unit
    const ok = await onAdd({ name, unit: resolvedUnit, quantity, minimumQuantity, note })
    if (ok) resetAddForm()
  }

  function canSubmitAddStep() {
    if (addStep === 0) return Boolean(name.trim())
    if (addStep === 2 && unit === '吏곸젒?낅젰') return Boolean(customUnit.trim())
    return true
  }

  function handleAddStepSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmitAddStep()) return
    if (addStep < 3) {
      setAddStep((step) => Math.min(3, step + 1) as AddStep)
      return
    }
    void submitAdd()
  }

  function openEdit(item: InventoryItem) {
    setEditingItem(item)
    setDraft({ ...item })
  }

  function updateDraft(patch: Partial<InventoryItem>) {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  function saveDraft() {
    if (!editingItem || !draft) return
    onUpdate(editingItem.id, {
      name: draft.name,
      unit: draft.unit,
      quantity: Number(draft.quantity),
      minimumQuantity: Number(draft.minimumQuantity),
      note: draft.note,
    })
    setEditingItem(undefined)
    setDraft(undefined)
  }

  function closeEdit() {
    setEditingItem(undefined)
    setDraft(undefined)
  }

  function handleEditSubmit(event: React.FormEvent) {
    event.preventDefault()
    saveDraft()
  }

  return (
    <div className="stack">
      <div className="inventory-topbar">
        <label className="search-box">
          <Search size={18} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder="품목 또는 보관위치 검색" value={query} />
        </label>
        <button className="primary-button inventory-add-button" onClick={() => setAddOpen(true)} type="button">
          <Plus size={18} /> 입력
        </button>
      </div>

      <div className="inventory-summary">
        <article>
          <strong>{items.length}</strong>
          <span>총 품목</span>
        </article>
        <article>
          <strong>{items.filter(isLowStock).length}</strong>
          <span>보충 필요</span>
        </article>
      </div>

      <div className="inventory-grid">
        {filtered.map((item) => (
          <article className={`inventory-card ${isLowStock(item) ? 'low-stock' : ''}`} key={item.id}>
            <header className="inventory-card-header">
              <div>
                <strong>{item.name}</strong>
                <small>
                  안전재고 {item.minimumQuantity}{item.unit} · 수정 {formatTime(item.updatedAt)}
                </small>
              </div>
              <div className="inventory-icon-actions">
                <button aria-label="수정" onClick={() => openEdit(item)} type="button">
                  <Pencil size={16} />
                </button>
                <button
                  aria-label="삭제"
                  onClick={() => {
                    if (window.confirm(`${item.name} 품목을 삭제할까요?`)) onDelete(item.id)
                  }}
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </header>
            <div className="stock-amount">
              <strong>{item.quantity}</strong>
              <span>{item.unit}</span>
            </div>
            {item.note && <p>{item.note}</p>}
            <div className="stock-actions two-actions">
              <button onClick={() => onAdjust(item.id, -1)} type="button">
                <Minus size={18} />
              </button>
              <button onClick={() => onAdjust(item.id, 1)} type="button">
                <Plus size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {addOpen && (
        <div className="modal-backdrop" onClick={resetAddForm}>
          <form className="modal inventory-edit-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleAddStepSubmit}>
            <header className="modal-header">
              <div>
                <span>부식재고 입력</span>
                <h2>{['품명', '수량', '단위', '보관위치'][addStep]}</h2>
              </div>
              <button aria-label="닫기" className="icon-button" onClick={resetAddForm} type="button">
                <X size={20} />
              </button>
            </header>
            <div className="wizard-progress">
              {[0, 1, 2, 3].map((step) => (
                <span className={step <= addStep ? 'active' : ''} key={step} />
              ))}
            </div>
            {addStep === 0 && (
              <input autoFocus onChange={(event) => setName(event.target.value)} placeholder="품명을 입력하세요" value={name} />
            )}
            {addStep === 1 && (
              <div className="field-line compact-fields">
                <input
                  autoFocus
                  min={0}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  placeholder="현재 수량"
                  type="number"
                  value={quantity}
                />
                <input
                  min={0}
                  onChange={(event) => setMinimumQuantity(Number(event.target.value))}
                  placeholder="안전재고"
                  type="number"
                  value={minimumQuantity}
                />
              </div>
            )}
            {addStep === 2 && (
              <div className="unit-choice-grid">
                {[...units, '직접입력'].map((candidate) => (
                  <button className={unit === candidate ? 'active' : ''} key={candidate} onClick={() => setUnit(candidate)} type="button">
                    {candidate}
                  </button>
                ))}
                {unit === '직접입력' && (
                  <input onChange={(event) => setCustomUnit(event.target.value)} placeholder="단위를 입력하세요" value={customUnit} />
                )}
              </div>
            )}
            {addStep === 3 && (
              <textarea
                autoFocus
                onChange={(event) => setNote(event.target.value)}
                placeholder="예: 냉장고 2칸, 창고 좌측 선반, 조리실 앞"
                value={note}
              />
            )}
            <div className="modal-actions">
              <button className="ghost-button" disabled={addStep === 0} onClick={() => setAddStep((step) => Math.max(0, step - 1) as AddStep)} type="button">
                이전
              </button>
              {addStep < 3 ? (
                <button
                  className="primary-button"
                  disabled={(addStep === 0 && !name.trim()) || (addStep === 2 && unit === '직접입력' && !customUnit.trim())}
                  type="submit"
                >
                  다음
                </button>
              ) : (
                <button className="primary-button" type="submit">
                  <Save size={17} /> 저장
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {editingItem && draft && (
        <div className="modal-backdrop" onClick={closeEdit}>
          <form className="modal inventory-edit-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleEditSubmit}>
            <header className="modal-header">
              <div>
                <span>부식재고 수정</span>
                <h2>{editingItem.name}</h2>
              </div>
              <button aria-label="닫기" className="icon-button" onClick={closeEdit} type="button">
                <X size={20} />
              </button>
            </header>
            <input onChange={(event) => updateDraft({ name: event.target.value })} placeholder="품목명" value={draft.name} />
            <div className="field-line compact-fields">
              <input onChange={(event) => updateDraft({ unit: event.target.value })} placeholder="단위" value={draft.unit} />
              <input
                min={0}
                onChange={(event) => updateDraft({ quantity: Number(event.target.value) })}
                placeholder="현재고"
                type="number"
                value={draft.quantity}
              />
            </div>
            <input
              min={0}
              onChange={(event) => updateDraft({ minimumQuantity: Number(event.target.value) })}
              placeholder="안전재고"
              type="number"
              value={draft.minimumQuantity}
            />
            <textarea onChange={(event) => updateDraft({ note: event.target.value })} placeholder="보관위치 또는 메모" value={draft.note ?? ''} />
            <div className="modal-actions">
              <button className="ghost-button" onClick={closeEdit} type="button">
                취소
              </button>
              <button className="primary-button" type="submit">
                <Save size={17} /> 저장
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
