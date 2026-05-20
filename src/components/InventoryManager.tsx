import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Minus, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'
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

const unitAmountUnits = ['g', 'kg', 'L', 'mL', 'ea', '박스']
const addFieldOrder = [
  'name',
  'manufacturer',
  'quantity',
  'minimumQuantity',
  'unitAmountValue',
  'unitAmountUnit',
  'expirationDate',
  'purpose',
  'note',
  'dailyConsumptionEnabled',
  'dailyConsumptionAmount',
] as const
const editFieldOrder = [
  'draftName',
  'draftManufacturer',
  'draftQuantity',
  'draftMinimumQuantity',
  'draftUnitAmountValue',
  'draftUnitAmountUnit',
  'draftExpirationDate',
  'draftPurpose',
  'draftNote',
  'draftDailyConsumptionEnabled',
  'draftDailyConsumptionAmount',
] as const
type InventoryFieldKey = (typeof addFieldOrder)[number] | (typeof editFieldOrder)[number]

function formatAmount(value: number) {
  return Number(value.toFixed(2)).toString()
}

function splitUnitAmount(value?: string) {
  const trimmed = value?.trim() ?? ''
  const match = trimmed.match(/^([\d,.]+)\s*(.*)$/u)
  if (!match) return { amount: trimmed, unit: 'g' }
  const unit = match[2]?.trim()
  return {
    amount: match[1].replace(',', '.'),
    unit: unit && unitAmountUnits.includes(unit) ? unit : 'g',
  }
}

