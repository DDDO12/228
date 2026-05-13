import { useMemo, useState } from 'react'
import type { AppState } from '../app/appState'
import { MealSelector } from '../components/MealSelector'
import { ReportPreview } from '../components/ReportPreview'
import { formatKakaoReport } from '../domain/report'

export function ReportScreen({ app }: { app: AppState }) {
  const [includeMissing, setIncludeMissing] = useState(true)
  const [includeDivisionDetails, setIncludeDivisionDetails] = useState(true)
  const report = useMemo(
    () => formatKakaoReport(app.currentRecord, includeMissing, includeDivisionDetails),
    [app.currentRecord, includeDivisionDetails, includeMissing],
  )

  async function copy() {
    await navigator.clipboard.writeText(report)
    app.setToast('보고문을 복사했습니다.')
  }

  return (
    <div className="stack">
      <section className="panel control-panel">
        <div className="field-line">
          <input onChange={(event) => app.setDate(event.target.value)} type="date" value={app.date} />
          <MealSelector meal={app.meal} onChange={app.setMeal} />
        </div>
        <div className="toggle-line">
          <label>
            <input checked={includeMissing} onChange={(event) => setIncludeMissing(event.target.checked)} type="checkbox" /> 미취식자 포함
          </label>
          <label>
            <input
              checked={includeDivisionDetails}
              onChange={(event) => setIncludeDivisionDetails(event.target.checked)}
              type="checkbox"
            /> 분과 상세
          </label>
        </div>
      </section>
      <ReportPreview onCopy={() => void copy()} report={report} />
    </div>
  )
}
