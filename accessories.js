'use strict';
(function(){
  const A={items:[],editing:null,imageFile:null};
  const fmtEGP=x=>Number(x||0).toLocaleString(undefined,{maximumFractionDigits:2})+' EGP';
  const fmtUSD=x=>'$'+Number(x||0).toFixed(2);
  const a$=id=>document.getElementById(id);
  const aesc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const anorm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

  function calc(){
    const qty=Math.max(1,+a$('accQty').value||1);
    const unit=Math.max(0,+a$('accUnit').value||0);
    const fees=Math.max(0,+a$('accFees').value||0);
    const calcUsd=qty*unit+fees;
    const raw=a$('accTotalUsd').value.trim();
    const totalUsd=raw===''?calcUsd:Math.max(0,+raw||0);
    const r=Math.max(0,+a$('accRate').value||0);
    const totalEgp=totalUsd*r;
    a$('accCalcUsd').textContent=fmtUSD(calcUsd);
    a$('accTotalEgp').textContent=fmtEGP(totalEgp);
    return {qty,unit,fees,calcUsd,totalUsd,r,totalEgp};
  }

  function reset(){
    ['accName','accBrand','accModel','accKeywords','accColor','accSupplier','accUrl','accNotes'].forEach(id=>a$(id).value='');
    a$('accCategory').value='Cutter';
    a$('accQty').value='1'; a$('accUnit').value=''; a$('accFees').value='0'; a$('accTotalUsd').value=''; a$('accRate').value=(typeof rate==='number'&&rate>0?rate:'');
    a$('accPicture').value=''; A.imageFile=null; A.editing=null;
    a$('accSave').textContent='＋ Add accessory';
    a$('accCancel').classList.add('hidden');
    calc();
  }

  async function upload(file,id){
    if(!file)return null;
    if(file.size>5*1024*1024)throw new Error('Accessory picture must be 5 MB or smaller.');
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
    const path=user.id+'/accessories/'+id+'.'+ext;
    const {error}=await sb.storage.from('cigar-images').upload(path,file,{cacheControl:'31536000',upsert:true,contentType:file.type});
    if(error)throw error;
    return sb.storage.from('cigar-images').getPublicUrl(path).data.publicUrl;
  }

  async function load(){
    if(!sb||!user)return;
    const {data,error}=await sb.from('accessory_purchases').select('*').order('purchased_at',{ascending:false});
    if(error){console.error(error);a$('accStatus').textContent='Could not load accessories: '+error.message;return}
    A.items=data||[]; render();
  }

  function matches(x,q){
    if(!q)return true;
    const hay=anorm([x.name,x.category,x.brand,x.model,x.keywords,x.color,x.supplier].join(' '));
    return q.split(' ').every(part=>hay.includes(part));
  }

  function render(){
    const q=anorm(a$('accSearch')?.value||'');
    const list=A.items.filter(x=>matches(x,q));
    const groups={};
    for(const x of list){
      const key=anorm(x.name)+'|'+anorm(x.color);
      if(!groups[key])groups[key]={name:x.name,color:x.color,qty:0,totalEgp:0,totalUsd:0,unitEgp:[]};
      const g=groups[key];g.qty+=+x.quantity||0;g.totalEgp+=+x.total_paid_egp||0;g.totalUsd+=+x.total_paid_usd||0;
      if(x.quantity)g.unitEgp.push((+x.total_paid_egp||0)/+x.quantity);
    }
    const groupRows=Object.values(groups).sort((a,b)=>b.qty-a.qty).map(g=>{
      const avg=g.qty?g.totalEgp/g.qty:0,min=g.unitEgp.length?Math.min(...g.unitEgp):0,max=g.unitEgp.length?Math.max(...g.unitEgp):0;
      return '<div class="accGroup"><div><b>'+aesc(g.name)+'</b>'+(g.color?' · <span class="muted">'+aesc(g.color)+'</span>':'')+'</div><div class="accGroupStats">'+g.qty+' total · Avg '+fmtEGP(avg)+'/unit · Range '+fmtEGP(min)+'–'+fmtEGP(max)+'</div></div>';
    }).join('');
    const rows=list.map(x=>'<div class="accRow">'+
      (x.image_url?'<img src="'+aesc(x.image_url)+'" class="accThumb">':'<div class="accThumb placeholder">—</div>')+
      '<div class="accMain"><div><b>'+aesc(x.name)+'</b><span class="pill">'+aesc(x.category)+'</span>'+(x.color?' <span class="pill">'+aesc(x.color)+'</span>':'')+'</div>'+
      '<div class="muted">'+(x.brand?aesc(x.brand)+' · ':'')+(x.model?aesc(x.model)+' · ':'')+'Qty '+x.quantity+' · '+fmtUSD(x.unit_price_usd)+'/unit · Fees '+fmtUSD(x.fees_usd)+'</div>'+
      '<div class="muted">Paid '+fmtUSD(x.total_paid_usd)+' · '+fmtEGP(x.total_paid_egp)+' · Rate '+Number(x.usdt_egp_rate||0).toFixed(2)+(x.supplier?' · '+aesc(x.supplier):'')+'</div>'+
      (x.keywords?'<div class="muted">Keywords: '+aesc(x.keywords)+'</div>':'')+
      (x.product_url?'<a href="'+aesc(x.product_url)+'" target="_blank" rel="noopener">Open product link ↗</a>':'')+
      '</div><div class="buttons"><button class="btn small" data-acc-edit="'+x.id+'">Edit</button><button class="btn small del" data-acc-delete="'+x.id+'">Delete</button></div></div>').join('');
    a$('accGroups').innerHTML=groupRows||'<div class="muted">No matching accessories yet.</div>';
    a$('accHistory').innerHTML=rows||'<div class="muted" style="padding:18px;text-align:center">No accessory purchases yet.</div>';
    const totalQty=list.reduce((s,x)=>s+(+x.quantity||0),0),totalPaid=list.reduce((s,x)=>s+(+x.total_paid_egp||0),0);
    a$('accCount').textContent=String(totalQty);a$('accSpent').textContent=fmtEGP(totalPaid);
    a$('accHistory').querySelectorAll('[data-acc-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.accEdit));
    a$('accHistory').querySelectorAll('[data-acc-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.accDelete));
  }

  function edit(id){
    const x=A.items.find(v=>v.id===id);if(!x)return;
    A.editing=id;
    a$('accName').value=x.name||'';a$('accCategory').value=x.category||'Other';a$('accBrand').value=x.brand||'';a$('accModel').value=x.model||'';
    a$('accKeywords').value=x.keywords||'';a$('accColor').value=x.color||'';a$('accQty').value=x.quantity||1;a$('accUnit').value=x.unit_price_usd||0;a$('accFees').value=x.fees_usd||0;
    a$('accTotalUsd').value=x.total_paid_usd||0;a$('accRate').value=x.usdt_egp_rate||'';a$('accSupplier').value=x.supplier||'';a$('accUrl').value=x.product_url||'';a$('accNotes').value=x.notes||'';
    a$('accPicture').value='';A.imageFile=null;a$('accSave').textContent='✓ Update accessory';a$('accCancel').classList.remove('hidden');calc();a$('accessories').scrollIntoView({behavior:'smooth'});
  }

  async function save(){
    if(!user)return alert('Log in to save accessories to your cloud database.');
    const name=a$('accName').value.trim();if(!name)return alert('Enter an accessory name.');
    const c=calc();if(c.r<=0)return alert('Enter the USDT/EGP rate.');
    const payload={user_id:user.id,name,normalized_name:anorm(name),category:a$('accCategory').value,brand:a$('accBrand').value.trim(),model:a$('accModel').value.trim(),keywords:a$('accKeywords').value.trim(),color:a$('accColor').value.trim(),quantity:c.qty,unit_price_usd:c.unit,fees_usd:c.fees,total_paid_usd:c.totalUsd,usdt_egp_rate:c.r,total_paid_egp:c.totalEgp,supplier:a$('accSupplier').value.trim(),product_url:a$('accUrl').value.trim(),notes:a$('accNotes').value.trim()};
    const btn=a$('accSave');btn.disabled=true;btn.textContent='Saving…';
    try{
      if(A.editing){
        let imageUrl=A.items.find(x=>x.id===A.editing)?.image_url||null;if(A.imageFile)imageUrl=await upload(A.imageFile,A.editing);
        payload.image_url=imageUrl;
        const {error}=await sb.from('accessory_purchases').update(payload).eq('id',A.editing).eq('user_id',user.id);if(error)throw error;
      }else{
        const {data,error}=await sb.from('accessory_purchases').insert(payload).select().single();if(error)throw error;
        if(A.imageFile){const url=await upload(A.imageFile,data.id);const {error:e}=await sb.from('accessory_purchases').update({image_url:url}).eq('id',data.id).eq('user_id',user.id);if(e)throw e}
      }
      reset();await load();a$('accStatus').textContent='Accessory saved successfully.';
    }catch(e){alert('Could not save accessory: '+(e?.message||e))}
    finally{btn.disabled=false;if(!A.editing)btn.textContent='＋ Add accessory'}
  }

  async function remove(id){
    if(!user||!confirm('Delete this accessory purchase? This cannot be undone.'))return;
    const {error}=await sb.from('accessory_purchases').delete().eq('id',id).eq('user_id',user.id);
    if(error)return alert('Could not delete accessory: '+error.message);
    await load();
  }

  function csv(){
    const q=anorm(a$('accSearch')?.value||'');const rows=A.items.filter(x=>matches(x,q));
    const headers=['Date','Name','Category','Brand','Model','Keywords','Color','Quantity','Unit Price USD','Fees USD','Total Paid USD','USDT/EGP Rate','Total Paid EGP','Supplier','Product Link','Picture URL','Notes'];
    const escCsv=v=>{const s=String(v??'');return '"'+s.replace(/"/g,'""')+'"'};
    const out=[headers,...rows.map(x=>[x.purchased_at,x.name,x.category,x.brand,x.model,x.keywords,x.color,x.quantity,x.unit_price_usd,x.fees_usd,x.total_paid_usd,x.usdt_egp_rate,x.total_paid_egp,x.supplier,x.product_url,x.image_url,x.notes])].map(r=>r.map(escCsv).join(',')).join('\n');
    const blob=new Blob([out],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='accessory-history.csv';a.click();URL.revokeObjectURL(url);
  }

  function showTab(){
    ['current','hist','db'].forEach(x=>$(x).classList.add('hidden'));
    a$('accessories').classList.remove('hidden');
    ['orderTab','historyTab','dbTab'].forEach(x=>$(x).classList.remove('active'));
    a$('accessoryTab').classList.add('active');load();
  }
  function hideTab(){a$('accessories')?.classList.add('hidden');a$('accessoryTab')?.classList.remove('active')}
  a$('accessoryTab').onclick=showTab;
  ['orderTab','historyTab','dbTab'].forEach(id=>a$(id).addEventListener('click',hideTab));
  ['accQty','accUnit','accFees','accTotalUsd','accRate'].forEach(id=>a$(id).addEventListener('input',calc));
  a$('accPicture').onchange=()=>{A.imageFile=a$('accPicture').files?.[0]||null};
  a$('accSearch').oninput=render;a$('accSave').onclick=save;a$('accCancel').onclick=reset;a$('accCsv').onclick=csv;
  if(sb){
    sb.auth.onAuthStateChange((_event,session)=>{if(session?.user){setTimeout(load,0)}else{A.items=[];render()}});
    sb.auth.getUser().then(({data})=>{if(data.user)setTimeout(load,0)});
  }
  setTimeout(()=>{if(typeof rate==='number'&&rate>0)a$('accRate').value=rate;calc()},200);
  render();
})();
