/** أدوات الواجهة المشتركة */
const UI = {
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  money(n) {
    if (n === '' || n == null) return '—';
    const v = Number(n);
    return isFinite(v) ? v.toLocaleString('ar-EG-u-nu-latn', { maximumFractionDigits: 2 }) : '—';
  },

  qty(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('ar-EG-u-nu-latn');
  },

  /** تاريخ اليوم بتوقيت الجهاز yyyy-mm-dd (قيمة افتراضية فقط — الخادم يتحقق) */
  today() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  },

  date(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleString('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });
  },

  /** توحيد النص للبحث المحلي فقط (التحقق الحقيقي من التكرار في الخادم) */
  norm(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim()
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/[\u064B-\u0652\u0640]/g, '')
      .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632))
      .toLowerCase();
  },

  toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'err' ? ' err' : '');
    el.textContent = msg;
    document.getElementById('toastRoot').appendChild(el);
    setTimeout(() => el.remove(), type === 'err' ? 7000 : 3500);
  },

  busy(btn, on, text) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = text || 'جارٍ الحفظ…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  },

  /** نافذة حوار — لا تُغلق بالضغط خارجها حتى لا تضيع البيانات المكتوبة */
  modal({ title, body, foot, wide }) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `
      <div class="modal${wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-head"><h3 id="modalTitle">${UI.esc(title)}</h3>
          <button type="button" class="modal-x" data-close aria-label="إغلاق">×</button></div>
        <form class="modal-form" novalidate>
          <div class="modal-body">${body}<p class="form-error" data-ref="err" hidden></p></div>
          <div class="modal-foot">${foot}</div>
        </form>
      </div>`;
    const prevFocus = document.activeElement;
    const onKey = e => { if (e.key === 'Escape') close(); };
    function close() {
      back.remove();
      document.removeEventListener('keydown', onKey);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    }
    back.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    document.getElementById('modalRoot').appendChild(back);
    const first = back.querySelector('input:not([type=checkbox]):not([disabled]),select,textarea');
    if (first) first.focus();
    const errEl = back.querySelector('[data-ref=err]');
    return {
      root: back,
      form: back.querySelector('form'),
      close,
      error(msg) { errEl.textContent = msg || ''; errEl.hidden = !msg; }
    };
  },

  confirm(message, okLabel, danger) {
    return new Promise(resolve => {
      let done = false;
      const m = UI.modal({
        title: 'تأكيد',
        body: `<p class="confirm-text">${UI.esc(message)}</p>`,
        foot: `<button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${UI.esc(okLabel || 'تأكيد')}</button>
               <button type="button" class="btn btn-ghost" data-close>إلغاء</button>`
      });
      m.form.addEventListener('submit', e => { e.preventDefault(); done = true; m.close(); resolve(true); });
      const obs = new MutationObserver(() => {
        if (!m.root.isConnected) { obs.disconnect(); if (!done) resolve(false); }
      });
      obs.observe(document.getElementById('modalRoot'), { childList: true });
    });
  }
};
