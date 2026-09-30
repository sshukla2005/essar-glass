// HS code lookup for documents (PDFs, invoice lines). The rules live on the server
// (app/services/hsn_service.py); this only batches the request: every distinct
// product/type/category in a document is resolved in ONE call, then looked up locally.
// No imports, so scripts/test-hsn-resolver.mjs can run it under plain node.

const norm = (v) => (v ?? '').toString().trim().toLowerCase()

// What the server needs for one item (a quotation/SO group, an SO/PO/invoice line)
export const hsnRequestItem = (src) => ({
  product_id: src?.product_id || null,
  glass_type: src?.glass_type || null,
  glass_category: src?.glass_category || null,
})

const keyOf = (item) => `${item.product_id ?? ''}|${norm(item.glass_type)}|${norm(item.glass_category)}`

/**
 * Resolve HS codes for `sources` with a single `fetchBatch(items)` call, which must
 * return { codes: [...] } in the same order. Returns codeFor(source) -> code or null.
 * If the request fails, codeFor returns null so callers can show a blank instead of a
 * wrong code.
 */
export const resolveHsnFor = async (sources, fetchBatch) => {
  const unique = new Map()
  for (const src of sources || []) {
    const item = hsnRequestItem(src)
    const key = keyOf(item)
    if (!unique.has(key)) unique.set(key, item)
  }
  const codes = new Map()
  if (unique.size > 0) {
    try {
      const res = await fetchBatch([...unique.values()])
      const list = res?.codes || []
      ;[...unique.keys()].forEach((key, i) => { if (list[i]) codes.set(key, list[i]) })
    } catch (err) {
      console.error('HSN lookup failed:', err)
    }
  }
  return (src) => codes.get(keyOf(hsnRequestItem(src))) || null
}

// Distinct codes in first-seen order, for a document-level summary
export const distinctHsnCodes = (sources, codeFor) => [...new Set((sources || []).map(codeFor).filter(Boolean))]
