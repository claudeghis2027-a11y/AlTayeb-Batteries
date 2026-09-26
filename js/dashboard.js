/** الرئيسية — طلب واحد (dashboard.summary) */
const DashboardPage = {
  async mount(root) {
    root.innerHTML = `<div class="welcome"><h2>أهلًا، ${UI.esc(App.user.displayName)}</h2>
      <div data-ref="body"><div class="loading">جارٍ التحميل…</div></div></div>`;
    const body = root.querySelector('[data-ref=body]');
    let d;
    try { d = await Api.call('dashboard.summary'); }
    catch (e) { body.innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`; return; }

    const cards = [
      ['items', 'الأصناف', 'صنف'], ['customers', 'العملاء', 'عميل'],
      ['suppliers', 'الموردين', 'مورد'], ['employees', 'الموظفين', 'موظف']
    ].filter(c => d.counts[c[0]]).map(c => `
      <a class="stat" href="#${c[0]}"><span>${c[1]}</span><b>${d.counts[c[0]].active}</b><small>${c[2]} نشط</small></a>`).join('');

    const noPrice = d.counts.itemsWithoutPrice
      ? `<p class="notice">${d.counts.itemsWithoutPrice} صنف نشط بدون سعر بيع. حدّد الأسعار من شاشة الأصناف.</p>` : '';

    // Phase 2: أرصدة المخزون (محسوبة في الخادم من حركات المخزون)
    const stock = d.stock ? `
      <h3 class="sub-head">البطاريات في المخزون</h3>
      <div class="stats stats-5">${d.stock.locations.map(l => `
        <a class="stat" href="#inventory"><span>${UI.esc(l.LocationName)}</span><b>${UI.esc(UI.qty(d.stock.totals[l.LocationID]))}</b><small>بطارية</small></a>`).join('')}
        <a class="stat stat-total" href="#inventory"><span>إجمالي المخزون</span><b>${UI.esc(UI.qty(d.stock.grandTotal))}</b><small>بطارية</small></a>
      </div>` : '';

    body.innerHTML = (cards ? `<div class="stats">${cards}</div>` : (stock ? '' : '<p class="muted">لا توجد بيانات متاحة لصلاحياتك الحالية.</p>')) + noPrice + stock;
  }
};
