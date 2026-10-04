/**
 * FORMAT FabLab backend (Google Apps Script web app).
 *
 * Separate from the contact form script. Attach this to its own Google Sheet
 * (name it "FORMAT FabLab"). It does four things:
 *
 *   1. Records concept votes (one piece vote + one color vote per visitor per piece).
 *   2. Records waitlist signups for concepts and pre-order pieces.
 *   3. Takes pre-order submissions (color, size, name, email). Each submission
 *      holds a unit straight away; when a size in a color reaches its cap
 *      (Sizes tab) that size shows "Sold out" and the server refuses more.
 *      Set a row's Status to Cancelled in the Orders tab to free its unit.
 *   4. Serves the live numbers the site needs (stock left, top 3 concepts by
 *      day / week / month / year, how long each concept has been listed).
 *
 * Pre-orders email NOTIFY_EMAIL right away. Votes, picks, notes and waitlist signups are collected into one daily summary email. Visitors can also leave
 * an optional note (saved in a Message column).
 *
 * It also builds the Dashboard tab (tables and charts). Setup steps are in
 * README.md under "FabLab voting, waitlist and stock".
 */

var TAB_ITEMS = 'Items';
var TAB_VOTES = 'Votes';
var TAB_WAIT = 'Waitlist';
var TAB_ORDERS = 'Orders';
var TAB_SIZES = 'Sizes';
var TAB_DASH = 'Dashboard';
var TAB_SONGS = 'SongFavs';        // Archive > Audio hearts: one row per visitor per song

var DEFAULT_CAP = 50;              // units per pre-order piece when Items > Cap is blank
var NOTIFY_EMAIL = 'info@madebyformat.com';   // gets an email for every vote, waitlist signup and pre-order
var DIGEST_HOUR = 20;              // the daily summary email goes out around 8 pm (the script's time zone)
var MAX_MESSAGE = 1000;            // longest optional visitor note kept
var MAX_PER_PERSON = 2;            // units one email address can hold per piece
var SIZE_LIST = ['S', 'M', 'L', 'XL', 'XXL', 'One size'];
var MAX_ACTIONS = 60;              // actions allowed per visitor...
var MAX_PER_EMAIL = 5;             // ...and per email address...
var WINDOW_SECONDS = 10 * 60;      // ...in this many seconds
var PERIOD_DAYS = { day: 1, week: 7, month: 30, year: 365 };
var DASH_ROWS = 60;                // how many Items rows the Dashboard table covers

var HEADERS = {
  Items: ['Key', 'Name', 'Category', 'Status', 'Cap', 'Listed', 'Colors'],
  Votes: ['Time', 'Item', 'Type', 'Color / size', 'Visitor', 'Message', 'Name'],
  Waitlist: ['Time', 'Item', 'List', 'Email', 'Visitor', 'Message', 'Name'],
  Sizes: ['Item', 'Color', 'Size', 'Cap', 'Taken', 'Left'],
  SongFavs: ['Time', 'Song', 'Visitor'],
  Orders: ['Time', 'Item', 'Color', 'Size', 'Qty', 'Status', 'Confirmed on', 'Visitor', 'Name', 'Email', 'Ref', 'Message']
};

// Size run for pieces with a fixed size breakdown: starting values for the Sizes tab
// (after setup you edit the Sizes tab, not this). Use `all` for the same run in every
// color, or list colors one by one when the split is uneven.
var RUNS = {
  'signal-tee': { all: { S: 1, M: 3, L: 3, XL: 2, XXL: 1 } },                     // 6 colors x 10 = 60
  'polo': {                                                                       // 8 + 8 + 7 + 7 = 30
    'Black': { S: 1, M: 2, L: 2, XL: 2, XXL: 1 },
    'Off-white': { S: 1, M: 2, L: 2, XL: 2, XXL: 1 },
    'Hot pink': { S: 1, M: 2, L: 2, XL: 1, XXL: 1 },
    'Charcoal': { S: 1, M: 2, L: 2, XL: 1, XXL: 1 }
  },
  'core-hoodie': { all: { S: 1, M: 3, L: 3, XL: 2, XXL: 1 } }                     // 3 colors x 10 = 30
};

