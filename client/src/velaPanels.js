// client/src/velaPanels.js
// Custom Side Panel & Icon Registrations for Vela WebGL2 Workspace
// Matches LuxAlgo Quant architecture and official drawers with full TradingView Parity

import { registerSidePanel } from '@luxalgo/vela';
import { registerIcon, svg16 } from '@luxalgo/vela/ui';

export function registerAllVelaPanels(app) {
  // 1. Register Custom SVG Icons wrapped with svg16 for Vela Drawer & SideDock
  registerIcon('layout', svg16('<rect x="1.5" y="1.5" width="13" height="13" rx="1.5"/><path d="M8 1.5v13M1.5 8h13"/>'));
  registerIcon('code', svg16('<polyline points="10 4 14 8 10 12"/><polyline points="6 12 2 8 6 4"/>'));
  registerIcon('star', svg16('<polygon points="8 1.5 10 5.5 14.5 6.2 11.2 9.5 12 14 8 11.8 4 14 4.8 9.5 1.5 6.2 6 5.5 8 1.5"/>'));
  registerIcon('watchlist', svg16('<line x1="5.5" y1="4" x2="14" y2="4"/><line x1="5.5" y1="8" x2="14" y2="8"/><line x1="5.5" y1="12" x2="14" y2="12"/><circle cx="2.5" cy="4" r="1" fill="currentColor"/><circle cx="2.5" cy="8" r="1" fill="currentColor"/><circle cx="2.5" cy="12" r="1" fill="currentColor"/>'));
  registerIcon('trade', svg16('<rect x="1.5" y="4.5" width="13" height="9.5" rx="1.5"/><path d="M10.5 14V3.5a1.5 1.5 0 0 0-1.5-1.5H7a1.5 1.5 0 0 0-1.5 1.5V14"/>'));
  registerIcon('journal', svg16('<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><line x1="10.5" y1="1.5" x2="10.5" y2="4"/><line x1="5.5" y1="1.5" x2="5.5" y2="4"/><line x1="2" y1="6.5" x2="14" y2="6.5"/>'));
  registerIcon('strategy', svg16('<polygon points="3.5 2.5 13.5 8 3.5 13.5 3.5 2.5"/>'));
  registerIcon('propsim', svg16('<path d="M8 1.5v13M11.5 3.5H6.5a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H4"/>'));
  registerIcon('trackers', svg16('<circle cx="8" cy="8" r="6.5"/><line x1="1.5" y1="8" x2="14.5" y2="8"/><path d="M8 1.5a10 10 0 0 1 2.5 6.5 10 10 0 0 1-2.5 6.5 10 10 0 0 1-2.5-6.5A10 10 0 0 1 8 1.5z"/>'));
  registerIcon('calendar', svg16('<rect x="2" y="3" width="12" height="11" rx="1.5"/><line x1="11" y1="1.5" x2="11" y2="4"/><line x1="5" y1="1.5" x2="5" y2="4"/><line x1="2" y1="6.5" x2="14" y2="6.5"/>'));
  registerIcon('compare', svg16('<circle cx="8" cy="8" r="6.5"/><line x1="8" y1="5" x2="8" y2="11"/><line x1="5" y1="8" x2="11" y2="8"/>'));
  registerIcon('screener', svg16('<path d="M2 3h12l-4.5 5.5v5l-3-1.5v-3.5L2 3z"/><line x1="10.5" y1="11.5" x2="14.5" y2="11.5"/><line x1="10.5" y1="13.5" x2="13.5" y2="13.5"/>'));
  registerIcon('dom', svg16('<rect x="2" y="2" width="12" height="12" rx="1"/><line x1="2" y1="6" x2="14" y2="6"/><line x1="2" y1="10" x2="14" y2="10"/><line x1="6" y1="2" x2="6" y2="14"/><line x1="10" y1="2" x2="10" y2="14"/>'));
  registerIcon('news', svg16('<path d="M2.5 13.5h11a1 1 0 0 0 1-1v-10a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v10a1 1 0 0 1-1 1Zm0 0a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h1"/><line x1="11.5" y1="9" x2="6.5" y2="9"/><line x1="9.5" y1="11" x2="6.5" y2="11"/><rect x="6.5" y="3.5" width="5" height="3" rx="0.5"/>'));

  // 2. Register Side Panels (Rendered in Vela's PanelDock on Desktop & MoreDrawer on Mobile)

  // Pine Editor (Panel #3)
  registerSidePanel({
    id: 'pine',
    title: 'Pine editor',
    icon: 'code',
    order: 30,
    width: 380,
    resizable: true,
    mount: (ctx, body, header) => {
      app.mountPineEditor(body);
    }
  });

  // Indicator Templates (Panel #4)
  registerSidePanel({
    id: 'templates',
    title: 'Indicator Templates',
    icon: 'star',
    order: 40,
    width: 330,
    resizable: true,
    mount: (ctx, body, header) => {
      app.mountIndicatorTemplates(body);
    }
  });

  // Workspaces (Panel #5)
  registerSidePanel({
    id: 'workspaces',
    title: 'Workspaces',
    icon: 'layout',
    order: 50,
    width: 310,
    mount: (ctx, body, header) => {
      app.mountWorkspaces(body);
    }
  });

  // Technical Screener (Panel #5b - TradingView Parity)
  registerSidePanel({
    id: 'screener',
    title: 'Technical Screener',
    icon: 'screener',
    order: 55,
    width: 480,
    resizable: true,
    mount: (ctx, body, header) => {
      app.mountTechnicalScreener(body);
    }
  });

  // Watchlist (Panel #6)
  registerSidePanel({
    id: 'watchlist',
    title: 'Watchlist',
    icon: 'watchlist',
    order: 60,
    width: 330,
    resizable: true,
    mount: (ctx, body, header) => {
      app.mountWatchlist(body);
    }
  });

  // Trade / Paper Trading (Panel #7)
  registerSidePanel({
    id: 'paper',
    title: 'Trade',
    icon: 'trade',
    order: 70,
    width: 330,
    resizable: true,
    mount: (ctx, body, header) => {
      app.mountPaperTrading(body);
    }
  });

  // Depth of Market - DOM (Panel #7b - TradingView Parity)
  registerSidePanel({
    id: 'dom',
    title: 'Depth of Market (DOM)',
    icon: 'dom',
    order: 75,
    width: 340,
    resizable: true,
    mount: (ctx, body, header) => {
      app.mountDepthOfMarket(body);
    }
  });

  // Alerts Manager (Panel #8)
  registerSidePanel({
    id: 'alerts',
    title: 'Alerts',
    icon: 'bell',
    order: 80,
    width: 330,
    resizable: true,
    mount: (ctx, body, header) => {
      app.mountAlerts(body);
    }
  });

  // Strategy Tester (Panel #9)
  registerSidePanel({
    id: 'strategy',
    title: 'Strategy Tester',
    icon: 'strategy',
    order: 90,
    width: 440,
    resizable: true,
    mount: (ctx, body, header) => {
      app.mountStrategyTester(body);
    }
  });

  // Prop-Firm Simulator (Panel #10)
  registerSidePanel({
    id: 'propsim',
    title: 'Prop-Firm Simulator',
    icon: 'propsim',
    order: 100,
    width: 380,
    resizable: true,
    mount: (ctx, body, header) => {
      app.mountPropFirmSim(body);
    }
  });

  // Trade Journal (Panel #11)
  registerSidePanel({
    id: 'journal',
    title: 'Trade Journal',
    icon: 'journal',
    order: 110,
    width: 440,
    resizable: true,
    mount: (ctx, body, header) => {
      app.mountTradeJournal(body);
    }
  });

  // Market Trackers (Panel #12)
  registerSidePanel({
    id: 'trackers',
    title: 'Market Trackers (SEC)',
    icon: 'trackers',
    order: 120,
    width: 440,
    resizable: true,
    mount: (ctx, body, header) => {
      app.mountMarketTrackers(body);
    }
  });

  // Economic Calendar (Panel #13)
  registerSidePanel({
    id: 'calendar',
    title: 'Economic Calendar',
    icon: 'calendar',
    order: 130,
    width: 420,
    resizable: true,
    mount: (ctx, body, header) => {
      app.mountEconomicCalendar(body);
    }
  });

  // Market News & Catalysts (Panel #14 - TradingView Parity)
  registerSidePanel({
    id: 'news',
    title: 'Market News',
    icon: 'news',
    order: 140,
    width: 440,
    resizable: true,
    mount: (ctx, body, header) => {
      app.mountMarketNews(body);
    }
  });

  console.log('[VelaPanels] All 13 custom panels and icons registered into Vela WebGL2 Workspace');
}
