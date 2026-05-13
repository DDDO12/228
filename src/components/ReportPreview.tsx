interface ReportPreviewProps {
  report: string
  onCopy: () => void
}

export function ReportPreview({ report, onCopy }: ReportPreviewProps) {
  return (
    <section className="panel report-preview">
      <pre>{report}</pre>
      <button className="primary-button" onClick={onCopy} type="button">
        보고문 복사
      </button>
    </section>
  )
}
