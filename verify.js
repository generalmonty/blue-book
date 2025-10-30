// Blue Book Verification – fixed WPM calculation + red pill styling

const fileInput = document.getElementById('fileInput');
const result = document.getElementById('result');

// Zero-width character set (must match writer)
const ZW = ["\u200B", "\u200C", "\u200D", "\uFEFF"];

/* --- Zero-width decoding --- */
function extractZW(text) {
  return Array.from(text).filter(ch => ZW.includes(ch)).join('');
}

function zwToBytes(zwText) {
  let bits = '';
  for (const ch of zwText) {
    const idx = ZW.indexOf(ch);
    if (idx >= 0) bits += idx.toString(2).padStart(2, '0');
  }
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    const b = bits.slice(i, i + 8);
    if (b.length === 8) bytes.push(parseInt(b, 2));
  }
  return new Uint8Array(bytes);
}

function bytesToString(bytes) {
  return String.fromCharCode(...bytes);
}

function b64ToUtf8(b64) {
  const bin = atob(b64);
  const pct = Array.prototype.map
    .call(bin, ch => '%' + ('00' + ch.charCodeAt(0).toString(16)).slice(-2))
    .join('');
  return decodeURIComponent(pct);
}

function decodeHidden(fullText) {
  const zw = extractZW(fullText);
  const essay = fullText.replace(/[\u200B\u200C\u200D\uFEFF]/g, '').trim();
  if (!zw) return [null, essay];
  try {
    const bytes = zwToBytes(zw);
    const asString = bytesToString(bytes);
    const json = b64ToUtf8(asString);
    const meta = JSON.parse(json);
    return [meta, essay];
  } catch {
    return [null, essay];
  }
}

/* --- Helpers --- */
function formatPacificTime(isoString) {
  try {
    const date = new Date(isoString);
    const options = {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    };
    return date.toLocaleString('en-US', options);
  } catch {
    return '(Unknown)';
  }
}

function wordCount(text) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* --- Main --- */
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const raw = await file.text();
  const [meta, essay] = decodeHidden(raw);

  if (!meta) {
    result.innerHTML = `<p class="invalid">❌ Verification Failed — No metadata found</p>`;
    return;
  }

  // Metadata values
  const recordedWordCount = Number(meta.wordCount ?? 0);
  const recordedCharCount = Number(meta.charCount ?? 0);
  const keystrokes = Number(meta.keystrokes ?? 0);
  const activeMinutes = Number(meta.activeMinutes ?? 0);
  const title = meta.title || '(Untitled Essay)';
  const name = meta.name || '(Anonymous)';
  const submitted = meta.timestamp ? formatPacificTime(meta.timestamp) : '(Unknown)';

  // Actual essay analysis
  const actualWordCount = wordCount(essay);
  const mismatch = actualWordCount !== recordedWordCount;

  // WPM: use actual essay word count if mismatch
  const minutes = Math.max(activeMinutes, 1);
  const wordsForWPM = mismatch ? actualWordCount : recordedWordCount;
  const wpm = Math.round(wordsForWPM / minutes);
  const keystrokeRate = Math.round(keystrokes / minutes);

  // Interpretation
  let interpretation = 'Average Speed';
  if (wpm < 20) interpretation = 'Very Slow — Possible Pauses';
  else if (wpm < 40) interpretation = 'Normal for Careful Typing';
  else if (wpm < 80) interpretation = 'Average Speed';
  else if (wpm < 120) interpretation = 'Fast but Plausible';
  else if (wpm < 200) interpretation = 'Extremely Fast — Review Recommended';
  else interpretation = 'Suspiciously Fast';

  const wpmClass = (wpm >= 200) ? 'suspicious' : '';
  const verified = !mismatch && wpm < 200;

  // Status
  const statusHTML = verified
    ? `<p class="verified">✅ Verification Passed</p>`
    : `<p class="invalid">❌ Verification Failed</p>`;

  // Word count line
  const wordCountHTML = mismatch
    ? `<strong>Word Count:</strong> ${recordedWordCount} → <span class="red-inline">${actualWordCount}</span> <span class="mismatch">MISMATCH</span>`
    : `<strong>Word Count:</strong> ${recordedWordCount}`;

  // Tooltip info
  const tooltipText = `
    Typing Speed Guidelines:
    • 0–40 WPM — Normal human typing pace
    • 40–60 WPM — Fast but plausible
    • 60–80 WPM — Unusually quick (review context)
    • 80–120 WPM — Very fast; verify context
    • 200+ WPM — Suspicious; possible transcription
  `.trim().replace(/\n/g, '<br>');

  // Build results
  const html = `
    ${statusHTML}
    <div class="meta">
      <p><strong>Submitted:</strong> ${submitted}</p>
      <p>${wordCountHTML}</p>
      <p><strong>Character Count:</strong> ${recordedCharCount}</p>
      <p><strong>Keystrokes:</strong> ${keystrokes}</p>
      <p><strong>Active Minutes:</strong> ${activeMinutes}</p>
      <p><strong>Typing Speed:</strong> <span class="${wpmClass}">${wpm} WPM${wpmClass ? ' — Suspiciously Fast' : ''}</span>
        <span class="tooltip">ⓘ
          <span class="tooltiptext">${tooltipText}</span>
        </span>
      </p>
      <p><strong>Keystroke Rate:</strong> ${keystrokeRate}/min</p>
    </div>

    <div class="essay-box">
      <div class="essay-title">${title}</div>
      <div class="essay-author">${name}</div>
      <div class="essay">${escapeHTML(essay)}</div>
    </div>
  `;

  result.innerHTML = html;
  result.scrollIntoView({ behavior: 'smooth' });
});
