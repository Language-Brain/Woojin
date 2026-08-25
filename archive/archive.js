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
    news:{type:'news',title:'뇌·인지 뉴스',eyebrow:'NEWS ARCHIVE',description:'연구 결과와 보도를 구분해 읽을 수 있도록 선별하고 검토한 뉴스입니다.'},
    works:{type:'works',title:'강의·저서·연구 원고',eyebrow:'WORKS ARCHIVE',description:'연구에서 출발해 교육과 삶으로 이어지는 강의, 저서, 연구 원고를 모았습니다.'},
    videos:{type:'video',title:'동영상',eyebrow:'VIDEO ARCHIVE',description:'언어와 뇌, 문해교육의 질문을 짧고 선명하게 살펴보는 영상 자료실입니다.'}
  }[kind];
  document.body.dataset.archiveKind=kind;
  const $=s=>document.querySelector(s); const esc=v=>{const n=document.createElement('span');n.textContent=v??'';return n.innerHTML};
  let rows=[],visible=12;
  document.title=`${settings.title} | 언어와 문해 연구실`; $('#archive-title').textContent=settings.title; $('#eyebrow').textContent=settings.eyebrow; $('#archive-description').textContent=settings.description;
  $('#search').placeholder=kind==='papers'?'제목·원문 제목·저자 검색':'제목 또는 설명 검색';
  const date=v=>v?new Date(`${v}T00:00:00`).toLocaleDateString('ko-KR'):'날짜 없음';
  function detailUrl(row){return kind==='videos'?`/video?id=${encodeURIComponent(row.id)}`:`/article?id=${encodeURIComponent(row.id)}`}
  function card(row){
    if(kind==='videos'){
      const image=row.custom_image_url||row.thumbnail_url||`https://i.ytimg.com/vi/${row.youtube_id}/hqdefault.jpg`;
      return `<article class="archive-card">${image?`<a href="${detailUrl(row)}"><img class="card-image" src="${esc(image)}" alt="${esc(row.title)} 대표 이미지" loading="lazy"></a>`:''}<span class="card-kicker">${esc(row.category||'동영상')}</span><h2><a href="${detailUrl(row)}">${esc(row.title)}</a></h2><p class="card-meta">${date(row.published_at)}</p><p class="card-summary">${esc(row.description||'동영상 소개를 준비하고 있습니다.')}</p><div class="card-actions"><a href="${detailUrl(row)}">자세히 보기 →</a></div></article>`;
    }
    const meta=kind==='papers'?[row.authors,row.publication_year,row.journal||row.source].filter(Boolean).join(' · '):kind==='news'?[row.publisher||row.source,date(row.article_date||row.published_at)].filter(Boolean).join(' · '):[row.content_subtype||row.source,date(row.published_at)].filter(Boolean).join(' · ');
    const external=kind==='news'&&row.link_url?`<a href="${esc(row.link_url)}" target="_blank" rel="noopener noreferrer">원문 보기 ↗</a>`:'';
    const workMatch=String(row.title||'').match(/^\[([^\]]+)\]\s*(.*)$/),workType=workMatch?.[1]||row.content_subtype||row.category||row.source||'칼럼',workTitle=workMatch?.[2]||row.title;
    return `<article class="archive-card">${row.image_url?`<a href="${detailUrl(row)}"><img class="card-image" src="${esc(row.image_url)}" alt="${esc(row.image_alt||row.title)}" loading="lazy"></a>`:''}${kind==='works'?'':`<span class="card-kicker">${esc(row.category||settings.title)}</span>`}<h2><a href="${detailUrl(row)}"${kind==='works'?` data-type="${esc(workType)}"`:''}>${esc(kind==='works'?workTitle:row.title)}</a></h2><p class="card-meta">${esc(meta)}</p><p class="card-summary">${esc(row.excerpt||row.subtitle||'상세 내용을 준비하고 있습니다.')}</p><div class="card-actions"><a href="${detailUrl(row)}">자세히 보기 →</a>${external}</div></article>`;
  }
  function render(){
    const q=$('#search').value.trim().toLowerCase(),topic=$('#topic').value,old=$('#sort').value==='old';
    let filtered=rows.filter(r=>{const hay=kind==='papers'?`${r.title} ${r.original_title} ${r.authors}`:`${r.title} ${r.description||r.excerpt||''}`;return(!q||hay.toLowerCase().includes(q))&&(topic==='all'||r.category===topic)});
    filtered.sort((a,b)=>kind==='videos'
      ? (old?-1:1)*((Number(a.home_order)||0)-(Number(b.home_order)||0))
      : (old?1:-1)*String(a.published_at||a.article_date||a.created_at).localeCompare(String(b.published_at||b.article_date||b.created_at)));
    $('#archive-list').innerHTML=filtered.slice(0,visible).map(card).join(''); $('#result-count').textContent=`공개 자료 ${filtered.length}건`; $('#empty').hidden=filtered.length>0; $('#load-more').hidden=filtered.length<=visible;
  }
  async function load(){
    let result;
    if(kind==='videos') result=await db.from('videos').select('*').eq('status','published').neq('youtube_id','');
    else result=await db.from('posts').select('*').eq('status','published').eq('type',settings.type);
    if(result.error){$('#empty').hidden=false;$('#empty').textContent='자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';return}
    rows=result.data||[]; const topics=[...new Set(rows.map(r=>r.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
    $('#topic').insertAdjacentHTML('beforeend',topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')); render();
  }
  ['#search','#topic','#sort'].forEach(s=>$(s).addEventListener('input',()=>{visible=12;render()})); $('#load-more').addEventListener('click',()=>{visible+=12;render()}); load();
})();
