const initialConsonants = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
] as const

const hangulStart = 0xac00
const hangulEnd = 0xd7a3
const syllableSize = 588

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

export function getHangulInitials(value: string) {
  return Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0)
      if (code < hangulStart || code > hangulEnd) return char
      return initialConsonants[Math.floor((code - hangulStart) / syllableSize)]
    })
    .join('')
}

export function matchesSearch(query: string, fields: Array<string | undefined>) {
  const term = normalizeSearchText(query)
  if (!term) return true

  const termInitials = normalizeSearchText(getHangulInitials(term))

  return fields.some((field) => {
    const text = normalizeSearchText(field ?? '')
    if (!text) return false
    const initials = normalizeSearchText(getHangulInitials(text))
    return text.includes(term) || initials.includes(term) || initials.includes(termInitials)
  })
}
