// Ship To address for quotations, Sales Orders and their PDFs. No imports, so
// scripts/test-ship-to.mjs can run it under plain node.
//
// Where it comes from, first match wins:
//   1. the document's own Ship To text (delivery_address), unless it just repeats
//      the billing address (older documents stored the billing street line there)
//   2. the customer master's shipping address, when "Same as billing" is off
//   3. the billing address (what every PDF printed before)
//
// Customer shipping fields live in the customer's extra_data, which the API
// returns flattened: ship_same_as_billing, ship_address, ship_address_line2,
// ship_city, ship_state, ship_pincode.

const clean = (v) => (v === null || v === undefined ? '' : String(v).trim())
const squash = (v) => clean(v).toLowerCase().replace(/[\s,.;]+/g, ' ').trim()

/** Customer's separate shipping address as { address, address_line2, city, state, pincode }, or null. */
export const customerShippingAddress = (c) => {
  if (!c || c.ship_same_as_billing !== false) return null
  const a = {
    address: clean(c.ship_address),
    address_line2: clean(c.ship_address_line2),
    city: clean(c.ship_city),
    state: clean(c.ship_state),
    pincode: clean(c.ship_pincode),
  }
  return a.address || a.city ? a : null
}

/** Multi-line text for an address object: street, line 2, "city, state, pincode". */
export const formatAddressText = (a) => {
  if (!a) return ''
  const cityLine = [clean(a.city), clean(a.state || a.state_name), clean(a.pincode)].filter(Boolean).join(', ')
  return [clean(a.address), clean(a.address_line2), cityLine].filter(Boolean).join('\n')
}

/** Ship To text to pre-fill on a quotation / SO when its customer is picked ('' = same as billing). */
export const defaultShipToText = (customer) => formatAddressText(customerShippingAddress(customer))

const repeatsBilling = (text, billing) => {
  const t = squash(text)
  if (!t) return true
  return t === squash(billing?.address) || t === squash(formatAddressText(billing))
}

/**
 * Party object for the PDF's SHIP TO box, or null when it is the same as Bill To.
 * `billing` is the Bill To party (name, address, city, state, pincode, phone, gstin...),
 * `customer` the customer master row (may be null), `docShipText` the document's
 * delivery_address.
 */
export const resolveShipToParty = (billing, customer, docShipText) => {
  const text = clean(docShipText)
  if (text && !repeatsBilling(text, billing)) {
    return { ...billing, address: text, address_line2: '', city: '', state: '', state_name: '', pincode: '' }
  }
  const ship = customerShippingAddress(customer)
  if (ship) return { ...billing, ...ship, state_name: ship.state }
  return null
}
