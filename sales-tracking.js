'use strict';
(function(){
  const BASE_HEADERS=['Date','Type','Order / purchase ID','Supplier','Item','Item details','Quantity','Assigned unit price (EGP)','Assigned item total (EGP)','Order actual paid (EGP)','Item picture URLs','Order picture URLs'];
  const SALE_HEADER='selling price/sampler,stick';
  const SALE_BASIS_HEADER='selling price basis';
  const REVENUE_HEADER='total price per item';
  const PROFIT_HEADER='profit per item';
  const PIECE_PROFIT_HEADER='profit per piece';
  const CALC_HEADERS=[SALE_HEADER,SALE_BASIS_HEADER,REVENUE_HEADER,PROFIT_HEADER,PIECE_PROFIT_HEADER];
  const money=v=>Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const num=v=>{const n=Number(String(v??'').replace(/,/g,'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const normalized=v=>String(v??'').toLowerCase().trim().replace(/\s+/g,' ');
  const sampler=x=>!!x?.is_sampler||x?.allocation_mode==='sampler';
  const stamp=()=>new Date().toISOString().slice(0,10);
  let loadedKey='',state={entries:{},extraHeaders:[],headerOrder:[],footerRows:[],customColumns:[],manualRows:[]},lines=[],selectedOnly=false;

  function storageKey(){return 'cigarSalesTrackingV1:'+(window.user?.id||'local')}
  function loadState(){const k=storageKey();if(k===loadedKey)return;loadedKey=k;try{state=JSON.parse(localStorage.getItem(k)||'{}')}catch(e){state={}}state.entries=state.entries||{};state.extraHeaders=Array.isArray(state.extraHeaders)?state.extraHeaders:[];state.headerOrder=Array.isArray(state.headerOrder)?state.headerOrder:[];state.footerRows=Array.isArray(state.footerRows)?state.footerRows:[];state.customColumns=Array.isArray(state.customColumns)?state.customColumns:[];state.manualRows=Array.isArray(state.manualRows)?state.manualRows:[]}
  function saveState(){loadState();localStorage.setItem(loadedKey,JSON.stringify(state))}
  function itemName(x){const n=x?.cigar_name_snapshot||x?.cigar||x?.name||x?.label||'Unnamed item';return sampler(x)?n+' - Sampler':n}
  function orderPictures(o){return Array.from(new Set([...(Array.isArray(o?.order_image_urls)?o.order_image_urls:[]),o?.order_image_url].filter(Boolean)))}
  function itemPictures(x){return Array.from(new Set([...(Array.isArray(x?.image_urls)?x.image_urls:[]),x?.image_url].filter(Boolean)))}
  function detailsFor(o,x){
    if(sampler(x)){const out=[Number(x.sampler_count||x.quantity||1)+' samplers × '+Number(x.cigars_per_sampler||1)+' cigars/sampler'];if(x.sampler_price_mode)out.push('Sampler price: '+(x.sampler_price_mode==='total_order'?'total for all samplers':'per sampler'));if(x.sampler_unit_price_usd!=null)out.push('$'+Number(x.sampler_unit_price_usd||0).toFixed(2)+'/sampler');if(x.sampler_total_price_usd!=null)out.push('$'+Number(x.sampler_total_price_usd||0).toFixed(2)+' sampler total');if(x.sampler_contents)out.push('Contains: '+String(x.sampler_contents).replace(/\r?\n/g,' | '));return out.join(' · ')}
    if(o.is_accessory)return [x.vitola_snapshot,'Accessory units'].filter(Boolean).join(' · ');
    return x.vitola_snapshot||x.vitola||'';
  }
  function allOrders(){
    let cigarOrders=window.user?(window.cloudOrders||[]):(window.local?.orders||[]);
    const accessoryOrders=window.user?(window.cloudAccessories||[]).map(x=>{const quantity=Number(x.quantity||0),paid=Number(x.total_paid_egp||0);return{id:'accessory-'+x.id,is_accessory:true,created_at:x.purchased_at,total_egp:paid,actual_total_egp:paid,supplier:x.supplier||'',order_image_url:x.image_url||null,items:[{id:x.id,cigar_name_snapshot:x.name||'Accessory',vitola_snapshot:[x.category,x.brand,x.model,x.color].filter(Boolean).join(' · ')||'Accessory',quantity,price_per_stick_egp:quantity?paid/quantity:0,image_url:x.image_url||null}]}}):[];
    let orders=[...cigarOrders,...accessoryOrders];
    if(selectedOnly){const selected=window.getSelectedHistoryOrderIds?.()||new Set();orders=orders.filter(o=>selected.has(String(o.id||'')))}
    return orders;
  }
  function makeLines(){
    loadState();const out=[],seen=new Map();
    for(const o of allOrders()){
      const its=Array.isArray(o.items)?o.items:[];
      const items=its.length?its:[{cigar_name_snapshot:'Unspecified items',quantity:Number(o.total_cigars||0),price_per_stick_egp:0}];
      items.forEach(x=>{
        const isSampler=!o.is_accessory&&sampler(x),quantity=o.is_accessory?num(x.quantity??x.qty):isSampler?num(x.sampler_count??x.quantity??1)*num(x.cigars_per_sampler??1):num(x.quantity??x.qty);
        const item=itemName(x),details=detailsFor(o,x),type=o.is_accessory?'Accessory':'Cigar',orderId=String(o.id||''),orderKey=orderId||String(o.created_at||o.purchased_at||o.date||'')+'|'+String(o.supplier||''),baseKey=[orderKey,type,normalized(item),normalized(details)].join('|'),occ=seen.get(baseKey)||0;seen.set(baseKey,occ+1);
        const key=baseKey+'|'+occ,unitCost=num(x.price_per_stick_egp??x.price??(quantity?num(o.actual_total_egp??o.total_egp)/quantity:0)),lineCost=unitCost*quantity;
        const entry=state.entries[key]||{};
        out.push({key,order:o,item:x,type,orderId,orderKey,date:o.created_at||o.purchased_at||o.date||'',supplier:o.supplier||'',name:o.is_accessory?(x.cigar_name_snapshot||x.name||'Accessory'):item,details,quantity,saleUnits:isSampler?num(x.sampler_count??x.quantity??1):quantity,saleUnitLabel:isSampler?'sampler':o.is_accessory?'accessory unit':'cigar stick',unitCost,lineCost,paid:num(o.actual_total_egp??o.total_egp??o.total),itemPics:itemPictures(x).join(' | '),orderPics:orderPictures(o).join(' | '),entry,isSampler,isAccessory:!!o.is_accessory});
      });
    }
    if(!selectedOnly)state.manualRows.forEach(row=>{const key='manual-'+row.id,entry=state.entries[key]||{salePrice:''},quantity=Math.max(0,num(row.quantity)),unitCost=num(row.unitCost);state.entries[key]=entry;out.push({key,order:{id:key},item:row,type:row.type||'Cigar',orderId:key,orderKey:key,date:row.date||stamp(),supplier:row.supplier||'',name:row.name||'New item',details:row.details||'',quantity,saleUnits:quantity,saleUnitLabel:row.unitLabel||'unit',unitCost,lineCost:unitCost*quantity,paid:unitCost*quantity,itemPics:'',orderPics:'',entry,isSampler:false,isAccessory:row.type==='Accessory',isManual:true,manualRow:row})});
    return out.sort((a,b)=>new Date(a.date||0)-new Date(b.date||0)||a.orderId.localeCompare(b.orderId));
  }
  function saleMath(line){
    const e=line.entry;
    if(e.legacy&&e.salePrice!=='')return{revenue:num(e.legacyRevenue),profit:num(e.legacyProfit),perPiece:num(e.legacyPerPiece),hasPrice:true};
    if(e.salePrice==null||String(e.salePrice).trim()==='')return{revenue:null,profit:null,perPiece:null,hasPrice:false};
    const sale=num(e.salePrice),revenue=line.isSampler?(e.salePriceBasis==='per_sampler'?sale*line.saleUnits:sale):sale*line.saleUnits,profit=revenue-line.lineCost;
    return{revenue,profit,perPiece:line.quantity?profit/line.quantity:0,hasPrice:true};
  }
  function summary(){
    const cigars=lines.filter(x=>!x.isAccessory).reduce((n,x)=>n+x.quantity,0),accessories=lines.filter(x=>x.isAccessory).reduce((n,x)=>n+x.quantity,0),paidOrders=new Map();
    lines.forEach(x=>{if(!paidOrders.has(x.orderKey))paidOrders.set(x.orderKey,x.paid)});
    const paid=[...paidOrders.values()].reduce((a,b)=>a+b,0),cost=lines.reduce((n,x)=>n+x.lineCost,0),math=lines.map(x=>saleMath(x)),revenue=math.reduce((n,x)=>n+(x.revenue??0),0),profit=math.reduce((n,x)=>n+(x.profit??0),0),missing=math.filter(x=>!x.hasPrice).length;
    const cards=[['Cigars (samplers counted)',cigars],['Accessory units',accessories],['Actual paid',money(paid)+' EGP'],['Assigned item cost',money(cost)+' EGP'],['Sale total',money(revenue)+' EGP'],['Profit',money(profit)+' EGP'],['Prices to enter',missing]];
    const el=document.getElementById('salesTrackingSummary');if(el)el.innerHTML=cards.map(([label,value])=>'<div class="stat"><span>'+label+'</span><b>'+value+'</b></div>').join('');
  }
  function customColumns(){
    const imported=state.extraHeaders.map((header,index)=>({id:'csv-'+index,header,imported:true}));
    const custom=state.customColumns.map(column=>({id:column.id,header:column.header,imported:false}));
    return [...imported,...custom.filter(col=>!imported.some(x=>normalized(x.header)===normalized(col.header)))];
  }
  function refreshRow(line){
    const row=document.querySelector('[data-track-key="'+CSS.escape(line.key)+'"]');if(!row)return;
    const m=saleMath(line),revenue=row.querySelector('[data-label="Total sale (EGP)"]'),profit=row.querySelector('[data-label="Profit (EGP)"]'),piece=row.querySelector('[data-label="Profit / cigar or unit (EGP)"]');
    revenue.textContent=m.revenue==null?'—':money(m.revenue)+' EGP';profit.textContent=m.profit==null?'—':money(m.profit)+' EGP';piece.textContent=m.perPiece==null?'—':money(m.perPiece)+' EGP';
  }
  function render(){
    const panel=document.getElementById('salesTracking');if(!panel)return;loadState();lines=makeLines();
    const columns=customColumns(),headers=['Item','Quantity','Cost / unit (EGP)','Item cost (EGP)','Selling price','Total sale (EGP)','Profit (EGP)','Profit / cigar or unit (EGP)',...columns.map(x=>x.header),'Actions'];
    const rows=lines.map(line=>{const m=saleMath(line),search=normalized([line.date,line.type,line.supplier,line.name,line.details,line.orderId].join(' ')),pics=(line.itemPics||line.orderPics).split(' | ').filter(Boolean),photo=pics[0]?'<button type="button" class="trackThumbButton" data-track-photo="'+esc(line.key)+'" aria-label="View picture of '+esc(line.name)+'"><img class="trackThumb" src="'+esc(pics[0])+'" alt="" loading="lazy"></button>':'<span class="trackThumbPlaceholder" aria-hidden="true">'+(line.isAccessory?'🧰':'🚬')+'</span>',itemContent=line.isManual?'<input class="trackManualName" data-manual-field="name" data-track-key-ref="'+esc(line.key)+'" value="'+esc(line.manualRow.name)+'" placeholder="Item name">':'<b>'+esc(line.name)+'</b>',qty=line.isManual?'<input type="number" min="0" step="1" data-manual-field="quantity" data-track-key-ref="'+esc(line.key)+'" value="'+esc(line.quantity)+'">':String(line.quantity)+(line.isSampler?' <small>cigars</small><span class="trackCellNote">'+line.saleUnits+' sampler(s)</span>':'');
      const unitCost=line.isManual?'<input type="number" min="0" step=".01" data-manual-field="unitCost" data-track-key-ref="'+esc(line.key)+'" value="'+esc(line.unitCost)+'">':money(line.unitCost);
      const custom=columns.map(col=>{const value=col.imported?(line.entry.extra?.[col.header]||''):(line.entry.customCells?.[col.id]||'');return '<td data-label="'+esc(col.header)+'"><input type="text" class="trackCustomInput" data-custom-cell="'+esc(col.id)+'" data-track-key-ref="'+esc(line.key)+'" value="'+esc(value)+'" aria-label="'+esc(col.header)+' for '+esc(line.name)+'"></td>'}).join('');
      const manualType=line.isManual?'<select data-manual-field="type" data-track-key-ref="'+esc(line.key)+'"><option '+(line.isAccessory?'':'selected')+'>Cigar</option><option '+(line.isAccessory?'selected':'')+'>Accessory</option></select>':'';
      const basis=line.entry.salePriceBasis||'total_samplers',basisSelect=line.isSampler?'<select data-sale-basis="'+esc(line.key)+'" aria-label="Sampler selling price basis"><option value="total_samplers" '+(basis==='total_samplers'?'selected':'')+'>Total for all samplers</option><option value="per_sampler" '+(basis==='per_sampler'?'selected':'')+'>Per sampler × '+line.saleUnits+'</option></select>':'';
      const action=line.isManual?'<button type="button" class="btn small del" data-delete-manual="'+esc(line.key)+'" aria-label="Remove '+esc(line.name)+'">×</button>':'—';
      return '<tr data-track-search="'+esc(search)+'" data-track-key="'+esc(line.key)+'"><td class="trackItemCell" data-label="Item">'+photo+'<div class="trackItemText">'+itemContent+'<div class="trackMeta">'+esc(new Date(line.date||0).toLocaleDateString())+' · '+esc(line.type)+' · '+esc(line.supplier||'Unknown supplier')+'</div>'+manualType+'<div class="trackDetails">'+esc(line.details)+'</div></div></td><td data-label="Quantity">'+qty+'</td><td data-label="Cost / unit (EGP)">'+unitCost+'</td><td data-label="Item cost (EGP)" title="Cost per unit × quantity">'+money(line.lineCost)+'</td><td data-label="Selling price / '+esc(line.saleUnitLabel)+'">'+basisSelect+'<input type="number" min="0" step=".01" value="'+esc(line.entry.salePrice??'')+'" data-sale-price="'+esc(line.key)+'" aria-label="Selling price per '+esc(line.saleUnitLabel)+' for '+esc(line.name)+'" placeholder="'+(line.isSampler&&basis==='total_samplers'?'Total for all':'Enter price')+'"></td><td data-label="Total sale (EGP)" title="Selling price × sale units">'+(m.revenue==null?'—':money(m.revenue))+'</td><td data-label="Profit (EGP)" title="Total sale − item cost">'+(m.profit==null?'—':money(m.profit))+'</td><td data-label="Profit / cigar or unit (EGP)" title="Profit ÷ quantity">'+(m.perPiece==null?'—':money(m.perPiece))+'</td>'+custom+'<td data-label="Actions">'+action+'</td></tr>'}).join('');
    const table=lines.length?'<div class="trackSheetWrap" style="--extra-cols:'+Math.max(columns.length,1)+'"><table class="trackSheet"><thead><tr>'+headers.map((h,i)=>'<th title="'+(i===3?'Cost per unit × quantity':i===5?'Selling price × sale units':i===6?'Total sale − item cost':i===7?'Profit ÷ cigar or unit count':'')+'">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="muted" style="padding:18px;text-align:center">Save cigar orders or accessory purchases to see them here.</div>';
    panel.innerHTML='<div class="trackHead"><div><h3>Sales &amp; profit spreadsheet</h3><div class="note">One item per row. Formulas update automatically: item cost = cost/unit × quantity; sampler sales use sampler count; profit = total sale − item cost; profit per cigar or unit = profit ÷ quantity.</div><label style="display:flex;align-items:center;gap:7px;margin-top:9px"><input id="salesTrackingSelectedOnly" type="checkbox" style="width:18px;height:18px" '+(selectedOnly?'checked':'')+'>Use selected orders from Order History</label></div><div class="buttons"><label class="btn" for="salesTrackingImport">Import edited CSV</label><input id="salesTrackingImport" type="file" accept=".csv,text/csv" class="hidden"><button class="btn" id="salesTrackingAddColumn">＋ Add column</button><button class="btn" id="salesTrackingAddRow">＋ Add row</button><button class="btn primary" id="salesTrackingExport">Download updated CSV</button></div></div><div id="salesTrackingSummary" class="break"></div><input class="dbSearch" id="salesTrackingSearch" placeholder="Search items, suppliers, or order IDs…" style="margin:0 0 10px">'+table+'<div id="salesTrackingStatus" class="note" style="margin-top:9px"></div>';
    summary();
    panel.querySelectorAll('[data-sale-price]').forEach(input=>input.addEventListener('input',()=>{const line=lines.find(x=>x.key===input.dataset.salePrice);if(!line)return;line.entry.salePrice=input.value;delete line.entry.legacy;delete line.entry.legacyRevenue;delete line.entry.legacyProfit;delete line.entry.legacyPerPiece;state.entries[line.key]=line.entry;saveState();refreshRow(line);summary()}));
    panel.querySelectorAll('[data-sale-basis]').forEach(select=>select.addEventListener('change',()=>{const line=lines.find(x=>x.key===select.dataset.saleBasis);if(!line)return;line.entry.salePriceBasis=select.value;delete line.entry.legacy;delete line.entry.legacyRevenue;delete line.entry.legacyProfit;delete line.entry.legacyPerPiece;state.entries[line.key]=line.entry;saveState();refreshRow(line);summary()}));
    panel.querySelectorAll('[data-manual-field]').forEach(input=>input.addEventListener('change',()=>{const line=lines.find(x=>x.key===input.dataset.trackKeyRef);if(!line?.manualRow)return;line.manualRow[input.dataset.manualField]=input.value;if(input.dataset.manualField==='type')line.manualRow.unitLabel=input.value==='Accessory'?'accessory unit':'cigar stick';saveState();render()}));
    panel.querySelectorAll('[data-custom-cell]').forEach(input=>input.addEventListener('change',()=>{const line=lines.find(x=>x.key===input.dataset.trackKeyRef);if(!line)return;if(input.dataset.customCell.startsWith('csv-')){line.entry.extra=line.entry.extra||{};const col=columns.find(x=>x.id===input.dataset.customCell);if(col)line.entry.extra[col.header]=input.value}else{line.entry.customCells=line.entry.customCells||{};line.entry.customCells[input.dataset.customCell]=input.value}state.entries[line.key]=line.entry;saveState()}));
    panel.querySelectorAll('[data-track-photo]').forEach(button=>button.addEventListener('click',()=>{const line=lines.find(x=>x.key===button.dataset.trackPhoto),photos=(line?.itemPics||line?.orderPics||'').split(' | ').filter(Boolean);if(photos.length)window.openPhotoGallery?.(photos)}));
    document.getElementById('salesTrackingAddColumn').onclick=()=>{const header=prompt('Name for the new spreadsheet column:');if(!header?.trim())return;const name=header.trim();if(customColumns().some(x=>normalized(x.header)===normalized(name))||[...BASE_HEADERS,...CALC_HEADERS].some(x=>normalized(x)===normalized(name)))return alert('That column already exists.');state.customColumns.push({id:'custom-'+Date.now(),header:name});saveState();render()};
    document.getElementById('salesTrackingAddRow').onclick=()=>{state.manualRows.push({id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),date:stamp(),type:'Cigar',name:'',supplier:'',quantity:1,unitCost:0,unitLabel:'cigar stick'});saveState();render()};
    panel.querySelectorAll('[data-delete-manual]').forEach(button=>button.onclick=()=>{const key=button.dataset.deleteManual;state.manualRows=state.manualRows.filter(row=>'manual-'+row.id!==key);delete state.entries[key];saveState();render()});
    document.getElementById('salesTrackingExport').onclick=exportCsv;
    document.getElementById('salesTrackingImport').onchange=importCsv;
    document.getElementById('salesTrackingSelectedOnly').onchange=e=>{selectedOnly=e.target.checked;render()};
    document.getElementById('salesTrackingSearch').oninput=e=>{const q=normalized(e.target.value);panel.querySelectorAll('[data-track-search]').forEach(row=>row.hidden=!!q&&!row.dataset.trackSearch.includes(q))};
  }
  function csvRows(text){
    const rows=[];let row=[],cell='',quoted=false;const s=String(text||'').replace(/^\uFEFF/,'');
    for(let i=0;i<s.length;i++){const c=s[i];if(quoted){if(c==='"'&&s[i+1]==='"'){cell+='"';i++}else if(c==='"')quoted=false;else cell+=c}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell=''}else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell=''}else if(c!=='\r')cell+=c}
    if(cell!==''||row.length){row.push(cell);rows.push(row)}return rows;
  }
  const headerKey=x=>normalized(x).replace(/[^a-z0-9]/g,'');
  function exportCsv(){
    if(!lines.length)return alert('There are no order items to export.');
    const headers=state.headerOrder.length?state.headerOrder.slice():[...BASE_HEADERS,...CALC_HEADERS];
    const column=name=>headers.findIndex(h=>headerKey(h)===headerKey(name));
    const ensureColumn=name=>{let i=column(name);if(i<0){headers.push(name);i=headers.length-1}return i};
    [...BASE_HEADERS,...CALC_HEADERS,...state.extraHeaders,...state.customColumns.map(x=>x.header)].forEach(ensureColumn);
    const rows=[headers],orderPaid=new Map(),writtenOrders=new Set();let cigars=0,accessories=0,sales=0,profit=0,cost=0;
    lines.forEach(line=>{
      const m=saleMath(line);if(line.isAccessory)accessories+=line.quantity;else cigars+=line.quantity;cost+=line.lineCost;if(m.revenue!=null)sales+=m.revenue;if(m.profit!=null)profit+=m.profit;if(!orderPaid.has(line.orderKey))orderPaid.set(line.orderKey,line.paid);
      const firstOrderRow=!writtenOrders.has(line.orderKey);writtenOrders.add(line.orderKey);
      const entry=line.entry,calc=[entry.salePrice??'',line.isSampler?(entry.salePriceBasis||'total_samplers'):'',m.revenue==null?'':m.revenue.toFixed(2),m.profit==null?'':m.profit.toFixed(2),m.perPiece==null?'':m.perPiece.toFixed(2)];
      const row=Array(headers.length).fill('');(entry.importedCells||[]).forEach((v,i)=>{if(i<row.length)row[i]=v});
      const values=[line.date,line.type,line.orderId,line.supplier,line.name,line.details,line.quantity,line.unitCost.toFixed(2),line.lineCost.toFixed(2),firstOrderRow?line.paid.toFixed(2):'',line.itemPics,line.orderPics];
      BASE_HEADERS.forEach((h,i)=>row[column(h)]=values[i]);CALC_HEADERS.forEach((h,i)=>row[column(h)]=calc[i]);state.extraHeaders.forEach(h=>row[column(h)]=line.entry.extra?.[h]??row[column(h)]);state.customColumns.forEach(col=>row[column(col.header)]=line.entry.customCells?.[col.id]??'');
      rows.push(row);
    });
    const footer=()=>Array(headers.length).fill('');
    const addTotal=(label,baseHeader,value,customHeader)=>{const r=footer();r[0]=label;if(baseHeader)r[column(baseHeader)]=value;if(customHeader)r[column(customHeader)]=value;rows.push(r)};
    rows.push(footer());addTotal('Total actual paid (EGP)','Order actual paid (EGP)',[...orderPaid.values()].reduce((a,b)=>a+b,0).toFixed(2));addTotal('Total cigars (sampler contents counted)','Quantity',cigars);addTotal('Total accessory units','Quantity',accessories);addTotal('Total quantity (cigars + accessory units)','Quantity',cigars+accessories);addTotal('Total assigned item cost','Assigned item total (EGP)',cost.toFixed(2));addTotal('Total price per item',null,sales.toFixed(2),REVENUE_HEADER);addTotal('Total profit',null,profit.toFixed(2),PROFIT_HEADER);
    state.footerRows.forEach(saved=>{const r=footer();(Array.isArray(saved)?saved:[]).forEach((v,i)=>{if(i<r.length)r[i]=v});if(r.some(Boolean))rows.push(r)});
    const quote=v=>{const s=String(v??'');return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cigar-order-summary-'+(selectedOnly?'selected':'all')+'-'+stamp()+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function importCsv(e){
    const file=e.target.files?.[0];if(!file)return;
    try{
      loadState();const rows=csvRows(await file.text());if(rows.length<2)throw new Error('The selected file has no item rows.');const headers=rows[0],idx=name=>headers.findIndex(h=>headerKey(h)===headerKey(name));
      const orderCol=idx('Order / purchase ID'),typeCol=idx('Type'),itemCol=idx('Item'),detailsCol=idx('Item details');if([orderCol,typeCol,itemCol].some(i=>i<0))throw new Error('This CSV is missing order ID, type, or item columns.');
      const saleCol=idx(SALE_HEADER),saleBasisCol=idx(SALE_BASIS_HEADER),revenueCol=idx(REVENUE_HEADER),profitCol=idx(PROFIT_HEADER),pieceCol=idx(PIECE_PROFIT_HEADER),baseKeys=new Set(BASE_HEADERS.map(headerKey)),calcKeys=new Set(CALC_HEADERS.map(headerKey));
      const extras=headers.filter(h=>h&&!baseKeys.has(headerKey(h))&&!calcKeys.has(headerKey(h))&&!/^h\d+$/i.test(h));state.extraHeaders=[...new Set([...state.extraHeaders,...extras])];state.headerOrder=headers.slice();
      const seen=new Map();let imported=0;
      rows.slice(1).forEach(row=>{
        const id=String(row[orderCol]||'').trim(),type=String(row[typeCol]||''),item=String(row[itemCol]||'').trim();if(!id||!item||/^total/i.test(item))return;
        const details=detailsCol>=0?row[detailsCol]||'':'',baseKey=[id,type,normalized(item),normalized(details)].join('|'),occ=seen.get(baseKey)||0;seen.set(baseKey,occ+1);const key=baseKey+'|'+occ,entry=state.entries[key]||{};entry.importedCells=Array.from({length:headers.length},(_,i)=>baseKeys.has(headerKey(headers[i]))||calcKeys.has(headerKey(headers[i]))?'':row[i]||'');
        if(saleCol>=0&&String(row[saleCol]??'').trim()!=='')entry.salePrice=String(num(row[saleCol]));
        if(saleBasisCol>=0&&String(row[saleBasisCol]??'').trim()!=='')entry.salePriceBasis=String(row[saleBasisCol]).trim()==='per_sampler'?'per_sampler':'total_samplers';
        if(revenueCol>=0&&String(row[revenueCol]??'').trim()!==''||profitCol>=0&&String(row[profitCol]??'').trim()!==''){
          entry.legacy=true;entry.legacyRevenue=revenueCol>=0?num(row[revenueCol]):0;entry.legacyProfit=profitCol>=0?num(row[profitCol]):0;entry.legacyPerPiece=pieceCol>=0?num(row[pieceCol]):0;
        }
        entry.extra={...(entry.extra||{})};extras.forEach(h=>{const col=headers.findIndex(x=>x===h);if(col>=0&&row[col])entry.extra[h]=row[col]});state.entries[key]=entry;imported++;
      });
      state.footerRows=rows.slice(1).filter(row=>!row[orderCol]&&row.some(Boolean)&&!/^total/i.test(String(row[0]||'')));saveState();render();const status=document.getElementById('salesTrackingStatus');if(status)status.textContent='Imported '+imported+' item rows. Existing selling prices and calculations are saved on this PWA; future order items will be added at the bottom of the CSV.';
    }catch(err){alert('Could not import this CSV: '+(err.message||err))}finally{e.target.value=''}
  }
  function show(){
    ['current','hist','db','accessories'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));document.getElementById('salesTracking')?.classList.remove('hidden');
    ['orderTab','historyTab','dbTab','accessoryTab','salesTrackingTab'].forEach(id=>document.getElementById(id)?.classList.remove('active'));document.getElementById('salesTrackingTab')?.classList.add('active');render();
  }
  function hide(){document.getElementById('salesTracking')?.classList.add('hidden');document.getElementById('salesTrackingTab')?.classList.remove('active')}
  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('salesTrackingTab')?.addEventListener('click',show);
    ['orderTab','historyTab','dbTab','accessoryTab'].forEach(id=>document.getElementById(id)?.addEventListener('click',hide));
  });
  window.renderSalesTracking=render;
  window.salesTrackingIsVisible=()=>!document.getElementById('salesTracking')?.classList.contains('hidden');
})();




