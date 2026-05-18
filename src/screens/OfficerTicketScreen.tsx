import { useMemo, useState } from 'react'
import { Search, Ticket, Trash2 } from 'lucide-react'
import type { AppState } from '../app/appState'
import { createOfficerBalanceMap } from '../domain/officer'
import { mealLabels, mealOrder, type MealType } from '../domain/meal'
import { matchesSearch } from '../utils/search'

type MealSelection = Record<MealType, boolean>

function createMealSelection(defaultMeal: MealType): MealSelection {
  return {
    breakfast: defaultMeal === 'breakfast',
    lunch: defaultMeal === 'lunch',
    dinner: defaultMeal === 'dinner',
  }
}

function getSelectedMeals(selection: MealSelection) {
  return mealOrder.filter((meal) => selection[meal])
}

function MealMultiSelect({
  selection,
  onChange,
}: {
  selection: MealSelection
  onChange: (next: MealSelection) => void
}) {
  function toggle(meal: MealType) {
    const selectedCount = getSelectedMeals(selection).length
    if (selection[meal] && selectedCount === 1) return
    onChange({ ...selection, [meal]: !selection[meal] })
  }

  return (
    <div className="meal-multi-row" aria-label="식사 선택">
      {mealOrder.map((meal) => (
        <button className={selection[meal] ? 'active' : ''} key={meal} onClick={() => toggle(meal)} type="button">
          {mealLabels[meal]}
        </button>
      ))}
    </div>
  )
}

export function OfficerTicketScreen({ app }: { app: AppState }) {
  const [buyerName, setBuyerName] = useState('')
  const [purchaseName, setPurchaseName] = useState('')
  const [purchaseMeals, setPurchaseMeals] = useState<MealSelection>(() => createMealSelection(app.meal))
  const [quantity, setQuantity] = useState(1)
  const [query, setQuery] = useState('')
  const balances = useMemo(
    () => createOfficerBalanceMap(app.officerTicketPurchases, app.officerMealUses),
    [app.officerMealUses, app.officerTicketPurchases],
  )
  const currentUses = app.officerMealUses
    .filter((use) => use.date === app.date && use.meal === app.meal && matchesSearch(query, [use.officerName]))
    .sort((a, b) => a.officerName.localeCompare(b.officerName, 'ko'))
  const unpaidCount = currentUses.filter((use) => use.status === 'unpaid').length
  const visibleBuyers = app.officers
    .filter((officer) => matchesSearch(query, [officer.name]))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  const cancellationRecords = app.officerTicketPurchases
    .filter((purchase) => purchase.quantity < 0 && matchesSearch(query, [purchase.officerName]))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12)

  async function handleBuyerSubmit(event: React.FormEvent) {
    event.preventDefault()
    const ok = await app.addOfficerBuyer(buyerName)
    if (ok) setBuyerName('')
  }

  async function handlePurchaseSubmit(event: React.FormEvent) {
    event.preventDefault()
    const ok = await app.addOfficerTicketPurchase(purchaseName, getSelectedMeals(purchaseMeals), quantity)
    if (ok) {
      setPurchaseName('')
      setQuantity(1)
    }
  }

  function findTodayUse(officerId: string, meal: MealType) {
    return app.officerMealUses.find((use) => use.date === app.date && use.meal === meal && use.officerId === officerId)
  }

  function toggleTodayMeal(officerName: string, officerId: string, meal: MealType) {
    const existing = findTodayUse(officerId, meal)
    if (existing) {
      void app.deleteOfficerMealUse(existing.id)
      return
    }
    void app.addOfficerMealUse(officerName, [meal])
  }

  return (
    <div className="stack">
      <section className="panel officer-hero-panel">
        <div>
          <span>
            {app.date} {mealLabels[app.meal]}
          </span>
          <h2>식권구매자 {currentUses.length}명</h2>
          <p>식권 처리 {currentUses.length - unpaidCount}명 · 미구매 {unpaidCount}명</p>
        </div>
        <Ticket size={36} />
      </section>

      <section className="panel control-panel">
        <form className="field-line" onSubmit={handleBuyerSubmit}>
          <input onChange={(event) => setBuyerName(event.target.value)} placeholder="식권구매자 이름 등록" value={buyerName} />
          <button className="primary-button" type="submit">
            구매자 추가
          </button>
        </form>
        <label className="search-box">
          <Search size={18} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder="식권구매자 이름 검색" value={query} />
        </label>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>식권구매자 배치</h2>
          <small>{visibleBuyers.length}명</small>
        </div>
        {visibleBuyers.length > 0 ? (
          <div className="ticket-buyer-grid">
            {visibleBuyers.map((officer) => {
              const balance = balances.get(officer.id) ?? { breakfast: 0, lunch: 0, dinner: 0 }
              return (
                <article className="ticket-buyer-card" key={officer.id}>
                  <header>
                    <strong>{officer.name}</strong>
                    <button className="ghost-button" onClick={() => setPurchaseName(officer.name)} type="button">
                      구매
                    </button>
                  </header>
                  <div className="ticket-buyer-meals" aria-label={`${officer.name} 오늘 식사 배치`}>
                    {mealOrder.map((meal) => {
                      const use = findTodayUse(officer.id, meal)
                      return (
                        <button
                          className={use ? `active ${use.status}` : ''}
                          key={meal}
                          onClick={() => toggleTodayMeal(officer.name, officer.id, meal)}
                          type="button"
                        >
                          <span>{mealLabels[meal]}</span>
                          <small>{use ? (use.status === 'ticket' ? '식권' : '미구매') : '미등록'}</small>
                        </button>
                      )
                    })}
                  </div>
                  <div className="ticket-buyer-balance" aria-label={`${officer.name} 잔여 식권`}>
                    {mealOrder.map((meal) => {
                      const count = balance[meal]
                      return (
                        <button
                          disabled={count <= 0}
                          key={meal}
                          onClick={() => void app.cancelOfficerTicket(officer.id, meal, 1)}
                          title={`${mealLabels[meal]} 식권 1장 취소`}
                          type="button"
                        >
                          <span>
                            {mealLabels[meal]} {count}
                          </span>
                          {count > 0 && <Trash2 size={14} />}
                        </button>
                      )
                    })}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="empty-inline">식권구매자를 먼저 등록하세요.</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>식권 구매</h2>
          <small>미구매분 먼저 상계</small>
        </div>
        <form className="officer-purchase-form" onSubmit={handlePurchaseSubmit}>
          <input onChange={(event) => setPurchaseName(event.target.value)} placeholder="식권구매자 이름" value={purchaseName} />
          <MealMultiSelect onChange={setPurchaseMeals} selection={purchaseMeals} />
          <input min={1} onChange={(event) => setQuantity(Number(event.target.value))} type="number" value={quantity} />
          <button className="primary-button" type="submit">
            구매 등록
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>식권 취소 내역</h2>
          <small>최근 12건</small>
        </div>
        {cancellationRecords.length > 0 ? (
          <div className="compact-list">
            {cancellationRecords.map((record) => (
              <div key={record.id}>
                <span>
                  {record.date} · {record.officerName} · {mealLabels[record.meal]}
                </span>
                <strong>{Math.abs(record.quantity)}장 취소</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-inline">식권 취소 내역이 없습니다.</div>
        )}
      </section>
    </div>
  )
}
