'use strict';

// CSV export tools for the current order and the complete cigar purchase history.
(function () {
  const escHtml = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
  const num = v => Number(v || 0);
  const moneyCsv = v => num(v).toFixed(2);
  const csvCell = value => {
    const s = String(value ?? '');
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const makeCsv = rows => '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const downloadCsv = (filename, rows) => {
    const blob = new Blob([makeCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const stamp = () => new Date().toISOString().slice(0,10);

  function getCurrentItems() {
    return Array.isArray(window.items) ? window.items : [];
  }

  function exportCurrentOrder() {
    const items = getCurrentItems();
    if (!items.length) return alert('There are no items in the current order to export.');
    const rows = [[
      'Order Item','Cigar / Item','Vitola / Size','Quantity','Original USD','7% Tax USD','Quantity Fee USD','Box Fee USD','Total USD','Total EGP','Price / Stick EGP','USDT/EGP Rate','Rate Source','Allocation'
    ]];
    items.forEach((it, i) => {
      const allocations = Array.isArray(it.alloc) && it.alloc.length ? it.alloc : [{ name: it.cigar || '', vitola: it.vitola || '', qty: it.q, price: it.per, mode: 'automatic' }];
      const allocationText = allocations.map(a => `${a.name || 'Unnamed'}${a.vitola ? ' · ' + a.vitola : ''} × ${a.qty} @ ${moneyCsv(a.price)} EGP`).join(' | ');
      rows.push([
        i + 1,
        it.cigar || it.label || '',
        it.vitola || '',
        it.q,
        moneyCsv(it.p),
        moneyCsv(it.tax),
        moneyCsv(it.f),
        moneyCsv(it.b),
        moneyCsv(it.u),
        moneyCsv(it.total),
        moneyCsv(it.per),
        num(it.rate).toFixed(2),
        it.rateSource === 'manual' ? 'Manual' : 'Live',
        allocationText
      ]);
    });
    const q = items.reduce((s, x) => s + num(x.q), 0);
    const total = items.reduce((s, x) => s + num(x.total), 0);
    rows.push([]);
    rows.push(['ORDER TOTAL','','',q,'','','','','',moneyCsv(total),moneyCsv(q ? total / q : 0),'','','']);
    downloadCsv(`cigar-order-${stamp()}.csv`, rows);
  }

  function getOrders() {
    if (Array.isArray(window.cloudOrders) && window.user) return window.cloudOrders;
    return window.local && Array.isArray(window.local.orders) ? window.local.orders : [];
  }

  function getCigars() {
    if (Array.isArray(window.cloudCigars) && window.user) return window.cloudCigars;
    return window.local && Array.isArray(window.local.cigars) ? window.local.cigars : [];
  }

  function exportInventoryHistory() {
    const cigars = getCigars();
    const orders = getOrders();
    const rows = [[
      'Purchase Date','Order ID','Cigar / Item','Vitola / Size','Quantity','Price / Stick EGP','Purchase Total EGP','USDT/EGP Rate','Rate Source','Allocation Mode'
    ]];

    // Cloud database: order_items contain the authoritative purchase records,
    // while cigar_price_history is already flattened into each cigar's history.
    if (window.user && Array.isArray(window.cloudCigars)) {
      const orderMap = new Map(orders.map(o => [String(o.id), o]));
      cigars.forEach(c => (c.history || []).forEach(h => {
        const order = orderMap.get(String(h.order_id || ''));
        rows.push([
          h.date || h.purchased_at || '',
          h.order_id || '',
          c.name || '',
          h.vitola || c.vitola || '',
          num(h.qty || h.quantity),
          moneyCsv(h.price || h.price_per_stick_egp),
          moneyCsv(h.order_total_egp),
          num(h.rate || h.usdt_egp_rate).toFixed(2),
          (h.rateSource || h.rate_source || 'live') === 'manual' ? 'Manual' : 'Live',
          h.allocation_mode || (order ? 'automatic' : '')
        ]);
      }));
    } else {
      // Local fallback: local cigar histories are used when the user is offline.
      cigars.forEach(c => (c.history || []).forEach(h => rows.push([
        h.date || h.purchased_at || '',
        h.order_id || '',
        c.name || '',
        h.vitola || c.vitola || '',
        num(h.qty || h.quantity),
        moneyCsv(h.price || h.price_per_stick_egp),
        moneyCsv(h.order_total_egp),
        num(h.rate || h.usdt_egp_rate).toFixed(2),
        (h.rateSource || h.rate_source || 'live') === 'manual' ? 'Manual' : 'Live',
        h.allocation_mode || ''
      ]));
    }

    if (rows.length === 1) {
      // Even if there is no per-cigar history yet, export the saved orders so
      // the user never loses their historical financial record.
      orders.forEach((o, oi) => {
        (o.items || []).forEach(x => rows.push([
          o.created_at || o.date || '',
          o.id || `order-${oi + 1}`,
          x.cigar_name_snapshot || x.name || x.label || '',
          x.vitola_snapshot || x.vitola || '',
          num(x.quantity || x.qty),
          moneyCsv(x.price_per_stick_egp || x.price || x.per),
          '',
          num(o.usdt_egp_rate || x.rate).toFixed(2),
          (o.rate_source || x.rateSource || 'live') === 'manual' ? 'Manual' : 'Live',
          x.allocation_mode || ''
        ]));
      });
    }

    if (rows.length === 1) return alert('There is no inventory purchase history to export yet.');
    rows.slice(1).sort((a,b) => String(b[0]).localeCompare(String(a[0])));
    downloadCsv(`cigar-inventory-history-${stamp()}.csv`, rows);
  }

  function addExportButtons() {
    const tabs = document.querySelector('.tabs');
    if (!tabs || document.getElementById('exportOrderBtn')) return;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:8px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end';
    wrap.innerHTML = `<button class="btn" id="exportOrderBtn" type="button">↓ Export Order CSV</button><button class="btn" id="exportInventoryBtn" type="button">↓ Export Inventory CSV</button>`;
    tabs.parentNode.insertBefore(wrap, tabs.nextSibling);
    tabs.style.marginBottom = '8px';
    wrap.style.marginBottom = '12px';
    document.getElementById('exportOrderBtn').addEventListener('click', exportCurrentOrder);
    document.getElementById('exportInventoryBtn').addEventListener('click', exportInventoryHistory);
  }

  // Expose for future UI integrations.
  window.exportCurrentOrderCsv = exportCurrentOrder;
  window.exportInventoryHistoryCsv = exportInventoryHistory;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addExportButtons);
  else addExportButtons();
})();
