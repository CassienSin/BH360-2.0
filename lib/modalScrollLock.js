// Share one lock between the mobile drawer and any confirmation above it.
const locks = new Set()
let previousOverflow = ''

export function lockBodyScroll() {
  if (typeof document === 'undefined') return () => {}
  const token = Symbol('scroll-lock')
  if (!locks.size) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  locks.add(token)
  return () => {
    if (!locks.delete(token)) return
    if (!locks.size) document.body.style.overflow = previousOverflow
  }
}
