/**
 * فواتير الشراء
 * #purchases         القائمة
 * #purchases/new     تسجيل فاتورة (معاينة ثم تسجيل نهائي)
 * #purchases/<ID>    عرض
 */
const PurchasesPage = {
  mount(page, arg) {
    const root = document.createElement('div');
    page.replaceChildren(root);
    if (!arg) return purchasesList(root);
    if (arg === 'new') return purchaseForm(root);
    return purchaseView(root, arg);
  }
};

async function purchasesList(root) {
  root.innerHTML = `<div class="page-head"><h2>فواتير الشراء</h2>
    ${App.can('POST_PURCHASE') ? '<a class="btn btn-primary" href="#purchases/new">فاتورة شراء جديدة</a>' : ''}</div>
    <div class="table-wrap" data-ref="table"><div class="loading">جارٍ التحميل…</div></div>`;
  const box = root.querySelector('[data-ref=table]');
  let d;
  try { d = await Api.call('purchases.list'); } catch (e) { box.innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`; return; }
  if (!d.rows.length) { box.innerHTML = '<div class="empty">لا توجد فواتير شراء.</div>'; return; }
  box.innerHTML = `<table><thead><tr><th>الرقم</th><th>التاريخ</th><th>المورد</th><th>رقم فاتورة المورد</th><th class="num">الإجمالي</th><th class="num">المدفوع</th><th class="num">المديونية</th><th>المستخدم</th></tr></thead>
    <tbody>${d.rows.map(r => `<tr class="clickable" data-id="${UI.esc(r.PurchaseID)}"><td class="mono strong">${UI.esc(r.PurchaseNo)}</td><td class="mono">${UI.esc(r.PurchaseDate)}</td>
      <td>${UI.esc(r.SupplierName)}</td><td class="mono">${UI.esc(r.SupplierInvoiceNo || '—')}</td><td class="num">${UI.money(r.Total)}</td>
      <td class="num">${UI.money(r.PaidAmount)}</td><td class="num${r.DebtAmount ? ' warn' : ''}">${UI.money(r.DebtAmount)}</td><td>${UI.esc(r.CreatedByName)}</td></tr>`).join('')}</tbody></table>`;
  box.addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = '#purchases/' + tr.dataset.id; });
}

async function purchaseView(root, id) {
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  let p;
  try { p = await Api.call('purchases.get', { id }); } catch (e) { root.innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`; return; }
  const h = p.header;
  root.innerHTML = `<div class="page-head"><h2>فاتورة شراء <span class="mono">${UI.esc(h.PurchaseNo)}</span> <span class="st st-posted">مسجلة</span></h2><a class="btn btn-ghost" href="#purchases">رجوع</a></div>
    <p class="note">الفاتورة المسجلة لا تُعدل ولا تُحذف. أي تصحيح يكون بمستند مرتجع موثق.</p>
    <div class="doc-grid"><div><span>المورد</span><b>${UI.esc(h.SupplierName)}</b></div><div><span>التاريخ</span><b class="mono">${UI.esc(h.PurchaseDate)}</b></div>
      <div><span>رقم فاتورة المورد</span><b class="mono">${UI.esc(h.SupplierInvoiceNo || '—')}</b></div><div><span>المستخدم</span><b>${UI.esc(h.CreatedByName)}</b></div>
      <div><span>الإجمالي</span><b>${UI.money(h.Total)}</b></div><div><span>المديونية</span><b class="${h.DebtAmount ? 'warn' : ''}">${UI.money(h.DebtAmount)}</b></div></div>
    <div class="table-wrap"><table><thead><tr><th>الكود</th><th>الصنف</th><th>مكان الاستلام</th><th class="num">الكمية</th><th class="num">سعر الشراء</th><th class="num">الإجمالي</th></tr></thead>
      <tbody>${p.lines.map(l => `<tr><td class="mono">${UI.esc(l.ItemCode)}</td><td>${UI.esc(l.ItemName)}</td><td>${UI.esc(l.LocationName)}</td><td class="num">${UI.qty(l.Quantity)}</td><td class="num">${UI.money(l.UnitPrice)}</td><td class="num">${UI.money(l.LineTotal)}</td></tr>`).join('')}</tbody></table></div>
    <h4 class="sub-head">السداد</h4><p>${p.settlements.map(s => `${UI.esc(s.MethodLabel)}: <b>${UI.money(s.Amount)}</b>`).join(' · ')}</p>`;
}

