const { page } = ctx;
return await page.evaluate(() => {
  const vis = e => e && e.getClientRects().length && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
  const L = sel => Array.from(document.querySelectorAll(sel)).filter(vis).map(e => ({ id: e.id, cls: e.className.toString().slice(0, 40), data: JSON.stringify(e.dataset).slice(0, 60), txt: (e.innerText || e.title || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40) }));
  return {
    rail: L('#desktop-side-rail button, .rail-btn'),
    tabs: L('.panel-tab, [data-tab]'),
    topbar: L('.vela-widget-topbar button, .vela-widget-topbar [role=button], .vela-ws-toolbar button').slice(0, 30),
    bottombar: L('.vela-widget-bottombar button'),
    mobilebar: L('.vela-mobilebar button, .vela-mobilebar [role=button]'),
  };
});
