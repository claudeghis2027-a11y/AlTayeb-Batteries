/** العملاء — العميل النقدي محمي (لا إيقاف ولا تغيير اسم) */
const CustomersPage = () => createCrudPage({
  title: 'العملاء', addLabel: 'إضافة عميل', editTitle: 'تعديل عميل',
  listAction: 'customers.list', saveAction: 'customers.save', setActiveAction: 'customers.setActive',
  managePerm: 'MANAGE_CUSTOMERS', idField: 'CustomerID', nameField: 'CustomerName',
  searchPlaceholder: 'ابحث بالاسم أو الكود أو التليفون', searchKeys: ['CustomerName', 'CustomerCode', 'Phone'],
  isProtected: r => r.CustomerCode === 'CASH',
  columns: [
    { key: 'CustomerCode', label: 'الكود', cls: 'mono' },
    { label: 'اسم العميل', render: r => UI.esc(r.CustomerName) + (r.CustomerCode === 'CASH' ? '<span class="tag">نظامي</span>' : '') },
    { key: 'Phone', label: 'التليفون', cls: 'mono' }
  ],
  form: (meta, row) => [
    ...(row ? [{ key: 'CustomerCode', label: 'الكود', type: 'readonly' }] : []),
    row && row.CustomerCode === 'CASH'
      ? { key: 'CustomerName', label: 'اسم العميل', type: 'readonly', send: true, hint: 'العميل النقدي نظامي ولا يمكن تغيير اسمه.' }
      : { key: 'CustomerName', label: 'اسم العميل', required: true, max: 120 },
    { key: 'Phone', label: 'التليفون', ltr: true, max: 20 }
  ]
});
