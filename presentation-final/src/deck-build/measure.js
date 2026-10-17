await document.fonts.ready;
const seg = new Intl.Segmenter('th', { granularity: 'grapheme' });
const rgb = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(s => parseFloat(s)); if (p.length === 4 && p[3] === 0) return null; return p.slice(0,3).map(v => Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase(); };
// runs with browser line breaks: a run piece ends with nl:1 when the next grapheme starts a new visual line
const runsOf = (el, withLines) => { const out = []; let lastTop = null;
  const walk = (n) => { for (const c of n.childNodes) {
    if (c.nodeType === 3) { const cs = getComputedStyle(c.parentElement); const st = { b: parseInt(cs.fontWeight) >= 600, c: rgb(cs.color), f: cs.fontFamily.split(',')[0].replace(/['"]/g,'').trim(), s: parseFloat(cs.fontSize) };
      const raw = c.textContent; let buf = ''; let off = 0;
      for (const { segment } of seg.segment(raw)) { let top = null;
        if (withLines && segment.trim()) { const r = document.createRange(); r.setStart(c, off); r.setEnd(c, off + segment.length); const rs = r.getClientRects(); if (rs.length) top = Math.round(rs[0].top); }
        if (top !== null && lastTop !== null && top - lastTop > 4) { out.push({ t: buf, ...st }); out.push({ br: 1 }); buf = ''; }
        if (top !== null) lastTop = top; buf += segment; off += segment.length; }
      out.push({ t: buf, ...st });
    } else if (c.nodeName === 'BR') { out.push({ br: 1 }); lastTop = null; }
    else if (c.nodeType === 1) walk(c); } };
  walk(el);
  for (const r of out) if (!r.br) r.t = r.t.replace(/\s+/g, ' ');
  // trim spaces around line breaks
  for (let k = 0; k < out.length; k++) { if (out[k].br) { if (out[k-1] && !out[k-1].br) out[k-1].t = out[k-1].t.replace(/ $/,''); if (out[k+1] && !out[k+1].br) out[k+1].t = out[k+1].t.replace(/^ /,''); } }
  if (out[0] && !out[0].br) out[0].t = out[0].t.replace(/^ /,''); const l = out[out.length-1]; if (l && !l.br) l.t = l.t.replace(/ $/,'');
  return out.filter(r => r.br || r.t !== ''); };
const slides = [];
for (const s of document.querySelectorAll('section')) {
  const r0 = s.getBoundingClientRect(); const box = e => { const r = e.getBoundingClientRect(); return { x: r.left - r0.left, y: r.top - r0.top, w: r.width, h: r.height }; };
  const items = []; const skip = new Set();
  for (const e of s.querySelectorAll('*')) {
    if ([...skip].some(k => k.contains(e))) continue;
    const cs = getComputedStyle(e);
    if (e.tagName === 'IMG') { items.push({ k: 'img', ...box(e), src: e.getAttribute('src'), nw: e.naturalWidth, nh: e.naturalHeight, bg: rgb(cs.backgroundColor), rad: parseFloat(cs.borderTopLeftRadius) || 0 }); continue; }
    if (e.tagName === 'TABLE') { skip.add(e); const rows = [...e.rows].map(tr => ({ bg: rgb(getComputedStyle(tr).backgroundColor), h: tr.getBoundingClientRect().height, cells: [...tr.cells].map(td => ({ runs: runsOf(td, true), w: td.getBoundingClientRect().width, align: getComputedStyle(td).textAlign, th: td.tagName === 'TH' })) })); items.push({ k: 'table', ...box(e), rows, fs: parseFloat(cs.fontSize) }); continue; }
    if (e.tagName === 'DIV') { const bg = rgb(cs.backgroundColor); if (bg) items.push({ k: 'rect', ...box(e), bg, rad: parseFloat(cs.borderTopLeftRadius) || 0 }); const bl = parseFloat(cs.borderLeftWidth); if (bl > 0 && cs.borderLeftStyle !== 'none') { const b = box(e); items.push({ k: 'vline', x: b.x, y: b.y, w: bl, h: b.h, c: rgb(cs.borderLeftColor) }); } continue; }
    if (['P','H1','H2','H3'].includes(e.tagName)) { skip.add(e); items.push({ k: 'text', ...box(e), runs: runsOf(e, true), lh: parseFloat(cs.lineHeight) / parseFloat(cs.fontSize), align: cs.textAlign }); }
  }
  slides.push({ id: s.dataset.id, bg: rgb(getComputedStyle(s).backgroundColor), items });
}
const res = await fetch('/save', { method: 'POST', body: JSON.stringify(slides) }); await res.text();