// Starting roster for the Items tab: key, name, category, status, colors, cap (pre-order only).
// After setup you manage this in the sheet, not here.
var SEED = [
  ["frame-tee", "Frame Tee", "Shirts", "Concept", "Off-white, Black"],
  ["signal-tee", "Signal Tee", "Shirts", "Pre-order", "Off-white, Black, Charcoal, Hot pink, Stone, White", 60],
  ["polo", "Field Polo", "Shirts", "Pre-order", "Black, Off-white, Hot pink, Charcoal", 30],
  ["core-hoodie", "Core Hoodie", "Hoodies", "Pre-order", "Black, Off-white, Hot pink", 30],
  ["archive-sweater", "Archive Sweater", "Sweaters", "Concept", "Black, Off-white, Charcoal"],
  ["blueprint-sweater", "Blueprint Sweater", "Sweaters", "Concept", "Black, Stone, Hot pink"],
  ["field-shell", "Field Shell", "Jackets", "Concept", "Black, Off-white, Hot pink"],
  ["archive-jacket", "Archive Jacket", "Jackets", "Concept", "Stone, Black, Hot pink"],
  ["workshirt", "Workshirt", "Jackets", "Concept", "Black, Off-white, Hot pink"],
  ["hockey-jersey", "Hockey Jersey", "Jerseys", "Concept", "Black, White, Hot pink"],
  ["rugby-jersey", "Rugby Jersey", "Jerseys", "Concept", "Black"]
];

// ---------- web app ----------

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.action === 'summary') {
      return ContentService.createTextOutput(summary_()).setMimeType(ContentService.MimeType.JSON);
    }
    if (e && e.parameter && e.parameter.action === 'songs') {
      return ContentService.createTextOutput(songCounts_()).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    console.error(err);
    return ContentService.createTextOutput(JSON.stringify({ ok: false })).setMimeType(ContentService.MimeType.JSON);
  }
  return reply_('FORMAT FabLab backend is running.');
}

function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Bots fill the hidden "website" field; real visitors never see it.
    if (d.website) return reply_('ok');

    var client = clean_(d.client, 64);
    if (!client || tooMany_('c:' + client, MAX_ACTIONS)) return reply_('rate_limited');

    if (d.action === 'songfav') {
      var slock = LockService.getScriptLock();
      if (!slock.tryLock(15000)) return reply_('busy');
      try { return reply_(songFav_(d, client)); } finally { slock.releaseLock(); }
    }

    var key = clean_(d.item, 60);
    var items = readItems_();
    var item = items[key];
    if (!item) return reply_('invalid');

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) return reply_('busy');
    try {
      if (d.action === 'vote') return reply_(vote_(key, item, d, client));
      if (d.action === 'waitlist') return reply_(waitlist_(key, item, d, client));
      if (d.action === 'note') return reply_(note_(key, item, d, client));
      if (d.action === 'order') return reply_(order_(key, item, d, client));
      return reply_('invalid');
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    console.error(err);
    return reply_('error');
  }
}

function vote_(key, item, d, client) {
  if (item.status !== 'Concept') return 'invalid';
  var vname = clean_(d.name, 80);
  var type = d.kind === 'color' ? 'color' : d.kind === 'size' ? 'size' : 'item';
  var color = type === 'item' ? '' : clean_(d.value, 40);   // the Color column holds the picked color or size
  if (type === 'color' && (!color || (item.colors.length && item.colors.indexOf(color) < 0))) return 'invalid';
  if (type === 'size' && SIZE_LIST.indexOf(color) < 0) return 'invalid';

  var sh = sheet_(TAB_VOTES);
  var n = sh.getLastRow();
  if (n >= 2) {
    var rows = sh.getRange(2, 2, n - 1, 4).getValues();   // Item, Type, Color, Visitor
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === key && rows[i][1] === type && rows[i][3] === client) {
        if (type === 'item') return 'duplicate';
        // A visitor can change their color or size pick: update their row instead of adding another.
        var msg = clean_(d.message, MAX_MESSAGE);
        sh.getRange(i + 2, 4).setValue(noFormula_(color));
        if (msg) sh.getRange(i + 2, 6).setValue(noFormula_(msg));
        if (vname) sh.getRange(i + 2, 7).setValue(noFormula_(vname));
        nameRows_(sh, key, client, vname);
        return 'ok';
      }
    }
  }
  var message = clean_(d.message, MAX_MESSAGE);
  sh.appendRow([new Date(), key, type, color, client, message, vname].map(noFormula_));
  nameRows_(sh, key, client, vname);
  CacheService.getScriptCache().remove('summary');
  return 'ok';
}

