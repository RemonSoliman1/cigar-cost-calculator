'use strict';

// Cigar Database UX enhancement: searchable cards + detailed purchase history modal + smart cigar matching.
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money2 = x => Number(x || 0).toLocaleString(undefined, {maximumFractionDigits:2}) + ' EGP';
  const norm2 = s => String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();

  // More tolerant than the original word-overlap matcher. It handles typos,
  // abbreviations and reordered words while still avoiding aggressive matches.
  function levenshtein(a,b){
    a=norm2(a); b=norm2(b);
    if(a===b)return 0; if(!a)return b.length; if(!b)return a.length;
    let prev=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const cur=[i];
      for(let j=1;j<=b.length;j++) cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      prev=cur;
    }
    return prev[b.length];
  }
  function tokenScore(a,b){
    const A=norm2(a).split(' ').filter(Boolean),B=norm2(b).split(' ').filter(Boolean);
    if(!A.length||!B.length)return 0;
    let matched=0;
    for(const x of A){
      let best=0;
      for(const y of B){
        if(x===y){best=1;break;}
        const d=levenshtein(x,y), mx=Math.max(x.length,y.length);
        if(mx>=3) best=Math.max(best,1-d/mx);
        if(x.length>=3&&y.startsWith(x.slice(0,Math.max(2,x.length-1)))) best=Math.max(best,.86);
        if(y.length>=3&&x.startsWith(y.slice(0,Math.max(2,y.length-1)))) best=Math.max(best,.86);
      }
      matched+=best;
    }
    return matched/Math.max(A.length,B.length);
  }
  function smartScore(query,c){
    const q=norm2(query), name=norm2(c.name), vit=norm2(c.vitola||'');
    if(!q||!name)return 0;
    if(q===name)return 1;
    const qTokens=q.split(' '), nTokens=name.split(' ');
    const overlap=qTokens.filter(t=>nTokens.includes(t)).length/Math.max(qTokens.length,nTokens.length);
    const token=tokenScore(q,name);
    const compact=1-(levenshtein(q,name)/Math.max(q.length,name.length));
    const vitBonus=vit&&qTokens.some(t=>t.length>2&&vit.includes(t))?.06:0;
    return Math.min(1,.52*token+.30*compact+.18*overlap+vitBonus);
  }
  function smartMatches(query){
    const cs=typeof allCigars==='function'?allCigars():[];
    return cs.map(c=>({...c,s:smartScore(query,c)})).filter(c=>c.s>=.38).sort((a,b)=>b.s-a.s).slice(0,6);
  }

  function addSmartMatcher(){
    const input=document.getElementById('cigar'), box=document.getElementById('suggest');
    if(!input||!box)return;
    const render=()=>{
      const q=input.value.trim();
      if(!q){box.classList.add('hidden');return;}
      const found=smartMatches(q);
      box.innerHTML=found.length ? found.map((c,i)=>{
        const confidence=c.s>=.86?'Strong match':c.s>=.68?'Likely match':'Possible match';
        return `<div data-smart-id="${esc(c.id)}" style="display:flex;justify-content:space-between;gap:10px;align-items:center"><span><b>${esc(c.name)}</b><span class="muted">${c.vitola?' · '+esc(c.vitola):''}</span></span><span class="pill">${confidence}</span></div>`;
      }).join('') : `<div><b>New cigar</b><span class="muted"> No close saved match — this name will be learned when you save the purchase.</span></div>`;
      box.classList.remove('hidden');
      box.querySelectorAll('[data-smart-id]').forEach(row=>row.addEventListener('click',()=>{
        const c=(typeof allCigars==='function'?allCigars():[]).find(x=>String(x.id)===String(row.dataset.smartId));
        if(!c)return;
        input.value=c.name;
        const v=document.getElementById('vitola');
        if(v&&!v.value&&c.vitola)v.value=c.vitola;
        box.classList.add('hidden');
        if(typeof showPriceHistory==='function')showPriceHistory();
      }));
    };
    // The original app listener remains active; this listener deliberately runs
    // after it and replaces its suggestions with the more tolerant matcher.
    input.addEventListener('input',render);
    input.addEventListener('focus',()=>{if(input.value.trim())render()});
    input.addEventListener('blur',()=>{
      setTimeout(()=>{
        const q=input.value.trim(); if(!q)return;
        const found=smartMatches(q);
        // Only auto-correct when confidence is high and the best result is
        // clearly ahead of the runner-up. Ambiguous names are left untouched.
        const best=found[0], second=found[1];
        if(best && best.s>=.88 && (!second || best.s-second.s>=.10) && norm2(q)!==norm2(best.name)){
          input.value=best.name;
          const v=document.getElementById('vitola');
          if(v&&!v.value&&best.vitola)v.value=best.vitola;
          if(typeof showPriceHistory==='function')showPriceHistory();
          box.innerHTML=`<div><b>✓ Matched to ${esc(best.name)}</b><span class="muted"> · saved cigar</span></div>`;
          box.classList.remove('hidden');
          setTimeout(()=>box.classList.add('hidden'),2200);
        }
      },120);
    });
  }

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
  if (document.readyState !== 'loading') { renderDB(); addSmartMatcher(); } else document.addEventListener('DOMContentLoaded',()=>{ renderDB(); addSmartMatcher(); });
})();
