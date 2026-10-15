/**
 * فواتير البيع
 * #sales          قائمة الفواتير + تصدير Excel للتقرير
 * #sales/new      إصدار فاتورة (معاينة ثم إصدار نهائي — لا مسودات)
 * #sales/<SaleID> عرض الفاتورة + طباعة + PDF + Excel
 * التحقق هنا للراحة فقط — الخادم يعيد التحقق من الرصيد والتكلفة والتسويات داخل الـ Lock.
 */

const SalesPage = {
  mount(page, arg) {
    const root = document.createElement('div');
    page.replaceChildren(root);
    if (!arg) return salesList(root);
    if (arg === 'new') return saleForm(root);
    return saleView(root, arg);
  }
};

/* ================= القائمة والتقرير ================= */

function salesList(root) {
  const st = { rows: [] };
  root.innerHTML = `
    <div class="page-head"><h2>فواتير البيع</h2><div class="head-actions">
      <button class="btn btn-ghost" data-act="xlsx">تصدير Excel</button>
      ${App.can('ISSUE_SALE') ? '<a class="btn btn-primary" href="#sales/new">فاتورة جديدة</a>' : ''}</div></div>
    <div class="toolbar">
      <label class="inline">من <input type="date" class="select" data-f="dateFrom"></label>
      <label class="inline">إلى <input type="date" class="select" data-f="dateTo"></label>
      <button class="btn btn-ghost" data-act="load">عرض</button>
      <input type="search" class="search" placeholder="رقم الفاتورة أو العميل" aria-label="بحث">
      <span class="count" data-ref="count"></span>
    </div>
    <div class="table-wrap" data-ref="table"><div class="loading">جارٍ التحميل…</div></div>`;
  const $ = s => root.querySelector(s);
  let q = '';
  $('.search').addEventListener('input', e => { q = UI.norm(e.target.value); render(); });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && b.dataset.act === 'load') return load();
    if (b && b.dataset.act === 'xlsx') return exportReport();
    const tr = e.target.closest('tr[data-id]');
    if (tr) location.hash = '#sales/' + tr.dataset.id;
  });
  async function load() {
    const p = {}; root.querySelectorAll('[data-f]').forEach(el => { if (el.value) p[el.dataset.f] = el.value; });
    try { st.rows = (await Api.call('sales.list', p)).rows; render(); }
    catch (e) { $('[data-ref=table]').innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`; }
  }
  const filtered = () => st.rows.filter(r => !q || UI.norm(r.InvoiceNo).includes(q) || UI.norm(r.CustomerName).includes(q));
  function render() {
    const list = filtered();
    const sum = k => list.reduce((a, r) => a + r[k], 0);
    $('[data-ref=count]').textContent = `${list.length} فاتورة`;
    if (!list.length) { $('[data-ref=table]').innerHTML = '<div class="empty">لا توجد فواتير.</div>'; return; }
    $('[data-ref=table]').innerHTML = `<table><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>العميل</th><th>مكان الخروج</th>
      <th class="num">الإجمالي</th><th class="num">المدفوع</th><th class="num">المديونية</th><th>المستخدم</th></tr></thead>
      <tbody>${list.map(r => `<tr class="clickable" data-id="${UI.esc(r.SaleID)}"><td class="mono strong">${UI.esc(r.InvoiceNo)}</td>
        <td class="mono">${UI.esc(r.InvoiceDate)}</td><td>${UI.esc(r.CustomerName)}</td><td>${UI.esc(r.LocationName)}</td>
        <td class="num">${UI.money(r.Total)}</td><td class="num">${UI.money(r.PaidAmount)}</td><td class="num${r.DebtAmount ? ' warn' : ''}">${UI.money(r.DebtAmount)}</td>
        <td>${UI.esc(r.CreatedByName)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td></td><td></td><td>الإجمالي</td><td></td><td class="num">${UI.money(sum('Total'))}</td><td class="num">${UI.money(sum('PaidAmount'))}</td><td class="num">${UI.money(sum('DebtAmount'))}</td><td></td></tr></tfoot></table>`;
  }
  function exportReport() {
    const list = filtered();
    if (!list.length) return UI.toast('لا توجد فواتير للتصدير.', 'err');
    const rows = [['رقم الفاتورة', 'التاريخ', 'العميل', 'مكان الخروج', 'الإجمالي', 'المدفوع', 'المديونية', 'المستخدم']]
      .concat(list.map(r => [r.InvoiceNo, r.InvoiceDate, r.CustomerName, r.LocationName, r.Total, r.PaidAmount, r.DebtAmount, r.CreatedByName]));
    XLSX.download(`تقرير-فواتير-البيع-${UI.today()}.xlsx`, [{ name: 'فواتير البيع', rows, boldRows: [0], widths: [16, 12, 24, 16, 12, 12, 12, 16] }]);
  }
  load();
}

/* ================= الفاتورة: عرض + طباعة + PDF + Excel ================= */

function invoiceBody(inv) {
  const h = inv.header;
  return `
  <div class="inv">
    <div class="inv-head">
      <div><div class="inv-shop">${UI.esc(h.ShopName)}</div><div class="inv-sub">فاتورة بيع</div></div>
      <div class="inv-meta">
        <div><span>رقم الفاتورة</span><b>${UI.esc(h.InvoiceNo)}</b></div>
        <div><span>التاريخ</span><b>${UI.esc(h.InvoiceDate)} ${UI.esc(new Date(h.CreatedAt).toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' }))}</b></div>
      </div>
    </div>
    <div class="inv-info">
      <div><span>العميل</span><b>${UI.esc(h.CustomerName)}</b>${h.CustomerPhone ? ` <small>${UI.esc(h.CustomerPhone)}</small>` : ''}</div>
      <div><span>مكان خروج البضاعة</span><b>${UI.esc(h.LocationName)}</b></div>
      <div><span>المستخدم</span><b>${UI.esc(h.CreatedByName)}</b></div>
    </div>
    <table class="inv-table"><thead><tr><th>#</th><th>الكود</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
      <tbody>${inv.lines.map((l, i) => `<tr><td>${i + 1}</td><td class="mono">${UI.esc(l.ItemCode)}</td><td>${UI.esc(l.ItemName)}</td>
        <td>${UI.qty(l.Quantity)}</td><td>${UI.money(l.UnitPrice)}</td><td>${UI.money(l.LineTotal)}</td></tr>`).join('')}</tbody></table>
    <div class="inv-bottom">
      <table class="inv-table inv-settle"><thead><tr><th>طريقة التسوية</th><th>المبلغ</th><th>بيان</th></tr></thead>
        <tbody>${inv.settlements.map(s => `<tr><td>${UI.esc(s.MethodLabel)}</td><td>${UI.money(s.Amount)}</td><td>${UI.esc(s.Reference || '')}</td></tr>`).join('')}</tbody></table>
      <div class="inv-totals">
        <div><span>إجمالي الفاتورة</span><b>${UI.money(h.Total)} ${UI.esc(h.Currency === 'EGP' ? 'جنيه' : h.Currency)}</b></div>
        <div><span>المدفوع</span><b>${UI.money(h.PaidAmount)}</b></div>
        <div class="${h.DebtAmount ? 'inv-debt' : ''}"><span>المتبقي (مديونية)</span><b>${UI.money(h.DebtAmount)}</b></div>
      </div>
    </div>
    ${h.Notes ? `<p class="inv-notes">ملاحظات: ${UI.esc(h.Notes)}</p>` : ''}
  </div>`;
}

/** مستند HTML مستقل للطباعة على A4 — بدون قوائم أو أزرار */
function invoiceDocument(inv) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${UI.esc(inv.header.InvoiceNo)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "IBM Plex Sans Arabic", Tahoma, Arial, sans-serif; color: #111; font-size: 13px; }
    .inv-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
    .inv-shop { font-size: 26px; font-weight: 700; } .inv-sub { font-size: 15px; color: #444; }
    .inv-meta div, .inv-info div, .inv-totals div { display: flex; gap: 8px; } .inv-meta span, .inv-info span, .inv-totals span { color: #555; min-width: 110px; }
    .inv-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px; }
    .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .inv-table th, .inv-table td { border: 1px solid #999; padding: 6px 8px; text-align: right; }
    .inv-table th { background: #eee; } .mono { direction: ltr; unicode-bidi: isolate; }
    .inv-bottom { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; align-items: start; }
    .inv-totals div { justify-content: space-between; border-bottom: 1px solid #ccc; padding: 6px 0; font-size: 15px; }
    .inv-debt b { color: #b00; } .inv-notes { margin-top: 10px; color: #333; }
  </style></head><body>${invoiceBody(inv)}</body></html>`;
}

function printInvoice(inv, forPdf) {
  const w = window.open('', '_blank');
  if (!w) return UI.toast('المتصفح منع نافذة الطباعة — اسمح بالنوافذ المنبثقة لهذا الموقع.', 'err');
  w.document.open(); w.document.write(invoiceDocument(inv)); w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  if (forPdf) UI.toast('في نافذة الطباعة اختر الوجهة "حفظ كـ PDF" (Save as PDF).');
}

function exportInvoiceXlsx(inv) {
  const h = inv.header;
  const rows = [
    [h.ShopName], ['فاتورة بيع'], [],
    ['رقم الفاتورة', h.InvoiceNo], ['التاريخ', h.InvoiceDate], ['العميل', h.CustomerName], ['مكان خروج البضاعة', h.LocationName], ['المستخدم', h.CreatedByName], [],
    ['#', 'الكود', 'الصنف', 'الكمية', 'السعر', 'الإجمالي'],
    ...inv.lines.map((l, i) => [i + 1, l.ItemCode, l.ItemName, l.Quantity, l.UnitPrice, l.LineTotal]),
    [], ['طريقة التسوية', 'المبلغ', 'بيان'],
    ...inv.settlements.map(s => [s.MethodLabel, s.Amount, s.Reference || '']),
    [], ['إجمالي الفاتورة', h.Total], ['المدفوع', h.PaidAmount], ['المتبقي (مديونية)', h.DebtAmount]
  ];
  const headRow = 9, setRow = 9 + inv.lines.length + 2;
  XLSX.download(`${h.InvoiceNo}.xlsx`, [{ name: h.InvoiceNo, rows, boldRows: [0, headRow, setRow], widths: [18, 14, 30, 10, 12, 14] }]);
}

async function saleView(root, id) {
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  let inv;
  try { inv = await Api.call('sales.get', { id }); }
  catch (e) { root.innerHTML = `<div class="empty err">${UI.esc(e.message)}<br><a class="btn btn-ghost" href="#sales">رجوع</a></div>`; return; }
  root.innerHTML = `
    <div class="page-head"><h2>فاتورة <span class="mono">${UI.esc(inv.header.InvoiceNo)}</span> <span class="st st-posted">مصدرة</span></h2>
      <div class="head-actions">
        <button class="btn btn-primary" data-act="print">طباعة</button>
        <button class="btn btn-ghost" data-act="pdf">PDF</button>
        <button class="btn btn-ghost" data-act="xlsx">Excel</button>
        <a class="btn btn-ghost" href="#sales">رجوع</a></div></div>
    <p class="note">الفاتورة المصدرة لا تُعدل ولا تُحذف. أي تصحيح يكون بمستند مرتجع موثق.</p>
    <div class="inv-preview">${invoiceBody(inv)}</div>`;
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'print') printInvoice(inv, false);
    else if (b.dataset.act === 'pdf') printInvoice(inv, true);
    else if (b.dataset.act === 'xlsx') exportInvoiceXlsx(inv);
  });
}

/* ================= إصدار فاتورة ================= */

async function saleForm(root) {
  if (!App.can('ISSUE_SALE')) { root.innerHTML = '<div class="empty err">ليس لديك صلاحية إصدار فواتير.</div>'; return; }
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  let meta;
  try { meta = await Api.call('sales.formData'); } catch (e) { root.innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`; return; }
  const label = i => `${i.ItemCode} — ${i.ItemName}`;
  const byLabel = {}, byId = {};
  meta.items.forEach(i => { byLabel[label(i)] = i; byId[i.ItemID] = i; });
  const custLabel = c => c.IsCash ? `${c.Name} (نقدي)` : `${c.Code} — ${c.Name}`;
  const custByLabel = {}; meta.customers.forEach(c => { custByLabel[custLabel(c)] = c; });
  const st = { lines: [{ ItemID: '', Quantity: '1', UnitPrice: '' }], settle: [{ Method: 'CASH', Amount: '', Reference: '' }], req: Api.newRequestId() };
  const cash = meta.customers.find(c => c.IsCash);

  root.innerHTML = `
    <div class="page-head"><h2>فاتورة بيع جديدة</h2><a class="btn btn-ghost" href="#sales">رجوع</a></div>
    <datalist id="slItems">${meta.items.map(i => `<option value="${UI.esc(label(i))}"></option>`).join('')}</datalist>
    <datalist id="slCust">${meta.customers.map(c => `<option value="${UI.esc(custLabel(c))}"></option>`).join('')}</datalist>
    <div class="doc-form ob-head">
      <label class="field"><span>مكان خروج البضاعة <span class="req">*</span></span><select name="LocationID">${meta.locations.map(l => `<option value="${UI.esc(l.LocationID)}">${UI.esc(l.LocationName)}</option>`).join('')}</select></label>
      <label class="field"><span>العميل <span class="req">*</span></span><input name="Customer" list="slCust" value="${UI.esc(cash ? custLabel(cash) : '')}"></label>
      <label class="field wide3"><span>ملاحظات</span><input name="Notes" maxlength="500"></label>
    </div>
    <div class="table-wrap"><table class="lines"><thead><tr><th style="width:38%">الصنف</th><th class="num">المتاح</th><th class="num" style="width:10%">الكمية</th><th class="num" style="width:13%">السعر</th><th class="num">الإجمالي</th><th></th></tr></thead>
      <tbody data-ref="lines"></tbody><tfoot><tr><td><button type="button" class="btn btn-ghost btn-sm" data-act="addLine">إضافة صنف</button></td><td colspan="3">الإجمالي</td><td class="num strong" data-ref="total"></td><td></td></tr></tfoot></table></div>
    <h4 class="sub-head">التسوية</h4>
    <div class="table-wrap"><table class="lines"><thead><tr><th style="width:20%">الطريقة</th><th class="num" style="width:15%">المبلغ</th><th>بيان (إلزامي للخردة والمرتجع)</th><th></th></tr></thead>
      <tbody data-ref="settle"></tbody><tfoot><tr><td><button type="button" class="btn btn-ghost btn-sm" data-act="addSettle">إضافة طريقة</button></td><td colspan="3" data-ref="remain"></td></tr></tfoot></table></div>
    <p class="form-error" data-ref="err" hidden></p>
    <div class="doc-actions"><button type="button" class="btn btn-primary" data-act="preview">معاينة وإصدار</button></div>`;
  const $ = s => root.querySelector(s);
  const num = v => Number(String(v).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[,٬\s]/g, ''));
  const loc = () => $('[name=LocationID]').value;
  const customer = () => custByLabel[$('[name=Customer]').value.trim()] || null;

  function renderLines() {
    $('[data-ref=lines]').innerHTML = st.lines.map((l, i) => { const it = byId[l.ItemID]; return `
      <tr data-i="${i}"><td><input class="cell" list="slItems" data-k="item" value="${UI.esc(it ? label(it) : (l._t || ''))}" placeholder="اكتب اسم الصنف أو الكود"></td>
        <td class="num" data-ref="avail"></td>
        <td class="num"><input class="cell num-in" data-k="qty" inputmode="numeric" dir="ltr" value="${UI.esc(l.Quantity)}"></td>
        <td class="num"><input class="cell num-in" data-k="price" inputmode="decimal" dir="ltr" value="${UI.esc(l.UnitPrice)}"></td>
        <td class="num" data-ref="lt"></td><td class="actions"><button type="button" class="btn btn-ghost btn-sm" data-act="rmLine">حذف</button></td></tr>
      <tr class="line-msg" data-msg="${i}" hidden><td colspan="6"></td></tr>`; }).join('');
    validate();
  }
  function renderSettle() {
    $('[data-ref=settle]').innerHTML = st.settle.map((s, i) => `<tr data-s="${i}">
      <td><select class="cell" data-k="m">${meta.methods.map(m => `<option value="${m.value}"${m.value === s.Method ? ' selected' : ''}>${UI.esc(m.label)}</option>`).join('')}</select></td>
      <td class="num"><input class="cell num-in" data-k="a" inputmode="decimal" dir="ltr" value="${UI.esc(s.Amount)}"></td>
      <td><input class="cell" data-k="r" maxlength="120" value="${UI.esc(s.Reference)}"></td>
      <td class="actions"><button type="button" class="btn btn-ghost btn-sm" data-act="rmSettle">حذف</button></td></tr>`).join('');
    validate();
  }
  function totals() {
    return Math.round(st.lines.reduce((a, l) => a + (l.ItemID && num(l.Quantity) > 0 && num(l.UnitPrice) > 0 ? num(l.Quantity) * num(l.UnitPrice) : 0), 0) * 100) / 100;
  }
  function validate() {
    let problems = 0; const seen = {};
    st.lines.forEach((l, i) => {
      const tr = $(`tr[data-i="${i}"]`), mr = $(`tr[data-msg="${i}"]`); if (!tr) return;
      const it = byId[l.ItemID], avail = it ? (((meta.balances[it.ItemID] || {})[loc()]) || 0) : null, q = num(l.Quantity), p = num(l.UnitPrice);
      tr.querySelector('[data-ref=avail]').textContent = avail === null ? '—' : UI.qty(avail);
      tr.querySelector('[data-ref=lt]').textContent = it && q > 0 && p > 0 ? UI.money(q * p) : '—';
      let msg = '';
      if (l._t && !it) msg = 'اختر الصنف من القائمة.';
      else if (it && seen[it.ItemID]) msg = 'الصنف مكرر.';
      else if (it && it.CostStatus !== 'KNOWN') msg = 'تكلفة الصنف غير معروفة — لا يمكن بيعه حتى تُحدد التكلفة.';
      else if (it && !(Number(it.SellingPrice) > 0)) msg = 'الصنف ليس له سعر بيع في بيانات الأصناف.';
      else if (it && !(Number.isInteger(q) && q > 0)) msg = 'الكمية عدد صحيح أكبر من صفر.';
      else if (it && q > avail) msg = 'الكمية أكبر من المتاح في مكان الخروج.';
      else if (it && !(p > 0)) msg = 'اكتب سعر البيع.';
      if (it) seen[it.ItemID] = true;
      tr.classList.toggle('bad', !!msg); mr.hidden = !msg; mr.firstElementChild.textContent = msg; if (msg) problems++;
    });
    const total = totals(), paid = st.settle.reduce((a, s) => a + (num(s.Amount) || 0), 0);
    $('[data-ref=total]').textContent = UI.money(total);
    const diff = Math.round((total - paid) * 100) / 100;
    $('[data-ref=remain]').innerHTML = diff === 0 ? '<span class="ok-text">التسويات مطابقة للإجمالي</span>'
      : `<span class="warn">${diff > 0 ? 'متبقي بدون تسوية' : 'التسويات أكبر من الإجمالي بـ'} ${UI.money(Math.abs(diff))}</span>`;
    return { problems, total, diff };
  }
  root.addEventListener('input', e => {
    const tr = e.target.closest('tr[data-i]'), ts = e.target.closest('tr[data-s]');
    if (tr) {
      const l = st.lines[Number(tr.dataset.i)], k = e.target.dataset.k;
      if (k === 'item') { l._t = e.target.value.trim(); const it = byLabel[l._t]; l.ItemID = it ? it.ItemID : '';
        if (it && !l.UnitPrice && Number(it.SellingPrice) > 0) { l.UnitPrice = String(it.SellingPrice); tr.querySelector('[data-k=price]').value = l.UnitPrice; } }
      else if (k === 'qty') l.Quantity = e.target.value.trim(); else if (k === 'price') l.UnitPrice = e.target.value.trim();
    }
    if (ts) { const s = st.settle[Number(ts.dataset.s)], k = e.target.dataset.k;
      if (k === 'a') s.Amount = e.target.value.trim(); else if (k === 'r') s.Reference = e.target.value; }
    validate();
  });
  root.addEventListener('change', e => {
    const ts = e.target.closest('tr[data-s]');
    if (ts && e.target.dataset.k === 'm') st.settle[Number(ts.dataset.s)].Method = e.target.value;
    validate();
  });
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a === 'addLine') { st.lines.push({ ItemID: '', Quantity: '1', UnitPrice: '' }); renderLines(); }
    else if (a === 'rmLine') { st.lines.splice(Number(b.closest('tr').dataset.i), 1); if (!st.lines.length) st.lines.push({ ItemID: '', Quantity: '1', UnitPrice: '' }); renderLines(); }
    else if (a === 'addSettle') { const v = validate(); st.settle.push({ Method: 'DEBT', Amount: v.diff > 0 ? String(v.diff) : '', Reference: '' }); renderSettle(); }
    else if (a === 'rmSettle') { st.settle.splice(Number(b.closest('tr').dataset.s), 1); if (!st.settle.length) st.settle.push({ Method: 'CASH', Amount: '', Reference: '' }); renderSettle(); }
    else if (a === 'preview') preview(b);
  });
  const showErr = m => { const el = $('[data-ref=err]'); el.textContent = m || ''; el.hidden = !m; };

  async function preview(btn) {
    showErr('');
    const v = validate(), c = customer();
    if (!c) return showErr('اختر العميل من القائمة.');
    const lines = st.lines.filter(l => l.ItemID || l._t);
    if (!lines.length) return showErr('أضف صنفًا واحدًا على الأقل.');
    if (v.problems) return showErr('صحّح الأخطاء الموضحة في السطور.');
    if (v.diff !== 0) return showErr('مجموع التسويات يجب أن يساوي إجمالي الفاتورة.');
    const debt = st.settle.filter(s => s.Method === 'DEBT').reduce((a, s) => a + num(s.Amount), 0);
    if (c.IsCash && debt > 0) return showErr('العميل النقدي لا يمكن أن يتبقى عليه مديونية.');
    const locName = meta.locations.find(l => l.LocationID === loc()).LocationName;
    const m = UI.modal({ title: 'معاينة قبل الإصدار', wide: true, body: `
      <div class="doc-grid"><div><span>العميل</span><b>${UI.esc(c.Name)}</b></div><div><span>مكان الخروج</span><b>${UI.esc(locName)}</b></div>
        <div><span>الإجمالي</span><b>${UI.money(v.total)}</b></div></div>
      <div class="table-wrap"><table><thead><tr><th>الصنف</th><th class="num">الكمية</th><th class="num">السعر</th><th class="num">الإجمالي</th></tr></thead>
        <tbody>${lines.map(l => `<tr><td>${UI.esc(label(byId[l.ItemID]))}</td><td class="num">${UI.qty(num(l.Quantity))}</td><td class="num">${UI.money(num(l.UnitPrice))}</td><td class="num">${UI.money(num(l.Quantity) * num(l.UnitPrice))}</td></tr>`).join('')}</tbody></table></div>
      <h4 class="sub-head">التسوية</h4><p>${st.settle.map(s => `${UI.esc(meta.methods.find(x => x.value === s.Method).label)}: <b>${UI.money(num(s.Amount))}</b>${s.Reference ? ` (${UI.esc(s.Reference)})` : ''}`).join(' · ')}</p>
      <p class="notice">بعد الإصدار لا يمكن تعديل الفاتورة أو حذفها.</p>`,
      foot: '<button type="submit" class="btn btn-primary">إصدار الفاتورة</button><button type="button" class="btn btn-ghost" data-close>رجوع</button>' });
    m.form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const sb = m.form.querySelector('[type=submit]'); UI.busy(sb, true, 'جارٍ الإصدار…');
      try {
        const r = await Api.call('sales.issue', { LocationID: loc(), CustomerID: c.CustomerID, Notes: $('[name=Notes]').value.trim(),
          lines: lines.map(l => ({ ItemID: l.ItemID, Quantity: l.Quantity, UnitPrice: l.UnitPrice })),
          settlements: st.settle.map(s => ({ Method: s.Method, Amount: s.Amount, Reference: s.Reference })) }, { requestId: st.req });
        m.close(); UI.toast(`تم إصدار ${r.header.InvoiceNo}.`); location.hash = '#sales/' + r.header.SaleID;
      } catch (x) { UI.busy(sb, false); m.error(x.message); }
    });
  }
  renderLines(); renderSettle();
}