// Picks made before the visitor typed their name get it filled in once it arrives.
function nameRows_(sh, key, client, name) {
  if (!name) return;
  var n = sh.getLastRow();
  if (n < 2) return;
  var rows = sh.getRange(2, 2, n - 1, 6).getValues();   // Item, Type, Color, Visitor, Message, Name
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === key && rows[i][3] === client && !rows[i][5]) sh.getRange(i + 2, 7).setValue(noFormula_(name));
  }
}

// A note sent on its own, without a vote or signup.
function note_(key, item, d, client) {
  var message = clean_(d.message, MAX_MESSAGE);
  if (!message) return 'invalid';
  var vname = clean_(d.name, 80);
  var vsh = sheet_(TAB_VOTES);
  vsh.appendRow([new Date(), key, 'note', '', client, message, vname].map(noFormula_));
  nameRows_(vsh, key, client, vname);
  return 'ok';
}

function waitlist_(key, item, d, client) {
  var email = clean_(d.email, 200).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'invalid';
  if (tooMany_('e:' + email, MAX_PER_EMAIL)) return 'rate_limited';

  var sh = sheet_(TAB_WAIT);
  var n = sh.getLastRow();
  if (n >= 2) {
    var rows = sh.getRange(2, 2, n - 1, 3).getValues();   // Item, List, Email
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === key && String(rows[i][2]).toLowerCase() === email) return 'duplicate';
    }
  }
  var list = item.status === 'Pre-order' ? 'Pre-order' : 'Concept';
  var message = clean_(d.message, MAX_MESSAGE);
  var vname = clean_(d.name, 80);
  sh.appendRow([new Date(), key, list, email, client, message, vname].map(noFormula_));
  nameRows_(sheet_(TAB_VOTES), key, client, vname);
  return 'ok';
}

function order_(key, item, d, client) {
  if (item.status !== 'Pre-order') return 'invalid';
  var color = clean_(d.color, 40);
  var size = clean_(d.size, 12);
  var name = clean_(d.name, 120);
  var email = clean_(d.email, 200).toLowerCase();
  var ref = clean_(d.ref, 40);
  var message = clean_(d.message, MAX_MESSAGE);
  if (!name || !ref || !/^\S+@\S+\.\S+$/.test(email)) return 'invalid';
  if (item.colors.length && item.colors.indexOf(color) < 0) return 'invalid';
  if (SIZE_LIST.indexOf(size) < 0) return 'invalid';
  if (tooMany_('e:' + email, MAX_PER_EMAIL)) return 'rate_limited';

  var t = takenCounts_(ref);
  if (t.seenRef) return 'ok';                    // the same submission sent twice
  if ((t.byEmail[key + '|' + email] || 0) >= MAX_PER_PERSON) return 'limit';

  var sizes = readSizes_()[key];
  if (sizes) {
    var cap = sizes[color] && sizes[color][size];
    if (cap === undefined) return 'invalid';     // this color/size is not offered
    if ((t.variant[key + '|' + color + '|' + size] || 0) >= cap) return 'sold_out';
  } else if ((t.item[key] || 0) >= item.cap) {
    return 'sold_out';
  }

  sheet_(TAB_ORDERS).appendRow([new Date(), key, color, size, 1, 'Requested', '', client, name, email, ref, message].map(noFormula_));
  CacheService.getScriptCache().remove('summary');
  notify_('FORMAT pre-order: ' + item.name + ' / ' + color + ' / ' + size + ' from ' + name,
    [item.name + ', ' + color + ', size ' + size, 'Name: ' + name, 'Email: ' + email,
      message ? 'Message: ' + message : '', '',
      '(Reply to this email to answer ' + name + '. Set the row to Cancelled in the Orders tab to free the unit.)'].join('\n'), email);
  return 'ok';
}

