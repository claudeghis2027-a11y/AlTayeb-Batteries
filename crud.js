/**
 * صفحة بيانات أساسية عامة: بحث + فلتر الحالة + جدول + ترقيم + إضافة/تعديل + تفعيل/إيقاف.
 * - طلب واحد لتحميل القائمة عند فتح الصفحة، والبحث والترقيم محليًا.
 * - بعد الحفظ يرجع الخادم السجل المحفوظ فيتحدث الجدول بدون إعادة تحميل.
 * - التحقق هنا للراحة فقط — الخادم يعيد التحقق من كل شيء.
 */
function createCrudPage(cfg) {
  const st = { rows: [], meta: {}, q: '', status: 'active', page: 1 };
  let root = null;
  const canManage = () => App.can(cfg.managePerm);
  const idOf = r => String(r[cfg.idField]);

  async function mount(container) {
    // حاوية جديدة لكل فتح للصفحة حتى لا تتراكم الـ event listeners على #page
    root = document.createElement('div');
    container.replaceChildren(root);
    root.innerHTML = `
      <div class="page-head">
        <h2>${UI.esc(cfg.title)}</h2>
        ${canManage() ? `<button class="btn btn-primary" data-act="add">${UI.esc(cfg.addLabel)}</button>` : ''}
      </div>
      <div class="toolbar">
        <input type="search" class="search" placeholder="${UI.esc(cfg.searchPlaceholder)}" aria-label="بحث">
        <div class="seg" role="group" aria-label="الحالة">
          <button type="button" data-status="active" class="on">نشط</button>
          <button type="button" data-status="inactive">موقوف</button>
          <button type="button" data-status="all">الكل</button>
        </div>
        <span class="count" data-ref="count"></span>
      </div>
      <div class="table-wrap" data-ref="table"><div class="loading">جارٍ التحميل…</div></div>
      <div class="pager" data-ref="pager"></div>`;

    let t;
    root.querySelector('.search').addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => { st.q = UI.norm(e.target.value); st.page = 1; render(); }, 150);
    });
    root.addEventListener('click', onClick);
    await load();
  }

  async function load() {
    const box = root.querySelector('[data-ref=table]');
    box.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
    try {
      const d = await Api.call(cfg.listAction);
      st.rows = d.rows || [];
      st.meta = d.meta || {};
      render();
    } catch (e) {
      box.innerHTML = `<div class="empty err">${UI.esc(e.message)}<br>
        <button class="btn btn-ghost" data-act="reload">إعادة التحميل</button></div>`;
    }
  }

  function filtered() {
    return st.rows.filter(r => {
      if (st.status === 'active' && !r.Active) return false;
      if (st.status === 'inactive' && r.Active) return false;
      return !st.q || cfg.searchKeys.some(k => UI.norm(r[k]).includes(st.q));
    });
  }

  function render() {
    const list = filtered();
    const size = APP_CONFIG.PAGE_SIZE;
    const pages = Math.max(1, Math.ceil(list.length / size));
    if (st.page > pages) st.page = pages;
    const slice = list.slice((st.page - 1) * size, st.page * size);
    root.querySelector('[data-ref=count]').textContent = `${list.length} من ${st.rows.length}`;
    const box = root.querySelector('[data-ref=table]');

    if (!st.rows.length) {
      box.innerHTML = `<div class="empty">لا توجد بيانات بعد.${canManage() ? ` استخدم زر "${UI.esc(cfg.addLabel)}".` : ''}</div>`;
    } else if (!list.length) {
      box.innerHTML = '<div class="empty">لا توجد نتائج مطابقة.</div>';
    } else {
      const head = cfg.columns.map(c => `<th class="${c.cls || ''}">${UI.esc(c.label)}</th>`).join('') +
        '<th>الحالة</th>' + (canManage() ? '<th></th>' : '');
      const body = slice.map(r => `
        <tr class="${r.Active ? '' : 'inactive'}">
          ${cfg.columns.map(c => `<td class="${c.cls || ''}">${c.render ? c.render(r, st.meta) : UI.esc(r[c.key])}</td>`).join('')}
          <td><span class="status ${r.Active ? '' : 'off'}">${r.Active ? 'نشط' : 'موقوف'}</span></td>
          ${canManage() ? `<td class="actions">${rowActions(r)}</td>` : ''}
        </tr>`).join('');
      box.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    }
    root.querySelector('[data-ref=pager]').innerHTML = pages > 1
      ? Array.from({ length: pages }, (_, i) =>
          `<button type="button" data-act="page" data-page="${i + 1}" class="${i + 1 === st.page ? 'on' : ''}">${i + 1}</button>`).join('')
      : '';
  }

  function rowActions(r) {
    const id = UI.esc(idOf(r));
    let html = `<button class="btn btn-ghost btn-sm" data-act="edit" data-id="${id}">تعديل</button>`;
    (cfg.extraActions || []).forEach(a => {
      html += ` <button class="btn btn-ghost btn-sm" data-act="x-${a.act}" data-id="${id}">${UI.esc(a.label)}</button>`;
    });
    if (!cfg.isProtected || !cfg.isProtected(r)) {
      html += r.Active
        ? ` <button class="btn btn-danger btn-sm" data-act="toggle" data-id="${id}">إيقاف</button>`
        : ` <button class="btn btn-ghost btn-sm" data-act="toggle" data-id="${id}">تفعيل</button>`;
    }
    return html;
  }

  function onClick(e) {
    const s = e.target.closest('[data-status]');
    if (s) {
      st.status = s.dataset.status; st.page = 1;
      root.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b === s));
      render();
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const row = b.dataset.id ? st.rows.find(r => idOf(r) === b.dataset.id) : null;
    if (act === 'add') openForm(null);
    else if (act === 'edit' && row) openForm(row);
    else if (act === 'toggle' && row) toggle(row, b);
    else if (act === 'reload') load();
    else if (act === 'page') { st.page = Number(b.dataset.page); render(); }
    else if (act.startsWith('x-') && row) {
      const a = cfg.extraActions.find(x => 'x-' + x.act === act);
      if (a) a.run(row);
    }
  }

  function upsert(rec) {
    const i = st.rows.findIndex(r => idOf(r) === idOf(rec));
    if (i >= 0) st.rows[i] = rec; else st.rows.unshift(rec);
    render();
  }

  function fieldHtml(f, val) {
    const id = 'f_' + f.key;
    const star = f.required ? ' <span class="req">*</span>' : '';
    const hint = f.hint ? `<small class="hint">${UI.esc(f.hint)}</small>` : '';
    const v = val == null ? '' : val;
    let input;
    switch (f.type) {
      case 'readonly':
        input = `<div class="ro">${UI.esc(f.display ? f.display(v) : (v === '' ? '—' : v))}</div>`;
        break;
      case 'select':
        input = `<select id="${id}" name="${f.key}">${f.options.map(o =>
          `<option value="${UI.esc(o.value)}"${String(o.value) === String(v) ? ' selected' : ''}>${UI.esc(o.label)}</option>`).join('')}</select>`;
        break;
      case 'checks': {
        const set = new Set(Array.isArray(v) ? v : []);
        return `<div class="field" data-key="${f.key}"${f.hidden ? ' hidden' : ''}><span>${UI.esc(f.label)}</span><div class="checks">${f.options.map(o =>
          `<label><input type="checkbox" name="${f.key}" value="${UI.esc(o.value)}"${set.has(o.value) ? ' checked' : ''}> ${UI.esc(o.label)}</label>`).join('')}</div>${hint}</div>`;
      }
      default:
        input = `<input id="${id}" name="${f.key}" type="${f.type === 'password' ? 'password' : 'text'}"
          ${f.numeric ? 'inputmode="decimal" dir="ltr"' : ''} ${f.ltr ? 'dir="ltr"' : ''}
          maxlength="${f.max || 120}" value="${UI.esc(v)}" autocomplete="off">`;
    }
    return `<label class="field" for="${id}"><span>${UI.esc(f.label)}${star}</span>${input}${hint}</label>`;
  }

  function openForm(row) {
    const fields = cfg.form(st.meta, row);
    const requestId = Api.newRequestId(); // نفس المعرف لو ضغط حفظ مرة ثانية بعد انقطاع — الخادم لا يكرر
    const m = UI.modal({
      title: row ? cfg.editTitle : cfg.addLabel,
      body: fields.map(f => fieldHtml(f, row ? row[f.key] : f.default)).join(''),
      foot: `<button type="submit" class="btn btn-primary">${row ? 'حفظ التعديل' : 'حفظ'}</button>
             <button type="button" class="btn btn-ghost" data-close>إلغاء</button>`
    });
    if (cfg.onFormMount) cfg.onFormMount(m.form);

    m.form.addEventListener('submit', async e => {
      e.preventDefault();
      const payload = {};
      if (row) payload[cfg.idField] = idOf(row);
      for (const f of fields) {
        if (f.type === 'readonly') { if (f.send && row) payload[f.key] = row[f.key]; continue; }
        if (f.type === 'checks') {
          payload[f.key] = [...m.form.querySelectorAll(`input[name="${f.key}"]:checked`)].map(i => i.value);
          continue;
        }
        const el = m.form.elements[f.key];
        const val = el ? el.value.trim() : '';
        if (f.required && !val) { m.error(`اكتب ${f.label}.`); if (el) el.focus(); return; }
        payload[f.key] = val;
      }
      const btn = m.form.querySelector('[type=submit]');
      UI.busy(btn, true);
      m.error('');
      try {
        const saved = await Api.call(cfg.saveAction, payload, { requestId });
        upsert(saved);
        m.close();
        UI.toast(row ? 'تم حفظ التعديل.' : 'تمت الإضافة.');
      } catch (err) {
        UI.busy(btn, false);
        m.error(err.message);
      }
    });
  }

  async function toggle(row, btn) {
    const activate = !row.Active;
    const name = row[cfg.nameField];
    const ok = await UI.confirm(
      activate ? `تفعيل "${name}"؟` : `إيقاف "${name}"؟ تبقى بياناته محفوظة ويمكن تفعيله لاحقًا.`,
      activate ? 'تفعيل' : 'إيقاف', !activate);
    if (!ok) return;
    UI.busy(btn, true, '…');
    try {
      upsert(await Api.call(cfg.setActiveAction, { id: idOf(row), active: activate }));
      UI.toast(activate ? 'تم التفعيل.' : 'تم الإيقاف.');
    } catch (err) {
      UI.busy(btn, false);
      UI.toast(err.message, 'err');
    }
  }

  return { mount };
}
