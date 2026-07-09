import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import toast from 'react-hot-toast'

// ============================================================
// Shared helpers
// ============================================================

/** Strip characters that are invalid in filenames. */
function safeFilename(name) {
  return String(name).replace(/[/\\?%*:|"<>]/g, '-').trim() || 'export'
}

/** Resolve a cell value via the column definition. */
function cellValue(row, col) {
  const value = col.value ? col.value(row) : row[col.key]
  return value === null || value === undefined ? '' : String(value)
}

/**
 * CSV formula-injection protection. Values starting with = + - @ (or tab/CR)
 * are treated as formulas by Excel/Sheets — dangerous here because titles and
 * descriptions are resident-supplied text. Prefixing with ' neutralizes them.
 */
function sanitizeForCSV(value) {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`
  return value
}

/** Remove emoji (they render as garbage glyphs in jsPDF's built-in fonts). */
function stripEmoji(value) {
  return value
    .replace(/[\u{1F000}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{2190}-\u{21FF}]|\u{200D}/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Truncate text with an ellipsis so it fits within maxWidth (in doc units). */
function fitText(doc, text, maxWidth) {
  if (doc.getTextWidth(text) <= maxWidth) return text
  let out = text
  while (out.length > 0 && doc.getTextWidth(out + '...') > maxWidth) {
    out = out.slice(0, -1)
  }
  return out + '...'
}

// ============================================================
// CSV Export
// ============================================================

export function exportToCSV(data, filename, columns) {
  if (!data || data.length === 0) {
    toast.error('No data to export')
    return false
  }

  try {
    const headers = columns.map(c => `"${c.label}"`).join(',')

    const rows = data.map(row =>
      columns.map(col => {
        const value = sanitizeForCSV(cellValue(row, col)).replace(/"/g, '""')
        return `"${value}"`
      }).join(',')
    )

    const csv = [headers, ...rows].join('\n')
    // BOM so Excel opens it as UTF-8 (Filipino names, ñ, etc.)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${safeFilename(filename)}-${new Date().toISOString().split('T')[0]}.csv`
    // Firefox requires the link to be in the DOM for click() to work
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    // Revoke on the next tick — revoking synchronously can cancel the
    // download in some browsers
    setTimeout(() => URL.revokeObjectURL(url), 1000)

    toast.success(`Exported ${data.length} record${data.length === 1 ? '' : 's'} to CSV`)
    return true
  } catch (err) {
    console.error('CSV export failed:', err)
    toast.error('Export failed. Please try again.')
    return false
  }
}

// ============================================================
// PDF Export
// ============================================================

// Cache the logo — no reason to refetch it on every export
let logoCache = undefined // undefined = not tried yet, null = failed
async function getLogoBase64() {
  if (logoCache !== undefined) return logoCache
  try {
    const response = await fetch('/logo.png')
    if (!response.ok) throw new Error('Logo fetch failed')
    const blob = await response.blob()
    logoCache = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    logoCache = null
  }
  return logoCache
}

// Colorize only cells in these columns — matching by value alone risked
// styling a title that happened to be exactly "High" or "Low"
const BADGE_COLUMN_KEYS = new Set(['priority', 'status'])

const PRIORITY_STYLES = {
  critical: { fill: [254, 226, 226], text: [185, 28, 28], bold: true },
  high: { fill: [254, 215, 170], text: [194, 65, 12], bold: true },
  medium: { fill: [219, 234, 254], text: [30, 64, 175], bold: false },
  low: { fill: [220, 252, 231], text: [22, 101, 52], bold: false },
}

const STATUS_STYLES = {
  pending: { fill: [254, 243, 199], text: [146, 64, 14] },
  open: { fill: [254, 243, 199], text: [146, 64, 14] },
  assigned: { fill: [219, 234, 254], text: [30, 64, 175] },
  in_progress: { fill: [219, 234, 254], text: [30, 64, 175] },
  resolved: { fill: [220, 252, 231], text: [22, 101, 52] },
  closed: { fill: [220, 252, 231], text: [22, 101, 52] },
}

const DOT_POSITIONS = [
  { x: 0.15, y: 0.25, size: 1.5, opacity: 0.4 },
  { x: 0.25, y: 0.55, size: 1, opacity: 0.3 },
  { x: 0.35, y: 0.35, size: 2, opacity: 0.5 },
  { x: 0.45, y: 0.7, size: 1, opacity: 0.25 },
  { x: 0.55, y: 0.45, size: 1.5, opacity: 0.35 },
  { x: 0.62, y: 0.2, size: 1, opacity: 0.3 },
  { x: 0.68, y: 0.6, size: 1.8, opacity: 0.4 },
  { x: 0.72, y: 0.85, size: 1, opacity: 0.25 },
  { x: 0.78, y: 0.4, size: 1.2, opacity: 0.3 },
  { x: 0.85, y: 0.65, size: 1.5, opacity: 0.4 },
  { x: 0.92, y: 0.3, size: 1, opacity: 0.25 },
  { x: 0.96, y: 0.55, size: 1.3, opacity: 0.35 },
]

// jspdf placeholder that putTotalPages() replaces at the end
const TOTAL_PAGES_EXP = '{total_pages_count_string}'

export async function exportToPDF(data, filename, columns, options = {}) {
  if (!data || data.length === 0) {
    toast.error('No data to export')
    return false
  }

  const {
    title = 'Report',
    subtitle = '',
    barangay = '',
    orientation = 'portrait',
    paperSize = 'a4', // a4, letter, legal
  } = options

  try {
    const doc = new jsPDF({ orientation, unit: 'mm', format: paperSize })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const compact = pageWidth < 200

    const margin = compact ? 10 : 14
    const headerHeight = compact ? 38 : 45
    const slimHeaderHeight = 12 // continuation pages

    const logoBase64 = await getLogoBase64()

    // Column-index → key map so didParseCell knows which column it's styling
    const columnKeyByIndex = columns.map(c => c.key)

    // ---------- Full header (page 1) ----------
    doc.setFillColor(91, 84, 232)
    doc.rect(0, 0, pageWidth, headerHeight, 'F')

    DOT_POSITIONS.forEach(dot => {
      doc.setFillColor(255, 255, 255)
      doc.setGState(new doc.GState({ opacity: dot.opacity }))
      doc.circle(pageWidth * dot.x, headerHeight * dot.y, dot.size, 'F')
    })
    doc.setGState(new doc.GState({ opacity: 1 }))

    // Accent stripe
    doc.setFillColor(124, 117, 240)
    doc.rect(0, headerHeight - 3, pageWidth, 3, 'F')

    // Logo card
    const logoSize = compact ? 18 : 22
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(margin, 8, logoSize, logoSize, 4, 4, 'F')

    const drawLogoFallback = () => {
      doc.setTextColor(91, 84, 232)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('BH', margin + logoSize / 2, 18, { align: 'center' })
      doc.setFontSize(8)
      doc.text('360', margin + logoSize / 2, 24, { align: 'center' })
    }

    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', margin + 2, 10, logoSize - 4, logoSize - 4)
      } catch {
        drawLogoFallback()
      }
    } else {
      drawLogoFallback()
    }

    // Brand
    const brandX = margin + logoSize + 6
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(compact ? 15 : 18)
    doc.setFont('helvetica', 'bold')
    doc.text('BarangayHub 360', brandX, 18)

    doc.setFontSize(compact ? 7 : 8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(220, 215, 255)
    doc.text('Smart Barangay Management', brandX, 24)

    // Title, right-aligned — truncated so a long title can't collide
    // with the brand block
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(compact ? 12 : 14)
    doc.setFont('helvetica', 'bold')
    const maxTitleWidth = pageWidth - margin - (brandX + doc.getTextWidth('BarangayHub 360')) - 8
    doc.text(fitText(doc, stripEmoji(title), Math.max(maxTitleWidth, 40)), pageWidth - margin, 16, { align: 'right' })

    doc.setFontSize(compact ? 7 : 8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(220, 215, 255)
    doc.text(
      `Generated: ${new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}`,
      pageWidth - margin,
      24,
      { align: 'right' }
    )

    // ---------- Info card ----------
    const cardY = headerHeight + 8
    const cardHeight = 22

    doc.setFillColor(245, 244, 255)
    doc.roundedRect(margin, cardY, pageWidth - margin * 2, cardHeight, 3, 3, 'F')
    doc.setDrawColor(232, 227, 255)
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, cardY, pageWidth - margin * 2, cardHeight, 3, 3, 'S')

    const badgeWidth = 36
    const badgeHeight = 10
    const badgeX = pageWidth - margin - badgeWidth - 4
    const badgeY = cardY + 6

    const col1X = margin + 6
    const col2X = compact ? margin + 60 : margin + 70

    if (barangay) {
      doc.setTextColor(91, 84, 232)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('LOCATION', col1X, cardY + 7)

      doc.setTextColor(55, 65, 81)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(fitText(doc, barangay, col2X - col1X - 4), col1X, cardY + 14)
    }

    if (subtitle) {
      doc.setTextColor(91, 84, 232)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('REPORT DETAILS', col2X, cardY + 7)

      doc.setTextColor(55, 65, 81)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(fitText(doc, subtitle, badgeX - col2X - 4), col2X, cardY + 14)
    }

    // Total records badge
    doc.setFillColor(91, 84, 232)
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(6)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL RECORDS', badgeX + badgeWidth / 2, badgeY + 4, { align: 'center' })
    doc.setFontSize(9)
    doc.text(String(data.length), badgeX + badgeWidth / 2, badgeY + 8.5, { align: 'center' })

    // ---------- Table ----------
    const headers = [columns.map(c => c.label)]
    const rows = data.map(row =>
      columns.map(col => {
        const value = cellValue(row, col)
        return value === '' ? '—' : stripEmoji(value)
      })
    )

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: cardY + cardHeight + 5,
      theme: 'plain',
      headStyles: {
        fillColor: [91, 84, 232],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: compact ? 8 : 9,
        cellPadding: compact ? 3 : 5,
        halign: 'left',
      },
      bodyStyles: {
        fontSize: compact ? 7.5 : 8.5,
        cellPadding: compact ? 3 : 4,
        textColor: [55, 65, 81],
        lineColor: [240, 239, 254],
        lineWidth: 0.2,
        overflow: 'linebreak',
      },
      alternateRowStyles: {
        fillColor: [250, 250, 255],
      },
      // top margin keeps continuation-page tables clear of the slim header
      margin: { left: margin, right: margin, top: slimHeaderHeight + 8, bottom: 22 },
      tableWidth: 'auto',
      didDrawPage: (hookData) => {
        const currentPage = doc.internal.getNumberOfPages()

        // Slim brand strip on continuation pages so every page is identifiable
        if (hookData.pageNumber > 1) {
          doc.setFillColor(91, 84, 232)
          doc.rect(0, 0, pageWidth, slimHeaderHeight, 'F')
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          doc.text('BarangayHub 360', margin, 8)
          doc.setFontSize(8)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(220, 215, 255)
          doc.text(fitText(doc, stripEmoji(title), pageWidth / 2), pageWidth - margin, 8, { align: 'right' })
        }

        // Footer
        doc.setDrawColor(232, 227, 255)
        doc.setLineWidth(0.3)
        doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18)

        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(156, 163, 175)
        doc.text('BarangayHub 360', margin, pageHeight - 12)

        doc.setFontSize(6)
        doc.text('Confidential - For Internal Use Only', margin, pageHeight - 8)

        doc.setTextColor(91, 84, 232)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.text('Smart Barangay Management System', pageWidth / 2, pageHeight - 10, { align: 'center' })

        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(156, 163, 175)
        doc.text(`Page ${currentPage} of ${TOTAL_PAGES_EXP}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
      },
      didParseCell: (hookData) => {
        if (hookData.section !== 'body') return
        // Only style known badge columns — never regular text columns
        const key = columnKeyByIndex[hookData.column.index]
        if (!BADGE_COLUMN_KEYS.has(key)) return

        const value = String(hookData.cell.text[0] || '').toLowerCase()
        const style = PRIORITY_STYLES[value] || STATUS_STYLES[value]
        if (style) {
          hookData.cell.styles.fillColor = style.fill
          hookData.cell.styles.textColor = style.text
          if (style.bold) hookData.cell.styles.fontStyle = 'bold'
        }
      },
    })

    // Replace the "of {placeholder}" tokens with the real page count
    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(TOTAL_PAGES_EXP)
    }

    doc.save(`${safeFilename(filename)}-${new Date().toISOString().split('T')[0]}.pdf`)
    toast.success(`Exported ${data.length} record${data.length === 1 ? '' : 's'} to PDF`)
    return true
  } catch (err) {
    console.error('PDF export failed:', err)
    toast.error('PDF export failed. Please try again.')
    return false
  }
}