async function purchaseForm(root) {
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  let meta;
  try { meta = await Api.call('purchases.formData'); } catch (e) { root.innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`; return; }
  const label = i => `${i.ItemCode} — ${i.ItemName}`, supLabel = s => `${s.Code} — ${s.Name}`;
  const byLabel = {}, byId = {}, supBy = {};
  meta.items.forEach(i => { byLabel[label(i)] = i; byId[i.ItemID] = i; });
  meta.suppliers.forEach(s => { supBy[supLabel(s)] = s; });
  const st = { lines: [{ ItemID: '', LocationID: (meta.locations[0] || {}).LocationID, Quantity: '', UnitPrice: '' }], settle: [{ Method: 'CASH', Amount: '' }], req: Api.newRequestId() };
  root.innerHTML = `<div class="page-head"><h2>فاتورة شراء جديدة</h2><a class="btn btn-ghost" href="#purchases">رجوع</a></div>
    <datalist id="puItems">${meta.items.map(i => `<option value="${UI.esc(label(i))}"></option>`).join('')}</datalist>
    <datalist id="puSup">${meta.suppliers.map(s => `<option value="${UI.esc(supLabel(s))}"></option>`).join('')}</datalist>
    <div class="doc-form">
      <label class="field"><span>المورد <span class="req">*</span></span><input name="Supplier" list="puSup"></label>
      <label class="field"><span>التاريخ</span><input type="date" name="PurchaseDate" value="${UI.today()}"></label>
      <label class="field"><span>رقم فاتورة المورد</span><input name="SupplierInvoiceNo" dir="ltr" maxlength="60"></label>
      <label class="field wide"><span>ملاحظات</span><input name="Notes" maxlength="500"></label></div>
    <div class="table-wrap"><table class="lines"><thead><tr><th style="width:36%">الصنف</th><th style="width:16%">مكان الاستلام</th><th class="num">الكمية</th><th class="num">سعر الشراء</th><th class="num">الإجمالي</th><th></th></tr></thead>
      <tbody data-ref="lines"></tbody><tfoot><tr><td><button type="button" class="btn btn-ghost btn-sm" data-act="addLine">إضافة صنف</button></td><td colspan="3">الإجمالي</td><td class="num strong" data-ref="total"></td><td></td></tr></tfoot></table></div>
    <h4 class="sub-head">السداد</h4>
    <div class="table-wrap"><table class="lines"><thead><tr><th style="width:25%">الطريقة</th><th class="num" style="width:20%">المبلغ</th><th></th></tr></thead>
      <tbody data-ref="settle"></tbody><tfoot><tr><td><button type="button" class="btn btn-ghost btn-sm" data-act="addSettle">إضافة طريقة</button></td><td colspan="2" data-ref="remain"></td></tr></tfoot></table></div>
    <p class="hint-line">السداد بالخردة أو المرتجعات يُفعل مع وحداتها. الباقي بدون سداد = "مديونية" للمورد.</p>
    <p class="form-error" data-ref="err" hidden></p>
    <div class="doc-actions"><button type="button" class="btn btn-primary" data-act="save">معاينة وتسجيل</button></div>`;
  const $ = s => root.querySelector(s);
  const num = v => Number(String(v).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[,٬\s]/g, ''));
  function renderLines() {
    $('[data-ref=lines]').innerHTML = st.lines.map((l, i) => `<tr data-i="${i}">
      <td><input class="cell" list="puItems" data-k="item" value="${UI.esc(byId[l.ItemID] ? label(byId[l.ItemID]) : (l._t || ''))}"></td>
      <td><select class="cell" data-k="loc">${meta.locations.map(x => `<option value="${UI.esc(x.LocationID)}"${x.LocationID === l.LocationID ? ' selected' : ''}>${UI.esc(x.LocationName)}</option>`).join('')}</select></td>
      <td class="num"><input class="cell num-in" data-k="qty" inputmode="numeric" dir="ltr" value="${UI.esc(l.Quantity)}"></td>
      <td class="num"><input class="cell num-in" data-k="price" inputmode="decimal" dir="ltr" value="${UI.esc(l.UnitPrice)}"></td>
      <td class="num" data-ref="lt"></td><td class="actions"><button type="button" class="btn btn-ghost btn-sm" data-act="rmLine">حذف</button></td></tr>`).join('');
    calc();
  }
  function renderSettle() {
    $('[data-ref=settle]').innerHTML = st.settle.map((s, i) => `<tr data-s="${i}"><td><select class="cell" data-k="m">${meta.methods.map(m => `<option value="${m.value}"${m.value === s.Method ? ' selected' : ''}>${UI.esc(m.label)}</option>`).join('')}</select></td>
      <td class="num"><input class="cell num-in" data-k="a" inputmode="decimal" dir="ltr" value="${UI.esc(s.Amount)}"></td>
      <td class="actions"><button type="button" class="btn btn-ghost btn-sm" data-act="rmSettle">حذف</button></td></tr>`).join('');
    calc();
  }
  function calc() {
    let total = 0;
    st.lines.forEach((l, i) => { const v = l.ItemID && num(l.Quantity) > 0 && num(l.UnitPrice) > 0 ? num(l.Quantity) * num(l.UnitPrice) : 0; total += v;
      const c = $(`tr[data-i="${i}"] [data-ref=lt]`); if (c) c.textContent = v ? UI.money(v) : '—'; });
    total = Math.round(total * 100) / 100;
    const diff = Math.round((total - st.settle.reduce((a, s) => a + (num(s.Amount) || 0), 0)) * 100) / 100;
    $('[data-ref=total]').textContent = UI.money(total);
    $('[data-ref=remain]').innerHTML = diff === 0 ? '<span class="ok-text">السداد مطابق للإجمالي</span>' : `<span class="warn">الفرق ${UI.money(diff)}</span>`;
    return { total, diff };
  }
  root.addEventListener('input', e => {
    const tr = e.target.closest('tr[data-i]'), ts = e.target.closest('tr[data-s]'), k = e.target.dataset.k;
    if (tr) { const l = st.lines[Number(tr.dataset.i)];
      if (k === 'item') { l._t = e.target.value.trim(); l.ItemID = byLabel[l._t] ? byLabel[l._t].ItemID : ''; } else if (k === 'qty') l.Quantity = e.target.value.trim(); else if (k === 'price') l.UnitPrice = e.target.value.trim(); }
    if (ts && k === 'a') st.settle[Number(ts.dataset.s)].Amount = e.target.value.trim();
    calc();
  });
  root.addEventListener('change', e => {
    const tr = e.target.closest('tr[data-i]'), ts = e.target.closest('tr[data-s]');
    if (tr && e.target.dataset.k === 'loc') st.lines[Number(tr.dataset.i)].LocationID = e.target.value;
    if (ts && e.target.dataset.k === 'm') st.settle[Number(ts.dataset.s)].Method = e.target.value;
  });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a === 'addLine') { st.lines.push({ ItemID: '', LocationID: st.lines[st.lines.length - 1].LocationID, Quantity: '', UnitPrice: '' }); renderLines(); }
    else if (a === 'rmLine') { st.lines.splice(Number(b.closest('tr').dataset.i), 1); if (!st.lines.length) st.lines.push({ ItemID: '', LocationID: meta.locations[0].LocationID, Quantity: '', UnitPrice: '' }); renderLines(); }
    else if (a === 'addSettle') { const c = calc(); st.settle.push({ Method: 'DEBT', Amount: c.diff > 0 ? String(c.diff) : '' }); renderSettle(); }
    else if (a === 'rmSettle') { st.settle.splice(Number(b.closest('tr').dataset.s), 1); if (!st.settle.length) st.settle.push({ Method: 'CASH', Amount: '' }); renderSettle(); }
    else if (a === 'save') save(b);
  });
  const showErr = m => { const el = $('[data-ref=err]'); el.textContent = m || ''; el.hidden = !m; };
  async function save(btn) {
    showErr('');
    const sup = supBy[$('[name=Supplier]').value.trim()];
    if (!sup) return showErr('اختر المورد من القائمة.');
    const lines = st.lines.filter(l => l.ItemID || l._t);
    if (!lines.length || lines.some(l => !l.ItemID)) return showErr('اختر الأصناف من القائمة.');
    const c = calc();
    if (c.diff !== 0) return showErr('مجموع السداد يجب أن يساوي إجمالي الفاتورة (استخدم "مديونية" للباقي).');
    if (!await UI.confirm(`تسجيل فاتورة شراء من "${sup.Name}" بإجمالي ${UI.money(c.total)}؟ سيزيد المخزون ويتحدث متوسط التكلفة، ولا يمكن تعديلها بعد ذلك.`, 'تسجيل الفاتورة')) return;
    UI.busy(btn, true, 'جارٍ التسجيل…');
    try {
      const r = await Api.call('purchases.post', { SupplierID: sup.SupplierID, PurchaseDate: $('[name=PurchaseDate]').value, SupplierInvoiceNo: $('[name=SupplierInvoiceNo]').value.trim(),
        Notes: $('[name=Notes]').value.trim(), lines: lines.map(l => ({ ItemID: l.ItemID, LocationID: l.LocationID, Quantity: l.Quantity, UnitPrice: l.UnitPrice })),
        settlements: st.settle.map(s => ({ Method: s.Method, Amount: s.Amount })) }, { requestId: st.req });
      UI.toast(`تم تسجيل ${r.header.PurchaseNo}.`); location.hash = '#purchases/' + r.header.PurchaseID;
    } catch (x) { UI.busy(btn, false); showErr(x.message); }
  }
  renderLines(); renderSettle();
}
