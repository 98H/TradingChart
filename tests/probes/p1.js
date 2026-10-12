const { page } = ctx;
return await page.evaluate(() => {
  const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), disp: getComputedStyle(e).display }; };
  const out = {};
  // fixed/absolute elements in the bottom 160px
  out.bottomEls = Array.from(document.querySelectorAll('body *')).filter(e => { const s = getComputedStyle(e); if (s.display==='none'||s.visibility==='hidden') return false; const b = e.getBoundingClientRect(); return b.height>10 && b.width>40 && b.top > innerHeight-170 && (s.position==='fixed'||s.position==='absolute'); }).map(e => ({ id: e.id, cls: e.className.toString().slice(0,50), t: Math.round(e.getBoundingClientRect().top), b: Math.round(e.getBoundingClientRect().bottom), l: Math.round(e.getBoundingClientRect().left), r: Math.round(e.getBoundingClientRect().right), z: getComputedStyle(e).zIndex })).slice(0, 25);
  // chart canvases
  out.canvases = Array.from(document.querySelectorAll('canvas')).map(c => { const b = c.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height), p: c.parentElement.className.toString().slice(0,40) }; }).filter(c => c.w > 0);
  // letter spacing on Persian text
  const ls = [];
  document.querySelectorAll('body *').forEach(e => { const s = getComputedStyle(e); if (s.letterSpacing !== 'normal' && parseFloat(s.letterSpacing) !== 0 && /[\u0600-\u06FF]/.test(Array.from(e.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('')) && e.getClientRects().length) ls.push({ id: e.id, cls: e.className.toString().slice(0,40), ls: s.letterSpacing, txt: e.innerText.slice(0,20) }); });
  out.letterSpacingFa = ls.slice(0, 30);
  out.legend = Array.from(document.querySelectorAll('[class*=legend], [class*=vela-sl], [class*=statusline]')).filter(e=>e.getClientRects().length).map(e => e.className.toString().slice(0,40) + ' :: ' + e.innerText.replace(/\s+/g,' ').slice(0, 120)).slice(0, 8);
  out.header = Array.from(document.querySelectorAll('header button, .topbar button, nav button')).filter(e=>e.getClientRects().length && getComputedStyle(e).display!=='none').map(e => { const b = e.getBoundingClientRect(); return (e.id||e.className.toString().slice(0,25)) + ' [' + Math.round(b.left) + '-' + Math.round(b.right) + '] ' + (e.innerText||e.title).trim().slice(0,25); });
  return out;
});
