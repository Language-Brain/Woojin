(() => {
  'use strict';
  const fallback={supabaseUrl:'https://vhaosgzyvoijgwryybry.supabase.co',supabasePublishableKey:'sb_publishable_Obv4RYPtgwB71vZ4vOM0iA_jxPfeuZa'};
  const config=window.LANGUAGE_BRAIN_CONFIG?.supabaseUrl?window.LANGUAGE_BRAIN_CONFIG:fallback;
  const db=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey);
  const path=location.pathname.replace(/\/$/,'').split('/').pop();
  const requested=new URLSearchParams(location.search).get('kind');
  const kind=['papers','news','works','videos'].includes(path)?path:['papers','news','works','videos'].includes(requested)?requested:'papers';
  const settings={
    papers:{type:'paper',title:'주목할 논문',eyebrow:'PAPER ARCHIVE',description:'언어·문해·인지와 뇌에 관한 국내외 연구를 한국어로 정리한 자료실입니다.'},
    news:{type:'news',title:'언어, 문해, 인지 관련 기사',eyebrow:'NEWS ARCHIVE',description:'문해, 한국어 교육, 디지털리터러시, 인지 능력 등과 관련한 뉴스를 살펴봅니다.'},
    works:{type:'works',title:'강의·저서·연구 원고',eyebrow:'WORKS ARCHIVE',description:'연구에서 출발해 교육과 삶으로 이어지는 강의, 저서, 연구 원고를 모았습니다.'},
    videos:{type:'video',title:'동영상',eyebrow:'VIDEO ARCHIVE',description:'언어와 뇌, 문해교육의 질문을 짧고 선명하게 살펴보는 영상 자료실입니다.'}
  }[kind];
  document.body.dataset.archiveKind=kind;
  const canonicalUrl=`https://languagebrain.vercel.app/${kind}`;
  document.title=`${settings.title} | 삶과 언어`;
  document.querySelector('meta[name="description"]').content=settings.description;
  document.querySelector('#canonical').href=canonicalUrl;
  document.querySelector('#og-title').content=`${settings.title} | 삶과 언어`;
  document.querySelector('#og-description').content=settings.description;
  document.querySelector('#og-url').content=canonicalUrl;
  const $=s=>document.querySelector(s); const esc=v=>{const n=document.createElement('span');n.textContent=v??'';return n.innerHTML};
  const stateKey=`languagebrain:archive:${kind}`;
  let savedState={};
  try{savedState=JSON.parse(sessionStorage.getItem(stateKey)||'{}')}catch(_error){savedState={}}
  const params=new URLSearchParams(location.search);
  let rows=[],visible=kind==='works'?Math.max(12,Number(savedState.visible)||12):12;
  $('#archive-title').textContent=settings.title; $('#eyebrow').textContent=settings.eyebrow; $('#archive-description').textContent=settings.description;
  $('#search').placeholder='키워드 검색';
  const date=v=>{if(!v)return '날짜 없음';const raw=String(v),parsed=new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw)?`${raw}T00:00:00`:raw);return Number.isNaN(parsed.getTime())?'날짜 없음':parsed.toLocaleDateString('ko-KR')};
  function detailUrl(row){return kind==='videos'?`/video?id=${encodeURIComponent(row.id)}`:`/article?id=${encodeURIComponent(row.id)}`}
  const emptySummary='상세 내용을 준비하고 있습니다.';
  function plainText(value){
    return String(value||'').replace(/!\[[^\]]*\]\([^)]*\)/g,' ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/gi,' ').replace(/[#*_`>|~]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function shorten(value,max=180){
    const text=plainText(value); if(text.length<=max)return text;
    const sample=text.slice(0,max+1); let cut=-1;
    for(const mark of ['. ','다. ','요. ','! ','? ','。','！','？']){const at=sample.lastIndexOf(mark);if(at>=120)cut=Math.max(cut,at+mark.trim().length)}
    if(cut<120){const at=sample.lastIndexOf(' ');cut=at>=120?at:max}
    return `${sample.slice(0,cut).trim()}…`;
  }
  function listSummary(row){
    const html=String(row.content_html||row.content||'').trim();
    if(!html){
      const preserved=[row.excerpt,row.subtitle,row.description].map(plainText).find(value=>value&&value!==emptySummary);
      return preserved?shorten(preserved):emptySummary;
    }
    const doc=new DOMParser().parseFromString(html,'text/html');
    doc.querySelectorAll('script,style,noscript,img,picture,figure,figcaption,table,pre,code,iframe,svg,video,audio,h1,h2,h3,h4,h5,h6').forEach(node=>node.remove());
    const metadata=[row.title,row.original_title,row.authors,row.journal,row.source,row.publisher].map(value=>plainText(value).toLowerCase()).filter(Boolean);
    let candidates=[...doc.body.querySelectorAll('p,li,blockquote')].map(node=>plainText(node.textContent));
    if(!candidates.length)candidates=[plainText(doc.body.textContent)];
    candidates=candidates.filter(text=>{const lower=text.toLowerCase();return text.length>=18&&!metadata.includes(lower)&&!/^(출처|자료|저자|게재|발행|doi|www\.|https?\b|이미지|사진|wiley online library|pubmed)\s*[:：]?/i.test(text)&&!/^[\w.-]+\.(?:jpg|jpeg|png|gif|webp)$/i.test(text)&&!/^\S+(?:\s+\S+){0,5}\s*\(\d{4}\)[.,]/.test(text)});
    if(!candidates.length)return emptySummary;
    let summary=candidates[0];
    for(let index=1;summary.length<120&&index<candidates.length;index+=1)summary+=` ${candidates[index]}`;
    return shorten(summary);
  }
  function workCard(row){
    const match=String(row.title||'').match(/^\[([^\]]+)\]\s*(.*)$/);
    const workType=match?.[1]||row.content_subtype||row.category||row.source||'연구 원고';
    const workTitle=match?.[2]||row.title||'제목 없는 글';
    const summary=row._listSummary||emptySummary;
    const tags=Array.isArray(row.tags)?row.tags.filter(Boolean).slice(0,3):[];
    const image=row.image_url||row.thumbnail_url||'';
    const url=detailUrl(row);
    return `<article class="archive-card works-list-item"><a class="works-list-row" href="${url}" aria-label="${esc(workTitle)} 읽기"><div class="works-list-primary"><span class="works-list-kicker">${esc(workType)}</span><h2>${esc(workTitle)}</h2></div><p class="works-list-summary">${esc(summary)}</p><div class="works-list-meta"><time datetime="${esc(row.published_at||row.updated_at||'')}">${date(row.published_at||row.updated_at||row.created_at)}</time>${tags.length?`<span class="works-list-tags">${tags.map(tag=>`#${esc(String(tag).replace(/^#+/,''))}`).join(' ')}</span>`:''}</div><span class="works-list-thumb">${image?`<img src="${esc(image)}" alt="${esc(row.image_alt||`${workTitle} 대표 이미지`)}" loading="lazy">`:`<span class="works-list-placeholder" aria-hidden="true">삶과 언어</span>`}</span></a></article>`;
  }
  function compactPostCard(row){
    const title=row.title||'제목 없는 글';
    const meta=kind==='papers'?[row.authors,row.publication_year,row.journal||row.source].filter(Boolean).join(' · '):[row.publisher||row.source,date(row.article_date||row.published_at)].filter(Boolean).join(' · ');
    const image=row.image_url||row.thumbnail_url||'';
    return `<article class="archive-card compact-list-item"><a class="compact-list-row" href="${detailUrl(row)}" aria-label="${esc(title)} 읽기"><div class="compact-list-copy"><span class="card-kicker">${esc(row.category||settings.title)}</span><h2>${esc(title)}</h2><p class="compact-list-summary">${esc(row._listSummary||emptySummary)}</p><p class="compact-list-meta">${esc(meta||date(row.published_at||row.updated_at||row.created_at))}</p></div><span class="compact-list-thumb">${image?`<img src="${esc(image)}" alt="${esc(row.image_alt||`${title} 대표 이미지`)}" loading="lazy">`:`<span class="compact-list-placeholder" aria-hidden="true">삶과 언어</span>`}</span></a></article>`;
  }
  function card(row){
    if(kind==='works') return workCard(row);
    if(kind==='papers'||kind==='news') return compactPostCard(row);
    if(kind==='videos'){
      const image=row.custom_image_url||row.thumbnail_url||`https://i.ytimg.com/vi/${row.youtube_id}/hqdefault.jpg`;
      return `<article class="archive-card">${image?`<a href="${detailUrl(row)}"><img class="card-image" src="${esc(image)}" alt="${esc(row.title)} 대표 이미지" loading="lazy"></a>`:''}<span class="card-kicker">${esc(row.category||'동영상')}</span><h2><a href="${detailUrl(row)}">${esc(row.title)}</a></h2><p class="card-meta">${date(row.published_at)}</p><p class="card-summary">${esc(row.description||'동영상 소개를 준비하고 있습니다.')}</p><div class="card-actions"><a href="${detailUrl(row)}">자세히 보기 →</a></div></article>`;
    }
    const meta=kind==='papers'?[row.authors,row.publication_year,row.journal||row.source].filter(Boolean).join(' · '):kind==='news'?[row.publisher||row.source,date(row.article_date||row.published_at)].filter(Boolean).join(' · '):[row.content_subtype||row.source,date(row.published_at)].filter(Boolean).join(' · ');
    const external=kind==='news'&&row.link_url?`<a href="${esc(row.link_url)}" target="_blank" rel="noopener noreferrer">원문 보기 ↗</a>`:'';
    return `<article class="archive-card">${row.image_url?`<a href="${detailUrl(row)}"><img class="card-image" src="${esc(row.image_url)}" alt="${esc(row.image_alt||row.title)}" loading="lazy"></a>`:''}<span class="card-kicker">${esc(row.category||settings.title)}</span><h2><a href="${detailUrl(row)}">${esc(row.title)}</a></h2><p class="card-meta">${esc(meta)}</p><p class="card-summary">${esc(row.excerpt||row.subtitle||'상세 내용을 준비하고 있습니다.')}</p><div class="card-actions"><a href="${detailUrl(row)}">자세히 보기 →</a>${external}</div></article>`;
  }
  function saveState(includeScroll=false){
    if(kind!=='works') return;
    const state={q:$('#search').value,visible,scrollY:includeScroll?window.scrollY:(savedState.scrollY||0)};
    sessionStorage.setItem(stateKey,JSON.stringify(state)); savedState=state;
    const url=new URL(location.href); url.searchParams.delete('q');
    if(state.q)url.searchParams.set('q',state.q);
    history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`);
  }
  function render(){
    const q=$('#search').value.trim().toLocaleLowerCase('ko-KR');
    let filtered=rows.filter(row=>!q||row._searchText.includes(q));
    filtered.sort((a,b)=>kind==='videos'
      ? (Number(a.home_order)||0)-(Number(b.home_order)||0)
      : -String(a.published_at||a.article_date||a.created_at).localeCompare(String(b.published_at||b.article_date||b.created_at)));
    $('#archive-list').innerHTML=filtered.slice(0,visible).map(card).join(''); $('#result-count').textContent=`공개 자료 ${filtered.length}건`; $('#empty').hidden=filtered.length>0; $('#empty').textContent='검색 결과가 없습니다.'; $('#load-more').hidden=filtered.length<=visible; $('#clear-search').hidden=!$('#search').value; saveState();
  }
  async function load(){
    let result;
    if(kind==='videos') result=await db.from('videos').select('*').eq('status','published').neq('youtube_id','');
    else result=await db.from('posts').select('*').eq('status','published').eq('type',settings.type);
    if(result.error){$('#empty').hidden=false;$('#empty').textContent='자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';return}
    rows=(result.data||[]).map(row=>({...row,_listSummary:listSummary(row),_searchText:[row.title,row.subtitle,row.excerpt,row.description,row.content_html,row.content,row.tags,row.authors,row.original_title,row.category,row.source,row.publisher].flat().map(plainText).join(' ').toLocaleLowerCase('ko-KR')}));
    if(kind==='works')$('#search').value=params.get('q')??savedState.q??'';
    render();
    if(kind==='works'&&savedState.scrollY)requestAnimationFrame(()=>window.scrollTo({top:Number(savedState.scrollY)||0,behavior:'auto'}));
  }
  $('#search').addEventListener('input',()=>{visible=12;render()}); $('#clear-search').addEventListener('click',()=>{$('#search').value='';visible=12;render();$('#search').focus()}); $('#load-more').addEventListener('click',()=>{visible+=12;render()});
  if(kind==='works'){document.addEventListener('click',event=>{if(event.target.closest('.works-list-row'))saveState(true)});window.addEventListener('pagehide',()=>saveState(true))}
  load();
})();
