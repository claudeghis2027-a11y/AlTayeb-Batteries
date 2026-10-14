/**
 * تسوية أرصدة أول المدة (OA) + تحديد التكلفة المجهولة (CR)
 * #adjust/new/<OpeningID>   تسوية جديدة على عملية معتمدة
 * #adjust/<AdjustmentID>    مسودة (تعديل) أو معتمدة/ملغاة (قراءة فقط)
 * #costs                    الكميات مجهولة التكلفة + تحديدها
 * التحقق هنا للراحة فقط — الخادم يعيد التحقق ويفحص الرصيد طازجًا داخل الـ Lock.
 */

const DIR_LABEL = { INCREASE: 'زيادة', DECREASE: 'نقص' };
const TYPE_LABEL = { STOCK: 'مخزون', CUSTOMER: 'عميل', SUPPLIER: 'مورد' };

const AdjustPage = {
  mount(page, arg) {
    const root = document.createElement('div');
    page.replaceChildren(root);
    const parts = (arg || '').split('/');
    return parts[0] === 'new' ? adjustScreen(root, null, parts[1]) : adjustScreen(root, parts[0], null);
  }
};

async function adjustScreen(root, id, openingId) {
  const canManage = App.can('MANAGE_OPENING');
  root.innerHTML = '<div class="loading">جارٍ التحميل…</div>';
  if (!id && !canManage) { root.innerHTML = '<div class="empty err">ليس لديك صلاحية إنشاء تسوية.</div>'; return; }
  let meta = null, adj = null;
  try {
    if (canManage) { meta = await Api.call('adjust.formData', id ? { id } : { openingId }); adj = meta.adjustment; }
    else adj = await Api.call('adjust.get', { id });
  } catch (e) { root.innerHTML = `<div class="empty err">${UI.esc(e.message)}<br><a class="btn btn-ghost" href="#opening">رجوع</a></div>`; return; }
  if (adj && (adj.header.Status !== 'DRAFT' || !canManage)) return renderAdjustView(root, adj);
  renderAdjustEditor(root, meta);
}

