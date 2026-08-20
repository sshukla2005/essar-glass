import dayjs from 'dayjs'

/**
 * disabledDate rule: block any date strictly before `anchor`.
 * Returns a permissive rule when anchor is empty so the picker stays
 * usable before the user has filled the anchor field.
 */
export const notBefore = (anchor) => (current) => {
  if (!current || !anchor) return false
  return current.isBefore(dayjs(anchor), 'day')
}
