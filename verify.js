// Blue Book v1.6 — Enhanced Verification: WPM, Typing Density, Focus Integrity
const fileInput = document.getElementById('fileInput');
const result = document.getElementById('result');

const ZW = ["\u200B","\u200C","\u200D","\uFEFF"];

function zwToBytes(zwText) {
  let bits = '';
  for (const ch of zwText) {
    const idx = ZW.indexOf(ch);
    if (idx >= 0) bits += idx.toString(2).padStart(2,'0');
  }
  const bytes = [];
  for (let i=0; i<bits.length; i+=8) {
    const byte = bits.slice(i,i+8);
    if (byte.length===8) bytes.push(parseInt(byte,2));
  }
  return new Uint8Array(bytes);
}

function decodeHidden(text) {
  const zwChars = new Set(ZW);
  let i = text.length - 1;
  while (i >= 0 && zwChars.has(text[i])) i--;
  const hidden = text.slice(i + 1);
  if (!hidden) return [null, text];
  const bytes = zwToBytes(hidden);
  const b64 = String.fromCharCode(...bytes);
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    const meta = JSON.parse(json);
    const visibleText = text.slice(0, i).trimEnd();
    return [meta, visibleText];
  } catch {
    return [null, text];
  }
}

async function sha256Hex(str) {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function formatPacificTime(isoString) {
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
}

function getWordCount(text) {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const [meta, essay] = decodeHidden(text);

  if (!meta) {
    result.innerHTML = '<p class="invalid">❌ No metadata found in this file.</p>';
    return;
  }

  // --- Integrity + Metrics ---
  const source = `${meta.sessionId}|${meta.keystrokes}|${meta.activeMinutes}|${meta.wordCount}`;
  const checkHash = await sha256Hex(source);
  let verified = (checkHash === meta.hash);

  const actualWordCount = getWordCount(essay);
  const recordedWordCount = Number(meta.wordCount);
  const mismatch = actualWordCount !== recordedWordCount;
  if (mismatch) verified = false;

  const activeMins = Math.max(Number(meta.activeMinutes), 1);
  const wpm = Math.round(actualWordCount / activeMins);
  const typingDensity = Math.round(meta.keystrokes / activeMins);

  // --- Interpretation ---
  let interpretation = "Normal Pace";
  let color = "#1f1f20";
  if (wpm > 80) {
    interpretation = "Suspiciously Fast";
    color = "#c00";
    verified = false;
  } else if (wpm > 60) {
    interpretation = "Unusually Quick";
    color = "#d98200";
  } else if (wpm < 20) {
    interpretation = "Slow";
    color = "#555";
  }

  // --- Density Flag ---
  let densityWarning = "";
  if (typingDensity > 400) {
    densityWarning = `<span style="color:#c00;font-weight:700;">⚠️ Extremely high keystroke rate (${typingDensity}/min) — possible transcription.</span>`;
    verified = false;
  }

  // --- Tooltip Text ---
  const tooltipText = `
    Typing Speed Guidelines:
    • 0–40 WPM — Normal human typing pace
    • 40–60 WPM — Fast but plausible
    • 60–80 WPM — Unusually quick (review context)
    • 80+ WPM — Suspiciously fast; possible AI transcription
  `.trim().replace(/\n/g, "<br>");

  const readableDate = meta.timestamp ? formatPacificTime(meta.timestamp) : '(Unknown)';

  const statusHtml = verified
    ? '<p class="verified">✅ Verified</p>'
    : '<p class="invalid">❌ Verification Failed</p>';

  const wordCountHtml = mismatch
    ? `<strong>Word Count:</strong> ${recordedWordCount} <span style="color:#c00;font-weight:700;">→ ${actualWordCount}</span> <span style="background:#ffe5e5;color:#c00;border:1px solid #c00;border-radius:12px;padding:2px 8px;margin-left:8px;font-weight:700;">MISMATCH</span>`
    : `<strong>Word Count:</strong> ${recordedWordCount}`;

  const metaHtml = `
    ${statusHtml}
    <div class="meta">
      <strong>Submitted:</strong> ${readableDate}<br>
      ${wordCountHtml}<br>
      <strong>Character Count:</strong> ${meta.charCount}<br>
      <strong>Keystrokes:</strong> ${meta.keystrokes}<br>
      <strong>Active Minutes:</strong> ${meta.activeMinutes}<br>
      <strong>Typing Speed:</strong> 
        <span style="color:${color};font-weight:600;">${wpm} WPM — ${interpretation}</span>
        <span class="tooltip">ⓘ
          <span class="tooltiptext">${tooltipText}</span>
        </span><br>
      <strong>Keystroke Rate:</strong> ${typingDensity}/min
      ${densityWarning ? "<br>" + densityWarning : ""}
    </div>
    <div class="essay-box">
      <div class="essay-title">${meta.title || '(Untitled Essay)'}</div>
      <div class="essay-author">${meta.name || '(Anonymous)'}</div>
      <pre class="essay" id="essayContent"></pre>
    </div>
  `;

  result.innerHTML = metaHtml;
  document.getElementById('essayContent').textContent = essay;
});