function composeUnitAmount(amount: string, unit: string) {
  const trimmed = amount.trim()
  return trimmed ? `${trimmed}${unit}` : ''
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
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<InventoryItem>()
  const [draft, setDraft] = useState<InventoryItem>()
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [unit] = useState('개')
  const [quantity, setQuantity] = useState(0)
  const [minimumQuantity, setMinimumQuantity] = useState(0)
  const [unitAmountValue, setUnitAmountValue] = useState('')
  const [unitAmountUnit, setUnitAmountUnit] = useState('g')
  const [expirationDate, setExpirationDate] = useState('')
  const [purpose, setPurpose] = useState('')
  const [note, setNote] = useState('')
  const [dailyConsumptionEnabled, setDailyConsumptionEnabled] = useState(false)
  const [dailyConsumptionAmount, setDailyConsumptionAmount] = useState(0)
  const [activeField, setActiveField] = useState<InventoryFieldKey>('name')

  const filtered = items.filter((item) =>
    matchesSearch(query, [item.name, item.manufacturer, item.unitAmount, item.expirationDate, item.purpose, item.note]),
  )
  const addIsRice = name.trim() === militaryRiceName
  const addDailyEnabled = addIsRice || dailyConsumptionEnabled
  const addDailyAmount = addIsRice ? militaryRiceDailyConsumption : dailyConsumptionAmount
  const draftUnitAmount = splitUnitAmount(draft?.unitAmount)

  function resetAddForm() {
    setAddOpen(false)
    setActiveField('name')
    setName('')
    setManufacturer('')
    setQuantity(0)
    setMinimumQuantity(0)
    setUnitAmountValue('')
    setUnitAmountUnit('g')
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
      unitAmount: composeUnitAmount(unitAmountValue, unitAmountUnit),
      expirationDate,
      purpose,
      note,
      dailyConsumptionEnabled: addDailyEnabled,
      dailyConsumptionAmount: addDailyAmount,
    })
    if (ok) resetAddForm()
  }

  function canSubmitAdd() {
    if (!name.trim()) return false
    if (addDailyEnabled) return addDailyAmount > 0
    return true
  }

  function handleAddSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmitAdd()) return
    void submitAdd()
  }

  function openEdit(item: InventoryItem) {
    const daily = resolveDailyConsumption(item)
    setEditingItem(item)
    setActiveField('draftName')
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
    setActiveField('name')
  }

  function handleEditSubmit(event: FormEvent) {
    event.preventDefault()
    saveDraft()
  }

  function focusField(field?: InventoryFieldKey) {
    if (!field) return
    setActiveField(field)
    const target = document.querySelector<HTMLElement>(`[data-field-key="${field}"]`)
    if (target instanceof HTMLElement) requestAnimationFrame(() => target.focus())
  }

  function handleSequentialEnter(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    order: readonly InventoryFieldKey[],
    currentField: InventoryFieldKey,
    onComplete: () => void,
  ) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const currentIndex = order.indexOf(currentField)
    const nextField = order[currentIndex + 1]
    if (!nextField) {
      onComplete()
      return
    }
    if (nextField === 'dailyConsumptionAmount' && !addDailyEnabled && currentField !== 'dailyConsumptionEnabled') {
      onComplete()
      return
    }
    if (
      nextField === 'draftDailyConsumptionAmount' &&
      !(draft && (isMilitaryRice(draft) || draft.dailyConsumptionEnabled === true))
    ) {
      onComplete()
      return
    }
    focusField(nextField)
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
                    onClick={() => setConfirmDeleteItem(item)}
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
          <form className="modal inventory-edit-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleAddSubmit}>
            <header className="modal-header">
              <div>
                <span>부식재고 입력</span>
                <h2>빠른 등록</h2>
              </div>
              <button aria-label="닫기" className="icon-button" onClick={resetAddForm} type="button">
                <X size={20} />
              </button>
            </header>
            <div className={`field-focus-shell ${activeField === 'name' ? 'active' : ''}`}>
              <input
                autoFocus
                onChange={(event) => setName(event.target.value)}
                onFocus={() => setActiveField('name')}
                onKeyDown={(event) => handleSequentialEnter(event, addFieldOrder, 'name', () => void submitAdd())}
                placeholder="품명을 입력하세요"
                data-field-key="name"
                value={name}
              />
            </div>
            <div className={`field-focus-shell ${activeField === 'manufacturer' ? 'active' : ''}`}>
              <input
                onChange={(event) => setManufacturer(event.target.value)}
                onFocus={() => setActiveField('manufacturer')}
                onKeyDown={(event) => handleSequentialEnter(event, addFieldOrder, 'manufacturer', () => void submitAdd())}
                placeholder="업체이름"
                data-field-key="manufacturer"
                value={manufacturer}
              />
            </div>
            <div className="field-line compact-fields">
              <label className={`input-guide ${activeField === 'quantity' ? 'active' : ''}`}>
                <span>현재고</span>
                <input
                  min={0}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  onFocus={() => setActiveField('quantity')}
                  onKeyDown={(event) => handleSequentialEnter(event, addFieldOrder, 'quantity', () => void submitAdd())}
                  placeholder="현재 수량"
                  data-field-key="quantity"
                  step="0.1"
                  type="number"
                  value={quantity}
                />
              </label>
              <label className={`input-guide ${activeField === 'minimumQuantity' ? 'active' : ''}`}>
                <span>안전재고</span>
                <input
                  min={0}
                  onChange={(event) => setMinimumQuantity(Number(event.target.value))}
                  onFocus={() => setActiveField('minimumQuantity')}
                  onKeyDown={(event) => handleSequentialEnter(event, addFieldOrder, 'minimumQuantity', () => void submitAdd())}
                  placeholder="안전재고 또는 주의 기준"
                  data-field-key="minimumQuantity"
                  step="0.1"
                  type="number"
                  value={minimumQuantity}
                />
              </label>
            </div>
            <div className="unit-amount-row">
              <input
                className={activeField === 'unitAmountValue' ? 'field-focus-active' : ''}
                min={0}
                onChange={(event) => setUnitAmountValue(event.target.value)}
                onFocus={() => setActiveField('unitAmountValue')}
                onKeyDown={(event) => handleSequentialEnter(event, addFieldOrder, 'unitAmountValue', () => void submitAdd())}
                placeholder="개별기준량"
                data-field-key="unitAmountValue"
                step="0.1"
                type="number"
                value={unitAmountValue}
              />
              <select
                className={activeField === 'unitAmountUnit' ? 'field-focus-active' : ''}
                onChange={(event) => setUnitAmountUnit(event.target.value)}
                onFocus={() => setActiveField('unitAmountUnit')}
                onKeyDown={(event) => handleSequentialEnter(event, addFieldOrder, 'unitAmountUnit', () => void submitAdd())}
                data-field-key="unitAmountUnit"
                value={unitAmountUnit}
              >
                {unitAmountUnits.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate}
                  </option>
                ))}
              </select>
            </div>
            <div className={`field-focus-shell ${activeField === 'expirationDate' ? 'active' : ''}`}>
              <input
                onChange={(event) => setExpirationDate(event.target.value)}
                onFocus={() => setActiveField('expirationDate')}
                onKeyDown={(event) => handleSequentialEnter(event, addFieldOrder, 'expirationDate', () => void submitAdd())}
                data-field-key="expirationDate"
                type="date"
                value={expirationDate}
              />
            </div>
            <div className={`field-focus-shell ${activeField === 'purpose' ? 'active' : ''}`}>
              <textarea
                onChange={(event) => setPurpose(event.target.value)}
                onFocus={() => setActiveField('purpose')}
                onKeyDown={(event) => handleSequentialEnter(event, addFieldOrder, 'purpose', () => void submitAdd())}
                placeholder="용도 예: 조식 김치, 취사용, 예비 보관"
                data-field-key="purpose"
                value={purpose}
              />
            </div>
            <div className={`field-focus-shell ${activeField === 'note' ? 'active' : ''}`}>
              <input
                onChange={(event) => setNote(event.target.value)}
                onFocus={() => setActiveField('note')}
                onKeyDown={(event) => handleSequentialEnter(event, addFieldOrder, 'note', () => void submitAdd())}
                placeholder="메모가 필요하면 입력하세요"
                data-field-key="note"
                value={note}
              />
            </div>
            <section className={`daily-consumption-control ${activeField === 'dailyConsumptionEnabled' || activeField === 'dailyConsumptionAmount' ? 'active' : ''}`}>
              <label className="daily-consumption-toggle">
                <input
                  checked={addDailyEnabled}
                  disabled={addIsRice}
                  onChange={(event) => setDailyConsumptionEnabled(event.target.checked)}
                  onFocus={() => setActiveField('dailyConsumptionEnabled')}
                  onKeyDown={(event) => handleSequentialEnter(event, addFieldOrder, 'dailyConsumptionEnabled', () => void submitAdd())}
                  data-field-key="dailyConsumptionEnabled"
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
                    onFocus={() => setActiveField('dailyConsumptionAmount')}
                    onKeyDown={(event) => handleSequentialEnter(event, addFieldOrder, 'dailyConsumptionAmount', () => void submitAdd())}
                    data-field-key="dailyConsumptionAmount"
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
            <div className="modal-actions">
              <button className="ghost-button" onClick={resetAddForm} type="button">
                취소
              </button>
              <button className="primary-button" disabled={!canSubmitAdd()} type="submit">
                <Save size={17} /> 저장
              </button>
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
            <div className={`field-focus-shell ${activeField === 'draftName' ? 'active' : ''}`}>
              <input
                onChange={(event) => updateDraft({ name: event.target.value })}
                onFocus={() => setActiveField('draftName')}
                onKeyDown={(event) => handleSequentialEnter(event, editFieldOrder, 'draftName', saveDraft)}
                placeholder="품목명"
                data-field-key="draftName"
                value={draft.name}
              />
            </div>
            <div className={`field-focus-shell ${activeField === 'draftManufacturer' ? 'active' : ''}`}>
              <input
                onChange={(event) => updateDraft({ manufacturer: event.target.value })}
                onFocus={() => setActiveField('draftManufacturer')}
                onKeyDown={(event) => handleSequentialEnter(event, editFieldOrder, 'draftManufacturer', saveDraft)}
                placeholder="업체이름"
                data-field-key="draftManufacturer"
                value={draft.manufacturer ?? ''}
              />
            </div>
            <div className="field-line compact-fields">
              <label className={`input-guide ${activeField === 'draftQuantity' ? 'active' : ''}`}>
                <span>현재고</span>
                <input
                  min={0}
                  onChange={(event) => updateDraft({ quantity: Number(event.target.value) })}
                  onFocus={() => setActiveField('draftQuantity')}
                  onKeyDown={(event) => handleSequentialEnter(event, editFieldOrder, 'draftQuantity', saveDraft)}
                  placeholder="현재 남은 수량"
                  data-field-key="draftQuantity"
                  step="0.1"
                  type="number"
                  value={draft.quantity}
                />
              </label>
              <label className={`input-guide ${activeField === 'draftMinimumQuantity' ? 'active' : ''}`}>
                <span>안전재고</span>
                <input
                  min={0}
                  onChange={(event) => updateDraft({ minimumQuantity: Number(event.target.value) })}
                  onFocus={() => setActiveField('draftMinimumQuantity')}
                  onKeyDown={(event) => handleSequentialEnter(event, editFieldOrder, 'draftMinimumQuantity', saveDraft)}
                  placeholder="주의 알림 기준"
                  data-field-key="draftMinimumQuantity"
                  step="0.1"
                  type="number"
                  value={draft.minimumQuantity}
                />
              </label>
            </div>
            <div className="unit-amount-row">
              <input
                className={activeField === 'draftUnitAmountValue' ? 'field-focus-active' : ''}
                min={0}
                onChange={(event) => updateDraft({ unitAmount: composeUnitAmount(event.target.value, draftUnitAmount.unit) })}
                onFocus={() => setActiveField('draftUnitAmountValue')}
                onKeyDown={(event) => handleSequentialEnter(event, editFieldOrder, 'draftUnitAmountValue', saveDraft)}
                placeholder="개별기준량"
                data-field-key="draftUnitAmountValue"
                step="0.1"
                type="number"
                value={draftUnitAmount.amount}
              />
              <select
                className={activeField === 'draftUnitAmountUnit' ? 'field-focus-active' : ''}
                onChange={(event) => updateDraft({ unitAmount: composeUnitAmount(draftUnitAmount.amount, event.target.value) })}
                onFocus={() => setActiveField('draftUnitAmountUnit')}
                onKeyDown={(event) => handleSequentialEnter(event, editFieldOrder, 'draftUnitAmountUnit', saveDraft)}
                data-field-key="draftUnitAmountUnit"
                value={draftUnitAmount.unit}
              >
                {unitAmountUnits.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate}
                  </option>
                ))}
              </select>
            </div>
            <div className={`field-focus-shell ${activeField === 'draftExpirationDate' ? 'active' : ''}`}>
              <input
                onChange={(event) => updateDraft({ expirationDate: event.target.value })}
                onFocus={() => setActiveField('draftExpirationDate')}
                onKeyDown={(event) => handleSequentialEnter(event, editFieldOrder, 'draftExpirationDate', saveDraft)}
                data-field-key="draftExpirationDate"
                type="date"
                value={draft.expirationDate ?? ''}
              />
            </div>
            <div className={`field-focus-shell ${activeField === 'draftPurpose' ? 'active' : ''}`}>
              <textarea
                onChange={(event) => updateDraft({ purpose: event.target.value })}
                onFocus={() => setActiveField('draftPurpose')}
                onKeyDown={(event) => handleSequentialEnter(event, editFieldOrder, 'draftPurpose', saveDraft)}
                placeholder="용도"
                data-field-key="draftPurpose"
                value={draft.purpose ?? ''}
              />
            </div>
            <div className={`field-focus-shell ${activeField === 'draftNote' ? 'active' : ''}`}>
              <input
                onChange={(event) => updateDraft({ note: event.target.value })}
                onFocus={() => setActiveField('draftNote')}
                onKeyDown={(event) => handleSequentialEnter(event, editFieldOrder, 'draftNote', saveDraft)}
                placeholder="메모"
                data-field-key="draftNote"
                value={draft.note ?? ''}
              />
            </div>
            <section className={`daily-consumption-control ${activeField === 'draftDailyConsumptionEnabled' || activeField === 'draftDailyConsumptionAmount' ? 'active' : ''}`}>
              <label className="daily-consumption-toggle">
                <input
                  checked={isMilitaryRice(draft) || draft.dailyConsumptionEnabled === true}
                  disabled={isMilitaryRice(draft)}
                  onChange={(event) => updateDraft({ dailyConsumptionEnabled: event.target.checked })}
                  onFocus={() => setActiveField('draftDailyConsumptionEnabled')}
                  onKeyDown={(event) => handleSequentialEnter(event, editFieldOrder, 'draftDailyConsumptionEnabled', saveDraft)}
                  data-field-key="draftDailyConsumptionEnabled"
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
                    onFocus={() => setActiveField('draftDailyConsumptionAmount')}
                    onKeyDown={(event) => handleSequentialEnter(event, editFieldOrder, 'draftDailyConsumptionAmount', saveDraft)}
                    data-field-key="draftDailyConsumptionAmount"
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
      {confirmDeleteItem && (
        <ConfirmDialog
          body="해당 부식 품목이 영구 삭제됩니다."
          confirmLabel="삭제"
          onCancel={() => setConfirmDeleteItem(undefined)}
          onConfirm={() => {
            onDelete(confirmDeleteItem.id)
            setConfirmDeleteItem(undefined)
          }}
          title={`${confirmDeleteItem.name} 품목을 삭제할까요?`}
        />
      )}
    </div>
  )
}
