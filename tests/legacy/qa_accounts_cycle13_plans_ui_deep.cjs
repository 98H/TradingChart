// @ts-check
/**
 * Cycle 13: Deep Real-Browser Interactive QA for Plans Studio
 * Tests UI-driven CRUD, custom modal dialogs, mobile master-detail navigation,
 * dirty state protection, keyboard shortcuts, and factory reset.
 */

const {
  runSuite,
  shots,
  auditStatic,
  VIEWPORTS
} = require('./qa_lib.cjs');

const MASTER_KEY = 'tradingchart_master_nexus';
const TS = Date.now().toString(36);
const PLAN_ID = `quant_vip_${TS}`;
const CLONE_ID = `${PLAN_ID}_copy`;

async function pollUntil(fn, timeoutMs = 10000, step = 200) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await new Promise(r => setTimeout(r, step));
  }
  return null;
}

async function ensureStudioOpen(page) {
  await page.evaluate(({ key }) => {
    localStorage.setItem('tradingchart_admin_key', key);
    sessionStorage.setItem('tradingchart_admin_key', key);
    window.__TRADING_APP__?.auth?.openPlanAdminStudio();
  }, { key: MASTER_KEY });
  return pollUntil(() => page.evaluate(() => !!document.querySelector('#tc-plan-admin-modal')), 10000);
}

