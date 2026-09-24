/** الموردين */
const SuppliersPage = () => createCrudPage({
  title: 'الموردين', addLabel: 'إضافة مورد', editTitle: 'تعديل مورد',
  listAction: 'suppliers.list', saveAction: 'suppliers.save', setActiveAction: 'suppliers.setActive',
  managePerm: 'MANAGE_SUPPLIERS', idField: 'SupplierID', nameField: 'SupplierName',
  searchPlaceholder: 'ابحث بالاسم أو الكود أو التليفون', searchKeys: ['SupplierName', 'SupplierCode', 'Phone'],
  columns: [
    { key: 'SupplierCode', label: 'الكود', cls: 'mono' },
    { key: 'SupplierName', label: 'اسم المورد' },
    { key: 'Phone', label: 'التليفون', cls: 'mono' }
  ],
  form: (meta, row) => [
    ...(row ? [{ key: 'SupplierCode', label: 'الكود', type: 'readonly' }] : []),
    { key: 'SupplierName', label: 'اسم المورد', required: true, max: 120 },
    { key: 'Phone', label: 'التليفون', ltr: true, max: 20 }
  ]
});
