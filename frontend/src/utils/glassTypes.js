// Glass type options for dropdowns. The stored value never changes (e.g. 'DGU');
// only what the user sees does. Types with no entry here, including ones users add
// themselves, show exactly as stored.

export const DEFAULT_GLASS_TYPES = ['Annealed', 'Toughened', 'Laminated', 'DGU']

// Stored value (trimmed, case-insensitive) -> label shown in dropdowns
const GLASS_TYPE_LABELS = {
  dgu: 'Insulated',
}

export const glassTypeLabel = (value) => {
  if (value == null) return value
  return GLASS_TYPE_LABELS[String(value).trim().toLowerCase()] ?? value
}

export const glassTypeOptions = (types = DEFAULT_GLASS_TYPES) =>
  (types?.length ? types : DEFAULT_GLASS_TYPES).map(t => ({ value: t, label: glassTypeLabel(t) }))

// Select filterOption that matches either the label or the stored value ("dgu" finds Insulated)
export const matchGlassTypeOption = (input, option) => {
  const q = (input || '').trim().toLowerCase()
  return String(option?.label ?? '').toLowerCase().includes(q) || String(option?.value ?? '').toLowerCase().includes(q)
}
