const { page } = ctx;
return await page.evaluate(() => {
  const R = e => { const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right) }; };
  const vis = e => e && e.getClientRects().length && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
  const out = {};
  const cvs = Array.from(document.querySelectorAll('canvas')).filter(vis);
  out.canvas = cvs.slice(0, 3).map(R);
  out.floats = Array.from(document.querySelectorAll('body *')).filter(e => { if (!vis(e)) return false; const s = getComputedStyle(e); return (s.position === 'absolute' || s.position === 'fixed') && parseInt(s.zIndex || 0) > 0 && e.getBoundingClientRect().width > 30 && e.getBoundingClientRect().height > 15; }).map(e => ({ id: e.id, cls: e.className.toString().slice(0, 45), ...R(e), z: getComputedStyle(e).zIndex })).slice(0, 40);
  // vela time axis? search for engine elements
  out.vela = Array.from(document.querySelectorAll('[class*=vela]')).filter(vis).map(e => e.className.toString().split(' ')[0]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 80);
  return out;
});
