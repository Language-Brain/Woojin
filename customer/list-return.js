(()=>{
  'use strict';
  const CONTEXT_KEY='literacy-talktalk-list-return-v1';
  const RESTORE_KEY='literacy-talktalk-list-scroll-v1';
  const MAX_AGE=2*60*60*1000;
  const LIST_PATHS=new Set(['/','/papers','/news','/works','/videos','/search','/guides','/pyeongjae']);
  const DETAIL_PATHS=new Set(['/article','/guide','/pyeongjae-entry','/video']);
  const current=()=>`${location.pathname}${location.search}${location.hash}`;
  const detailId=url=>`${url.pathname}${url.search}`;
  function parse(value){try{return JSON.parse(value||'null')}catch{return null}}
  function safeUrl(value){try{const url=new URL(value,location.origin);return url.origin===location.origin&&LIST_PATHS.has(url.pathname)?url:null}catch{return null}}
  function context(){try{const item=parse(sessionStorage.getItem(CONTEXT_KEY));if(!item||Date.now()-Number(item.savedAt||0)>MAX_AGE)return null;const list=safeUrl(item.list);return list?{...item,list:`${list.pathname}${list.search}${list.hash}`}:null}catch{return null}}
  function save(item){try{sessionStorage.setItem(CONTEXT_KEY,JSON.stringify(item))}catch{}}
  function capture(link){const target=new URL(link.href,location.href);if(target.origin!==location.origin||!DETAIL_PATHS.has(target.pathname))return;save({detail:detailId(target),list:current(),scrollY:window.scrollY,savedAt:Date.now()})}
  function restoreList(){let item;try{item=parse(sessionStorage.getItem(RESTORE_KEY));sessionStorage.removeItem(RESTORE_KEY)}catch{return}if(!item||item.list!==current()||Date.now()-Number(item.savedAt||0)>MAX_AGE)return;const restore=()=>window.scrollTo({top:Math.max(0,Number(item.scrollY)||0),behavior:'auto'});requestAnimationFrame(restore);setTimeout(restore,250);setTimeout(restore,800)}
  function prepareDetail(){const detail=current().split('#')[0],referrer=safeUrl(document.referrer),saved=context(),navigation=performance.getEntriesByType('navigation')[0]?.type;if(referrer)save({detail,list:`${referrer.pathname}${referrer.search}${referrer.hash}`,scrollY:saved?.list===`${referrer.pathname}${referrer.search}${referrer.hash}`?saved.scrollY:0,savedAt:Date.now()});else if(navigation==='reload'&&saved)save({...saved,detail,savedAt:Date.now()});else if(saved&&document.referrer.startsWith(location.origin))save({...saved,detail,savedAt:Date.now()});else try{sessionStorage.removeItem(CONTEXT_KEY)}catch{}document.querySelectorAll('[data-list-return]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();const item=context(),fallback=safeUrl(button.dataset.listFallback)||new URL('/',location.origin),target=item&&item.detail===detail?item.list:`${fallback.pathname}${fallback.search}${fallback.hash}`;try{sessionStorage.setItem(RESTORE_KEY,JSON.stringify({list:target,scrollY:item?.scrollY||0,savedAt:Date.now()}))}catch{}if(item&&item.detail===detail&&referrer&&`${referrer.pathname}${referrer.search}${referrer.hash}`===target&&navigation!=='reload')history.back();else location.assign(target)}))}
  document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link&&LIST_PATHS.has(location.pathname))capture(link)},true);
  if(LIST_PATHS.has(location.pathname))restoreList();
  if(DETAIL_PATHS.has(location.pathname))prepareDetail();
})();
