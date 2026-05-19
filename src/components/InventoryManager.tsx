import { useState, type FormEvent } from 'react'
import { Minus, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'
import {
  isLowStock,
  isMilitaryRice,
  militaryRiceDailyConsumption,
  militaryRiceName,
  militaryRiceUnit,
  resolveDailyConsumption,
  type InventoryItem,
} from '../domain/inventory'
import { formatCompactDate, formatTime, toDateInputValue } from '../utils/date'
import { matchesSearch } from '../utils/search'

type InventoryInput = Pick<
  InventoryItem,
  | 'name'
  | 'manufacturer'
  | 'unit'
  | 'quantity'
  | 'minimumQuantity'
  | 'unitAmount'
  | 'expirationDate'
  | 'purpose'
  | 'note'
  | 'dailyConsumptionEnabled'
  | 'dailyConsumptionAmount'
>

interface InventoryManagerProps {
  items: InventoryItem[]
  onAdd: (input: InventoryInput) => Promise<boolean>
  onAdjust: (id: string, delta: number) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, patch: Partial<InventoryItem>) => void
}

type AddStep = 0 | 1 | 2 | 3 | 4 | 5

const addStepLabels = ['품명', '업체이름', '수량', '개별기준량', '유통기한', '용도']

function formatAmount(value: number) {
  return Number(value.toFixed(2)).toString()
}

function getExpirationStatus(expirationDate?: string) {
  if (!expirationDate) return 'none'
  const today = new Date(`${toDateInputValue()}T00:00:00`).getTime()
  const expiry = new Date(`${expirationDate}T00:00:00`).getTime()
  const daysLeft = Math.ceil((expiry - today) / 86_400_000)
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 7) return 'soon'
  return 'normal'
}

function formatExpirationLabel(expirationDate?: string) {
  if (!expirationDate) return '유통기한 미입력'
  const status = getExpirationStatus(expirationDate)
  const prefix = status === 'expired' ? '만료' : status === 'soon' ? '임박' : '유통기한'
  return `${prefix} ${formatCompactDate(expirationDate)}`
}