// Emails NOTIFY_EMAIL right away (used for pre-orders). Votes, picks, notes and waitlist signups go in the daily
// digest instead. A mail failure (quota, missing permission) never loses the sheet row.
function notify_(subject, body, replyTo) {
  try {
    var o = { to: NOTIFY_EMAIL, name: 'FORMAT website', subject: subject.replace(/[\r\n]+/g, ' '), body: body };
    if (replyTo) o.replyTo = replyTo;
    MailApp.sendEmail(o);
  } catch (err) { console.error(err); }
}

// ---------- daily digest ----------

// One email a day (DIGEST_HOUR) with the last 24 hours: votes, color and size picks, notes and waitlist signups.
// Sends nothing on a quiet day. setup() installs the daily trigger; you can also run this from the FabLab menu.
function sendDigest_() {
  var items = readItems_();
  var since = Date.now() - 24 * 3600 * 1000;
  var perItem = {}, notes = [], waits = [];
  function slot(k) { return perItem[k] = perItem[k] || { votes: 0, who: [], colors: {}, sizes: {} }; }
  function when(v) { return v instanceof Date ? v.getTime() : Date.parse(v); }

  var vs = sheet_(TAB_VOTES), n = vs.getLastRow();
  if (n >= 2) {
    vs.getRange(2, 1, n - 1, 7).getValues().forEach(function (r) {
      if (!(when(r[0]) >= since)) return;
      var name = items[r[1]] ? items[r[1]].name : r[1], t = r[2], v = r[3], who = r[6] || 'no name';
      if (t === 'note') notes.push(name + ': ' + r[5] + ' (' + who + ')');
      else {
        var o = slot(name);
        if (t === 'item') { o.votes++; o.who.push(who); }
        else if (t === 'color') o.colors[v] = (o.colors[v] || 0) + 1;
        else if (t === 'size') o.sizes[v] = (o.sizes[v] || 0) + 1;
        if (r[5]) notes.push(name + ': ' + r[5] + ' (' + who + ')');
      }
    });
  }
  var ws = sheet_(TAB_WAIT), m = ws.getLastRow();
  if (m >= 2) {
    ws.getRange(2, 1, m - 1, 7).getValues().forEach(function (r) {
      if (!(when(r[0]) >= since)) return;
      var name = items[r[1]] ? items[r[1]].name : r[1];
      waits.push(name + ': ' + (r[6] || 'no name') + ', ' + r[3]);
      if (r[5]) notes.push(name + ': ' + r[5] + ' (' + (r[6] || 'no name') + ')');
    });
  }

  function tally(o) { return Object.keys(o).map(function (k) { return k + ' x' + o[k]; }).join(', '); }
  var lines = [];
  Object.keys(perItem).forEach(function (k) {
    var o = perItem[k], bits = [];
    if (o.votes) bits.push(o.votes + (o.votes === 1 ? ' vote' : ' votes') + ' (' + o.who.join(', ') + ')');
    if (Object.keys(o.colors).length) bits.push('colors: ' + tally(o.colors));
    if (Object.keys(o.sizes).length) bits.push('sizes: ' + tally(o.sizes));
    lines.push(k + ' - ' + bits.join('; '));
  });
  if (!lines.length && !waits.length && !notes.length) return;

  var body = ['FORMAT FabLab, last 24 hours', '',
    lines.length ? 'VOTES AND PICKS\n' + lines.join('\n') : '',
    waits.length ? '\nWAITLIST (' + waits.length + ')\n' + waits.join('\n') : '',
    notes.length ? '\nNOTES (' + notes.length + ')\n' + notes.join('\n') : '',
    '\nPre-orders email you right away. Full detail is in the sheet.'].filter(function (x) { return x !== ''; }).join('\n');
  MailApp.sendEmail({ to: NOTIFY_EMAIL, name: 'FORMAT website', subject: 'FORMAT FabLab daily summary', body: body });
}

// Run by the daily trigger.
function sendDigest() {
  try { sendDigest_(); } catch (err) { console.error(err); }
}

// Replaces any old digest trigger with one that runs every day around DIGEST_HOUR.
function installDigestTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendDigest').timeBased().everyDays(1).atHour(DIGEST_HOUR).create();
}

