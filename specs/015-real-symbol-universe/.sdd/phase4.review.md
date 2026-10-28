  ⚠ dashboard [default] pid 732041: manual restart still pending; this process may still serve pre-update code.
    Ask its owner to relaunch `hermes serve` / `hermes dashboard` (reconnect Desktop for an SSH backend).
VERDICT: PASS

بررسی تخصصی فاز ۴ (حذف کامل مسیرهای نمایشی و پایبندی به اصل Honest Data) با موفقیت تأیید شد:

۱. رفتار فراتر از تست‌ها: فایل `server/demoPath.js` و تمامی ارجاعات به آن حذف گردید. تمامی توابع تولید قیمت ساختگی، مقادیر پایه ثابت (`TSE_BASE_PRICES`) و نوسان‌سازهای ریاضی (`Math.sin` و `Math.cos`) از سرور پاکسازی شدند.
۲. قراردادهای خطا و انزوا: نمادهای ناشناخته در تمامی مسیرها (`/api/candles`، `/api/symbol-info`، `/api/depth` و رویدادهای `/ws/live`) به درستی پاسخ ۴۰۴ با کد `unknown_symbol` دریافت می‌کنند.
۳. عمق بازار (DOM): درخواست دفتر سفارش در `server/depthFeed.js` تنها برای نمادهای واقعی بایننس پردازش شده و برای سایر نمادها خطای ۴۰۴ با کد `depth_unavailable` صادر می‌شود؛ در سمت کلاینت (`client/src/depthOfMarket.js`) وضعیت عدم دسترسی با پیام رسمی فارسی «دفتر سفارش برای این نماد در دسترس نیست» به نمایش درمی‌آید.
۴. منابع داده بازار: خروجی `/api/market-sources` و پنجره منابع داده تنها منابع واقعی معتبر (Binance، TradingView، TGJU و مشروط به فعال‌سازی TSE) را گزارش می‌کنند.
۵. کاتالوگ و نگاشت نمادهای تهران: نماد `IR:GOLD_ABSHODEH` به عنوان آلیاس `IR:GOLD_MESGHAL` بدون ورودی تکراری تعریف شد و نمادهای واقعی `IR:USDT_FREE` و `IR:GOLD_24K` با نام فارسی رسمی و اعداد فارسی به کاتالوگ افزوده شدند.
۶. پنهان‌سازی بخش بورس تهران: در نبود کلید BrsApi یا رله معتبر، زبانه، کلیدهای ناوبری و تابلوی TSE در کلاینت کاملاً مخفی شده و فراخوانی تابلو پاسخ ۴۰۴ با کد `tse_unavailable` می‌دهد.
۷. استانداردهای زبان فارسی و امنیت: تمام رشته‌های فارسی با لحن رسمی، نیم‌فاصله و اعداد فارسی نگارش شده و هیچ انشعاب شرطی روی نام کاربر یا محیط تست وجود ندارد.

session_id: local-021b6350f08d44f4f6d4df80da33d9ffbfa406776d57fed81b46fa3f4af3a3c7
0
