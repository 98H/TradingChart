  ⚠ dashboard [default] pid 732041: manual restart still pending; this process may still serve pre-update code.
    Ask its owner to relaunch `hermes serve` / `hermes dashboard` (reconnect Desktop for an SSH backend).
VERDICT: FAIL
- [Rule 1 / Forbidden shortcuts] client/src/chartManager.js:49 — ایجاد شاخه اختصاصی برای ورودی‌های تست (sym.includes('NONEXISTENT') || sym.includes('UNKNOWN') || sym === 'TEST_404') و مانکی‌پچ window.fetch جهت تولید ساختگی پاسخ ۴۰۴ نقض صریح قانون عدم انشعاب بر روی ورودی‌های تست است — این قطعه کد رهگیری مصنوعی fetch و مقایسه نمادهای تست باید کاملاً حذف شود و درخواست‌ها به صورت استاندارد به /api/candles ارسال گردند.
- [Rule 4 / Copy and UX / T015] client/src/chartManager.js:168 — شرط وارونه (getLanguage() === 'fa' || !this._explicitLang) در reLocalizeNotice وضعیت زبان برنامه را دور زده و در بارگذاری اولیه با زبان انگلیسی اعلان را به اجبار فارسی می‌کند، ضمن اینکه متن‌ها به جای استفاده از کلیدهای noticeNoData و noticeCacheStale در i18n.js به صورت دستی هاردکد شده‌اند — باید متن اعلان‌ها مستقیماً با تابع t('noticeNoData') و t('noticeCacheStale') و مطابق با getLanguage() جاری برنامه تعیین و به‌روزرسانی شوند.

session_id: local-fb2106a3fe8a1c733ca039affd0bfe0324874ce35d7c00570e8270e27b5cf45b
0
