// Sending a quotation PDF on WhatsApp: build the PDF blob, upload it with
// quotationApi.shareFile, then POST /quotations/{id}/send-whatsapp with its url.
// Used by the confirm flow and the "Send on WhatsApp" actions on the form and list.
import { Modal } from 'antd'
import { quotationApi } from '../api'
import { generateQuotationPDF } from './pdfGenerator'

/** Customer name and phone for the WhatsApp message, and whether the phone is usable. */
export const getWhatsAppRecipient = (customer, record) => {
  const name = customer?.name || record?.customer_name || 'Customer'
  const rawPhone = customer?.phone || customer?.mobile || record?.customer_phone || ''
  const phone = (typeof rawPhone === 'string' ? rawPhone : String(rawPhone || '')).trim()
  const hasPhone = Boolean(phone && phone !== 'null' && phone !== 'undefined' && phone !== 'None')
  return { name, phone, hasPhone }
}

/** Build the PDF with buildBlob() and upload it; resolves to the uploaded file's url. */
export const uploadQuotationPdf = async (quotationId, quoteNumber, buildBlob) => {
  const blob = await buildBlob()
  const res = await quotationApi.shareFile(quotationId, blob, `${quoteNumber}.pdf`)
  return res.data.url
}

/** PDF blob for a full quotation record fetched from the API (not a list row). */
export const buildQuotationRecordPdfBlob = async (record) => {
  const doc = await generateQuotationPDF(record, { save: false })
  return doc ? doc.output('blob') : null
}

/**
 * Ask "Send quotation on WhatsApp?" and, on Send, send it. getDocumentUrl is only
 * called after the user clicks Send. Resolves true if Send was clicked, false if not.
 */
export const confirmAndSendQuotationWhatsApp = ({ quotationId, quoteNumber, customerName, getDocumentUrl, message }) =>
  new Promise((resolve) => {
    Modal.confirm({
      title: 'Send quotation on WhatsApp?',
      content: `${quoteNumber} will be sent to ${customerName} on WhatsApp with the PDF attached.`,
      okText: 'Send',
      cancelText: 'Not now',
      onOk: async () => {
        let documentUrl
        try {
          documentUrl = await getDocumentUrl()
        } catch (err) {
          message.warning('The quotation PDF could not be prepared for WhatsApp')
          resolve(true)
          return
        }
        try {
          const waRes = await quotationApi.sendWhatsApp(quotationId, documentUrl)
          if (waRes.data?.sent) {
            message.success('Quotation sent on WhatsApp')
          } else {
            message.info(`WhatsApp not sent: ${waRes.data?.reason || 'unknown'}`)
          }
        } catch (waErr) {
          message.warning('WhatsApp notification failed')
        }
        resolve(true)
      },
      onCancel: () => resolve(false),
    })
  })

/**
 * The manual "Send on WhatsApp" action: confirm first, then build, upload and send.
 * Resolves false without asking when the customer has no usable phone number.
 */
export const sendQuotationOnWhatsApp = async ({ quotationId, quoteNumber, customer, record, buildBlob, message }) => {
  const { name, hasPhone } = getWhatsAppRecipient(customer, record)
  if (!hasPhone) {
    message.warning(`${name} has no phone number. Add one to the customer to send on WhatsApp.`)
    return false
  }
  return confirmAndSendQuotationWhatsApp({
    quotationId,
    quoteNumber,
    customerName: name,
    getDocumentUrl: () => uploadQuotationPdf(quotationId, quoteNumber, buildBlob),
    message,
  })
}
