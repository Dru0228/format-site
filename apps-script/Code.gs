/**
 * FORMAT contact form backend (Google Apps Script web app).
 *
 * Receives the JSON the contact page sends, adds a row to the "Leads" tab
 * of the spreadsheet this script is attached to, and emails the details to
 * NOTIFY_EMAIL. Replying to that email replies to the visitor.
 * Setup steps are in README.md under "Contact form".
 */

var NOTIFY_EMAIL = 'info@madebyformat.com';  // where new messages are emailed
var SHEET_NAME = 'Leads';
var HEADERS = ['Received', 'Service', 'Name', 'Email', 'Phone', 'Timeline', 'Message', 'Page'];
var MAX_PER_SENDER = 5;           // messages allowed per email address...
var WINDOW_SECONDS = 10 * 60;     // ...in this many seconds

function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Bots fill the hidden "website" field; real visitors never see it.
    if (d.website) return reply_('ok');

    var lead = {
      service: clean_(d.service, 120),
      name: clean_(d.name, 120),
      email: clean_(d.email, 200),
      phone: clean_(d.phone, 40),
      timeline: clean_(d.timeline, 120),
      message: clean_(d.message, 5000),
      page: clean_(d.page, 40)
    };
    if (!lead.name || !lead.message || !/^\S+@\S+\.\S+$/.test(lead.email)) return reply_('invalid');
    if (tooMany_(lead.email)) return reply_('rate_limited');

    saveRow_(lead);
    sendEmail_(lead);
    return reply_('ok');
  } catch (err) {
    console.error(err);
    return reply_('error');
  }
}

// Opening the web app URL in a browser shows this, so you can check it is live.
function doGet() {
  return reply_('FORMAT contact form is running.');
}

function saveRow_(lead) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  sh.appendRow([new Date(), lead.service, lead.name, lead.email, lead.phone, lead.timeline, lead.message, lead.page]
    .map(function (v) { return typeof v === 'string' ? noFormula_(v) : v; }));
}

function sendEmail_(lead) {
  var lines = ['Service: ' + lead.service, 'Name: ' + lead.name, 'Email: ' + lead.email];
  if (lead.phone) lines.push('Phone: ' + lead.phone);
  if (lead.timeline) lines.push('Timeline: ' + lead.timeline);
  lines.push('', lead.message, '', '(Sent from the ' + (lead.page || 'contact') + ' page. Reply to this email to answer ' + lead.name + '.)');

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    replyTo: lead.email,
    name: 'FORMAT website',
    subject: 'FORMAT: ' + lead.service + ' from ' + lead.name,
    body: lines.join('\n')
  });
}

function tooMany_(email) {
  var cache = CacheService.getScriptCache();
  var key = 'n:' + email.toLowerCase();
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), WINDOW_SECONDS);
  return n > MAX_PER_SENDER;
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, max);
}

// Stops a visitor's text from running as a spreadsheet formula.
function noFormula_(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function reply_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}
