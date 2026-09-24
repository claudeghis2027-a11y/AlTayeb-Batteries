/** الإعدادات — تعديل الإعدادات المسموح بها فقط (الخادم يرفض غيرها) */
const SettingsPage = {
  async mount(root) {
    root.innerHTML = `<div class="page-head"><h2>الإعدادات</h2></div>
      <div class="table-wrap" data-ref="box"><div class="loading">جارٍ التحميل…</div></div>`;
    const box = root.querySelector('[data-ref=box]');
    let rows;
    try { rows = (await Api.call('settings.list')).rows; }
    catch (e) { box.innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`; return; }

    const render = () => {
      box.innerHTML = `<table>
        <thead><tr><th>الإعداد</th><th>القيمة</th><th>آخر تعديل</th><th></th></tr></thead>
        <tbody>${rows.map(r => `<tr data-key="${UI.esc(r.SettingKey)}">
          <td>${UI.esc(r.Description)}<br><small class="muted mono">${UI.esc(r.SettingKey)}</small></td>
          <td>${r.Editable
            ? `<input class="cell" value="${UI.esc(r.SettingValue)}" ${r.Type === 'money' ? 'inputmode="decimal" dir="ltr"' : ''} maxlength="120">`
            : `<span class="mono">${UI.esc(r.SettingValue)}</span> <small class="muted">(ثابت)</small>`}</td>
          <td><small class="muted">${UI.esc(UI.date(r.UpdatedAt))}</small></td>
          <td class="actions">${r.Editable ? '<button class="btn btn-primary btn-sm" data-act="save">حفظ</button>' : ''}</td>
        </tr>`).join('')}</tbody></table>`;
    };
    render();

    box.addEventListener('click', async e => {
      const btn = e.target.closest('[data-act=save]');
      if (!btn) return;
      const tr = btn.closest('tr');
      UI.busy(btn, true, '…');
      try {
        rows = (await Api.call('settings.save', { key: tr.dataset.key, value: tr.querySelector('input').value.trim() },
          { requestId: Api.newRequestId() })).rows;
        render();
        UI.toast('تم حفظ الإعداد.');
      } catch (x) { UI.busy(btn, false); UI.toast(x.message, 'err'); }
    });
  }
};
