(function(root){
  'use strict';
  const normalize = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[‐‑‒–—−]/g,'-').replace(/[’]/g,"'").replace(/[^a-z'0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const tokens = s => [...String(s).matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)].map(m=>({word:m[0],start:m.index,end:m.index+m[0].length}));
  function makeDictionary(data,extension={entries:[]}){
    const index=new Map();
    for(const entry of [...data.entries.map(e=>({...e,category:'professional'})),...extension.entries.map(e=>({...e,category:'extended'}))]){
      for(const f of new Set([entry.term,...(entry.forms||[])])){
        const key=normalize(f); if(!key)continue;
        if(!index.has(key))index.set(key,[]);index.get(key).push(entry);
      }
    }
    function candidates(key){
      if(index.has(key))return index.get(key);
      if(key.includes(' ')||key.length<4)return [];
      const forms=[];
      if(key.endsWith('ies'))forms.push(key.slice(0,-3)+'y');
      if(key.endsWith('s')&&!key.endsWith('ss'))forms.push(key.slice(0,-1));
      if(key.endsWith('es'))forms.push(key.slice(0,-2));
      if(key.endsWith('ed'))forms.push(key.slice(0,-1),key.slice(0,-2),key.slice(0,-3));
      if(key.endsWith('ing'))forms.push(key.slice(0,-3),key.slice(0,-3)+'e',key.slice(0,-4));
      for(const f of forms)if(index.has(f))return index.get(f);
      return [];
    }
    function contextual(word,text,position,chapter=''){
      const s=text.toLowerCase(), near=s.slice(Math.max(0,position-100),position+140)+' '+chapter.toLowerCase(), w=normalize(word);
      const after=s.slice(position), before=s.slice(Math.max(0,position-70),position);
      if(w==='moment' && /(?:at|this|that|any|every|the same|particular)\s+(?:\w+\s+)?$/.test(before))return ['时刻','时间语境'];
      if(w==='moment')return ['力矩','力学词义；转动惯量等词组会优先识别'];
      if(w==='work' && /(?:show|your|working|how|does|to)\s+(?:\w+\s+)?$/.test(before) && !/work done|work against/.test(after.slice(0,40)))return ['计算过程；工作','请结合原句，不按物理量“功”处理'];
      if(w==='work')return ['功；做功','物理语境'];
      if(w==='power' && /to the\s*$/.test(before))return ['幂；次方','数学语境'];
      if(w==='power')return ['功率','能量转移的快慢'];
      if(w==='current' && /current\s+(?:year|paper|page|version|website|session|study)/.test(after))return ['当前的','普通形容词用法'];
      if(w==='current')return ['电流','电学语境'];
      if(w==='state' && /state\s+(?:of|in|change|changes|is|was)/.test(after))return ['状态；物态','名词用法'];
      if(w==='state')return ['写出；陈述','题目指令；ground state 等词组会优先识别'];
      if(w==='states' && /states\s+that/.test(after))return ['指出；陈述','动词用法'];
      if(['show','shows','shown','showing'].includes(w)){
        if(/graph|figure|table|diagram|illustration/.test(near))return ['显示；图示','图像或表格所示'];
        if(/show\s+(?:how|why)/.test(after))return ['说明；解释','题目指令'];
        return ['显示；表明','show that 作为完整词组时译为“证明”'];
      }
      if(w==='mean' && /mean\s+by/.test(after))return ['意指；所指的意思','定义或解释用语'];
      if(w==='means' || w==='meant')return ['意味着；指的是','动词用法'];
      if(w==='mean')return ['平均的；平均值','统计或物理量语境'];
      if(w==='period' && /(?:during|over|for)\s+(?:a|the|this|that)\s*$/.test(before))return ['时间段','描述持续时间'];
      if(w==='period')return ['周期','周期运动或振动语境'];
      if(w==='normal' && /normal\s+(?:conditions|distribution|operation)/.test(after))return ['正常的；常规的','普通形容词用法'];
      if(w==='normal' && /ray|refraction|reflection|incidence|angle|surface/.test(near))return ['法线；垂直于表面的','光学或几何语境'];
      if(w==='normal')return ['法向的；正常的','需结合原句；normal force 等词组优先'];
      if(w==='charge' && /charge\s+(?:the|a|this)\s+(?:capacitor|battery|cell)/.test(after))return ['给……充电','动词用法'];
      if(w==='field')return ['场','物理语境；具体场名优先识别为词组'];
      if(w==='potential'){
        if(/gravitational/.test(near))return ['引力势','引力场语境'];
        if(/electric|charge|volt|capacitor/.test(near))return ['电势','电场语境'];
        return ['势；可能的','需结合原句；potential energy / difference 等词组优先'];
      }
      return null;
    }
    function lookup(text,offset,unit='',chapter=''){
      const tt=tokens(text), at=tt.findIndex(t=>t.start<=offset&&offset<t.end);
      if(at<0)return null;
      let best=null;
      for(let start=Math.max(0,at-7);start<=at;start++){
        for(let end=at;end<Math.min(tt.length,start+8);end++){
          let valid=true;
          for(let j=start;j<end;j++)if(!/^[\s‐‑‒–—-]*$/.test(text.slice(tt[j].end,tt[j+1].start)))valid=false;
          if(!valid)continue;
          const key=tt.slice(start,end+1).map(t=>normalize(t.word)).join(' '), hits=candidates(key);
          for(const e of hits){
            const score=(end-start+1)*100+(e.category==='professional'?40:0)+(e.kind==='reviewed'?20:0)+(e.units?.includes(unit)?10:0);
            if(!best||score>best.score)best={entry:e,score,start:tt[start].start,end:tt[end].end,count:end-start+1};
          }
        }
      }
      if(best){
        const display=text.slice(best.start,best.end);
        const context=best.count===1?contextual(tt[at].word,text,tt[at].start,chapter):null;
        return {word:display,term:best.entry.term,hoveredWord:tt[at].word,wordKey:normalize(tt[at].word),category:best.entry.category,zh:context?.[0]||best.entry.zh,hint:context?.[1]||(best.count>1?'完整词组优先':best.entry.category==='professional'?'原专业重点词库':'扩展英文词库 · 常用词典义'),source:best.entry.source,found:best.entry.status!=='pending',start:best.start,end:best.end};
      }
      const special=contextual(tt[at].word,text,tt[at].start,chapter);
      return {word:tt[at].word,term:normalize(tt[at].word),hoveredWord:tt[at].word,wordKey:normalize(tt[at].word),category:'extended',zh:special?.[0]||'本地词库暂未收录',hint:special?.[1]||'未作推断，可加入自定义词汇',found:!!special,start:tt[at].start,end:tt[at].end};
    }
    return {lookup,index};
  }

  function makeCounter(initial,onChange,readLatest){
    const clean=value=>({version:2,total:Number(value?.total)||0,words:{...(value?.words||{})},terms:{...(value?.terms||{})}});
    let data=clean(initial),persisted=true;
    const get=(map,key)=>Object.hasOwn(map,key)?map[key]:null;
    function refresh(){if(readLatest){try{data=clean(readLatest()||data);}catch{persisted=false;}}return data;}
    function record(result){
      refresh();const now=new Date().toISOString();
      const word=normalize(result.wordKey||result.hoveredWord||result.word),term=normalize(result.term||result.word);
      for(const [map,key,display] of [[data.words,word,result.hoveredWord||word],[data.terms,term,result.term||result.word]]){
        const prior=get(map,key);map[key]={count:(Number(prior?.count)||0)+1,lastQueriedAt:now,display,category:result.category,zh:result.zh};
      }
      data.total++;data.updatedAt=now;
      try{const saved=onChange?.(JSON.parse(JSON.stringify(data)));if(saved===false)persisted=false;else if(saved?.then)saved.catch(()=>{persisted=false;});}catch{persisted=false;}
      return get(data.words,word).count;
    }
    return {record,refresh,get data(){return data;},get persisted(){return persisted;},countWord:key=>Number(get(data.words,normalize(key))?.count)||0,countTerm:key=>Number(get(data.terms,normalize(key))?.count)||0};
  }

  function mount(options){
    const doc=options.document||document,win=doc.defaultView;
    const dictionary=makeDictionary(options.glossary,options.extension),cache=new Map(),pending=new Map();
    const counter=makeCounter(options.queryCounts,options.onCountsChange,options.readCounts);
    const dwellMs=Math.max(2010,Number(options.dwellMs)||2010);
    let enabled=options.enabled!==false,active=null,last=null,alive=true,sequence=0,dialog=null;
    const tip=doc.createElement('div');tip.className='ph-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;
    const focus=doc.createElement('div');focus.className='ph-word-focus';focus.hidden=true;
    doc.body.append(tip,focus);
    const button=doc.createElement('button');button.className='ph-toggle';button.type='button';
    button.title='在同一英文单词上停留超过 2 秒，显示本地译义并记录一次查询';
    const lexiconButton=doc.createElement('button');lexiconButton.className='ph-toggle ph-lexicon-button';lexiconButton.type='button';lexiconButton.textContent='词库';lexiconButton.title='查看分类词库与本机查询次数';
    (options.toggleHost||doc.body).append(button,lexiconButton);
    const listeners=[];
    function on(el,event,fn,opts){el.addEventListener(event,fn,opts);listeners.push(()=>el.removeEventListener(event,fn,opts));}
    function hide(){sequence++;if(active)clearTimeout(active.timer);active=null;tip.hidden=true;focus.hidden=true;}
    function setEnabled(value){enabled=!!value;hide();button.textContent=enabled?'译词：开':'译词：关';button.setAttribute('aria-pressed',String(enabled));options.onEnabledChange?.(enabled);}
    on(button,'click',()=>setEnabled(!enabled));setEnabled(enabled);
    function el(tag,text,cls){const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
    const professional=[...new Map(options.glossary.entries.map(e=>[e.term,e])).values()].map(e=>({...e,word:e.term,category:'professional',status:'verified',_term:true}));
    const inventory=options.inventory?.words||[];
    function openLexicon(){
      hide();if(dialog){dialog.focus();return;}
      counter.refresh();const returnFocus=doc.activeElement;
      dialog=el('dialog',undefined,'ph-lexicon');dialog.setAttribute('aria-label','本地英文词库与查询次数');
      const head=el('div',undefined,'ph-lexicon-head'),close=el('button','关闭');close.type='button';
      head.append(el('h2','本地英文词库'),close);dialog.append(head);
      dialog.append(el('p',`已出现词形 ${inventory.length.toLocaleString()} · 原专业重点词条 ${professional.length} · 本机累计查询 ${counter.data.total} 次`,'ph-lexicon-summary'));
      dialog.append(el('p','同一词停留超过 2 秒显示译义才计次；持续停留不重复计次。按指向的单词计次，专业词组另记匹配次数。','ph-lexicon-note'));
      const controls=el('div',undefined,'ph-lexicon-controls');
      const search=el('input');search.type='search';search.placeholder='搜索英文或中文';search.setAttribute('aria-label','搜索英文或中文');
      const group=el('select');group.setAttribute('aria-label','词库分类');
      for(const [value,label] of [['all','全部已出现词形'],['professional','原专业重点词条'],['extended','扩展英文词形'],['pending','待校核词形']]){const op=el('option',label);op.value=value;group.append(op);}
      const queriedLabel=el('label'),queried=el('input');queried.type='checkbox';queriedLabel.append(queried,doc.createTextNode('仅看已查询'));
      const csv=el('button','导出查询记录 CSV');csv.type='button';controls.append(search,group,queriedLabel,csv);dialog.append(controls);
      const meta=el('p',undefined,'ph-lexicon-note'),wrap=el('div',undefined,'ph-lexicon-table-wrap');dialog.append(meta,wrap);
      const nav=el('div',undefined,'ph-lexicon-pages'),prev=el('button','上一页'),next=el('button','下一页'),pageLabel=el('span');prev.type=next.type='button';nav.append(prev,pageLabel,next);dialog.append(nav);
      dialog.append(el('p','原专业词库独立保留；扩展词优先显示常用词典义，物理词组和已校核语境规则优先。待校核内容不猜译。查询记录只存在本机；Obsidian 与各浏览器分别累计。','ph-lexicon-note'));
      if(!counter.persisted)dialog.append(el('p','本地保存受限：当前查询记录仅保留在本次会话，请导出备份。','ph-storage-warning'));
      const count=row=>row._term?counter.countTerm(row.word):counter.countWord(row.word);
      const lastAt=row=>(row._term?counter.data.terms:counter.data.words)[normalize(row.word)]?.lastQueriedAt||'';
      let page=0,rows=[];
      function render(reset=true){
        if(reset)page=0;const query=normalize(search.value),raw=search.value.trim().toLowerCase();
        const base=group.value==='professional'?professional:inventory;
        rows=base.filter(r=>(group.value!=='extended'||r.category==='extended')&&(group.value!=='pending'||r.status==='pending')&&(!queried.checked||count(r)>0)&&(!raw||normalize(r.word).includes(query)&&query||String(r.zh).toLowerCase().includes(raw))).sort((a,b)=>count(b)-count(a)||a.word.localeCompare(b.word));
        page=Math.min(page,Math.max(0,Math.ceil(rows.length/100)-1));wrap.replaceChildren();
        const table=el('table'),thead=el('thead'),hr=el('tr');for(const h of ['英文','中文释义','类别','查询次数'])hr.append(el('th',h));thead.append(hr);table.append(thead);
        const body=el('tbody');for(const row of rows.slice(page*100,page*100+100)){
          const tr=el('tr'),en=el('td',row.word);en.title=row.source||'';
          tr.append(en,el('td',row.zh),el('td',row.status==='pending'?'待校核':row.category==='professional'?'专业重点':'扩展英文'),el('td',String(count(row))));body.append(tr);
        }
        table.append(body);wrap.append(table);meta.textContent=`符合条件 ${rows.length.toLocaleString()} 项；${group.value==='professional'?'次数为匹配该重点词条的查询次数':'次数为指向该词形并显示译义的查询次数'}。`;
        prev.disabled=page===0;next.disabled=(page+1)*100>=rows.length;pageLabel.textContent=`${page+1} / ${Math.max(1,Math.ceil(rows.length/100))}`;
      }
      search.addEventListener('input',()=>render());group.addEventListener('change',()=>render());queried.addEventListener('change',()=>render());prev.addEventListener('click',()=>{page--;render(false);});next.addEventListener('click',()=>{page++;render(false);});
      csv.addEventListener('click',()=>{
        const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
        const content='\uFEFF'+[['英文','中文','类别','状态','本机查询次数','最近查询时间'],...rows.map(r=>[r.word,r.zh,r.category==='professional'?'专业重点':'扩展英文',r.status,count(r),lastAt(r)])].map(r=>r.map(quote).join(',')).join('\r\n');
        if(options.exportCsv){options.exportCsv(content);return;}
        const url=win.URL.createObjectURL(new win.Blob([content],{type:'text/csv;charset=utf-8'})),a=el('a');a.href=url;a.download='本地英文词库-查询记录.csv';doc.body.append(a);a.click();a.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
      });
      close.addEventListener('click',()=>dialog?.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
      dialog.addEventListener('close',()=>{const old=dialog;dialog=null;old?.remove();returnFocus?.focus?.();});
      doc.body.append(dialog);render();dialog.showModal();search.focus();
    }
    on(lexiconButton,'click',openLexicon);
    function show(candidate){
      if(!alive||!enabled||active!==candidate||!candidate.target.isConnected||!last||!contains(candidate.rect,last.x,last.y))return;
      const result=dictionary.lookup(candidate.text,candidate.offset,options.unitFor?.(candidate.target)||'',options.contextFor?.(candidate.target)||'');
      if(!result)return;const count=counter.record(result);candidate.shown=true;
      tip.replaceChildren();
      for(const [cls,text] of [['ph-en',result.word],['ph-zh',result.zh],['ph-hint',result.hint+(candidate.isImage?' · 图中文字':'')],['ph-query-count',`${result.category==='professional'?'专业重点':'扩展英文'} · ${result.hoveredWord} 本机查询 ${count} 次`]])tip.append(el('div',text,cls));
      tip.hidden=false;const rect=candidate.rect,x=Math.max(8,Math.min(rect.left,win.innerWidth-tip.offsetWidth-12));
      let y=rect.bottom+10;if(y+tip.offsetHeight>win.innerHeight-10)y=rect.top-tip.offsetHeight-10;
      tip.style.left=x+'px';tip.style.top=Math.max(8,y)+'px';
      Object.assign(focus.style,{left:rect.left+'px',top:rect.top+'px',width:Math.max(2,rect.width)+'px',height:Math.max(2,rect.height)+'px'});focus.hidden=false;
    }
    function scope(node){return node?.closest?.(options.scope||'main');}
    const contains=(r,x,y)=>x>=r.left-1&&x<=r.left+r.width+1&&y>=r.top-1&&y<=r.top+r.height+1;
    async function imageData(img){
      const key=options.imageKeyFor(img),id=options.imageIndex[key];if(!id)return null;
      if(cache.has(id))return cache.get(id);
      if(!pending.has(id))pending.set(id,Promise.resolve(options.loadImage(id)).then(d=>{cache.set(id,d);pending.delete(id);return d;}).catch(()=>{pending.delete(id);return null;}));
      return pending.get(id);
    }
    async function resolveCandidate(x,y,target){
      if(!target?.isConnected||!scope(target)||target.closest('pre,code,.math,mjx-container,input,textarea,button,svg,.ph-tooltip,.ph-toggle,.ph-lexicon'))return null;
      if(target.tagName==='IMG'){
        const data=await imageData(target);if(!data)return null;
        const outer=target.getBoundingClientRect(),style=win.getComputedStyle(target);
        const left=(parseFloat(style.borderLeftWidth)||0)+(parseFloat(style.paddingLeft)||0),right=(parseFloat(style.borderRightWidth)||0)+(parseFloat(style.paddingRight)||0);
        const top=(parseFloat(style.borderTopWidth)||0)+(parseFloat(style.paddingTop)||0),bottom=(parseFloat(style.borderBottomWidth)||0)+(parseFloat(style.paddingBottom)||0);
        const rect={left:outer.left+left,top:outer.top+top,width:outer.width-left-right,height:outer.height-top-bottom};if(!rect.width||!rect.height)return null;
        const px=(x-rect.left)*data.width/rect.width,py=(y-rect.top)*data.height/rect.height;
        const hit=data.words.findIndex(w=>w[1]<=px&&px<=w[3]&&w[2]<=py&&py<=w[4]);if(hit<0)return null;
        const w=data.words[hit];if(!/[A-Za-z]/.test(w[0]))return null;
        const start=Math.max(0,hit-28),words=data.words.slice(start,Math.min(data.words.length,hit+29)),localIndex=hit-start,text=words.map(v=>v[0]).join(' ');
        const offset=words.slice(0,localIndex).reduce((s,v)=>s+v[0].length+1,0)+w[0].search(/[A-Za-z]/);
        const box={left:rect.left+w[1]*rect.width/data.width,top:rect.top+w[2]*rect.height/data.height,width:(w[3]-w[1])*rect.width/data.width,height:(w[4]-w[2])*rect.height/data.height};box.bottom=box.top+box.height;
        return {target,text,offset,rect:box,isImage:true};
      }
      let range=doc.caretRangeFromPoint?.(x,y);
      if(!range&&doc.caretPositionFromPoint){const p=doc.caretPositionFromPoint(x,y);if(p){range=doc.createRange();range.setStart(p.offsetNode,p.offset);}}
      const node=range?.startContainer,off=range?.startOffset;
      if(!node||node.nodeType!==3||!scope(node.parentElement)||node.parentElement.closest('pre,code,.math,mjx-container'))return null;
      const word=tokens(node.textContent).find(t=>t.start<=off&&off<=t.end);if(!word)return null;
      const wr=doc.createRange();wr.setStart(node,word.start);wr.setEnd(node,word.end);const box=wr.getBoundingClientRect();if(!contains(box,x,y))return null;
      const paragraph=node.parentElement.closest('p,li,td,th,h1,h2,h3,h4,summary,.cm-line')||node.parentElement;
      const walker=doc.createTreeWalker(paragraph,win.NodeFilter.SHOW_TEXT);let n,text='',position=0;
      while((n=walker.nextNode())){if(n===node)position=text.length+word.start;text+=n.textContent;}
      return {target,text,offset:position,rect:box,isImage:false};
    }
    on(doc,'mousemove',event=>{
      if(!enabled||dialog)return;
      const {clientX:x,clientY:y,target}=event;last={x,y,target};
      if(active&&active.target===target&&contains(active.rect,x,y))return;
      hide();const seq=sequence;
      resolveCandidate(x,y,target).then(candidate=>{
        if(!alive||!enabled||seq!==sequence||!candidate||!last||last.target!==target||!contains(candidate.rect,last.x,last.y))return;
        active=candidate;candidate.timer=win.setTimeout(()=>show(candidate),dwellMs);
      }).catch(()=>{});
    },{passive:true});
    on(doc,'scroll',hide,true);on(win,'resize',hide);on(doc,'keydown',e=>{if(e.key==='Escape')hide();});on(doc,'mouseout',e=>{if(!e.relatedTarget)hide();});on(win,'blur',hide);
    return {dictionary,counter,openLexicon,setEnabled,get enabled(){return enabled;},destroy(){alive=false;hide();dialog?.close();for(const dispose of listeners)dispose();tip.remove();focus.remove();button.remove();lexiconButton.remove();cache.clear();}};
  }
  const api={normalize,tokens,makeDictionary,makeCounter,mount};root.PhysicsHoverCore=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
