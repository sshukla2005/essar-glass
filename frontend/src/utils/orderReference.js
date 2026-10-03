// Where an order came from. Picked on the Quotation / Sales Order form (stored in
// order_reference), copied from a quotation to its Sales Order, and filterable on both lists.
export const ORDER_REFERENCES = [
  { value: 'architect',  label: 'Architect',               color: 'purple' },
  { value: 'builder',    label: 'Builders',                color: 'geekblue' },
  { value: 'fabricator', label: 'Fabricator / Contractor', color: 'orange' },
  { value: 'individual', label: 'Individual / Walk-in',    color: 'green' },
  { value: 'company',    label: 'Company',                 color: 'cyan' },
  { value: 'online',     label: 'IndiaMART / Online',      color: 'magenta' },
]

const BY_VALUE = Object.fromEntries(ORDER_REFERENCES.map(r => [r.value, r]))

export const orderReferenceLabel = (value) => BY_VALUE[value]?.label || value || ''
export const orderReferenceColor = (value) => BY_VALUE[value]?.color || 'default'
