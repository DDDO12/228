import { useMemo, useState } from 'react'
import { Search, Ticket, Trash2 } from 'lucide-react'
import type { AppState } from '../app/appState'
import { createOfficerBalanceMap } from '../domain/officer'
import { mealLabels, mealOrder, type MealType } from '../domain/meal'
import { matchesSearch } from '../utils/search'

export function OfficerTicketScreen({ app }: { app: AppState }) {
  const [name, setName] = useState('')
  const [purchaseName, setPurchaseName] = useState('')
  const [purchaseMeal, setPurchaseMeal] = useState<MealType>(app.meal)
  const [quantity, setQuantity] = useState(1)
  const [query, setQuery] = useState('')
  const balances = useMemo(
    () => createOfficerBalanceMap(app.officerTicketPurchases, app.officerMealUses),
    [app.officerMealUses, app.officerTicketPurchases],
  )
  const todayUses = app.officerMealUses
    .filter((use) => use.date === app.date && use.meal === app.meal && matchesSearch(query, [use.officerName]))
    .sort((a, b) => a.officerName.localeCompare(b.officerName, 'ko'))
  const unpaidCount = todayUses.filter((use) => use.status === 'unpaid').length

  async function handleUseSubmit(event: React.FormEvent) {
    event.preventDefault()
    const ok = await app.addOfficerMealUse(name)
    if (ok) setName('')
  }

  async function handlePurchaseSubmit(event: React.FormEvent) {
    event.preventDefault()
    const ok = await app.addOfficerTicketPurchase(purchaseName, purchaseMeal, quantity)
    if (ok) {
      setPurchaseName('')
      setQuantity(1)
    }
  }

  return (
    <div className="stack">
      <section className="panel officer-hero-panel">
        <div>
          <span>
            {app.date} {mealLabels[app.meal]}
          </span>
          <h2>식권구매자 {todayUses.length}명</h2>
          <p>식권 처리 {todayUses.length - unpaidCount}명 · 미구매 {unpaidCount}명</p>
        </div>
        <Ticket size={36} />
      </section>

      <section className="panel control-panel">
        <form className="field-line" onSubmit={handleUseSubmit}>
          <input onChange={(event) => setName(event.target.value)} placeholder="오늘 식사한 식권구매자 이름" value={name} />
          <button className="primary-button" type="submit">
            명단 추가
          </button>
        </form>
        <label className="search-box">
          <Search size={18} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder="식권구매자 이름 검색" value={query} />
        </label>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>오늘 식권구매자 명단</h2>
          <small>{mealLabels[app.meal]} 기준</small>
        </div>
        {todayUses.length > 0 ? (
          <div className="officer-use-list">
            {todayUses.map((use) => (
              <article className={use.status === 'unpaid' ? 'unpaid' : ''} key={use.id}>
                <div>
                  <strong>{use.officerName}</strong>
                  <span>{use.status === 'ticket' ? '식권 처리' : '미구매'}</span>
                </div>
                <button aria-label="삭제" onClick={() => void app.deleteOfficerMealUse(use.id)} type="button">
                  <Trash2 size={18} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-inline">현재 식사에 등록된 식권구매자가 없습니다.</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>식권 구매</h2>
          <small>미구매분 먼저 상계</small>
        </div>
        <form className="officer-purchase-form" onSubmit={handlePurchaseSubmit}>
          <input onChange={(event) => setPurchaseName(event.target.value)} placeholder="식권구매자 이름" value={purchaseName} />
          <select onChange={(event) => setPurchaseMeal(event.target.value as MealType)} value={purchaseMeal}>
            {mealOrder.map((meal) => (
              <option key={meal} value={meal}>
                {mealLabels[meal]}
              </option>
            ))}
          </select>
          <input min={1} onChange={(event) => setQuantity(Number(event.target.value))} type="number" value={quantity} />
          <button className="primary-button" type="submit">
            구매 등록
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>식권구매자 잔여 식권</h2>
          <small>{app.officers.length}명</small>
        </div>
        <div className="officer-balance-list">
          {app.officers
            .filter((officer) => matchesSearch(query, [officer.name]))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
            .map((officer) => {
              const balance = balances.get(officer.id) ?? { breakfast: 0, lunch: 0, dinner: 0 }
              return (
                <article key={officer.id}>
                  <strong>{officer.name}</strong>
                  <span>조 {balance.breakfast} · 중 {balance.lunch} · 석 {balance.dinner}</span>
                </article>
              )
            })}
        </div>
      </section>
    </div>
  )
}
