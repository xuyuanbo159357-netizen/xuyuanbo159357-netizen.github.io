(() => {
  const page=JSON.parse(document.querySelector('#page-data').textContent);
  const E=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e};
  const dialog=document.querySelector('#search-dialog'), input=document.querySelector('#search-input');
  let catalog=[];
  const openSearch=()=>{dialog.showModal();input.focus()};
  document.querySelector('#search-open').onclick=openSearch;
  document.querySelector('#search-close').onclick=()=>dialog.close();
  document.querySelector('#menu').onclick=()=>document.body.classList.toggle('menu-open');
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();openSearch()}});
  function link(n){const a=E('a',null,n.title);a.href=n.url;if(n.source===page.source)a.setAttribute('aria-current','page');return a}
  const sidebar=document.querySelector('#sidebar'), sidebarStateKey='oxfordaqa-sidebar-state-v1';
  function readSidebarState(){
    try{
      const value=JSON.parse(sessionStorage.getItem(sidebarStateKey)||'null');
      return value?.version===1&&value.folders&&typeof value.folders==='object'?value:null;
    }catch{return null;}
  }
  const initialSidebarState=readSidebarState();
  let navigationReady=false,sidebarSaveTimer;
  function folderDetails(details,key,fallback){
    details.dataset.navFolder=key;
    details.open=initialSidebarState&&Object.hasOwn(initialSidebarState.folders,key)?!!initialSidebarState.folders[key]:fallback;
    return details;
  }
  function saveSidebarState(){
    if(!navigationReady||!sidebar)return;
    clearTimeout(sidebarSaveTimer);
    const folders={};document.querySelectorAll('#navigation details[data-nav-folder]').forEach(d=>{folders[d.dataset.navFolder]=d.open;});
    try{sessionStorage.setItem(sidebarStateKey,JSON.stringify({version:1,folders,scrollTop:sidebar.scrollTop}));}catch{}
  }
  function scheduleSidebarSave(){if(navigationReady){clearTimeout(sidebarSaveTimer);sidebarSaveTimer=setTimeout(saveSidebarState,80);}}
  function restoreSidebarState(){
    const saved=readSidebarState();navigationReady=false;
    if(saved)document.querySelectorAll('#navigation details[data-nav-folder]').forEach(d=>{
      if(Object.hasOwn(saved.folders,d.dataset.navFolder))d.open=!!saved.folders[d.dataset.navFolder];
    });
    requestAnimationFrame(()=>{
      if(saved&&sidebar)sidebar.scrollTop=Math.max(0,Number(saved.scrollTop)||0);
      else document.querySelector('#navigation a[aria-current]')?.scrollIntoView({block:'nearest'});
      navigationReady=true;
    });
  }
  document.addEventListener('toggle',event=>{if(event.target.matches?.('#navigation details[data-nav-folder]'))scheduleSidebarSave();},true);
  sidebar?.addEventListener('scroll',scheduleSidebarSave,{passive:true});
  document.addEventListener('click',event=>{if(event.target.closest?.('a[href]'))saveSidebarState();},true);
  document.addEventListener('auxclick',event=>{if(event.target.closest?.('a[href]'))saveSidebarState();},true);
  window.addEventListener('pagehide',saveSidebarState);
  window.addEventListener('pageshow',event=>{if(event.persisted)restoreSidebarState();});

  function branch(items,base,level=0){
    const frag=document.createDocumentFragment(), groups=new Map();
    items.forEach(n=>{const bits=n.folder.slice(base.length).replace(/^\//,'').split('/').filter(Boolean);const key=bits[0]||'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n)});
    for(const [name,children]of groups){
      if(!name){children.forEach(n=>frag.append(link(n)));continue}
      const details=E('details'), summary=E('summary',null,name);details.append(summary);
      const folder=base?base+'/'+name:name;folderDetails(details,folder,page.source.startsWith(folder+'/')&&(level<2));
      details.append(branch(children,folder,level+1));frag.append(details);
    }return frag;
  }
  fetch('/assets/catalog.json?v=u1-u4-20261019-exam-analysis-and-current-notes').then(r=>r.json()).then(data=>{
    catalog=data; const nav=document.querySelector('#navigation');nav.replaceChildren();
    const top=E('a',null,'首页 / Start here');top.href='/knowledge.html';nav.append(top);
    const maps=E('a',null,'知识谱系图 / Knowledge maps');maps.href='/maps.html';nav.append(maps);
    const graph=E('a',null,'笔记关系图 / Relationships');graph.href='/graph.html';nav.append(graph);
    const prefix='A-level 物理/AQA（OxfordAQA 9630）';
    const general=catalog.filter(n=>n.folder===prefix);general.forEach(n=>nav.append(link(n)));
    for(const u of ['U1','U2','U3','U4']){
      const d=E('details'),s=E('summary',null,u+' · '+({U1:'力学、材料与原子',U2:'电学、波与粒子',U3:'场及其影响',U4:'能量与能源'}[u]));
      folderDetails(d,prefix+'/'+u,page.unit===u);d.append(s,branch(catalog.filter(n=>n.unit===u),prefix+'/'+u));nav.append(d);
    }
    restoreSidebarState();
  }).catch(()=>document.querySelector('#navigation').textContent='目录加载失败，请刷新 / Reload to load contents');
  let timer;
  input.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{
    const q=input.value.trim().toLowerCase(),tokens=q.split(/\s+/), out=document.querySelector('#search-results');out.replaceChildren();
    if(!q){out.textContent='输入关键词搜索本知识库';return}
    const matches=catalog.map(n=>{const title=n.title.toLowerCase(),text=n.text.toLowerCase();if(!tokens.every(t=>title.includes(t)||text.includes(t)))return null;return{n,score:tokens.reduce((s,t)=>s+(title.includes(t)?10:1),0)}}).filter(Boolean).sort((a,b)=>b.score-a.score);
    out.append(E('div','search-count',`${matches.length} 个结果 / results · 最多显示前 80 项`));
    matches.slice(0,80).forEach(({n})=>{const a=E('a','search-item');a.href=n.url;a.append(E('strong',null,n.title),E('small',null,n.source));const pos=n.text.toLowerCase().indexOf(tokens[0]);a.append(E('p',null,n.text.slice(Math.max(0,pos-35),Math.max(0,pos-35)+170)+'…'));out.append(a)});
  },140)};
  // Reveal the destination when following a heading inside a folded answer.
  function revealHash(){if(!location.hash)return;const t=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(t){let n=t.parentElement;while(n){if(n.tagName==='DETAILS')n.open=true;n=n.parentElement}t.scrollIntoView()}}
  window.addEventListener('hashchange',revealHash);revealHash();
  // MathJax is kept with the site so formulas also work without an external CDN.
  if(document.querySelector('.math')){
    window.MathJax={tex:{inlineMath:[['\\(','\\)']],displayMath:[['\\[','\\]']],tags:'none'},svg:{fontCache:'local'},options:{enableMenu:false},startup:{ready:()=>{MathJax.startup.defaultReady();MathJax.startup.promise.then(()=>{document.body.dataset.mathReady='true';revealHash()})}}};
    const s=E('script');s.src='/assets/mathjax/tex-svg-full.js';s.defer=true;document.head.append(s);
  }
  const blocks=[...document.querySelectorAll('pre code.language-mermaid')];
  if(blocks.length){blocks.forEach(c=>{const div=E('div','mermaid',c.textContent);c.parentElement.replaceWith(div)});const s=E('script');s.src='/assets/mermaid.min.js';s.onload=()=>{const engine=window.mermaid?.default||window.mermaid;engine?.initialize({startOnLoad:false,securityLevel:'strict',theme:'neutral'});engine?.run({querySelector:'.mermaid'})};document.head.append(s)}
})();

