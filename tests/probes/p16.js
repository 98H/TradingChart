const { page } = ctx;
await sleep(2500);
return await page.evaluate(() => ({ months: (globalThis.__VELA_MONTHS__ || []).slice(0, 3), lang: document.documentElement.lang }));
