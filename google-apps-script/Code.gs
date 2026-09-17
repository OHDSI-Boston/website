/** @OnlyCurrentDoc */

/**
 * Code.gs — signup endpoint for the OHDSI Boston site.
 *
 * NOT PART OF THE WEBSITE. Paste into the Apps Script project bound to the
 * signup Google Sheet (Sheet → Extensions → Apps Script) and deploy as a web
 * app. Setup: README.md in this directory.
 *
 * The site POSTs form fields (FormData, mode: 'no-cors'):
 *   name, email, institution, hasData, website (honeypot)
 * The browser cannot read the reply; the JSON below is for curl and for the
 * Executions log.
 */

/* ----------------------------------------------------------------- config */

var CONFIG = {
  /* Tab to write to. '' = the first tab in the spreadsheet. */
  SHEET_NAME: '',

  HEADERS: ['timestamp', 'name', 'email', 'institution', 'hasData'],
  HAS_DATA_VALUES: ['', 'yes', 'maybe', 'no'],

  MAX_WRITES_PER_MINUTE: 30,
  MAX_LENGTH: { name: 200, email: 254, institution: 300 }
};

/* ------------------------------------------------------------------ entry */

function doPost(e) {
  try {
    var p = (e && e.parameter) || {};

    /* Honeypot: pretend success so a bot learns nothing. */
    if (clean_(p.website, 500)) return json_({ ok: true });

    var name = clean_(p.name, CONFIG.MAX_LENGTH.name);
    var email = clean_(p.email, CONFIG.MAX_LENGTH.email).toLowerCase();
    var institution = clean_(p.institution, CONFIG.MAX_LENGTH.institution);
    var hasData = clean_(p.hasData, 10).toLowerCase();

    if (!name) return json_({ ok: false, error: 'Name is required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json_({ ok: false, error: 'Valid email is required.' });
    if (CONFIG.HAS_DATA_VALUES.indexOf(hasData) === -1) hasData = '';

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return json_({ ok: false, error: 'Busy, please retry.' });
    try {
      var sheet = getSheet_();
      if (rateLimited_()) return json_({ ok: false, error: 'Too many signups right now.' });
      sheet.appendRow([new Date(), safe_(name), safe_(email), safe_(institution), hasData]);
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);   // visible under Executions
    return json_({ ok: false, error: 'Unable to save signup.' });
  }
}

/** Health check: open the /exec URL in a browser to confirm the deployment. */
function doGet() {
  return json_({ ok: true, service: 'ohdsi-boston-signup' });
}

/**
 * Run this once from the editor (select it, click Run) to authorize the
 * script and confirm it can write. It appends a row named "setup test";
 * delete that row afterwards.
 */
function testWrite() {
  var out = doPost({ parameter: {
    name: 'setup test', email: 'setup-test@example.org',
    institution: '', hasData: '', website: ''
  } });
  console.log(out.getContent());
}

/* ------------------------------------------------------------- internals */

function getSheet_() {
  /* @OnlyCurrentDoc limits the script to the Sheet it is bound to, so the
     script must be opened from that Sheet (Extensions → Apps Script). */
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No spreadsheet: open this script from the Sheet (Extensions → Apps Script).');

  var sheet = CONFIG.SHEET_NAME ? ss.getSheetByName(CONFIG.SHEET_NAME) : ss.getSheets()[0];
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CONFIG.HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* Counts writes in the last minute with a cache counter, so it does not
   depend on the Sheet's contents or ordering. */
function rateLimited_() {
  var cache = CacheService.getScriptCache();
  var key = 'writes-' + Math.floor(Date.now() / 60000);
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 120);
  return n > CONFIG.MAX_WRITES_PER_MINUTE;
}

function clean_(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/* A cell starting with = + - @ is run as a formula when the Sheet is opened
   or exported; prefix with ' so it stays text. */
function safe_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
