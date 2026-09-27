// Opening a generated PDF in a new browser tab instead of downloading it.

// How long a preview's blob URL stays valid. The tab has loaded the PDF long before
// this; revoking frees the blob's memory so repeated previews do not accumulate.
export const PREVIEW_URL_TTL_MS = 60 * 1000

/**
 * Build a PDF with buildDoc() and show it in a new tab.
 *
 * The tab is opened synchronously, inside the click, and pointed at the PDF once it
 * is built: browsers block window.open calls made after a slow async build, so
 * opening it only at the end would fail intermittently. When the browser blocks the
 * tab, the user is told instead of nothing happening.
 *
 * Must be called directly from a click handler. Resolves true when the preview
 * opened, false when it was blocked or the PDF could not be built.
 */
export const openPdfPreview = async (buildDoc, message) => {
  const previewWindow = window.open('', '_blank')
  if (!previewWindow) {
    message.warning('The PDF preview was blocked by the browser. Allow pop-ups for this site and try again.')
    return false
  }
  try {
    previewWindow.document.title = 'Generating preview…'
    previewWindow.document.body.innerHTML =
      '<p style="font-family: sans-serif; color: #64748b; padding: 24px;">Generating preview…</p>'
  } catch (e) {
    // Placeholder text is cosmetic; the preview still loads without it
  }

  let doc = null
  try {
    doc = await buildDoc()
  } catch (e) {
    doc = null
  }
  if (!doc) {
    previewWindow.close()
    message.error('Could not generate the PDF preview')
    return false
  }

  const url = doc.output('bloburl')
  previewWindow.location.href = url
  setTimeout(() => URL.revokeObjectURL(url), PREVIEW_URL_TTL_MS)
  return true
}
