import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  Database,
  FileDown,
  FileUp,
  Info,
  Package,
  RotateCcw,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import type { AppState } from '../app/appState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { InventoryScreen } from '../screens/InventoryScreen'
import { ReportScreen } from '../screens/ReportScreen'
import { SoldiersScreen } from '../screens/SoldiersScreen'
import { downloadBackup } from '../storage/jsonExport'
import { parseBackup } from '../storage/jsonImport'
import { localStore } from '../storage/localStore'
import { formatTime } from '../utils/date'

interface SettingsSheetProps {
  app: AppState
  open: boolean
  onClose: () => void
}

type SettingsView = 'menu' | 'soldiers' | 'inventory' | 'report' | 'data'

const viewTitles: Record<SettingsView, string> = {
  menu: '관리',
  soldiers: '인원관리',
  inventory: '부식재고',
  report: '보고',
  data: '데이터',
}

export function SettingsSheet({ app, open, onClose }: SettingsSheetProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirm, setConfirm] = useState<'current' | 'all'>()
  const [view, setView] = useState<SettingsView>('menu')

  async function exportJson() {
    downloadBackup(await localStore.exportBackup())
    app.setToast('백업 파일을 내보냈습니다.')
  }

  async function importJson(file?: File) {
    if (!file) return
    try {
      downloadBackup(await localStore.exportBackup())
      const backup = parseBackup(await file.text())
      await app.importBackup(backup)
      app.setToast('JSON을 가져왔습니다. 기존 데이터는 자동 백업했습니다.')
    } catch (error) {
      app.setToast(error instanceof Error ? error.message : '가져오기에 실패했습니다.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function closeSheet() {
    setView('menu')
    onClose()
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div className="sheet-backdrop" onClick={closeSheet}>
            <motion.aside
              animate={{ y: 0 }}
              className="settings-sheet"
              exit={{ y: '100%' }}
              initial={{ y: '100%' }}
              onClick={(event) => event.stopPropagation()}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            >
              <header>
                <div>
                  <span>설정</span>
                  <h2>{viewTitles[view]}</h2>
                </div>
                <button aria-label="닫기" className="icon-button" onClick={closeSheet} type="button">
                  <X size={20} />
                </button>
              </header>

              {view !== 'menu' && (
                <button className="ghost-button sheet-back-button" onClick={() => setView('menu')} type="button">
                  설정으로 돌아가기
                </button>
              )}

              {view === 'menu' && (
                <div className="sheet-actions">
                  <button onClick={() => setView('soldiers')} type="button">
                    <Users size={18} /> 인원관리
                  </button>
                  <button onClick={() => setView('inventory')} type="button">
                    <Package size={18} /> 부식재고
                  </button>
                  <button onClick={() => setView('report')} type="button">
                    <BarChart3 size={18} /> 보고
                  </button>
                  <button onClick={() => setView('data')} type="button">
                    <Database size={18} /> 데이터 백업/초기화
                  </button>
                </div>
              )}

              {view === 'soldiers' && <SoldiersScreen app={app} />}
              {view === 'inventory' && <InventoryScreen app={app} />}
              {view === 'report' && <ReportScreen app={app} />}

              {view === 'data' && (
                <>
                  <div className="sheet-actions">
                    <button onClick={exportJson} type="button">
                      <FileDown size={18} /> JSON 내보내기
                    </button>
                    <button onClick={() => fileRef.current?.click()} type="button">
                      <FileUp size={18} /> JSON 가져오기
                    </button>
                    <button onClick={() => setConfirm('current')} type="button">
                      <RotateCcw size={18} /> 현재 식사 기록 초기화
                    </button>
                    <button className="danger-text" onClick={() => setConfirm('all')} type="button">
                      <Trash2 size={18} /> 전체 데이터 초기화
                    </button>
                  </div>
                  <input
                    accept="application/json"
                    hidden
                    onChange={(event) => void importJson(event.target.files?.[0])}
                    ref={fileRef}
                    type="file"
                  />
                  <section className="storage-status">
                    <Database size={18} />
                    <span>localStorage · 마지막 저장 {formatTime(app.lastSavedAt)}</span>
                  </section>
                  <section className="storage-status">
                    <Info size={18} />
                    <span>v1 · 오프라인 실행과 GitHub Pages 배포 가능</span>
                  </section>
                </>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      {confirm === 'current' && (
        <ConfirmDialog
          body="현재 날짜와 식사의 체크 기록만 새로 만듭니다."
          onCancel={() => setConfirm(undefined)}
          onConfirm={() => {
            void app.resetCurrentRecord()
            setConfirm(undefined)
          }}
          title="현재 기록을 초기화할까요?"
        />
      )}
      {confirm === 'all' && (
        <ConfirmDialog
          body="인원, 부식재고, 모든 취식 기록이 삭제됩니다."
          onCancel={() => setConfirm(undefined)}
          onConfirm={() => {
            void app.resetAll()
            setConfirm(undefined)
          }}
          title="전체 데이터를 초기화할까요?"
        />
      )}
    </>
  )
}