function adjLinesTable(lines) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>النوع</th><th>البند</th><th>الاتجاه</th><th class="num">الكمية / المبلغ</th><th>ملاحظات</th></tr></thead>
    <tbody>${lines.map(l => `<tr><td>${TYPE_LABEL[l.LineType]}</td><td>${UI.esc(l.Label)}</td>
      <td>${l.Direction === 'DECREASE' ? '<span class="warn">نقص</span>' : 'زيادة'}</td>
      <td class="num">${l.LineType === 'STOCK' ? UI.qty(l.Quantity) : UI.money(l.Amount)}</td><td>${UI.esc(l.Notes || '')}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderAdjustView(host, a) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const h = a.header;
  const canPost = h.Status === 'DRAFT' && App.can('POST_OPENING');
  root.innerHTML = `
    <div class="page-head"><h2>تسوية أرصدة أول المدة <span class="mono">${UI.esc(h.AdjustmentNo)}</span> ${obChip(h.Status)}</h2>
      <a class="btn btn-ghost" href="#opening/${UI.esc(h.OpeningID)}">رجوع للعملية ${UI.esc(h.OpeningNo)}</a></div>
    <p class="note">${h.Status === 'POSTED' ? 'معتمدة — أُنشئت حركات وقيود جديدة، والعملية الأصلية لم تتغير.' : h.Status === 'CANCELLED' ? 'ملغاة — بدون أي أثر.' : 'مسودة — بدون أي أثر.'}</p>
    <div class="doc-grid">
      <div><span>العملية الأصلية</span><b class="mono">${UI.esc(h.OpeningNo)}</b></div>
      <div><span>تاريخ التسوية</span><b class="mono">${UI.esc(h.AdjustmentDate)}</b></div>
      <div><span>أنشأها</span><b>${UI.esc(h.CreatedByName)}</b> <small class="muted">${UI.esc(UI.date(h.CreatedAt))}</small></div>
      ${h.PostedAt ? `<div><span>اعتمدها</span><b>${UI.esc(h.PostedByName)}</b> <small class="muted">${UI.esc(UI.date(h.PostedAt))}</small></div>` : ''}
      <div class="wide"><span>السبب</span><b>${UI.esc(h.Reason)}</b></div>
    </div>
    ${adjLinesTable(a.lines)}
    <p class="form-error" data-ref="err" hidden></p>
    ${canPost ? '<div class="doc-actions"><button class="btn btn-primary" data-act="post">اعتماد التسوية</button></div>' : ''}`;
  const btn = root.querySelector('[data-act=post]');
  if (btn) btn.addEventListener('click', async () => {
    const r = await postAdjustmentUI(a, btn, root.querySelector('[data-ref=err]'));
    if (r) renderAdjustView(host, r);
  });
}

async function postAdjustmentUI(a, btn, errEl) {
  if (!await UI.confirm(`اعتماد التسوية ${a.header.AdjustmentNo} على ${a.header.OpeningNo}؟ ستُنشأ حركات وقيود جديدة ولا يمكن تعديلها بعد ذلك.`, 'اعتماد التسوية')) return null;
  UI.busy(btn, true, 'جارٍ الاعتماد…');
  try {
    const r = await Api.call('adjust.post', { id: a.header.AdjustmentID }, { requestId: 'post-' + a.header.AdjustmentID });
    UI.toast(`تم اعتماد ${r.header.AdjustmentNo}.`); return r;
  } catch (e) { if (errEl) { errEl.textContent = e.message; errEl.hidden = false; } return null; }
  finally { if (btn.isConnected) UI.busy(btn, false); }
}

function renderAdjustEditor(host, meta, errMsg) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const a = meta.adjustment, h = a ? a.header : null;
  const chosen = {};
  if (a) a.lines.forEach(l => { chosen[l.SourceLineID] = { Direction: l.Direction, Value: String(l.LineType === 'STOCK' ? l.Quantity : l.Amount), Notes: l.Notes || '' }; });
  const all = meta.stockLines.map(l => Object.assign({ LineType: 'STOCK' }, l)).concat(meta.partyLines);
  const st = { saveReq: Api.newRequestId(), id: h ? h.AdjustmentID : '' };

  root.innerHTML = `
    <div class="page-head"><h2>${h ? `تسوية <span class="mono">${UI.esc(h.AdjustmentNo)}</span> ${obChip('DRAFT')}` : 'تسوية أرصدة أول المدة'} — على <span class="mono">${UI.esc(meta.opening.OpeningNo)}</span></h2>
      <a class="btn btn-ghost" href="#opening/${UI.esc(meta.opening.OpeningID)}">رجوع للعملية</a></div>
    <p class="note">العملية الأصلية لا تُعدل. اختر السطر واتجاه التصحيح؛ النقص لا يتجاوز المتبقي من السطر ولا الرصيد الحالي. تكلفة المخزون = تكلفة السطر الأصلي.</p>
    <div class="doc-form ob-head">
      <label class="field"><span>تاريخ التسوية <span class="req">*</span></span><input type="date" name="AdjustmentDate" value="${UI.esc(h ? h.AdjustmentDate : UI.today())}"></label>
      <label class="field wide3"><span>السبب <span class="req">*</span></span><input name="Reason" maxlength="500" value="${UI.esc(h ? h.Reason : '')}" placeholder="إلزامي — مثال: خطأ في عد المخزن يوم الجرد"></label>
    </div>
    <div class="table-wrap"><table class="lines">
      <thead><tr><th>النوع</th><th>البند</th><th class="num">الأصل</th><th class="num">المتبقي</th><th class="num">الرصيد الحالي</th><th style="width:12%">التصحيح</th><th class="num" style="width:12%">الكمية / المبلغ</th><th>ملاحظات</th></tr></thead>
      <tbody>${all.map((l, i) => { const c = chosen[l.SourceLineID] || { Direction: '', Value: '', Notes: '' }; return `
        <tr data-i="${i}"><td>${TYPE_LABEL[l.LineType]}</td><td>${UI.esc(l.Label)}${l.LineType === 'STOCK' && l.UnitCost === '' ? ' <small class="warn">تكلفة مجهولة</small>' : ''}</td>
          <td class="num">${l.LineType === 'STOCK' ? UI.qty(l.OriginalQty) : UI.money(l.OriginalAmount)}</td>
          <td class="num">${l.LineType === 'STOCK' ? UI.qty(l.RemainingQty) : UI.money(l.RemainingAmount)}</td>
          <td class="num">${l.LineType === 'STOCK' ? UI.qty(l.CurrentStock) : '—'}</td>
          <td><select class="cell" data-k="dir"><option value="">—</option><option value="INCREASE"${c.Direction === 'INCREASE' ? ' selected' : ''}>زيادة</option><option value="DECREASE"${c.Direction === 'DECREASE' ? ' selected' : ''}>نقص</option></select></td>
          <td class="num"><input class="cell num-in" data-k="val" inputmode="decimal" dir="ltr" value="${UI.esc(c.Value)}"></td>
          <td><input class="cell" data-k="notes" maxlength="200" value="${UI.esc(c.Notes)}"></td></tr>
        <tr class="line-msg" data-msg="${i}" hidden><td colspan="8"></td></tr>`; }).join('')}</tbody></table></div>
    <p class="form-error" data-ref="err" hidden></p>
    <div class="doc-actions">
      <button type="button" class="btn btn-blue" data-act="save">حفظ مسودة</button>
      ${App.can('POST_OPENING') ? '<button type="button" class="btn btn-primary" data-act="post">حفظ واعتماد</button>' : ''}
      ${h ? '<button type="button" class="btn btn-danger" data-act="cancel">إلغاء المسودة</button>' : ''}
    </div>`;
  const $ = s => root.querySelector(s);
  const num = v => String(v).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[,٬\s]/g, '');

  function collect() {
    let problems = 0;
    const lines = [];
    all.forEach((l, i) => {
      const tr = $(`tr[data-i="${i}"]`), mr = $(`tr[data-msg="${i}"]`);
      const dir = tr.querySelector('[data-k=dir]').value, raw = tr.querySelector('[data-k=val]').value.trim();
      let msg = '';
      if (dir || raw) {
        const v = Number(num(raw));
        if (!dir) msg = 'اختر زيادة أو نقص.';
        else if (l.LineType === 'STOCK' && !(/^\d+$/.test(num(raw)) && v > 0)) msg = 'الكمية عدد صحيح أكبر من صفر.';
        else if (l.LineType !== 'STOCK' && !(/^\d+(\.\d+)?$/.test(num(raw)) && v > 0)) msg = 'المبلغ أكبر من صفر.';
        else if (dir === 'DECREASE' && l.LineType === 'STOCK' && v > l.RemainingQty) msg = 'النقص أكبر من المتبقي من السطر الأصلي.';
        else if (dir === 'DECREASE' && l.LineType === 'STOCK' && v > l.CurrentStock) msg = 'النقص أكبر من الرصيد الحالي في المكان.';
        else if (dir === 'DECREASE' && l.LineType !== 'STOCK' && v > l.RemainingAmount) msg = 'النقص أكبر من المتبقي — الأرصدة العكسية غير مدعومة.';
        if (!msg) lines.push({ LineType: l.LineType, SourceLineID: l.SourceLineID, Direction: dir,
          Quantity: l.LineType === 'STOCK' ? raw : '', Amount: l.LineType === 'STOCK' ? '' : raw, Notes: tr.querySelector('[data-k=notes]').value });
      }
      tr.classList.toggle('bad', !!msg); mr.hidden = !msg; mr.firstElementChild.textContent = msg;
      if (msg) problems++;
    });
    return { problems, lines };
  }
  root.addEventListener('input', collect);
  root.addEventListener('change', collect);
  const showErr = m => { const el = $('[data-ref=err]'); el.textContent = m || ''; el.hidden = !m; };
  const lock = on => root.querySelectorAll('.doc-actions .btn').forEach(x => { x.disabled = on; });

  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    showErr('');
    if (b.dataset.act === 'cancel') {
      if (!await UI.confirm(`إلغاء المسودة ${h.AdjustmentNo}؟`, 'إلغاء المسودة', true)) return;
      lock(true);
      try { renderAdjustView(host, await Api.call('adjust.cancel', { id: st.id }, { requestId: 'cancel-' + st.id })); UI.toast('تم الإلغاء.'); }
      catch (x) { lock(false); showErr(x.message); }
      return;
    }
    const reason = $('[name=Reason]').value.trim();
    if (!reason) return showErr('سبب التسوية إلزامي.');
    const c = collect();
    if (c.problems) return showErr('صحّح الأخطاء الموضحة في السطور.');
    if (!c.lines.length) return showErr('اختر سطرًا واحدًا على الأقل للتصحيح.');
    lock(true); UI.busy(b, true, 'جارٍ الحفظ…');
    try {
      const payload = { AdjustmentID: st.id, OpeningID: meta.opening.OpeningID, AdjustmentDate: $('[name=AdjustmentDate]').value, Reason: reason, lines: c.lines };
      const saved = await Api.call(st.id ? 'adjust.updateDraft' : 'adjust.saveDraft', payload, { requestId: st.saveReq });
      st.saveReq = Api.newRequestId();
      if (!st.id) history.replaceState(null, '', '#adjust/' + saved.header.AdjustmentID);
      st.id = saved.header.AdjustmentID;
      UI.toast(`تم حفظ المسودة ${saved.header.AdjustmentNo}.`);
      if (b.dataset.act === 'post') {
        const posted = await postAdjustmentUI(saved, b, null);
        if (posted) return renderAdjustView(host, posted);
      }
      renderAdjustEditor(host, await Api.call('adjust.formData', { id: st.id }));
    } catch (x) { lock(false); UI.busy(b, false); showErr(x.message); }
  });
  collect();
  if (errMsg) showErr(errMsg);
}

/* ================= تحديد التكلفة المجهولة (CR) ================= */

const CostsPage = {
  async mount(page) {
    const root = document.createElement('div');
    page.replaceChildren(root);
    root.innerHTML = `
      <div class="page-head"><h2>تكاليف غير معروفة</h2><a class="btn btn-ghost" href="#opening">رجوع</a></div>
      <p class="note">كميات رصيد افتتاحي بدون تكلفة. الصنف يبقى "تكلفة غير معروفة" وربحه غير مكتمل حتى تُحدد تكلفة كل كمياته.
        التحديد يُنشئ مستند CR مرتبطًا بالسطر الأصلي — السطر الأصلي لا يتغير، والربح المصحح يظهر في فترة البيع الأصلية مع رقم وتاريخ المستند.</p>
      <div class="table-wrap" data-ref="table"><div class="loading">جارٍ التحميل…</div></div>`;
    const box = root.querySelector('[data-ref=table]');
    async function load() {
      let d;
      try { d = await Api.call('costs.unknownList'); } catch (e) { box.innerHTML = `<div class="empty err">${UI.esc(e.message)}</div>`; return; }
      if (!d.rows.length) { box.innerHTML = '<div class="empty">لا توجد كميات بتكلفة غير معروفة.</div>'; return; }
      box.innerHTML = `<table class="lines"><thead><tr><th>الصنف</th><th>المكان</th><th>العملية</th><th class="num">الكمية المتبقية</th>
        <th class="num" style="width:13%">التكلفة للقطعة</th><th style="width:28%">السبب / المصدر</th><th></th></tr></thead>
        <tbody>${d.rows.map(r => `<tr data-id="${UI.esc(r.CostEntryID)}"><td>${UI.esc(r.ItemName)} <small class="muted mono">${UI.esc(r.ItemCode)}</small></td>
          <td>${UI.esc(r.LocationName)}</td><td class="mono">${UI.esc(r.OpeningNo)}</td><td class="num">${UI.qty(r.RemainingQty)}</td>
          <td><input class="cell num-in" data-k="cost" inputmode="decimal" dir="ltr"></td><td><input class="cell" data-k="reason" maxlength="500" placeholder="إلزامي"></td>
          <td class="actions"><button class="btn btn-primary btn-sm" data-act="resolve">تحديد</button></td></tr>`).join('')}</tbody></table>`;
    }
    box.addEventListener('click', async e => {
      const b = e.target.closest('[data-act=resolve]'); if (!b) return;
      const tr = b.closest('tr'), cost = tr.querySelector('[data-k=cost]').value.trim(), reason = tr.querySelector('[data-k=reason]').value.trim();
      if (!cost || !reason) return UI.toast('اكتب التكلفة والسبب.', 'err');
      if (!await UI.confirm(`تحديد تكلفة القطعة بـ ${cost} جنيه؟ لا يمكن تغييرها بعد ذلك، وسيُعاد حساب متوسط تكلفة الصنف.`, 'تحديد التكلفة')) return;
      UI.busy(b, true, '…');
      try {
        const r = await Api.call('costs.resolve', { costEntryId: tr.dataset.id, unitCost: cost, reason }, { requestId: 'resolve-' + tr.dataset.id });
        UI.toast(`تم ${r.ResolutionNo} — حالة الصنف: ${r.CostStatus === 'KNOWN' ? 'تكلفة معروفة' : 'ما زال به كمية مجهولة'}.`);
        load();
      } catch (x) { UI.busy(b, false); UI.toast(x.message, 'err'); }
    });
    load();
  }
};
