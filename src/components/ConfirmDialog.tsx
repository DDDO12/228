import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  title: string
  body: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ title, body, confirmLabel = '초기화', onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <AlertTriangle size={24} />
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="modal-actions">
          <button className="ghost-button" onClick={onCancel} type="button">
            취소
          </button>
          <button className="danger-button" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