// Units held per size / piece / email, from every Orders row that is not Cancelled.
function takenCounts_(ref) {
  var out = { variant: {}, item: {}, byEmail: {}, seenRef: false };
  var sh = sheet_(TAB_ORDERS);
  var n = sh.getLastRow();
  if (n < 2) return out;
  sh.getRange(2, 2, n - 1, 10).getValues().forEach(function (r) {
    // Item, Color, Size, Qty, Status, Confirmed on, Visitor, Name, Email, Ref
    if (ref && r[9] === ref) out.seenRef = true;
    if (!r[0] || r[4] === 'Cancelled') return;
    var q = Number(r[3]) || 0;
    out.item[r[0]] = (out.item[r[0]] || 0) + q;
    out.variant[r[0] + '|' + r[1] + '|' + r[2]] = (out.variant[r[0] + '|' + r[1] + '|' + r[2]] || 0) + q;
    var e = String(r[8]).toLowerCase();
    if (e) out.byEmail[r[0] + '|' + e] = (out.byEmail[r[0] + '|' + e] || 0) + q;
  });
  return out;
}

// Sets "Confirmed on" the moment you mark an order Confirmed.
function onEdit(e) {
  try {
    var r = e.range;
    var sh = r.getSheet();
    if (sh.getName() !== TAB_ORDERS || r.getColumn() !== 6 || r.getRow() < 2 || r.getNumRows() !== 1) return;
    var cell = sh.getRange(r.getRow(), 7);
    if (String(e.value) === 'Confirmed') { if (!cell.getValue()) cell.setValue(new Date()); }
    else cell.clearContent();
  } catch (err) { /* never block an edit */ }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('FabLab')
    .addItem('Set up / refresh dashboard', 'setup')
    .addItem('Email me the last 24 hours now', 'sendDigest')
    .addToUi();
}

// ---------- live numbers for the site ----------

function summary_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('summary');
  if (hit) return hit;

  var items = readItems_();
  var now = Date.now();
  var counts = {};
  Object.keys(PERIOD_DAYS).forEach(function (p) { counts[p] = {}; });

  var votes = sheet_(TAB_VOTES);
  var n = votes.getLastRow();
  if (n >= 2) {
    votes.getRange(2, 1, n - 1, 3).getValues().forEach(function (r) {
      var key = r[1];
      if (r[2] !== 'item' || !items[key] || items[key].status !== 'Concept') return;
      var t = r[0] instanceof Date ? r[0].getTime() : Date.parse(r[0]);
      if (!t) return;
      Object.keys(PERIOD_DAYS).forEach(function (p) {
        if (now - t <= PERIOD_DAYS[p] * 864e5) counts[p][key] = (counts[p][key] || 0) + 1;
      });
    });
  }
  var top = {};
  Object.keys(counts).forEach(function (p) {
    top[p] = Object.keys(counts[p]).sort(function (a, b) {
      return counts[p][b] - counts[p][a] || (a < b ? -1 : 1);
    }).slice(0, 3);
  });

  var taken = takenCounts_();
  var sizes = readSizes_();
  var stock = {}, status = {}, since = {}, variants = {};
  Object.keys(items).forEach(function (k) {
    status[k] = items[k].status;
    if (items[k].listed) since[k] = items[k].listed;
    if (items[k].status !== 'Pre-order') return;
    stock[k] = { cap: items[k].cap, sold: taken.item[k] || 0 };
    if (sizes[k]) {
      variants[k] = {};
      Object.keys(sizes[k]).forEach(function (c) {
        variants[k][c] = {};
        Object.keys(sizes[k][c]).forEach(function (s) {
          variants[k][c][s] = [sizes[k][c][s], taken.variant[k + '|' + c + '|' + s] || 0];   // [cap, taken]
        });
      });
    }
  });

  var json = JSON.stringify({ ok: true, stock: stock, variants: variants, top: top, status: status, since: since });
  cache.put('summary', json, 30);
  return json;
}

function readItems_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('items');
  if (hit) return JSON.parse(hit);

  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var sh = sheet_(TAB_ITEMS);
  var out = {};
  var n = sh.getLastRow();
  if (n >= 2) {
    sh.getRange(2, 1, n - 1, 7).getValues().forEach(function (r) {
      var key = String(r[0]).trim();
      if (!key) return;
      out[key] = {
        name: String(r[1]),
        status: String(r[3]).trim() === 'Pre-order' ? 'Pre-order' : 'Concept',
        cap: Number(r[4]) || DEFAULT_CAP,
        listed: r[5] instanceof Date ? Utilities.formatDate(r[5], tz, 'yyyy-MM-dd') : '',
        colors: String(r[6]).split(',').map(function (c) { return c.trim(); }).filter(Boolean)
      };
    });
  }
  cache.put('items', JSON.stringify(out), 60);
  return out;
}

