'use strict';

// Cigar Database UX enhancement: searchable cards + detailed purchase history modal.
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money2 = x => Number(x || 0).toLocaleString(undefined, {maximumFractionDigits:2}) + ' EGP';
  const norm2 = s => String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

  function addModal() {
    if (document.getElementById('cigarDetailModal')) return;
    const div = document.createElement('div');
    div.id = 'cigarDetailModal';
    div.className = 'modal hidden';
    div.innerHTML = `<div class="modalBackdrop" data-close-cigar></div><div class="modalCard" role="dialog" aria-modal="true" aria-labelledby="detailTitle"><div class="modalHead"><div><h2 id="detailTitle">Cigar</h2><div id="detailSubtitle" class="muted"></div></div><button class="btn" data-close-cigar>×</button></div><div id="detailStats" class="detailStats"></div><div id="detailHistory"></div></div>`;
    document.body.appendChild(div);
    div.querySelectorAll('[data-close-cigar]').forEach(x => x.addEventListener('click', closeDetail));
    document.addEventListener('keydown', e => { if(e.key==='Escape') closeDetail(); });
  }
  function closeDetail(){ const m=document.getElementById('cigarDetailModal'); if(m)m.classList.add('hidden'); }
  function openDetail(id){
    const cs = typeof allCigars === 'function' ? allCigars() : [];
    const c = cs.find(x => String(x.id) === String(id));
    if(!c) return;
    const h = (c.history||[]).slice().sort((a,b)=>new Date(b.date||b.purchased_at)-new Date(a.date||a.purchased_at));
    const prices = h.map(x=>Number(x.price||x.price_per_stick_egp||0)).filter(Boolean);
    const avg = prices.length ? prices.reduce((a,b)=>a+b,0)/prices.length : 0;
    const best = prices.length ? Math.min(...prices) : 0;
    const last = prices[0] || 0;
    const rates = h.map(x=>Number(x.rate||x.usdt_egp_rate||0)).filter(Boolean);
    const lastRate = rates[0] || 0;
    $('detailTitle').textContent = c.name || 'Cigar';
    $('detailSubtitle').textContent = c.vitola ? `Default vitola: ${c.vitola}` : 'Cigar price reference';
    $('detailStats').innerHTML = `<div class="detailStat"><span>Purchases</span><b>${h.length}</b></div><div class="detailStat"><span>Last / stick</span><b>${money2(last)}</b></div><div class="detailStat"><span>Average / stick</span><b>${money2(avg)}</b></div><div class="detailStat"><span>Best / stick</span><b>${money2(best)}</b></div><div class="detailStat"><span>Last USDT/EGP</span><b>${lastRate ? lastRate.toFixed(2) : '—'}</b></div>`;
    $('detailHistory').innerHTML = h.length ? `<h3 style="margin:18px 0 8px">Purchase history</h3>${h.map(x=>{const d=new Date(x.date||x.purchased_at);const rate=Number(x.rate||x.usdt_egp_rate||0);const src=x.rateSource||x.rate_source||'live';return `<div class="purchaseRow"><div><b>${esc(x.vitola||x.vitola_snapshot||c.vitola||'No vitola')}</b><div class="muted">${d.toLocaleString()} · ${Number(x.qty||x.quantity||0)} sticks</div></div><div class="purchaseRight"><b>${money2(x.price||x.price_per_stick_egp)}</b><div class="muted">USDT/EGP ${rate?rate.toFixed(2):'—'} · ${src==='manual'?'Manual':'Live'}</div></div></div>`}).join('')}` : '<div class="muted" style="padding:20px 0">No purchases recorded yet.</div>';
    $('cigarDetailModal').classList.remove('hidden');
  }

  window.renderDB = function(){
    const el = document.getElementById('db');
    const cs = typeof allCigars === 'function' ? allCigars() : [];
    if(!el) return;
    if(!cs.length){el.innerHTML='<div class="muted" style="padding:20px;text-align:center">Your cigar database will build automatically as you save purchases.</div>';return;}
    el.innerHTML = `<div class="dbToolbar"><input class="dbSearch" id="dbSearch" placeholder="Search cigar or vitola…"><span class="muted" id="dbCount"></span></div><div id="dbRows">${cs.map(c=>{
      const h=(c.history||[]).slice().sort((a,b)=>new Date(b.date||b.purchased_at)-new Date(a.date||a.purchased_at));
      const prices=h.map(x=>Number(x.price||0)).filter(Boolean); const avg=prices.length?prices.reduce((a,b)=>a+b,0)/prices.length:0; const best=prices.length?Math.min(...prices):0; const last=prices[0]||0; const r=h[0]?Number(h[0].rate||0):0;
      return `<button class="dbCard" type="button" data-cigar-id="${esc(c.id)}"><div class="dbCardTop"><b>${esc(c.name)}</b><span class="pill">${h.length} purchase${h.length===1?'':'s'}</span></div><div class="dbStats">${esc(c.vitola||'No vitola')} · Last <b>${money2(last)}</b> · Avg ${money2(avg)} · Best ${money2(best)}</div><div class="dbRate">Last USDT/EGP: <b>${r?r.toFixed(2):'—'}</b> · Click for full history</div></button>`;
    }).join('')}</div>`;
    const rows=[...el.querySelectorAll('.dbCard')];
    const filter=()=>{const q=norm2(document.getElementById('dbSearch').value);let n=0;rows.forEach(row=>{const show=!q||norm2(row.textContent).includes(q);row.style.display=show?'block':'none';if(show)n++;});document.getElementById('dbCount').textContent=`${n} cigar${n===1?'':'s'}`;};
    document.getElementById('dbSearch').addEventListener('input',filter);
    rows.forEach(r=>r.addEventListener('click',()=>openDetail(r.dataset.cigarId)));
    filter();
  };
  window.openCigarDetail = openDetail;
  addModal();
  // app.js performs its initial render before this file loads; render again with the enhanced UI.
  if (document.readyState !== 'loading') renderDB(); else document.addEventListener('DOMContentLoaded', renderDB);
})();