export function InventoryManager({ items, onAdd, onAdjust, onDelete, onUpdate }: InventoryManagerProps) {
  const [query, setQuery] = useState('')
  const [editingItem, setEditingItem] = useState<InventoryItem>()
  const [draft, setDraft] = useState<InventoryItem>()
  const [addOpen, setAddOpen] = useState(false)
  const [addStep, setAddStep] = useState<AddStep>(0)
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [unit] = useState('개')
  const [quantity, setQuantity] = useState(0)
  const [minimumQuantity, setMinimumQuantity] = useState(0)
  const [unitAmount, setUnitAmount] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [purpose, setPurpose] = useState('')
  const [note, setNote] = useState('')
  const [dailyConsumptionEnabled, setDailyConsumptionEnabled] = useState(false)
  const [dailyConsumptionAmount, setDailyConsumptionAmount] = useState(0)

  const filtered = items.filter((item) =>
    matchesSearch(query, [item.name, item.manufacturer, item.unitAmount, item.expirationDate, item.purpose, item.note]),
  )
  const addIsRice = name.trim() === militaryRiceName
  const addDailyEnabled = addIsRice || dailyConsumptionEnabled
  const addDailyAmount = addIsRice ? militaryRiceDailyConsumption : dailyConsumptionAmount

  function resetAddForm() {
    setAddOpen(false)
    setAddStep(0)
    setName('')
    setManufacturer('')
    setQuantity(0)
    setMinimumQuantity(0)
    setUnitAmount('')
    setExpirationDate('')
    setPurpose('')
    setNote('')
    setDailyConsumptionEnabled(false)
    setDailyConsumptionAmount(0)
  }

  async function submitAdd() {
    const ok = await onAdd({
      name,
      manufacturer,
      unit: addIsRice ? militaryRiceUnit : unit,
      quantity,
      minimumQuantity,
      unitAmount,
      expirationDate,
      purpose,
      note,
      dailyConsumptionEnabled: addDailyEnabled,
      dailyConsumptionAmount: addDailyAmount,
    })
    if (ok) resetAddForm()
  }

  function canSubmitAddStep() {
    if (addStep === 0) return Boolean(name.trim())
    if (addStep === 5 && addDailyEnabled) return addDailyAmount > 0
    return true
  }

  function handleAddStepSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmitAddStep()) return
    if (addStep < 5) {
      setAddStep((step) => Math.min(5, step + 1) as AddStep)
      return
    }
    void submitAdd()
  }

  function openEdit(item: InventoryItem) {
    const daily = resolveDailyConsumption(item)
    setEditingItem(item)
    setDraft({
      ...item,
      dailyConsumptionEnabled: daily.enabled,
      dailyConsumptionAmount: daily.amount,
    })
  }

  function updateDraft(patch: Partial<InventoryItem>) {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  function saveDraft() {
    if (!editingItem || !draft) return
    const draftIsRice = isMilitaryRice(draft)
    onUpdate(editingItem.id, {
      name: draft.name,
      manufacturer: draft.manufacturer,
      unit: draftIsRice ? militaryRiceUnit : draft.unit,
      quantity: Number(draft.quantity),
      minimumQuantity: Number(draft.minimumQuantity),
      unitAmount: draft.unitAmount,
      expirationDate: draft.expirationDate,
      purpose: draft.purpose,
      note: draft.note,
      dailyConsumptionEnabled: draftIsRice || draft.dailyConsumptionEnabled === true,
      dailyConsumptionAmount: draftIsRice ? militaryRiceDailyConsumption : Number(draft.dailyConsumptionAmount ?? 0),
    })
    setEditingItem(undefined)
    setDraft(undefined)
  }

  function closeEdit() {
    setEditingItem(undefined)
    setDraft(undefined)
  }

  function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    saveDraft()
  }

  return (
    <div className="stack">
      <div className="inventory-topbar">
        <label className="search-box">
          <Search size={18} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder="품명, 업체, 용도 검색" value={query} />
        </label>
        <button className="primary-button inventory-add-button" onClick={() => setAddOpen(true)} type="button">
          <Plus size={18} /> 입력
        </button>
      </div>

      <div className="inventory-summary">
        <article>
          <strong>{items.length}</strong>
          <span>총 항목</span>
        </article>
        <article>
          <strong>{items.filter(isLowStock).length}</strong>
          <span>보충 필요</span>
        </article>
      </div>

      <div className="inventory-grid">
        {filtered.map((item) => {
          const daily = resolveDailyConsumption(item)
          const expirationStatus = getExpirationStatus(item.expirationDate)
          return (
            <article className={`inventory-card ${isLowStock(item) ? 'low-stock' : ''}`} key={item.id}>
              <header className="inventory-card-header">
                <div>
                  <strong>
                    {item.name}
                    {item.manufacturer ? `(${item.manufacturer})` : ''}
                  </strong>
                  <small>
                    안전재고 {item.minimumQuantity}
                    {item.unit} · 수정 {formatTime(item.updatedAt)}
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
                <strong>{formatAmount(item.quantity)}</strong>
                <span>{item.unit}</span>
              </div>
              <div className="inventory-meta-grid">
                <span>{item.unitAmount ? `개별 ${item.unitAmount}` : '개별기준량 미입력'}</span>
                <span className={`expiration-${expirationStatus}`}>{formatExpirationLabel(item.expirationDate)}</span>
                <span>{item.purpose ? `용도 ${item.purpose}` : '용도 미입력'}</span>
              </div>
              {daily.enabled && (
                <p className="daily-consumption-note">
                  하루 {formatAmount(daily.amount)}
                  {item.unit} 자동 소진
                  {item.lastDailyConsumptionDate ? ` · 기준 ${item.lastDailyConsumptionDate.slice(2)}` : ''}
                </p>
              )}
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
          )
        })}
      </div>

      {addOpen && (
        <div className="modal-backdrop" onClick={resetAddForm}>
          <form className="modal inventory-edit-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleAddStepSubmit}>
            <header className="modal-header">
              <div>
                <span>부식재고 입력</span>
                <h2>{addStepLabels[addStep]}</h2>
              </div>
              <button aria-label="닫기" className="icon-button" onClick={resetAddForm} type="button">
                <X size={20} />
              </button>
            </header>
            <div className="wizard-progress">
              {[0, 1, 2, 3, 4, 5].map((step) => (
                <span className={step <= addStep ? 'active' : ''} key={step} />
              ))}
            </div>
            {addStep === 0 && (
              <input autoFocus onChange={(event) => setName(event.target.value)} placeholder="품명을 입력하세요" value={name} />
            )}
            {addStep === 1 && (
              <input
                autoFocus
                onChange={(event) => setManufacturer(event.target.value)}
                placeholder="업체이름을 입력하세요"
                value={manufacturer}
              />
            )}
            {addStep === 2 && (
              <div className="inventory-quantity-step">
                <input
                  autoFocus
                  min={0}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  placeholder="현재 수량"
                  step="0.1"
                  type="number"
                  value={quantity}
                />
                <input
                  min={0}
                  onChange={(event) => setMinimumQuantity(Number(event.target.value))}
                  placeholder="안전재고 또는 주의 기준"
                  step="0.1"
                  type="number"
                  value={minimumQuantity}
                />
                <small>수량은 기본적으로 개수 기준으로 등록됩니다. 군량곡은 가마 단위로 고정됩니다.</small>
              </div>
            )}
            {addStep === 3 && (
              <input
                autoFocus
                onChange={(event) => setUnitAmount(event.target.value)}
                placeholder="예: 500g, 1L, 10kg, 1박스"
                value={unitAmount}
              />
            )}
            {addStep === 4 && (
              <input autoFocus onChange={(event) => setExpirationDate(event.target.value)} type="date" value={expirationDate} />
            )}
            {addStep === 5 && (
              <>
                <textarea
                  autoFocus
                  onChange={(event) => setPurpose(event.target.value)}
                  placeholder="예: 조식 김치, 취사용, 예비 보관, 배식용"
                  value={purpose}
                />
                <input onChange={(event) => setNote(event.target.value)} placeholder="메모가 필요하면 입력하세요" value={note} />
                <section className="daily-consumption-control">
                  <label className="daily-consumption-toggle">
                    <input
                      checked={addDailyEnabled}
                      disabled={addIsRice}
                      onChange={(event) => setDailyConsumptionEnabled(event.target.checked)}
                      type="checkbox"
                    />
                    <span>일자별 자동 소진</span>
                  </label>
                  {addDailyEnabled && (
                    <label className="daily-consumption-amount">
                      <span>하루 소진량</span>
                      <input
                        disabled={addIsRice}
                        min={0}
                        onChange={(event) => setDailyConsumptionAmount(Number(event.target.value))}
                        step="0.1"
                        type="number"
                        value={addDailyAmount}
                      />
                    </label>
                  )}
                  <small>
                    {addIsRice
                      ? '군량곡은 하루 1.5가마가 자동 소진됩니다.'
                      : '체크하지 않은 품목은 날짜가 지나도 수량을 자동으로 차감하지 않습니다.'}
                  </small>
                </section>
              </>
            )}
            <div className="modal-actions">
              <button className="ghost-button" disabled={addStep === 0} onClick={() => setAddStep((step) => Math.max(0, step - 1) as AddStep)} type="button">
                이전
              </button>
              {addStep < 5 ? (
                <button className="primary-button" disabled={!canSubmitAddStep()} type="submit">
                  다음
                </button>
              ) : (
                <button className="primary-button" disabled={!canSubmitAddStep()} type="submit">
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
            <input
              onChange={(event) => updateDraft({ manufacturer: event.target.value })}
              placeholder="업체이름"
              value={draft.manufacturer ?? ''}
            />
            <div className="field-line compact-fields">
              <input
                min={0}
                onChange={(event) => updateDraft({ quantity: Number(event.target.value) })}
                placeholder="현재고"
                step="0.1"
                type="number"
                value={draft.quantity}
              />
              <input
                min={0}
                onChange={(event) => updateDraft({ minimumQuantity: Number(event.target.value) })}
                placeholder="안전재고"
                step="0.1"
                type="number"
                value={draft.minimumQuantity}
              />
            </div>
            <input
              onChange={(event) => updateDraft({ unitAmount: event.target.value })}
              placeholder="개별기준량 예: 500g, 1L"
              value={draft.unitAmount ?? ''}
            />
            <input
              onChange={(event) => updateDraft({ expirationDate: event.target.value })}
              type="date"
              value={draft.expirationDate ?? ''}
            />
            <textarea onChange={(event) => updateDraft({ purpose: event.target.value })} placeholder="용도" value={draft.purpose ?? ''} />
            <input onChange={(event) => updateDraft({ note: event.target.value })} placeholder="메모" value={draft.note ?? ''} />
            <section className="daily-consumption-control">
              <label className="daily-consumption-toggle">
                <input
                  checked={isMilitaryRice(draft) || draft.dailyConsumptionEnabled === true}
                  disabled={isMilitaryRice(draft)}
                  onChange={(event) => updateDraft({ dailyConsumptionEnabled: event.target.checked })}
                  type="checkbox"
                />
                <span>일자별 자동 소진</span>
              </label>
              {(isMilitaryRice(draft) || draft.dailyConsumptionEnabled === true) && (
                <label className="daily-consumption-amount">
                  <span>하루 소진량</span>
                  <input
                    disabled={isMilitaryRice(draft)}
                    min={0}
                    onChange={(event) => updateDraft({ dailyConsumptionAmount: Number(event.target.value) })}
                    step="0.1"
                    type="number"
                    value={isMilitaryRice(draft) ? militaryRiceDailyConsumption : draft.dailyConsumptionAmount ?? 0}
                  />
                </label>
              )}
              <small>
                {isMilitaryRice(draft)
                  ? '군량곡은 하루 1.5가마 자동 소진으로 고정됩니다.'
                  : '체크를 켠 품목만 앱을 다시 열 때 날짜 차이만큼 자동 차감됩니다.'}
              </small>
            </section>
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
