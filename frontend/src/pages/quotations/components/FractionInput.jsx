import React from 'react'
import { Input } from 'antd'

// ── Convert decimal inches to fraction display string ──────────
export const toFraction = (decimal) => {
  if (decimal === null || decimal === undefined || decimal === '') return ''
  const num = parseFloat(decimal)
  if (isNaN(num)) return ''

  const whole = Math.floor(num)
  const remainder = num - whole

  if (remainder === 0) return `${whole}`

  const sixteenths = Math.round(remainder * 16)

  if (sixteenths === 0) return `${whole}`
  if (sixteenths === 16) return `${whole + 1}`

  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)
  const g = gcd(sixteenths, 16)
  const num_simplified = sixteenths / g
  const den_simplified = 16 / g

  if (whole === 0) return `${num_simplified}/${den_simplified}`
  return `${whole} ${num_simplified}/${den_simplified}`
}

// ── Convert fraction string back to decimal ────────────────────
export const fromFraction = (str) => {
  if (str === null || str === undefined || str === '') return null
  const s = String(str).trim()

  if (!s.includes('/') && !isNaN(parseFloat(s))) {
    return parseFloat(s)
  }

  const parts = s.split(' ')
  if (parts.length === 2) {
    const whole = parseFloat(parts[0])
    const fracParts = parts[1].split('/')
    if (fracParts.length === 2) {
      const numerator = parseFloat(fracParts[0])
      const denominator = parseFloat(fracParts[1])
      if (!isNaN(whole) && !isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return parseFloat((whole + numerator / denominator).toFixed(6))
      }
    }
  }

  if (parts.length === 1 && s.includes('/')) {
    const fracParts = s.split('/')
    if (fracParts.length === 2) {
      const numerator = parseFloat(fracParts[0])
      const denominator = parseFloat(fracParts[1])
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return parseFloat((numerator / denominator).toFixed(6))
      }
    }
  }

  return null
}

export const isValidFractionInput = (str) => {
  if (!str) return true
  return /^[\d\s./]*$/.test(str)
}

const FractionInput = ({ value, onChange, placeholder, style, size }) => {
  const [inputVal, setInputVal] = React.useState('')
  const [isFocused, setIsFocused] = React.useState(false)

  React.useEffect(() => {
    if (!isFocused) {
      setInputVal(value !== null && value !== undefined ? toFraction(value) : '')
    }
  }, [value, isFocused])

  const handleFocus = () => {
    setIsFocused(true)
    setInputVal(value !== null && value !== undefined ? String(value) : '')
  }

  const handleBlur = () => {
    setIsFocused(false)
    const decimal = fromFraction(inputVal)
    if (decimal !== null) {
      // Only fire onChange if the value actually changed — clicking into
      // the field and clicking back out without typing anything must be a
      // no-op, not a silent re-commit of the existing value (which was
      // triggering downstream rate-recalculation side effects on toughened
      // glass groups even though nothing was edited).
      const isUnchanged = value !== null && value !== undefined &&
        Math.abs(decimal - parseFloat(value)) < 0.0001
      if (!isUnchanged) {
        onChange && onChange(decimal)
      }
      setInputVal(toFraction(decimal))
    } else if (inputVal === '' || inputVal === null) {
      if (value !== null && value !== undefined) {
        onChange && onChange(null)
      }
      setInputVal('')
    } else {
      setInputVal(value !== null && value !== undefined ? toFraction(value) : '')
    }
  }

  const handleChange = (e) => {
    const val = e.target.value
    if (isValidFractionInput(val)) {
      setInputVal(val)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur()
    }
  }

  return (
    <Input
      size={size || 'small'}
      value={inputVal}
      placeholder={isFocused ? '84.25 or 84 1/4' : (placeholder || 'e.g. 84 1/4')}
      style={{ width: '100%', fontFamily: 'monospace', ...style }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  )
}

export default FractionInput
