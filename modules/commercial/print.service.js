const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const PrintService = {
  generateServiceRequestPDF(data, res) {
    // 22cm x 33cm in PDF points (1 cm = 28.3465 points)
    const CM_TO_PT = 28.3465;
    const fullPageWidth = 22 * CM_TO_PT;   // ~623.6 pt
    const fullPageHeight = 33 * CM_TO_PT;  // ~935.4 pt
    const contentHeight = 16.5 * CM_TO_PT; // ~467.7 pt

    // Load coordinates.json directly
    const configPath = path.join(__dirname, '../../coordinates.json');
    let positions = {};

    if (fs.existsSync(configPath)) {
      try {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        positions = JSON.parse(fileContent);
      } catch (err) {
        console.warn('Warning: Failed to parse coordinates.json:', err);
      }
    }

    // Format Date & Time: "Month DD, YYYY HH:MM"
    let formattedDateTime = '';
    if (data.requestDate) {
      try {
        const d = new Date(data.requestDate);
        const dateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        formattedDateTime = data.requestTime ? `${dateStr} ${data.requestTime}` : dateStr;
      } catch (e) {
        formattedDateTime = data.requestDate;
      }
    }

    // Clean Reference Number (Remove SR- prefix)
    let cleanRef = (data.referenceNumber || '').trim().toUpperCase();
    if (cleanRef.startsWith('SR-')) cleanRef = cleanRef.substring(3);
    else if (cleanRef.startsWith('SR')) cleanRef = cleanRef.substring(2);

    // Map input fields to position keys
    const mappedData = {
      'Reference Number': cleanRef,
      'Account Number': data.accountNumber || '',
      'Account Name': data.accountName || '',
      'Address': data.address || '',
      'Meter Number': data.meterNumber || '',
      'Reading': (data.waterMeterReading !== null && data.waterMeterReading !== undefined) ? String(data.waterMeterReading) : '',
      'Requested By': data.requestedBy || '',
      'Request Received By': data.receivedBy || '',
      'Date & Time Requested': formattedDateTime,
      'Contact Number': data.contactNumber || '',
      'Request Details': data.requestDetails || '',
      'Please specify': (data.otherDetails && data.otherDetails !== 'N/A') ? data.otherDetails : ''
    };

    // Initialize Document
    const doc = new PDFDocument({
      size: [fullPageWidth, fullPageHeight],
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Service_Request_${cleanRef}.pdf"`);
    doc.pipe(res);

    // 1. Reference Number (Large Red Font)
    if (positions['Reference Number'] && mappedData['Reference Number']) {
      const [x, y] = positions['Reference Number'];
      const topDownY = contentHeight - y;

      doc.font('Helvetica-Bold')
         .fontSize(23)
         .fillColor('red')
         .text(mappedData['Reference Number'], x, topDownY, { lineBreak: false });
    }

    // 2. All Other Fields
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor('#0206fa');

    for (const [field, [x, y]] of Object.entries(positions)) {
      if (field === 'Reference Number') continue;

      const value = mappedData[field];
      if (value && String(value).trim()) {
        const topDownY = contentHeight - y;

        if (field === 'Address' || field === 'Please specify') {
          doc.text(String(value).toUpperCase(), x, topDownY, {
            width: 200,
            lineBreak: true
          });
        } else {
          doc.text(String(value).toUpperCase(), x, topDownY, { lineBreak: false });
        }
      }
    }

    // Optional: Footer Timestamp
    const now = new Date();
    const printedTimestamp = now.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    doc.fontSize(8)
       .fillColor('#555555')
       .text(`Printed on: ${printedTimestamp}`, 100, fullPageHeight - 30, { lineBreak: false });

    doc.end();
  }
};

module.exports = PrintService;