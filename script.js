// Blue Book v1.6+ — Secure Writer with Live Word Counter & Focus-Aware Tracking
const editor = document.getElementById('editor');
const newBtn = document.getElementById('newBtn');
const submitBtn = document.getElementById('submitBtn');
const titleInput = document.getElementById('titleInput');
const nameInput = document.getElementById('nameInput');
const toast = document.getElementById('toast');
const wordCountDisplay = document.getElementById('wordCount');

let session = {
  id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
  keystrokes: 0,
  startedAt: Date.now(),
  lastInputAt: 0,
  activeMs: 0,
  _lastTick: Date.now()
};

// --- Tab + Activity Tracking ---
const IDLE_THRESHOLD_MS = 10000; // 10 seconds
let windowActive = true;

window.addEventListener('blur', () => windowActive = false);
window.addEventListener('focus', () => windowActive = true);

setInterval(() => {
  const now = Date.now();
  if (windowActive && now - session.lastInputAt < IDLE_THRESHOLD_MS) {
    session.activeMs += now - session._lastTick;
  }
  session._lastTick = now;
}, 1000);

// --- Keystroke & Word Count Tracking ---
editor.addEventListener('input', () => {
  session.keystrokes++;
  session.lastInputAt = Date.now();

  // Live word count display
  const words = editor.value.trim().split(/\s+/).filter(Boolean).length;
  wordCountDisplay.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
});

// --- Block Paste ---
editor.addEventListener('paste', (e) => {
  e.preventDefault();
  showToast();
});

// --- Allow Tab Key ---
editor.addEventListener('keydown', function (e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = this.selectionStart;
    const end = this.selectionEnd;
    this.value = this.value.substring(0, start) + "\t" + this.value.substring(end);
    this.selectionStart = this.selectionEnd = start + 1;
  }
});

// --- Utility: SHA-256 Hash ---
async function sha256Hex(str) {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Utility: Zero-Width Encoding ---
const ZW = ["\u200B", "\u200C", "\u200D", "\uFEFF"];
function bytesToZW(bytes) {
  let bits = '';
  for (let i = 0; i < bytes.length; i++) bits += bytes[i].toString(2).padStart(8, '0');
  let zw = '';
  for (let i = 0; i < bits.length; i += 2) {
    const val = parseInt(bits.slice(i, i + 2).padEnd(2, '0'), 2);
    zw += ZW[val];
  }
  return zw;
}
function encodeHidden(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  const bytes = new Uint8Array(b64.length);
  for (let i = 0; i < b64.length; i++) bytes[i] = b64.charCodeAt(i);
  return bytesToZW(bytes);
}

// --- Utility: Word Count ---
function getWordCount(txt) {
  const t = txt.trim();
  return t ? t.split(/\s+/).length : 0;
}

// --- Typing Density ---
function calculateTypingDensity() {
  const activeMinutes = Math.max(session.activeMs / 60000, 1);
  return Math.round(session.keystrokes / activeMinutes);
}

// --- Hidden Metadata Block ---
async function makeHiddenBlock() {
  const text = editor.value;
  const words = getWordCount(text);
  const meta = {
    sessionId: session.id,
    title: titleInput.value.trim(),
    name: nameInput.value.trim(),
    wordCount: words,
    charCount: text.length,
    keystrokes: session.keystrokes,
    activeMinutes: Math.round(session.activeMs / 60000),
    typingDensity: calculateTypingDensity(),
    timestamp: new Date().toISOString()
  };
  const source = `${meta.sessionId}|${meta.keystrokes}|${meta.activeMinutes}|${meta.wordCount}`;
  meta.hash = await sha256Hex(source);
  return encodeHidden(meta);
}

// --- Submit Button ---
submitBtn.addEventListener('click', async () => {
  const text = editor.value;
  const hidden = await makeHiddenBlock();
  const content = text + "\n" + hidden;
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const title = titleInput?.value.trim() || "Untitled";
  const name = nameInput?.value.trim() || "Anonymous";
  a.download = `${title} - ${name}.txt`;
  a.click();
});

// --- Toast ---
function showToast() {
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}
