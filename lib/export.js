import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// CSV Export
export function exportToCSV(data, filename, columns) {
  if (!data || data.length === 0) {
    alert('No data to export')
    return
  }

  const headers = columns.map(c => `"${c.label}"`).join(',')

  const rows = data.map(row =>
    columns.map(col => {
      let value = col.value ? col.value(row) : row[col.key]
      if (value === null || value === undefined) value = ''
      value = String(value).replace(/"/g, '""')
      return `"${value}"`
    }).join(',')
  )

  const csv = [headers, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// Helper: load logo as base64
async function getLogoBase64() {
  try {
    const response = await fetch('/logo.png')
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    return null
  }
}

  // PDF Export - Premium Style with adaptive sizing
  export async function exportToPDF(data, filename, columns, options = {}) {
    if (!data || data.length === 0) {
      alert('No data to export')
      return
    }

    const {
      title = 'Report',
      subtitle = '',
      barangay = '',
      orientation = 'portrait',
      paperSize = 'a4', // a4, letter, legal
    } = options

    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: paperSize,
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Adaptive margins based on paper size
    const margin = pageWidth < 200 ? 10 : 14
    const headerHeight = pageWidth < 200 ? 38 : 45

    // Load logo
    const logoBase64 = await getLogoBase64()

    // ============ HEADER ============
    // Purple background
    doc.setFillColor(91, 84, 232)
    doc.rect(0, 0, pageWidth, headerHeight, 'F')

    // Decorative dots in header (like landing page)
    const dotPositions = [
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

    dotPositions.forEach(dot => {
      doc.setFillColor(255, 255, 255)
      doc.setGState(new doc.GState({ opacity: dot.opacity }))
      doc.circle(pageWidth * dot.x, headerHeight * dot.y, dot.size, 'F')
    })
    doc.setGState(new doc.GState({ opacity: 1 }))

    // Accent stripe
    doc.setFillColor(124, 117, 240)
    doc.rect(0, headerHeight - 3, pageWidth, 3, 'F')

    // Logo background - adaptive size
    const logoSize = pageWidth < 200 ? 18 : 22
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(margin, 8, logoSize, logoSize, 4, 4, 'F')

    // Add logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', margin + 2, 10, logoSize - 4, logoSize - 4)
      } catch (e) {
        doc.setTextColor(91, 84, 232)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text('BH', margin + logoSize/2, 18, { align: 'center' })
        doc.setFontSize(8)
        doc.text('360', margin + logoSize/2, 24, { align: 'center' })
      }
    } else {
      doc.setTextColor(91, 84, 232)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('BH', margin + logoSize/2, 18, { align: 'center' })
      doc.setFontSize(8)
      doc.text('360', margin + logoSize/2, 24, { align: 'center' })
    }

    // Brand name
    const brandX = margin + logoSize + 6
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(pageWidth < 200 ? 15 : 18)
    doc.setFont('helvetica', 'bold')
    doc.text('BarangayHub 360', brandX, 18)

    doc.setFontSize(pageWidth < 200 ? 7 : 8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(220, 215, 255)
    doc.text('Smart Barangay Management', brandX, 24)

    // Title right
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(pageWidth < 200 ? 12 : 14)
    doc.setFont('helvetica', 'bold')
    doc.text(title, pageWidth - margin, 16, { align: 'right' })

    doc.setFontSize(pageWidth < 200 ? 7 : 8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(220, 215, 255)
    doc.text(
      `Generated: ${new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}`,
      pageWidth - margin,
      24,
      { align: 'right' }
    )

    // ============ INFO CARD ============
    const cardY = headerHeight + 8
    const cardHeight = 22

    doc.setFillColor(245, 244, 255)
    doc.roundedRect(margin, cardY, pageWidth - margin * 2, cardHeight, 3, 3, 'F')

    doc.setDrawColor(232, 227, 255)
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, cardY, pageWidth - margin * 2, cardHeight, 3, 3, 'S')

    // Calculate badge dimensions
    const badgeWidth = 36
    const badgeHeight = 10
    const badgeX = pageWidth - margin - badgeWidth - 4
    const badgeY = cardY + 6

    // Adaptive column positions
    const col1X = margin + 6
    const col2X = pageWidth < 200 ? margin + 60 : margin + 70

    if (barangay) {
      doc.setTextColor(91, 84, 232)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('LOCATION', col1X, cardY + 7)

      doc.setTextColor(55, 65, 81)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      // Truncate if too long
      const maxBarangayWidth = col2X - col1X - 4
      let displayBarangay = barangay
      if (doc.getTextWidth(displayBarangay) > maxBarangayWidth) {
        while (doc.getTextWidth(displayBarangay + '...') > maxBarangayWidth && displayBarangay.length > 0) {
          displayBarangay = displayBarangay.slice(0, -1)
        }
        displayBarangay += '...'
      }
      doc.text(displayBarangay, col1X, cardY + 14)
    }

    if (subtitle) {
      doc.setTextColor(91, 84, 232)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('REPORT DETAILS', col2X, cardY + 7)

      doc.setTextColor(55, 65, 81)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const maxSubtitleWidth = badgeX - col2X - 4
      let displaySubtitle = subtitle
      if (doc.getTextWidth(displaySubtitle) > maxSubtitleWidth) {
        while (doc.getTextWidth(displaySubtitle + '...') > maxSubtitleWidth && displaySubtitle.length > 0) {
          displaySubtitle = displaySubtitle.slice(0, -1)
        }
        displaySubtitle += '...'
      }
      doc.text(displaySubtitle, col2X, cardY + 14)
    }

    // Total records badge - compact
    doc.setFillColor(91, 84, 232)
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(6)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL RECORDS', badgeX + badgeWidth/2, badgeY + 4, { align: 'center' })
    doc.setFontSize(9)
    doc.text(String(data.length), badgeX + badgeWidth/2, badgeY + 8.5, { align: 'center' })

    // ============ TABLE ============
    const headers = [columns.map(c => c.label)]
    const rows = data.map(row =>
      columns.map(col => {
        let value = col.value ? col.value(row) : row[col.key]
        if (value === null || value === undefined) value = '—'
        value = String(value).replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '').trim()
        return value
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
        fontSize: pageWidth < 200 ? 8 : 9,
        cellPadding: pageWidth < 200 ? 3 : 5,
        halign: 'left',
      },
      bodyStyles: {
        fontSize: pageWidth < 200 ? 7.5 : 8.5,
        cellPadding: pageWidth < 200 ? 3 : 4,
        textColor: [55, 65, 81],
        lineColor: [240, 239, 254],
        lineWidth: 0.2,
        overflow: 'linebreak',
      },
      alternateRowStyles: {
        fillColor: [250, 250, 255],
      },
      margin: { left: margin, right: margin },
      tableWidth: 'auto',
      didDrawPage: () => {
        const currentPage = doc.internal.getNumberOfPages()

        // Footer divider
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
        doc.text(`Page ${currentPage}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const value = String(data.cell.text[0] || '').toLowerCase()

          if (value === 'critical') {
            data.cell.styles.fillColor = [254, 226, 226]
            data.cell.styles.textColor = [185, 28, 28]
            data.cell.styles.fontStyle = 'bold'
          } else if (value === 'high') {
            data.cell.styles.fillColor = [254, 215, 170]
            data.cell.styles.textColor = [194, 65, 12]
            data.cell.styles.fontStyle = 'bold'
          } else if (value === 'medium') {
            data.cell.styles.fillColor = [219, 234, 254]
            data.cell.styles.textColor = [30, 64, 175]
          } else if (value === 'low') {
            data.cell.styles.fillColor = [220, 252, 231]
            data.cell.styles.textColor = [22, 101, 52]
          }

          if (value === 'pending' || value === 'open') {
            data.cell.styles.fillColor = [254, 243, 199]
            data.cell.styles.textColor = [146, 64, 14]
          } else if (value === 'assigned' || value === 'in_progress') {
            data.cell.styles.fillColor = [219, 234, 254]
            data.cell.styles.textColor = [30, 64, 175]
          } else if (value === 'resolved' || value === 'closed') {
            data.cell.styles.fillColor = [220, 252, 231]
            data.cell.styles.textColor = [22, 101, 52]
          }
        }
      },
    })

    doc.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`)
  }