import { useMemo, useState } from 'react'
import type { AppState } from '../app/appState'
import { MealSelector } from '../components/MealSelector'
import { ReportPreview } from '../components/ReportPreview'
import { formatKakaoReport, formatOfficerMealReport } from '../domain/report'

type ReportMode = 'attendance' | 'officer'

export function ReportScreen({ app }: { app: AppState }) {
  const [reportMode, setReportMode] = useState<ReportMode>('attendance')
  const [includeMissing, setIncludeMissing] = useState(true)
  const [includeDivisionDetails, setIncludeDivisionDetails] = useState(true)
  const report = useMemo(() => {
    if (reportMode === 'officer') return formatOfficerMealReport(app.date, app.officerMealUses)
    return formatKakaoReport(app.currentRecord, includeMissing, includeDivisionDetails)
  }, [app.currentRecord, app.date, app.officerMealUses, includeDivisionDetails, includeMissing, reportMode])

  async function copy() {
    await navigator.clipboard.writeText(report)
    app.setToast('보고문을 복사했습니다.')
  }

  return (
    <div className="stack">
      <section className="panel control-panel">
        <div className="segmented" role="tablist" aria-label="보고 종류">
          <button className={reportMode === 'attendance' ? 'active' : ''} onClick={() => setReportMode('attendance')} type="button">
            취식체크
          </button>
          <button className={reportMode === 'officer' ? 'active' : ''} onClick={() => setReportMode('officer')} type="button">
            간부식수
          </button>
        </div>
        {reportMode === 'attendance' ? (
          <>
            <div className="field-line">
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
                /> 포대 상세
              </label>
            </div>
          </>
        ) : (
          <p className="muted-copy">선택 날짜 기준으로 조식, 중식, 석식 식권구매자 식수를 종합합니다.</p>
        )}
      </section>
      <ReportPreview onCopy={() => void copy()} report={report} />
    </div>
  )
}
