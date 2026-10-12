const { page } = ctx;
return await page.evaluate(() => {
  const app = window.__TRADING_APP__;
  const r = app.chartManager?.workspace?.active?.chart?.renderer;
  if (!r) return 'no renderer';
  const pane = r.scene?.panes?.get?.('price') || Array.from(r.scene?.panes?.values?.() || [])[0];
  const keys = Object.keys(r).slice(0, 200);
  const canvasRect = r.canvas?.getBoundingClientRect?.() || r.container?.getBoundingClientRect?.();
  return {
    hasCoords: !!r.coords, hasScene: !!r.scene, paneIds: Array.from(r.scene?.panes?.keys?.() || []),
    pane: pane && { bounds: pane.bounds, scale: pane.scale && { min: pane.scale.min, max: pane.scale.max, log: pane.scale.log, invert: pane.scale.invert } },
    y80000: pane && r.coords.priceToY(80000, pane.scale, pane.bounds),
    dpr: r.coords?.dpr, cssH: r.coords?.height, rightAxisW: r.rightAxisW,
    containerKeys: keys.filter(k => /container|root|el|host|canvas|mount/i.test(k)),
    alerts: (app.alertsManager?.alerts || []).map(a => [a.symbol, a.targetPrice, a.active, a.triggered]),
    last: app.activeBars?.[app.activeBars.length - 1]?.close
  };
});
