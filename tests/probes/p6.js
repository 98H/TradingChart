const { page } = ctx;
return await page.evaluate(() => {
  const app = window.__TRADING_APP__;
  const cell = app.chartManager?.workspace?.active;
  const ch = cell?.chart;
  const r = ch?.renderer;
  const own = o => o ? Object.getOwnPropertyNames(o).slice(0, 60) : null;
  const proto = o => o ? Object.getOwnPropertyNames(Object.getPrototypeOf(o)).slice(0, 120) : null;
  return { cellKeys: own(cell), chartKeys: own(ch), chartProto: proto(ch), rKeys: own(r), rProto: proto(r) };
});
