const { page } = ctx;
await sleep(1500);
await page.screenshot({ path: process.env.SHOT || '/root/.hermes/cache/scratch/shot.png' });
return 'ok';
