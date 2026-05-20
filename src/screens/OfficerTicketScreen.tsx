import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight, Pencil, Plus, Search, Ticket, Trash2, X } from 'lucide-react'
import type { AppState } from '../app/appState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { createOfficerBalanceMap, createOfficerUseHistoryMap, type Officer, type OfficerUseHistory } from '../domain/officer'
import { mealLabels, mealOrder, type MealType } from '../domain/meal'
import { matchesSearch } from '../utils/search'

const koreanNameCollator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' })

export function OfficerTicketScreen({ app }: { app: AppState }) {
  const expandScope = `${app.date}:${app.meal}`
  const [buyerName, setBuyerName] = useState('')
  const [query, setQuery] = useState('')
  const [addBuyerOpen, setAddBuyerOpen] = useState(false)
  const [editingBuyer, setEditingBuyer] = useState<{ id: string; name: string }>()
  const [editName, setEditName] = useState('')
  const [confirmDeleteBuyer, setConfirmDeleteBuyer] = useState<Officer>()
  const [expandedBuyerState, setExpandedBuyerState] = useState<{ scope: string; ids: string[] }>({
    scope: expandScope,
    ids: [],
  })
  const expandedBuyerIds = expandedBuyerState.scope === expandScope ? expandedBuyerState.ids : []
  const balances = useMemo(
    () => createOfficerBalanceMap(app.officerTicketPurchases, app.officerMealUses),
    [app.officerMealUses, app.officerTicketPurchases],
  )
  const histories = useMemo(() => createOfficerUseHistoryMap(app.officerMealUses), [app.officerMealUses])
  const currentUses = app.officerMealUses
    .filter((use) => use.date === app.date && use.meal === app.meal && matchesSearch(query, [use.officerName]))
    .sort((a, b) => koreanNameCollator.compare(a.officerName, b.officerName))
  const unpaidCount = currentUses.filter((use) => use.status === 'unpaid').length
  const visibleBuyers = app.officers
    .filter((officer) => matchesSearch(query, [officer.name]))
    .sort((a, b) => koreanNameCollator.compare(a.name, b.name))
  const allVisibleBuyersExpanded =
    visibleBuyers.length > 0 && visibleBuyers.every((officer) => expandedBuyerIds.includes(officer.id))
  const cancellationRecords = app.officerTicketPurchases
    .filter((purchase) => purchase.quantity < 0 && matchesSearch(query, [purchase.officerName]))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12)

  async function handleBuyerSubmit(event: React.FormEvent) {
    event.preventDefault()
    const ok = await app.addOfficerBuyer(buyerName)
    if (ok) {
      setBuyerName('')
      setAddBuyerOpen(false)
    }
  }

  function openEditBuyer(officer: Officer) {
    setEditingBuyer({ id: officer.id, name: officer.name })
    setEditName(officer.name)
  }

  function closeEditBuyer() {
    setEditingBuyer(undefined)
    setEditName('')
  }

  async function handleEditBuyerSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!editingBuyer) return
    const ok = await app.updateOfficerBuyer(editingBuyer.id, editName)
    if (ok) closeEditBuyer()
  }

  function handleDeleteBuyer(officer: Officer) {
    setConfirmDeleteBuyer(officer)
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
    void (async () => {
      await app.addOfficerTicketPurchase(officerName, [meal], 1)
      await app.addOfficerMealUse(officerName, [meal])
    })()
  }

  function purchaseMealTicket(officerName: string, meal: MealType) {
    void app.addOfficerTicketPurchase(officerName, [meal], 1)
  }

  function toggleBuyerExpanded(officerId: string) {
    setExpandedBuyerState((current) => {
      const ids = current.scope === expandScope ? current.ids : []
      return {
        scope: expandScope,
        ids: ids.includes(officerId) ? ids.filter((id) => id !== officerId) : [...ids, officerId],
      }
    })
  }

  function toggleAllVisibleBuyers() {
    setExpandedBuyerState({
      scope: expandScope,
      ids: allVisibleBuyersExpanded ? [] : visibleBuyers.map((officer) => officer.id),
    })
  }

  function getBuyerSummary(officerId: string, balance: Record<MealType, number>) {
    const states = mealOrder
      .map((meal) => {
        const use = findTodayUse(officerId, meal)
        if (use) return `${mealLabels[meal]} ${use.status === 'ticket' ? '식권' : '미구매'}`
        if (balance[meal] > 0) return `${mealLabels[meal]} ${balance[meal]}`
        return ''
      })
      .filter(Boolean)
    return states.length > 0 ? states.join(' · ') : '미등록'
  }

  function getHistory(officerId: string): OfficerUseHistory {
    return histories.get(officerId) ?? { dayCount: 0, mealCount: 0, ticketCount: 0, unpaidCount: 0 }
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
        <label className="search-box">
          <Search size={18} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder="식권구매자 이름 검색" value={query} />
        </label>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>오늘 식사 체크</h2>
          <div className="ticket-buyer-list-tools">
            <small>{visibleBuyers.length}명</small>
            <button disabled={visibleBuyers.length === 0} onClick={toggleAllVisibleBuyers} type="button">
              {allVisibleBuyersExpanded ? '전체 접기' : '전체 펼치기'}
            </button>
          </div>
        </div>
        {visibleBuyers.length > 0 ? (
          <div className="ticket-buyer-board">
            <div className="ticket-buyer-board-head" aria-hidden="true">
              <span>이름</span>
              <span>조식</span>
              <span>중식</span>
              <span>석식</span>
              <span>관리</span>
            </div>
            {visibleBuyers.map((officer) => {
              const balance = balances.get(officer.id) ?? { breakfast: 0, lunch: 0, dinner: 0 }
              const history = getHistory(officer.id)
              const isExpanded = expandedBuyerIds.includes(officer.id)
              const summary = getBuyerSummary(officer.id, balance)
              return (
                <article className={`ticket-buyer-row ${isExpanded ? 'expanded' : 'collapsed'}`} key={officer.id}>
                  <header className="ticket-buyer-row-header">
                    <div className="ticket-buyer-row-copy">
                      <strong>{officer.name}</strong>
                      <small>{summary}</small>
                      <small>누적 {history.dayCount}일 · {history.mealCount}식</small>
                    </div>
                    <div className="ticket-buyer-inline-meals" aria-label={`${officer.name} 오늘 식사 체크`}>
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
                            <small>{use ? '구매' : '미등록'}</small>
                          </button>
                        )
                      })}
                    </div>
                    <div className="ticket-buyer-actions">
                      <button
                        aria-expanded={isExpanded}
                        aria-label={`${officer.name} 상세 열기`}
                        onClick={() => toggleBuyerExpanded(officer.id)}
                        type="button"
                      >
                        {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                      </button>
                      <button aria-label={`${officer.name} 이름 수정`} onClick={() => openEditBuyer(officer)} type="button">
                        <Pencil size={17} />
                      </button>
                      <button aria-label={`${officer.name} 삭제`} onClick={() => handleDeleteBuyer(officer)} type="button">
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </header>
                  {isExpanded && (
                    <div className="ticket-buyer-detail">
                      <div className="ticket-buyer-history-strip" aria-label={`${officer.name} 누적 식수`}>
                        <div>
                          <span>누적</span>
                          <strong>{history.dayCount}일</strong>
                        </div>
                        <div>
                          <span>총 식수</span>
                          <strong>{history.mealCount}식</strong>
                        </div>
                        <div>
                          <span>구매/미구매</span>
                          <strong>
                            {history.ticketCount}/{history.unpaidCount}
                          </strong>
                        </div>
                      </div>
                      <div className="ticket-buyer-detail-caption">잔여 식권 / 추가 구매 / 취소</div>
                      <div className="ticket-buyer-balance" aria-label={`${officer.name} 잔여 식권`}>
                        {mealOrder.map((meal) => {
                          const count = balance[meal]
                          const use = findTodayUse(officer.id, meal)
                          const shouldCancel = count > 0 && use?.status !== 'unpaid'
                          return (
                            <button
                              className={shouldCancel ? 'cancel' : 'purchase'}
                              key={meal}
                              onClick={() =>
                                shouldCancel
                                  ? void app.cancelOfficerTicket(officer.id, meal, 1)
                                  : purchaseMealTicket(officer.name, meal)
                              }
                              title={shouldCancel ? `${mealLabels[meal]} 식권 1장 취소` : `${mealLabels[meal]} 식권 1장 구매`}
                              type="button"
                            >
                              <span>
                                {mealLabels[meal]} {shouldCancel ? count : '구매'}
                              </span>
                              {shouldCancel ? <Trash2 size={14} /> : <Ticket size={14} />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
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

      <motion.button
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="ticket-buyer-add-fab"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        onClick={() => setAddBuyerOpen(true)}
        transition={{ delay: 0.12, duration: 0.2 }}
        type="button"
      >
        <Plus size={18} />
        구매자 추가
      </motion.button>

      {editingBuyer && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal buyer-edit-modal" onSubmit={handleEditBuyerSubmit}>
            <header className="modal-header">
              <div>
                <span>식권구매자 수정</span>
                <h2>{editingBuyer.name}</h2>
              </div>
              <button aria-label="닫기" className="icon-button" onClick={closeEditBuyer} type="button">
                <X size={20} />
              </button>
            </header>
            <input
              autoFocus
              onChange={(event) => setEditName(event.target.value)}
              placeholder="식권구매자 이름"
              value={editName}
            />
            <div className="modal-actions">
              <button className="secondary-button" onClick={closeEditBuyer} type="button">
                취소
              </button>
              <button className="primary-button" type="submit">
                수정 저장
              </button>
            </div>
          </form>
        </div>
      )}

      <AnimatePresence>
        {addBuyerOpen && (
          <motion.div
            animate={{ opacity: 1 }}
            className="modal-backdrop"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => setAddBuyerOpen(false)}
          >
            <motion.form
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="modal buyer-add-modal"
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
              onSubmit={handleBuyerSubmit}
              transition={{ duration: 0.16 }}
            >
              <header className="modal-header">
                <div>
                  <span>식권구매자</span>
                  <h2>구매자 추가</h2>
                </div>
                <button aria-label="닫기" className="icon-button" onClick={() => setAddBuyerOpen(false)} type="button">
                  <X size={20} />
                </button>
              </header>
              <input
                autoFocus
                onChange={(event) => setBuyerName(event.target.value)}
                placeholder="식권구매자 이름"
                value={buyerName}
              />
              <button className="primary-button" type="submit">
                <Plus size={18} /> 추가
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
      {confirmDeleteBuyer && (
        <ConfirmDialog
          body="오늘 배치와 구매/취소 내역도 함께 삭제됩니다."
          confirmLabel="삭제"
          onCancel={() => setConfirmDeleteBuyer(undefined)}
          onConfirm={() => {
            void app.deleteOfficerBuyer(confirmDeleteBuyer.id)
            setConfirmDeleteBuyer(undefined)
          }}
          title={`${confirmDeleteBuyer.name} 식권구매자를 삭제할까요?`}
        />
      )}
    </div>
  )
}
