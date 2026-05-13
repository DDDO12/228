import { AnimatePresence, motion } from 'framer-motion'

interface ToastProps {
  message: string
  onClose: () => void
}

export function Toast({ message, onClose }: ToastProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.button
          animate={{ opacity: 1, y: 0 }}
          className="toast"
          exit={{ opacity: 0, y: 12 }}
          initial={{ opacity: 0, y: 12 }}
          onAnimationComplete={() => window.setTimeout(onClose, 2200)}
          type="button"
        >
          {message}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
