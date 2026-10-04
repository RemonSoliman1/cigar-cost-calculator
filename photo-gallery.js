'use strict';
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .photoGallery{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}
    .photoGallery.hidden{display:none}
    .photoGalleryMain{position:relative;flex:1;min-height:0;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .photoGalleryImage{max-width:calc(100vw - 100px);max-height:calc(100vh - 190px);object-fit:contain;cursor:zoom-in;transform-origin:center;transition:transform .12s ease}
    .photoGalleryImage.zoomed{cursor:zoom-out}
    .photoGalleryClose,.photoGalleryNav,.photoGalleryZoom{position:absolute;border:1px solid rgba(255,255,255,.3);background:rgba(20,20,20,.75);color:#fff;border-radius:10px;cursor:pointer;font-weight:700}
    .photoGalleryClose{top:12px;right:12px;font-size:22px;width:42px;height:42px}
    .photoGalleryNav{top:50%;transform:translateY(-50%);font-size:28px;width:44px;height:56px}
    .photoGalleryPrev{left:12px}.photoGalleryNext{right:12px}
    .photoGalleryZoom{bottom:18px;left:50%;transform:translateX(-50%);padding:9px 14px}
    .photoGalleryCount{position:absolute;bottom:22px;right:18px;color:#fff;font-size:13px;background:rgba(20,20,20,.65);padding:7px 10px;border-radius:999px}
    .photoGalleryThumbs{display:flex;gap:8px;max-width:100%;overflow-x:auto;padding:10px 0 2px}
    .photoGalleryThumbs img{width:62px;height:62px;object-fit:cover;border-radius:8px;border:2px solid transparent;cursor:pointer}
    .photoGalleryThumbs img.active{border-color:#fff}
    .clickablePhoto{cursor:zoom-in}
    .photoThumbRow{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
    .photoThumb{width:58px;height:58px;object-fit:cover;border-radius:8px;border:1px solid var(--line);cursor:zoom-in}
  `;
  document.head.appendChild(style);
  let modal=null, urls=[], index=0, scale=1;
  function ensure(){
    if(modal)return;
    modal=document.createElement('div');modal.className='photoGallery hidden';
    modal.innerHTML='<button class="photoGalleryClose" aria-label="Close">×</button><div class="photoGalleryMain"><button class="photoGalleryNav photoGalleryPrev" aria-label="Previous">‹</button><img class="photoGalleryImage" alt="Photo preview"><button class="photoGalleryNav photoGalleryNext" aria-label="Next">›</button><div class="photoGalleryCount"></div></div><button class="photoGalleryZoom">Zoom</button><div class="photoGalleryThumbs"></div>';
    document.body.appendChild(modal);
    modal.querySelector('.photoGalleryClose').onclick=close;
    modal.querySelector('.photoGalleryPrev').onclick=()=>move(-1);
    modal.querySelector('.photoGalleryNext').onclick=()=>move(1);
    modal.querySelector('.photoGalleryZoom').onclick=toggleZoom;
    modal.querySelector('.photoGalleryImage').onclick=toggleZoom;
    modal.addEventListener('click',e=>{if(e.target===modal)close()});
    document.addEventListener('keydown',e=>{if(!modal||modal.classList.contains('hidden'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1)});
  }
  function render(){
    const img=modal.querySelector('.photoGalleryImage'), thumbs=modal.querySelector('.photoGalleryThumbs');
    scale=1;img.classList.remove('zoomed');img.style.transform='scale(1)';
    img.src=urls[index];
    modal.querySelector('.photoGalleryCount').textContent=(index+1)+' / '+urls.length;
    thumbs.innerHTML=urls.map((u,i)=>'<img src="'+String(u).replace(/"/g,'&quot;')+'" class="'+(i===index?'active':'')+'" data-i="'+i+'" alt="Thumbnail">').join('');
    thumbs.querySelectorAll('img').forEach(t=>t.onclick=()=>{index=+t.dataset.i;render()});
    modal.querySelector('.photoGalleryPrev').style.display=urls.length>1?'block':'none';
    modal.querySelector('.photoGalleryNext').style.display=urls.length>1?'block':'none';
  }
  function move(delta){if(urls.length<2)return;index=(index+delta+urls.length)%urls.length;render()}
  function toggleZoom(){const img=modal.querySelector('.photoGalleryImage');scale=scale===1?2.5:1;img.style.transform='scale('+scale+')';img.classList.toggle('zoomed',scale!==1)}
  function close(){modal?.classList.add('hidden');document.body.style.overflow=''}
  window.openPhotoGallery=function(list,start=0){
    urls=(Array.isArray(list)?list:[list]).filter(Boolean);
    if(!urls.length)return;
    index=Math.max(0,Math.min(+start||0,urls.length-1));
    ensure();render();modal.classList.remove('hidden');document.body.style.overflow='hidden';
  };
  window.photoUrls=function(primary,extra){return Array.from(new Set([...(Array.isArray(extra)?extra:[]),primary].filter(Boolean)))};
})();