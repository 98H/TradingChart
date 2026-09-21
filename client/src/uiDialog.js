// client/src/uiDialog.js
// Institutional Bespoke Dialog Helper — Eliminates native window.prompt() and window.confirm()
// 100% Dark Glassmorphism, Bilingual (FA/EN), Keyboard Accessible (Enter/Esc)

import { getLanguage } from './i18n.js';

export function showPromptDialog({
  title,
  message,
  defaultValue = '',
  placeholder = '',
  confirmText,
  cancelText,
  onConfirm
}) {
  const isFa = getLanguage() === 'fa';
  let overlay = document.querySelector('#custom-ui-dialog-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'custom-ui-dialog-overlay';
  overlay.className = 'modal-overlay open custom-dialog-overlay';
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); z-index: 99999; display: flex; align-items: center; justify-content: center;';

  overlay.innerHTML = `
    <div class="modal-box custom-dialog-box" style="max-width: 440px; width: 92vw; background: #0c1017; border: 1px solid #1f293d; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.85); overflow: hidden; display: flex; flex-direction: column; ${isFa ? 'direction: rtl; text-align: right; font-family: var(--font-vazirmatn), sans-serif;' : 'direction: ltr; text-align: left;'}">
      <div style="padding: 14px 18px; background: #080b11; border-bottom: 1px solid #1c263c; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 700; font-size: 13px; color: #fff;">${title || (isFa ? 'ورود اطلاعات' : 'Input Required')}</span>
        <button id="btn-dialog-close" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); color: var(--text-dim); cursor: pointer; width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">✕</button>
      </div>
      <div style="padding: 18px; display: flex; flex-direction: column; gap: 12px;">
        ${message ? `<div style="font-size: 12px; color: #cbd5e1; line-height: 1.5;">${message}</div>` : ''}
        <input type="text" id="dialog-prompt-input" value="${defaultValue.replace(/"/g, '&quot;')}" placeholder="${placeholder}" style="width: 100%; box-sizing: border-box; padding: 8px 12px; font-size: 13px; background: var(--bg-surface); border: 1px solid var(--accent-cyan); border-radius: 6px; color: #fff; outline: none; box-shadow: 0 0 10px rgba(0,242,176,0.15);" />
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px;">
          <button id="btn-dialog-cancel" class="btn-secondary" style="padding: 6px 14px; font-size: 12px; cursor: pointer;">${cancelText || (isFa ? 'انصراف' : 'Cancel')}</button>
          <button id="btn-dialog-confirm" class="btn-primary" style="padding: 6px 18px; font-size: 12px; cursor: pointer;">${confirmText || (isFa ? 'تایید' : 'Confirm')}</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const input = overlay.querySelector('#dialog-prompt-input');
  setTimeout(() => {
    input?.focus();
    input?.select();
  }, 50);

  const cleanup = () => overlay.remove();

  overlay.querySelector('#btn-dialog-close')?.addEventListener('click', cleanup);
  overlay.querySelector('#btn-dialog-cancel')?.addEventListener('click', cleanup);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });

  const confirmAction = () => {
    const val = input?.value.trim();
    if (val !== undefined && val !== null) {
      cleanup();
      if (onConfirm) onConfirm(val);
    }
  };

  overlay.querySelector('#btn-dialog-confirm')?.addEventListener('click', confirmAction);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmAction(); }
    if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
  });
}

export function showConfirmDialog({
  title,
  message,
  confirmText,
  cancelText,
  danger = false,
  onConfirm
}) {
  const isFa = getLanguage() === 'fa';
  let overlay = document.querySelector('#custom-ui-dialog-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'custom-ui-dialog-overlay';
  overlay.className = 'modal-overlay open custom-dialog-overlay';
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); z-index: 99999; display: flex; align-items: center; justify-content: center;';

  overlay.innerHTML = `
    <div class="modal-box custom-dialog-box" style="max-width: 440px; width: 92vw; background: #0c1017; border: 1px solid ${danger ? 'rgba(239, 68, 68, 0.4)' : '#1f293d'}; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.85); overflow: hidden; display: flex; flex-direction: column; ${isFa ? 'direction: rtl; text-align: right; font-family: var(--font-vazirmatn), sans-serif;' : 'direction: ltr; text-align: left;'}">
      <div style="padding: 14px 18px; background: #080b11; border-bottom: 1px solid #1c263c; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 700; font-size: 13px; color: ${danger ? '#f87171' : '#fff'}; display: flex; align-items: center; gap: 6px;">
          ${danger ? '⚠️' : 'ℹ️'} ${title || (isFa ? 'تایید عملیات' : 'Confirm Action')}
        </span>
        <button id="btn-dialog-close" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); color: var(--text-dim); cursor: pointer; width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">✕</button>
      </div>
      <div style="padding: 18px; display: flex; flex-direction: column; gap: 14px;">
        <div style="font-size: 12px; color: #cbd5e1; line-height: 1.6;">${message}</div>
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px;">
          <button id="btn-dialog-cancel" class="btn-secondary" style="padding: 6px 14px; font-size: 12px; cursor: pointer;">${cancelText || (isFa ? 'انصراف' : 'Cancel')}</button>
          <button id="btn-dialog-confirm" class="${danger ? 'btn-danger' : 'btn-primary'}" style="padding: 6px 18px; font-size: 12px; cursor: pointer; ${danger ? 'background: #ef4444; border-color: #dc2626; color: #fff;' : ''}">${confirmText || (isFa ? 'تایید' : 'Confirm')}</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const cleanup = () => overlay.remove();

  overlay.querySelector('#btn-dialog-close')?.addEventListener('click', cleanup);
  overlay.querySelector('#btn-dialog-cancel')?.addEventListener('click', cleanup);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });

  overlay.querySelector('#btn-dialog-confirm')?.addEventListener('click', () => {
    cleanup();
    if (onConfirm) onConfirm();
  });

  const handleKey = (e) => {
    if (e.key === 'Escape') { cleanup(); window.removeEventListener('keydown', handleKey); }
  };
  window.addEventListener('keydown', handleKey);
}