// { item: { color: { size: cap } } } from the Sizes tab. Items with no rows there are limited by Items > Cap only.
function readSizes_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('sizes');
  if (hit) return JSON.parse(hit);
  var out = {};
  var sh = sheet_(TAB_SIZES);
  var n = sh.getLastRow();
  if (n >= 2) {
    sh.getRange(2, 1, n - 1, 4).getValues().forEach(function (r) {
      var k = String(r[0]).trim(), c = String(r[1]).trim(), s = String(r[2]).trim();
      if (!k || !c || !s) return;
      out[k] = out[k] || {};
      out[k][c] = out[k][c] || {};
      out[k][c][s] = Number(r[3]) || 0;
    });
  }
  cache.put('sizes', JSON.stringify(out), 60);
  return out;
}

// ---------- one-time setup and dashboard ----------

// Run from the FabLab menu. Safe to run again: it never touches your data tabs,
// only fills in missing ones and rebuilds the Dashboard.
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });

  var items = ss.getSheetByName(TAB_ITEMS);
  if (items.getLastRow() < 2) {
    var today = new Date();
    var rows = SEED.map(function (s) {
      return [s[0], s[1], s[2], s[3], s[3] === 'Pre-order' ? (s[5] || DEFAULT_CAP) : '', today, s[4]];
    });
    items.getRange(2, 1, rows.length, 7).setValues(rows);
    items.getRange(2, 6, DASH_ROWS, 1).setNumberFormat('yyyy-mm-dd');
  }
  items.getRange(2, 4, DASH_ROWS, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Pre-order', 'Concept'], true).build());
  items.setColumnWidths(1, 7, 140);

  // Sizes tab: one row per color and size, with live Taken / Left formulas.
  var sizes = ss.getSheetByName(TAB_SIZES);
  if (sizes.getLastRow() < 2) {
    var srows = [];
    SEED.forEach(function (s) {
      var runs = RUNS[s[0]];
      if (!runs || s[3] !== 'Pre-order') return;
      s[4].split(',').forEach(function (c) {
        c = c.trim();
        var run = runs[c] || runs.all;
        if (!run) return;
        Object.keys(run).forEach(function (size) { srows.push([s[0], c, size, run[size]]); });
      });
    });
    sizes.getRange(2, 1, srows.length, 4).setValues(srows);
  }
  var SF = [];
  for (var i = 0; i < 200; i++) {
    var r = 2 + i;
    SF.push([
      '=IF($A' + r + '="","",SUMIFS(Orders!$E:$E,Orders!$B:$B,$A' + r + ',Orders!$C:$C,$B' + r + ',Orders!$D:$D,$C' + r + ',Orders!$F:$F,"<>Cancelled"))',
      '=IF($A' + r + '="","",MAX(0,$D' + r + '-$E' + r + '))'
    ]);
  }
  sizes.getRange(2, 5, 200, 2).setFormulas(SF);
  sizes.setColumnWidths(1, 6, 120);

  var orders = ss.getSheetByName(TAB_ORDERS);
  // Older sheets were created before the Name / Email / Ref columns existed.
  [TAB_VOTES, TAB_WAIT].forEach(function (n) {
    ss.getSheetByName(n).getRange(1, 1, 1, HEADERS[n].length).setValues([HEADERS[n]]).setFontWeight('bold');
  });
  orders.getRange(1, 1, 1, HEADERS.Orders.length).setValues([HEADERS.Orders]).setFontWeight('bold');
  orders.getRange(2, 6, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Requested', 'Confirmed', 'Cancelled'], true).build());
  orders.getRange(2, 1, 1000, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  orders.getRange(2, 7, 1000, 1).setNumberFormat('yyyy-mm-dd');
  ss.getSheetByName(TAB_VOTES).getRange(2, 1, 5000, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  ss.getSheetByName(TAB_WAIT).getRange(2, 1, 5000, 1).setNumberFormat('yyyy-mm-dd hh:mm');

  installDigestTrigger_();
  buildDashboard_(ss);
  CacheService.getScriptCache().removeAll(['items', 'sizes', 'summary']);
}

function buildDashboard_(ss) {
  var dash = ss.getSheetByName(TAB_DASH) || ss.insertSheet(TAB_DASH, 0);
  dash.getCharts().forEach(function (c) { dash.removeChart(c); });
  dash.clear();

  dash.getRange('A1').setValue('FORMAT FabLab').setFontSize(16).setFontWeight('bold');
  dash.getRange('A2').setFormula(
    '="Concept votes: "&COUNTIF(Votes!C:C,"item")&"   |   Waitlist signups: "&MAX(0,COUNTA(Waitlist!D:D)-1)' +
    '&"   |   Pre-order units taken: "&SUMIFS(Orders!E:E,Orders!F:F,"<>Cancelled")&"   |   Confirmed: "&SUMIFS(Orders!E:E,Orders!F:F,"Confirmed")');

  // Main table: one row per Items row.
  dash.getRange('A3').setValue('Every piece').setFontWeight('bold');
  var head = ['Item', 'Status', 'Cap', 'Taken', 'Left', '% taken', 'Confirmed', 'First order', 'Last order',
    'Days to sell out', 'Units / day', 'Waitlist', 'Votes', 'Days on board'];
  dash.getRange(4, 1, 1, head.length).setValues([head]).setFontWeight('bold');

  var f = [];
  for (var i = 0; i < DASH_ROWS; i++) {
    var r = 5 + i, n = 2 + i;
    var key = 'Items!A' + n;
    f.push([
      '=IF(' + key + '="","",Items!B' + n + ')',
      '=IF($A' + r + '="","",Items!D' + n + ')',
      '=IF($B' + r + '="Pre-order",IF(Items!E' + n + '="",' + DEFAULT_CAP + ',Items!E' + n + '),"")',
      '=IF($B' + r + '="Pre-order",SUMIFS(Orders!$E:$E,Orders!$B:$B,' + key + ',Orders!$F:$F,"<>Cancelled"),"")',
      '=IF($B' + r + '="Pre-order",MAX(0,$C' + r + '-$D' + r + '),"")',
      '=IF($B' + r + '="Pre-order",$D' + r + '/$C' + r + ',"")',
      '=IF($B' + r + '="Pre-order",SUMIFS(Orders!$E:$E,Orders!$B:$B,' + key + ',Orders!$F:$F,"Confirmed"),"")',
      '=IF(AND($B' + r + '="Pre-order",N($D' + r + ')>0),MINIFS(Orders!$A:$A,Orders!$B:$B,' + key + ',Orders!$F:$F,"<>Cancelled"),"")',
      '=IF(AND($B' + r + '="Pre-order",N($D' + r + ')>0),MAXIFS(Orders!$A:$A,Orders!$B:$B,' + key + ',Orders!$F:$F,"<>Cancelled"),"")',
      '=IF(AND($B' + r + '="Pre-order",N($E' + r + ')=0,N($D' + r + ')>0),$I' + r + '-Items!F' + n + ',"")',
      '=IF(AND($B' + r + '="Pre-order",N($D' + r + ')>0),$D' + r + '/MAX(1,TODAY()-Items!F' + n + '),"")',
      '=IF($A' + r + '="","",COUNTIFS(Waitlist!$B:$B,' + key + '))',
      '=IF($B' + r + '="Concept",COUNTIFS(Votes!$B:$B,' + key + ',Votes!$C:$C,"item"),"")',
      '=IF($B' + r + '="Concept",MAX(0,TODAY()-Items!F' + n + '),"")'
    ]);
  }
  dash.getRange(5, 1, DASH_ROWS, head.length).setFormulas(f);
  dash.getRange(5, 6, DASH_ROWS, 1).setNumberFormat('0%');
  dash.getRange(5, 8, DASH_ROWS, 2).setNumberFormat('mmm d');
  dash.getRange(5, 11, DASH_ROWS, 1).setNumberFormat('0.0');
  dash.setFrozenRows(4);
  dash.setFrozenColumns(1);

  // Side tables.
  function block(col, title, formula) {
    dash.getRange(3, col).setValue(title).setFontWeight('bold');
    dash.getRange(4, col).setFormula(formula);
  }
  block(17, 'Most wanted concepts (all time)',
    '=IFERROR(QUERY(Votes!A:E,"select B, count(B) where C=\'item\' group by B order by count(B) desc label B \'Item\', count(B) \'Votes\'",1),"No votes yet")');
  block(20, 'Favorite colors',
    '=IFERROR(QUERY(Votes!A:E,"select B, D, count(D) where C=\'color\' group by B, D order by B, count(D) desc label B \'Item\', D \'Color\', count(D) \'Votes\'",1),"No votes yet")');
  block(24, 'Votes per day',
    '=IFERROR(QUERY(Votes!A:E,"select todate(A), count(B) where C=\'item\' group by todate(A) order by todate(A) label todate(A) \'Day\', count(B) \'Votes\'",1),"No votes yet")');
  block(27, 'Units taken per day',
    '=IFERROR(QUERY(Orders!A:K,"select todate(A), sum(E) where F<>\'Cancelled\' and A is not null group by todate(A) order by todate(A) label todate(A) \'Day\', sum(E) \'Units\'",1),"No orders yet")');
  block(30, 'Waitlist by piece',
    '=IFERROR(QUERY(Waitlist!A:E,"select B, count(D) group by B order by count(D) desc label B \'Item\', count(D) \'Signups\'",1),"No signups yet")');
  dash.getRange(3, 33).setValue('Pre-order stock').setFontWeight('bold');
  dash.getRange(4, 33, 1, 3).setValues([['Item', 'Taken', 'Left']]);
  dash.getRange(5, 33).setFormula('=IFERROR(FILTER({A5:A' + (4 + DASH_ROWS) + ',D5:D' + (4 + DASH_ROWS) + ',E5:E' + (4 + DASH_ROWS) + '},B5:B' + (4 + DASH_ROWS) + '="Pre-order"),"")');

  // Charts sit under the main table.
  var top = 5 + DASH_ROWS + 2;
  function chart(type, range, title, row, col) {
    dash.insertChart(dash.newChart()
      .setChartType(type)
      .addRange(dash.getRange(range))
      .setNumHeaders(1)
      .setOption('title', title)
      .setOption('width', 520)
      .setOption('height', 320)
      .setPosition(row, col, 0, 0)
      .build());
  }
  chart(Charts.ChartType.BAR, 'Q4:R24', 'Most wanted concepts', top, 1);
  chart(Charts.ChartType.LINE, 'X4:Y94', 'Votes per day', top, 8);
  chart(Charts.ChartType.COLUMN, 'AA4:AB94', 'Units taken per day', top + 17, 1);
  chart(Charts.ChartType.COLUMN, 'AG4:AI10', 'Pre-order stock (taken vs left)', top + 17, 8);
}

// ---------- audio favorites (Archive > Audio > Crowd Favorites) ----------

// d.song is the track id (e.g. 'A01'); d.on true adds this visitor's heart, false removes it.
function songFav_(d, client) {
  var song = clean_(d.song, 20);
  if (!/^[A-Za-z0-9_-]+$/.test(song)) return 'invalid';
  var sh = sheet_(TAB_SONGS);
  var n = sh.getLastRow();
  var at = -1;
  if (n >= 2) {
    var rows = sh.getRange(2, 2, n - 1, 2).getValues();   // Song, Visitor
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === song && rows[i][1] === client) { at = i + 2; break; }
    }
  }
  if (d.on) { if (at < 0) sh.appendRow([new Date(), song, client]); }
  else if (at > 0) sh.deleteRow(at);
  CacheService.getScriptCache().remove('songs');
  return 'ok';
}

// {"A01": 12, "A04": 7, ...} hearts per song
function songCounts_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('songs');
  if (hit) return hit;
  var out = {};
  var sh = sheet_(TAB_SONGS);
  var n = sh.getLastRow();
  if (n >= 2) {
    sh.getRange(2, 2, n - 1, 1).getValues().forEach(function (r) { out[r[0]] = (out[r[0]] || 0) + 1; });
  }
  var json = JSON.stringify(out);
  cache.put('songs', json, 60);
  return json;
}

// ---------- helpers ----------

function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function tooMany_(id, max) {
  var cache = CacheService.getScriptCache();
  var key = 'n:' + id;
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), WINDOW_SECONDS);
  return n > max;
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, max);
}

// Stops a visitor's text from running as a spreadsheet formula.
function noFormula_(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

function reply_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}
