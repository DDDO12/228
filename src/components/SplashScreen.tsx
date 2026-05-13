import { motion } from 'framer-motion'
import { Utensils } from 'lucide-react'

export function SplashScreen() {
  return (
    <div className="splash">
      <motion.div animate={{ opacity: 1, scale: 1 }} className="splash-mark" initial={{ opacity: 0, scale: 0.9 }}>
        <Utensils size={40} />
      </motion.div>
      <motion.h1 animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 18 }}>
        식수체크
      </motion.h1>
      <motion.p animate={{ opacity: 1 }} initial={{ opacity: 0 }}>
        Meal Attendance System
      </motion.p>
      <div className="splash-progress">
        <motion.span animate={{ x: ['-100%', '100%'] }} transition={{ duration: 1.2, repeat: Infinity }} />
      </div>
    </div>
  )
}
