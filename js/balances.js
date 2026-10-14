/**
 * Phase 3 — أرصدة العملاء والموردين (للقراءة فقط)
 * طلب واحد (balances.parties). الرصيد محسوب في الخادم من PartyLedger فقط.
 * حاليًا لا يوجد في السجل إلا أرصدة أول المدة؛ المبيعات والمشتريات والتسويات تُضاف في مراحلها.
 */
const BalancesPage = {
  async mount(page) {
    const root = document.createElement('div');
    page.replaceChildren(root);
    const st = { data: null, tab: 'customers', q: '', nonZero: false };
    root.innerHTML = `
      <div class="page-head"><h2>أرصدة العملاء والموردين</h2><button class="btn btn-ghost" data-act="refresh">تحديث</button></div>
      <div class="tabs"><button type="button" data-tab="customers" class="on">العملاء (مستحق لنا)</button><button type="button" data-tab="suppliers">الموردين (مستحق علينا)</button></div>
      <div class="toolbar">
        <input type="search" class="search" placeholder="ابحث بالاسم أو الكود" aria-label="بحث">
        <label class="check"><input type="checkbox" data-ref="nz"> له رصيد فقط</label>
        <span class="count" data-ref="count"></span>
      </div>
      <div class="table-wrap" data-ref="table"><div class="loading">جارٍ التحميل…</div></div>`;
    const $ = s => root.querySelector(s);
    let t;
    $('.search').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { st.q = UI.norm(e.target.value); render(); }, 150); });
    $('[data-ref=nz]').addEventListener('change', e => { st.nonZero = e.target.checked; render(); });
    root.addEventListener('click', e => {
      const tb = e.target.closest('[data-tab]');
      if (tb) { st.tab = tb.dataset.tab; root.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b === tb)); render(); }
      if (e.target.closest('[data-act=refresh]')) load();
    });

    async function load() {
      const btn = $('[data-act=refresh]');
      UI.busy(btn, true, 'جارٍ التحديث…');
      try { st.data = await Api.call('balances.parties'); render(); }
      catch (e) { $('[data-ref=table]').innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`; }
      UI.busy(btn, false);
    }

    function render() {
      if (!st.data) return;
      const d = st.data[st.tab];
      const list = d.rows.filter(r => (!st.nonZero || r.Balance !== 0) && (!st.q || UI.norm(r.Name).includes(st.q) || UI.norm(r.Code).includes(st.q)));
      $('[data-ref=count]').textContent = `${list.length} من ${d.rows.length}`;
      if (!list.length) { $('[data-ref=table]').innerHTML = '<div class="empty">لا توجد بيانات مطابقة.</div>'; return; }
      $('[data-ref=table]').innerHTML = `<table>
        <thead><tr><th>الكود</th><th>الاسم</th><th class="num">رصيد أول المدة</th><th class="num">الرصيد الحالي</th></tr></thead>
        <tbody>${list.map(r => `<tr class="${r.Active ? '' : 'inactive'}"><td class="mono">${UI.esc(r.Code)}</td><td>${UI.esc(r.Name)}</td>
          <td class="num">${UI.money(r.Opening)}</td><td class="num strong${r.Balance ? '' : ' zero'}">${UI.money(r.Balance)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td></td><td>الإجمالي</td><td></td><td class="num">${UI.money(d.total)}</td></tr></tfoot></table>`;
    }
    load();
  }
};