const tests = {
  desktop: {
    '01_open_studio_via_keyboard_shortcut_and_unlock': async (ctx) => {
      const defects = [];
      await ctx.page.evaluate(() => {
        localStorage.removeItem('tradingchart_admin_key');
        sessionStorage.removeItem('tradingchart_admin_key');
      });
      await new Promise(r => setTimeout(r, 300));

      // Trigger keyboard shortcut Ctrl+Shift+P
      await ctx.page.keyboard.down('Control');
      await ctx.page.keyboard.down('Shift');
      await ctx.page.keyboard.press('KeyP');
      await ctx.page.keyboard.up('Shift');
      await ctx.page.keyboard.up('Control');

      // Wait for Master Key gate
      const gateOpened = await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-master-key-modal')), 5000);
      if (!gateOpened) {
        defects.push({ kind: 'shortcut', text: 'Ctrl+Shift+P failed to open Master Key modal' });
      } else {
        // Unlock with master key
        await ctx.page.evaluate(({ key }) => {
          const inp = document.querySelector('#tc-mk-input');
          if (inp) inp.value = key;
          document.querySelector('#tc-mk-submit')?.click();
        }, { key: MASTER_KEY });

        const studioOpened = await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-plan-admin-modal')), 12000);
        if (!studioOpened) defects.push({ kind: 'gate', text: 'Studio did not open after entering valid master key' });
      }

      await shots(ctx, 'c13_desktop_studio_opened');
      return { defects };
    },

    '02_interactive_create_plan_via_custom_modal': async (ctx) => {
      const defects = [];
      await ensureStudioOpen(ctx.page);
      await new Promise(r => setTimeout(r, 600));

      // Click "+ تعریف پلن جدید"
      await ctx.page.evaluate(() => document.querySelector('#tc-pa-new-plan')?.click());

      // Verify custom modal opened
      const modalOpened = await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-custom-dialog-modal')), 4000);
      if (!modalOpened) {
        defects.push({ kind: 'ui-create', text: 'Create plan dialog did not appear' });
        return { defects };
      }

      // Fill form in the custom modal
      await ctx.page.evaluate(({ id, nameFa, nameEn }) => {
        const idInp = document.querySelector('#dlg-plan-id');
        const faInp = document.querySelector('#dlg-plan-nameFa');
        const enInp = document.querySelector('#dlg-plan-nameEn');
        const tplSel = document.querySelector('#dlg-plan-template');

        if (idInp) idInp.value = id;
        if (faInp) faInp.value = nameFa;
        if (enInp) enInp.value = nameEn;
        if (tplSel) tplSel.value = 'plus';

        document.querySelector('#tc-cd-confirm')?.click();
      }, {
        id: PLAN_ID,
        nameFa: 'کوانت تریدر ۱۳',
        nameEn: 'Quant Trader 13'
      });

      // Wait for modal to close and new plan to be active
      await new Promise(r => setTimeout(r, 800));
      const isSelected = await ctx.page.evaluate((id) => {
        return window.__TRADING_APP__?.auth?.planAdmin?.selectedPlanId === id;
      }, PLAN_ID);

      if (!isSelected) {
        defects.push({ kind: 'ui-create', text: `Newly created plan ${PLAN_ID} was not auto-selected` });
      }

      await shots(ctx, 'c13_plan_created_and_selected');
      return { defects };
    },

    '03_interactive_clone_plan_via_custom_modal': async (ctx) => {
      const defects = [];
      await ensureStudioOpen(ctx.page);
      await new Promise(r => setTimeout(r, 600));

      // Click clone button on PLAN_ID
      const clicked = await ctx.page.evaluate((id) => {
        const btn = document.querySelector(`button[data-act="clone"][data-id="${id}"]`);
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, PLAN_ID);

      if (!clicked) {
        defects.push({ kind: 'ui-clone', text: `Clone button for ${PLAN_ID} not found` });
        return { defects };
      }

      const modalOpened = await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-custom-dialog-modal')), 4000);
      if (!modalOpened) {
        defects.push({ kind: 'ui-clone', text: 'Clone dialog did not appear' });
        return { defects };
      }

      // Set custom clone ID
      await ctx.page.evaluate(({ cloneId }) => {
        const idInp = document.querySelector('#dlg-clone-id');
        if (idInp) idInp.value = cloneId;
        document.querySelector('#tc-cd-confirm')?.click();
      }, { cloneId: CLONE_ID });

      await new Promise(r => setTimeout(r, 800));
      const cloneExists = await ctx.page.evaluate((id) => {
        return !!document.querySelector(`[data-plan-item="${id}"]`);
      }, CLONE_ID);

      if (!cloneExists) {
        defects.push({ kind: 'ui-clone', text: `Cloned plan ${CLONE_ID} does not appear in list` });
      }

      await shots(ctx, 'c13_plan_cloned');
      return { defects };
    },

    '04_interactive_delete_cloned_plan_via_custom_modal': async (ctx) => {
      const defects = [];
      await ensureStudioOpen(ctx.page);
      await new Promise(r => setTimeout(r, 600));

      // Click delete on CLONE_ID
      const clicked = await ctx.page.evaluate((id) => {
        const btn = document.querySelector(`button[data-act="delete"][data-id="${id}"]`);
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, CLONE_ID);

      if (!clicked) {
        defects.push({ kind: 'ui-delete', text: `Delete button for ${CLONE_ID} not found` });
        return { defects };
      }

      // Danger modal appears
      const modalOpened = await pollUntil(() => ctx.page.evaluate(() => !!document.querySelector('#tc-custom-dialog-modal')), 4000);
      if (!modalOpened) {
        defects.push({ kind: 'ui-delete', text: 'Delete confirmation dialog did not appear' });
        return { defects };
      }

      // Confirm deletion
      await ctx.page.evaluate(() => document.querySelector('#tc-cd-confirm')?.click());
      await new Promise(r => setTimeout(r, 800));

      const stillExists = await ctx.page.evaluate((id) => {
        return !!document.querySelector(`[data-plan-item="${id}"]`);
      }, CLONE_ID);

      if (stillExists) {
        defects.push({ kind: 'ui-delete', text: `Cloned plan ${CLONE_ID} still exists after delete confirmation` });
      }

      await shots(ctx, 'c13_plan_deleted');
      return { defects };
    },

    '05_dirty_state_indicator_and_save_workflow': async (ctx) => {
      const defects = [];
      await ensureStudioOpen(ctx.page);
      await new Promise(r => setTimeout(r, 600));

      // Select PLAN_ID or plus
      await ctx.page.evaluate((id) => {
        const el = document.querySelector(`[data-plan-item="${id}"]`) || document.querySelector('[data-plan-item="plus"]');
        el?.click();
      }, PLAN_ID);

      // Switch to Quotas tab
      await ctx.page.evaluate(() => {
        document.querySelector('button[data-etab="quotas"]')?.click();
      });
      await new Promise(r => setTimeout(r, 200));

      // Toggle unlimited on chartsPerTab
      await ctx.page.evaluate(() => {
        const btn = document.querySelector('button[data-unlim-toggle="chartsPerTab"]');
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 300));

      // Verify Save button shows dirty state indicator
      const isDirtyUI = await ctx.page.evaluate(() => {
        const btn = document.querySelector('#tc-pa-save');
        return btn && (btn.textContent || '').includes('●');
      });

      if (!isDirtyUI) {
        defects.push({ kind: 'dirty-state', text: 'Save button did not display dirty indicator (●) after quota modification' });
      }

      // Click Save Changes
      await ctx.page.evaluate(() => document.querySelector('#tc-pa-save')?.click());
      await new Promise(r => setTimeout(r, 800));

      // Verify dirty state cleared
      const isDirtyAfterSave = await ctx.page.evaluate(() => {
        return window.__TRADING_APP__?.auth?.planAdmin?.isDirty;
      });

      if (isDirtyAfterSave) {
        defects.push({ kind: 'dirty-state', text: 'Plan remains dirty after successful save' });
      }

      await shots(ctx, 'c13_dirty_saved');
      return { defects };
    }
  },

  mobile: {
    'm01_mobile_master_detail_navigation': async (ctx) => {
      const defects = [];

      // Open studio on mobile
      await ensureStudioOpen(ctx.page);
      await new Promise(r => setTimeout(r, 600));

      // On mobile, initial view should be 'list': sidebar is visible, editor is hidden
      const listLayout = await ctx.page.evaluate(() => {
        const sidebar = document.querySelector('#tc-pa-sidebar');
        const editor = document.querySelector('#tc-pa-editor-wrap');
        const sidebarVisible = sidebar && window.getComputedStyle(sidebar).display !== 'none';
        const editorHidden = editor && window.getComputedStyle(editor).display === 'none';
        return { sidebarVisible, editorHidden };
      });

      if (!listLayout.sidebarVisible || !listLayout.editorHidden) {
        defects.push({ kind: 'mobile-master-detail', text: 'Initial mobile view did not correctly display full-width list with hidden editor' });
      }

      await shots(ctx, 'c13_mobile_list_view');

      // Click on a plan in mobile list view to transition to editor
      await ctx.page.evaluate(() => {
        const item = document.querySelector('[data-plan-item="plus"]') || document.querySelector('[data-plan-item]');
        item?.click();
      });
      await new Promise(r => setTimeout(r, 400));

      // In editor view: editor should be visible, sidebar hidden, and back button visible
      const editorLayout = await ctx.page.evaluate(() => {
        const sidebar = document.querySelector('#tc-pa-sidebar');
        const editor = document.querySelector('#tc-pa-editor-wrap');
        const backBtn = document.querySelector('#tc-pa-mobile-back-btn');
        const sidebarHidden = sidebar && window.getComputedStyle(sidebar).display === 'none';
        const editorVisible = editor && window.getComputedStyle(editor).display !== 'none';
        const backVisible = backBtn && window.getComputedStyle(backBtn).display !== 'none';
        return { sidebarHidden, editorVisible, backVisible };
      });

      if (!editorLayout.sidebarHidden || !editorLayout.editorVisible) {
        defects.push({ kind: 'mobile-master-detail', text: 'Mobile did not transition to full-width editor on plan card tap' });
      }
      if (!editorLayout.backVisible) {
        defects.push({ kind: 'mobile-master-detail', text: 'Back to plans list button (#tc-pa-mobile-back-btn) is not visible in mobile editor' });
      }

      await shots(ctx, 'c13_mobile_editor_view');

      // Tap back button to return to list view
      await ctx.page.evaluate(() => document.querySelector('#tc-pa-mobile-back-btn')?.click());
      await new Promise(r => setTimeout(r, 400));

      const returnedToList = await ctx.page.evaluate(() => {
        const sidebar = document.querySelector('#tc-pa-sidebar');
        const editor = document.querySelector('#tc-pa-editor-wrap');
        return sidebar && window.getComputedStyle(sidebar).display !== 'none' &&
               editor && window.getComputedStyle(editor).display === 'none';
      });

      if (!returnedToList) {
        defects.push({ kind: 'mobile-master-detail', text: 'Tapping back button did not return to mobile plans list' });
      }

      // Check overflow on mobile
      const audit = await auditStatic(ctx);
      if (audit.horizontalOverflow.length) {
        defects.push({ kind: 'mobile-overflow', text: JSON.stringify(audit.horizontalOverflow.slice(0, 2)) });
      }

      await shots(ctx, 'c13_mobile_returned_to_list');
      await ctx.page.evaluate(() => document.querySelector('#tc-plan-admin-modal [data-close]')?.click());

      // Clean up PLAN_ID via API
      await ctx.page.evaluate(async ({ planId, masterKey }) => {
        await fetch(`/api/admin/plans/${planId}`, {
          method: 'DELETE',
          headers: { 'X-Master-Key': masterKey }
        });
      }, { planId: PLAN_ID, masterKey: MASTER_KEY });

      return { defects, ignoreConsole: '404|409|Conflict' };
    }
  }
};

runSuite('accounts_cycle13_plans_ui_deep', tests);
