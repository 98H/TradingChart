const { page } = ctx;
return await page.evaluate(() => {
  const app = window.__TRADING_APP__;
  const R = app.chartManager?.workspace?.active?.chart?.renderer?.renderer;
  if (!R) return 'no inner';
  const panes = R.scene?.panes ? Array.from(R.scene.panes.entries()).map(([k, p]) => ({ k, kind: p.kind, b: p.bounds, s: p.scale && { min: p.scale.min, max: p.scale.max } })) : null;
  const pp = R.scene?.panes ? Array.from(R.scene.panes.values())[0] : null;
  const host = R.mountContainer || R.container || R.root;
  return { panes, y: pp && R.coords.priceToY(83000, pp.scale, pp.bounds), coordsH: R.coords?.height, rightAxisW: R.rightAxisW, hostRect: host && host.getBoundingClientRect && (({top, left, width, height}) => ({top, left, width, height}))(host.getBoundingClientRect()), hostCls: host && host.className };
});
