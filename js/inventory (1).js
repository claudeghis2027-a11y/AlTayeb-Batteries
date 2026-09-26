/**
 * Phase 2 — المخزون (للقراءة فقط — لا يوجد أي تعديل يدوي للرصيد)
 * #inventory  : الرصيد لكل صنف في الأماكن الأربعة — طلب واحد (inventory.summary)، البحث والفلترة محليًا
 * #movements  : سجل حركة المخزون — طلب عند الضغط على "بحث" فقط
 */

const InventoryPage = {
  mount(page) {
    const root = document.createElement('div');
    page.replaceChildren(root);
    const st = { data: null, q: '', stock: 'all', loc: '' };

    root.innerHTML = `
      <div class="page-head">
        <h2>المخزون</h2>
        <div class="head-actions">
          <a class="btn btn-ghost" href="#movements">حركة المخزون</a>
          <button class="btn btn-ghost" data-act="refresh">تحديث</button>
        </div>
      </div>
      <div class="toolbar">
        <input type="search" class="search" placeholder="ابحث باسم الصنف أو الكود" aria-label="بحث">
        <select class="select" data-ref="loc" aria-label="المكان"><option value="">كل الأماكن</option></select>
        <div class="seg" role="group" aria-label="الرصيد">
          <button type="button" data-stock="all" class="on">الكل</button>
          <button type="button" data-stock="has">له رصيد</button>
          <button type="button" data-stock="zero">رصيد صفر</button>
        </div>
        <span class="count" data-ref="count"></span>
      </div>
      <div class="table-wrap" data-ref="table"><div class="loading">جارٍ التحميل…</div></div>`;

    const $ = s => root.querySelector(s);
    let t;
    $('.search').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { st.q = UI.norm(e.target.value); render(); }, 150); });
    $('[data-ref=loc]').addEventListener('change', e => { st.loc = e.target.value; render(); });
    root.addEventListener('click', e => {
      const s = e.target.closest('[data-stock]');
      if (s) { st.stock = s.dataset.stock; root.querySelectorAll('[data-stock]').forEach(b => b.classList.toggle('on', b === s)); render(); return; }
      if (e.target.closest('[data-act=refresh]')) { load(); return; }
      const tr = e.target.closest('tr[data-item]');
      if (tr) openItemStock(tr.dataset.item);
    });
    root.addEventListener('keydown', e => {
      const tr = e.target.closest('tr[data-item]');
      if (tr && e.key === 'Enter') openItemStock(tr.dataset.item);
    });

    async function load() {
      const btn = $('[data-act=refresh]');
      UI.busy(btn, true, 'جارٍ التحديث…');
      try {
        st.data = await Api.call('inventory.summary');
        $('[data-ref=loc]').innerHTML = '<option value="">كل الأماكن</option>' +
          st.data.locations.map(l => `<option value="${UI.esc(l.LocationID)}">${UI.esc(l.LocationName)}</option>`).join('');
        $('[data-ref=loc]').value = st.loc;
        render();
      } catch (e) {
        $('[data-ref=table]').innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`;
      }
      UI.busy(btn, false);
    }

    function render() {
      const d = st.data;
      if (!d) return;
      const qtyOf = r => (st.loc ? r.qty[st.loc] : r.total) || 0;
      const list = d.rows.filter(r =>
        (st.stock !== 'has' || qtyOf(r) !== 0) && (st.stock !== 'zero' || qtyOf(r) === 0) &&
        (!st.q || UI.norm(r.ItemName).includes(st.q) || UI.norm(r.ItemCode).includes(st.q)));
      $('[data-ref=count]').textContent = `${list.length} صنف`;
      if (!list.length) { $('[data-ref=table]').innerHTML = '<div class="empty">لا توجد أصناف مطابقة.</div>'; return; }
      const hl = id => (id === st.loc ? ' hl' : '');
      $('[data-ref=table]').innerHTML = `<table class="inv">
        <thead><tr><th>الكود</th><th>الصنف</th>${d.locations.map(l => `<th class="num${hl(l.LocationID)}">${UI.esc(l.LocationName)}</th>`).join('')}<th class="num">الإجمالي</th></tr></thead>
        <tbody>${list.map(r => `
          <tr class="clickable${r.Active ? '' : ' inactive'}" data-item="${UI.esc(r.ItemID)}" tabindex="0">
            <td class="mono">${UI.esc(r.ItemCode)}</td><td>${UI.esc(r.ItemName)}</td>
            ${d.locations.map(l => `<td class="num${hl(l.LocationID)}${r.qty[l.LocationID] ? '' : ' zero'}">${UI.qty(r.qty[l.LocationID])}</td>`).join('')}
            <td class="num strong${r.total ? '' : ' zero'}">${UI.qty(r.total)}</td>
          </tr>`).join('')}</tbody>
        <tfoot><tr><td></td><td>الإجمالي</td>${d.locations.map(l => `<td class="num${hl(l.LocationID)}">${UI.qty(d.totals[l.LocationID])}</td>`).join('')}<td class="num">${UI.qty(d.grandTotal)}</td></tr></tfoot>
      </table>`;
    }

    load();
  }
};

function movementsTable(rows, withItem) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>التاريخ والوقت</th><th>الحركة</th>${withItem ? '<th>الصنف</th>' : ''}<th>من</th><th>إلى</th><th class="num">الكمية</th><th>المرجع</th><th>المستخدم</th></tr></thead>
    <tbody>${rows.map(m => `<tr>
      <td class="nowrap">${UI.esc(UI.date(m.Timestamp))}</td>
      <td>${UI.esc(m.MovementTypeLabel)}</td>
      ${withItem ? `<td>${UI.esc(m.ItemName)} <small class="muted mono">${UI.esc(m.ItemCode)}</small></td>` : ''}
      <td>${UI.esc(m.FromName || '—')}</td>
      <td>${UI.esc(m.ToName || '—')}</td>
      <td class="num">${UI.qty(m.Quantity)}</td>
      <td class="mono">${m.ReferenceType === 'TRANSFER' ? `<a href="#transfers/${UI.esc(m.ReferenceID)}" data-close>${UI.esc(m.ReferenceNo)}</a>` : UI.esc(m.ReferenceNo || '—')}</td>
      <td>${UI.esc(m.UserName)}</td></tr>`).join('')}</tbody></table></div>`;
}

/** تفاصيل صنف — طلب واحد (inventory.stock). للعرض فقط. */
async function openItemStock(itemId) {
  const m = UI.modal({ title: 'رصيد الصنف', wide: true, body: '<div class="loading" data-ref="ld">جارٍ التحميل…</div>',
    foot: '<button type="button" class="btn btn-ghost" data-close>إغلاق</button>' });
  let d;
  try { d = await Api.call('inventory.stock', { itemId }); }
  catch (e) { const ld = m.root.querySelector('[data-ref=ld]'); if (ld) ld.remove(); m.error(e.message); return; }
  if (!m.root.isConnected) return;
  m.root.querySelector('#modalTitle').textContent = d.item.ItemName;
  const body = m.root.querySelector('.modal-body');
  const err = body.querySelector('[data-ref=err]');
  body.innerHTML = `
    <p class="muted">الكود: <span class="mono">${UI.esc(d.item.ItemCode)}</span></p>
    <div class="stats stats-5">${d.locations.map(l => `<div class="stat"><span>${UI.esc(l.LocationName)}</span><b>${UI.qty(d.qty[l.LocationID])}</b></div>`).join('')}
      <div class="stat stat-total"><span>الإجمالي</span><b>${UI.qty(d.total)}</b></div></div>
    <h4 class="sub-head">حركة الصنف</h4>
    ${d.movements.length ? movementsTable(d.movements, false) : '<div class="empty">لا توجد حركات لهذا الصنف.</div>'}`;
  body.appendChild(err);
}

/** سجل حركة المخزون — للقراءة فقط، بدون أي زر حذف */
const MovementsPage = {
  mount(page) {
    const root = document.createElement('div');
    page.replaceChildren(root);
    const st = { rows: [], q: '' };
    root.innerHTML = `
      <div class="page-head"><h2>حركة المخزون</h2><a class="btn btn-ghost" href="#inventory">رجوع للمخزون</a></div>
      <div class="filters">
        <label>من تاريخ<input type="date" data-f="dateFrom"></label>
        <label>إلى تاريخ<input type="date" data-f="dateTo"></label>
        <label>المكان<select data-f="locationId"><option value="">الكل</option></select></label>
        <label>نوع الحركة<select data-f="movementType"><option value="">الكل</option></select></label>
        <label>رقم المرجع<input data-f="reference" dir="ltr" placeholder="TR-"></label>
        <label>&nbsp;<button class="btn btn-primary" data-act="search">بحث</button></label>
      </div>
      <div class="toolbar">
        <input type="search" class="search" data-ref="q" placeholder="تصفية النتائج باسم الصنف أو الكود" aria-label="الصنف">
        <span class="count" data-ref="count"></span>
      </div>
      <div class="table-wrap" data-ref="table"><div class="loading">جارٍ التحميل…</div></div>`;
    const $ = s => root.querySelector(s);
    let t;
    $('[data-ref=q]').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { st.q = UI.norm(e.target.value); render(); }, 150); });
    $('[data-act=search]').addEventListener('click', () => load());
    $('[data-f=reference]').addEventListener('keydown', e => { if (e.key === 'Enter') load(); });

    let firstLoad = true;
    async function load() {
      const btn = $('[data-act=search]');
      const p = {};
      root.querySelectorAll('[data-f]').forEach(el => { if (el.value.trim()) p[el.dataset.f] = el.value.trim(); });
      UI.busy(btn, true, 'جارٍ البحث…');
      try {
        const d = await Api.call('inventory.movements', p);
        st.rows = d.rows; st.truncated = d.truncated; st.limit = d.limit;
        if (firstLoad) {
          $('[data-f=locationId]').innerHTML = '<option value="">الكل</option>' + d.locations.map(l => `<option value="${UI.esc(l.LocationID)}">${UI.esc(l.LocationName)}</option>`).join('');
          $('[data-f=movementType]').innerHTML = '<option value="">الكل</option>' + d.movementTypes.map(x => `<option value="${UI.esc(x.value)}">${UI.esc(x.label)}</option>`).join('');
          firstLoad = false;
        }
        render();
      } catch (e) { $('[data-ref=table]').innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`; }
      UI.busy(btn, false);
    }

    function render() {
      const list = st.rows.filter(m => !st.q || UI.norm(m.ItemName).includes(st.q) || UI.norm(m.ItemCode).includes(st.q));
      $('[data-ref=count]').textContent = `${list.length} حركة` + (st.truncated ? ` (أحدث ${st.limit} فقط — ضيّق الفلتر)` : '');
      $('[data-ref=table]').innerHTML = list.length ? movementsTable(list, true).replace(/^<div class="table-wrap">|<\/div>$/g, '') : '<div class="empty">لا توجد حركات مطابقة.</div>';
    }

    load();
  }
};