(async function(){
  'use strict';
  const base='/assets/physics-hover/', version='20261020-3';
  try{
    const style=document.createElement('link');style.rel='stylesheet';style.href=base+'hover.css?v='+version;document.head.append(style);
    if(!globalThis.PhysicsHoverCore){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=base+'hover-core.js?v='+version;script.onload=resolve;script.onerror=reject;document.head.append(script);});}
    const [glossary,imageIndex,extension,inventory]=await Promise.all(['glossary.json','image-index.json','extended-glossary.json','word-inventory.json'].map(name=>fetch(base+name+'?v='+version).then(r=>{if(!r.ok)throw new Error('Local translation data unavailable');return r.json();})));
    const shards=new Map();let saved=null;try{saved=localStorage.getItem('physics-hover-enabled');}catch{}
    const countsKey='physics-hover-query-counts-v2';
    const readCounts=()=>{const value=localStorage.getItem(countsKey);return value?JSON.parse(value):{};};
    let queryCounts={};try{queryCounts=readCounts();}catch{}
    globalThis.physicsHoverController=PhysicsHoverCore.mount({
      glossary,imageIndex,extension,inventory,queryCounts,readCounts,dwellMs:2010,onCountsChange:data=>{window.dispatchEvent(new CustomEvent('physics-knowledge-query',{detail:data}));try{localStorage.setItem(countsKey,JSON.stringify(data));return true;}catch{return false;}},enabled:saved!=='false',toggleHost:document.querySelector('header nav'),scope:'main',
      unitFor:()=>JSON.parse(document.getElementById('page-data')?.textContent||'{}').unit||'',
      contextFor:()=>JSON.parse(document.getElementById('page-data')?.textContent||'{}').source||'',
      imageKeyFor:img=>new URL(img.currentSrc||img.src,location.href).pathname,
      loadImage:async id=>{const shard=id.slice(0,2);if(!shards.has(shard))shards.set(shard,fetch(base+'image-words/'+shard+'.json?v='+version).then(r=>{if(!r.ok)throw new Error('Image text unavailable');return r.json();}));return (await shards.get(shard))[id];},
      onEnabledChange:value=>{try{localStorage.setItem('physics-hover-enabled',String(value));}catch{}},
    });
  }catch(error){console.warn('本地悬停词库加载失败；刷新页面可重试。',error);}
})();

// Per-subpart teaching difficulty, kept separate from official exam answers.
(async()=>{try{const page=JSON.parse(document.getElementById('page-data')?.textContent||'{}'),src=page.source||'';const m=src.match(/\/PH0([1-4]) (20\d{4}) Q(\d+)(?:\.(\d+))?[^/]*\.md$/);if(!m||!src.includes('/06 真题练习/'))return;const parent=`PH0${m[1]}-${m[2]}-Q${m[3].padStart(2,'0')}`;const [data,ui]=await Promise.all([fetch('/assets/question-difficulty.json').then(r=>r.json()),import('/difficulty.js')]);let rows=data.questions[parent];if(!rows)return;if(m[4])rows=rows.filter(r=>r.part===String(Number(m[4])));if(!rows.length)return;const d=rows.reduce((a,b)=>a.difficulty.stars>=b.difficulty.stars?a:b).difficulty,box=document.createElement('section');box.className='exam-difficulty';box.innerHTML=ui.difficulty({number:Number(m[3]),difficulty:d,subparts:rows});const h=document.querySelector('main h1');if(h)h.insertAdjacentElement('afterend',box);}catch(error){console.warn('题目星级暂未加载',error);}})();
