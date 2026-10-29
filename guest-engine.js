const GuestEngine=(()=>{const modules={},cache={},data={};
modules['./common']=function(require,module,exports){
 class ApiError extends Error{constructor(message,status=400,detail={}){super(message);this.status=status;this.detail=detail;}}
 const fail=(message,status=400,detail={})=>{throw new ApiError(message,status,detail);};
 const id=()=>Array.from(crypto.getRandomValues(new Uint8Array(12)),x=>x.toString(16).padStart(2,'0')).join('');
 // Local content revision checksum only; account authentication never uses this function.
 const hash=value=>{let a=2166136261,b=3335557771;for(const c of String(value)){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b^c.charCodeAt(0),2246822519);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');};
 const copy=x=>JSON.parse(JSON.stringify(x)),sum=xs=>xs.reduce((a,b)=>a+b,0),unique=xs=>[...new Set(xs)],now=()=>Date.now()/1000;
 function integer(v,label,min,max){if(typeof v==='boolean'||!['number','string'].includes(typeof v)||!/^\d+$/.test(String(v))||!Number.isSafeInteger(Number(v))||v<min||v>max)fail(label+'需为 '+min+'–'+max+' 之间的整数');return Number(v);}
 function text(v,label,max,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail(label+'格式错误或超出长度限制');return v;}
 function shuffle(xs){const a=xs.slice();for(let i=a.length-1;i>0;i--){const range=i+1,max=Math.floor(4294967296/range)*range;let x;do{x=crypto.getRandomValues(new Uint32Array(1))[0];}while(x>=max);const j=x%range;[a[i],a[j]]=[a[j],a[i]];}return a;}
 const beijing=t=>new Date((t+28800)*1000).toISOString().slice(0,16).replace('T',' ')+'（北京时间）';
 module.exports={ApiError,fail,id,hash,copy,sum,unique,now,integer,text,shuffle,beijing};};
modules['./paper-plan']=function(require,module,exports){
'use strict';
const {fail,integer,shuffle,sum}=require('./common'),A=require('./assembly');
const bucket=(bank,q)=>bank.paperType(q)==='choice'?'choice':bank.isConcept(q)?'concept':'written';
function pool(bank,opts){let rows=bank.filtered({...opts,category:'all',structure:'part'});if(opts.category==='concept')rows=rows.filter(q=>bank.isConcept(q));if(opts.category==='discussion')rows=rows.filter(q=>q.category==='discussion'||q.questionType==='discussion');if(opts.typeCounts){const t=opts.typeCounts;rows=rows.filter(q=>bucket(bank,q)==='choice'?Number(t.choice)>0:bucket(bank,q)==='concept'?Number(t.concept)>0:Number(t.comprehensive)-Number(t.concept)>0);}return rows;}
function choose(bank,opts){
 if(!['score-range','count-range','both-ranges'].includes(opts.assemblyMode))fail('请选择三种区间匹配方式之一');
 const counts=opts.assemblyMode==='score-range'?{min:1,max:40}:A.range(opts.countRange,'题目数量',1,40);
 const marks=opts.assemblyMode==='count-range'?{min:1,max:300}:A.range(opts.marksRange,'分数',1,300);
 if(!counts||!marks)fail('请填写当前匹配方式对应的区间');
 let quotas=null;
 if(opts.typeCounts!==undefined){const t=opts.typeCounts;if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).some(k=>!['comprehensive','choice','concept'].includes(k)))fail('题型数量设置无效');const comp=integer(t.comprehensive??0,'综合题数量',0,40),choice=integer(t.choice??0,'选择题数量',0,40),concept=integer(t.concept??0,'其中概念题数量',0,40);if(concept>comp)fail('概念考察题数量不能超过综合题数量');if(comp+choice<counts.min||comp+choice>counts.max)fail('两类题型数量合计不在题目数量区间内');quotas={concept,written:comp-concept,choice};}
 const rows=shuffle(pool(bank,opts)).filter(q=>!quotas||quotas[bucket(bank,q)]>0),mask=(1n<<BigInt(marks.max+1))-1n;
 const reachable=(xs,n)=>{const dp=Array(n+1).fill(0n);dp[0]=1n;for(const q of xs)for(let k=n;k>0;k--)dp[k]|=(dp[k-1]<<BigInt(q.marks))&mask;return dp;};
 const dp=reachable(rows,counts.max);let typeBits=mask;
 if(quotas){typeBits=1n;for(const [k,n]of Object.entries(quotas)){const bits=reachable(rows.filter(q=>bucket(bank,q)===k),n)[n];let joined=0n;for(let s=0;s<=marks.max;s++)if((typeBits>>BigInt(s))&1n)joined|=bits<<BigInt(s);typeBits=joined&mask;}}
 const cases=[];for(let n=counts.min;n<=counts.max;n++){if(quotas&&sum(Object.values(quotas))!==n)continue;const bits=dp[n]&typeBits;for(let s=marks.min;s<=marks.max;s++)if((bits>>BigInt(s))&1n)cases.push({n,s});}
 if(!cases.length)fail('当前知识点、难度、题型与区间没有可用组合，请调整设置',409);
 const scope=new Set(Array.isArray(opts.topics)&&opts.topics.length?opts.topics:rows.flatMap(q=>q.topics||[])),deadline=Date.now()+2500;
 const gain=(q,covered)=>(q.topics||[]).filter(t=>scope.has(t)&&!covered.has(t)).length;
 for(const target of shuffle(cases)){
  const selected=[],left=quotas?{...quotas}:null,last=new Map(),pos=new Map(rows.map((q,i)=>[q.id,i]));let visits=0;
  function search(n,score){if(!n)return score===0?selected.map(q=>q.id):null;if(++visits%128===0&&Date.now()>deadline)fail('组合搜索尚未完成，请缩小区间后重试',409,{reason:'search-timeout'});
   const free=rows.filter(q=>(!left||left[bucket(bank,q)]>0)&&q.marks<=score&&pos.get(q.id)>(last.get(bucket(bank,q))??-1)&&!selected.some(p=>A.conflict(p,q)));
   if(free.length<n)return null;const ms=free.map(q=>q.marks).sort((a,b)=>a-b);if(sum(ms.slice(0,n))>score||sum(ms.slice(-n))<score)return null;
   // Canonical independent subparts have no overlap after de-duplication.
   // Exact residual reachability avoids exponential retries near score limits.
   let attainable;
   if(!left)attainable=reachable(free,n)[n];else{attainable=1n;for(const [k,want]of Object.entries(left)){const bits=reachable(free.filter(q=>bucket(bank,q)===k),want)[want];let joined=0n;for(let s=0;s<=score;s++)if((attainable>>BigInt(s))&1n)joined|=bits<<BigInt(s);attainable=joined&mask;}}
   if(!((attainable>>BigInt(score))&1n))return null;
   let candidates=free;
   if(left){let ratio=Infinity,lo=0,hi=0;for(const [k,want]of Object.entries(left))if(want){const xs=free.filter(q=>bucket(bank,q)===k),m=xs.map(q=>q.marks).sort((a,b)=>a-b);if(xs.length<want)return null;lo+=sum(m.slice(0,want));hi+=sum(m.slice(-want));if(xs.length/want<ratio){ratio=xs.length/want;candidates=xs;}}if(score<lo||score>hi)return null;}
   const covered=new Set(selected.flatMap(q=>q.topics||[]));candidates.sort((a,b)=>gain(b,covered)-gain(a,covered)||Math.abs(a.marks-score/n)-Math.abs(b.marks-score/n));
   for(const q of candidates){const k=bucket(bank,q),old=last.get(k);last.set(k,pos.get(q.id));if(left)left[k]--;selected.push(q);const result=search(n-1,score-q.marks);selected.pop();if(left)left[k]++;if(old===undefined)last.delete(k);else last.set(k,old);if(result)return result;}return null;
  }
  const result=search(target.n,target.s);if(result)return result;if(Date.now()>deadline)break;
 }
 fail('排除整题与所属小问重复后，暂未找到符合全部区间的组合，请调整条件',409);
}
module.exports={choose,pool,bucket};

};
modules['./assembly']=function(require,module,exports){
'use strict';
const {fail,integer,shuffle,sum}=require('./common');
const FORMS=['whole','part'],KINDS=['short','process','discussion','choice'];
const form=q=>q.entryKind==='part'?'part':'whole';
const key=q=>q.parent+':'+(form(q)==='whole'?'*':q.part||'single');
function conflict(a,b){return a.parent===b.parent&&(form(a)==='whole'||form(b)==='whole'||(a.part||'single')===(b.part||'single'));}
function normalize(bank,ids){const whole=new Set(ids.map(id=>bank.questions.get(id)).filter(q=>form(q)==='whole').map(q=>q.parent)),seen=new Set();return ids.filter(id=>{const q=bank.questions.get(id);if(form(q)==='part'&&whole.has(q.parent))return false;const k=key(q);if(seen.has(k))return false;seen.add(k);return true;});}
function levels(value){if(value===undefined||value===null||value==='')return [];const raw=Array.isArray(value)?value:String(value).split(',');return [...new Set(raw.map(v=>integer(v,'难度星级',1,5)))];}
function topicScope(pool,opts){const values=Array.isArray(opts.topics)?opts.topics:String(opts.topics||'').split(',').filter(Boolean);return new Set(values.length?values:pool.flatMap(q=>q.topics||[]));}
function coverageGain(q,covered,scope,freq){return (q.topics||[]).filter(t=>scope.has(t)).reduce((n,t)=>n+(covered.has(t)?0:1+1/Math.sqrt(freq.get(t)||1)),0);}
function spread(pool,count,opts={}){
 const scope=topicScope(pool,opts),freq=new Map(),covered=new Set(),picked=[];
 for(const q of pool)for(const t of q.topics||[])freq.set(t,(freq.get(t)||0)+1);
 let remaining=shuffle(pool);
 while(picked.length<count&&remaining.length){remaining.sort((a,b)=>coverageGain(b,covered,scope,freq)-coverageGain(a,covered,scope,freq));const q=remaining.shift();picked.push(q);for(const t of q.topics||[])covered.add(t);remaining=remaining.filter(x=>!conflict(x,q));}
 return picked;
}
function improve(bank,ids,pool,opts){
 const selected=ids.map(id=>bank.questions.get(id)),scope=topicScope(pool,opts);
 const coverage=xs=>new Set(xs.flatMap(q=>(q.topics||[]).filter(t=>scope.has(t))));
 for(let round=0;round<3;round++){let changed=false;for(let i=0;i<selected.length;i++){
  const old=selected[i],others=selected.filter((q,j)=>j!==i),remaining=coverage(others);let best=old,bestCount=coverage(selected).size;
  for(const q of pool){if(q.marks!==old.marks||form(q)!==form(old)||opts.typeCounts&&bank.questionType(q)!==bank.questionType(old)||others.some(p=>conflict(p,q)))continue;const n=new Set([...remaining,...(q.topics||[]).filter(t=>scope.has(t))]).size;if(n>bestCount){best=q;bestCount=n;}}
  if(best.id!==old.id){selected[i]=best;changed=true;}
 }if(!changed)break;}
 return selected.map(q=>q.id);
}
function coverageSummary(bank,ids,opts={}){
 const selected=ids.map(id=>bank.questions.get(id)),unit=opts.unit||selected[0]?.unit||1;
 let pool;
 if(opts.assemblyProtocol==='range-v2')pool=bank.planningPool(opts);else if(opts.automatic||!opts.paperId&&!opts.sourcePaperId&&opts.category){
  const effective=opts.structure||(opts.category==='normal'?'whole':'part');const whole=opts.structureRanges?.whole?.max??opts.structureCounts?.whole??(effective==='whole'?40:0),part=opts.structureRanges?.part?.max??opts.structureCounts?.part??(effective==='whole'?0:40);
  pool=bank.filtered({...opts,unit,structure:opts.structureCounts||opts.structureRanges?'all':opts.structure,category:opts.typeCounts||whole?'all':opts.category}).filter(q=>(form(q)==='whole'?whole>0:part>0)&&(!opts.typeCounts||Number(opts.typeCounts[bank.questionType(q)]||0)>0));
 }else pool=selected;
 const scope=topicScope(pool,opts),available=new Set(pool.flatMap(q=>(q.topics||[]).filter(t=>scope.has(t)))),covered=new Set(selected.flatMap(q=>(q.topics||[]).filter(t=>scope.has(t)))),labels=new Map(bank.catalog.topics.map(t=>[t.id,t.title]));
 return {coveredCount:covered.size,availableCount:available.size,coveredTopics:[...covered],remainingTopics:[...available].filter(t=>!covered.has(t)).map(id=>({id,title:labels.get(id)||id})),strategy:'prioritize-uncovered-topics-within-all-constraints'};
}
function assemble(bank,opts,deadline=Date.now()+1800){
 const counts=opts.structureCounts;
 if(!counts||typeof counts!=='object'||Array.isArray(counts)||Object.keys(counts).some(k=>!FORMS.includes(k)))fail('整题与小问数量设置无效');
 const forms=Object.fromEntries(FORMS.map(k=>[k,integer(counts[k]??0,k==='whole'?'整题数量':'小问数量',0,40)]));
 const count=sum(Object.values(forms));if(count<1||count>40)fail('整题与小问数量合计需为1–40道');
 let types=null;if(opts.typeCounts!==undefined){if(!opts.typeCounts||typeof opts.typeCounts!=='object'||Array.isArray(opts.typeCounts)||Object.keys(opts.typeCounts).some(k=>!KINDS.includes(k)))fail('题型数量设置无效');types=Object.fromEntries(KINDS.map(k=>[k,integer(opts.typeCounts[k]??0,'题型数量',0,40)]));if(sum(Object.values(types))!==count)fail('题型数量之和须等于整题与小问数量之和');}
 const target=integer(opts.marks,'目标总分',1,300),seen=new Set();
 const pool=shuffle(bank.filtered({...opts,structure:'all',category:types||forms.whole?'all':opts.category})).filter(q=>{const k=key(q);if(seen.has(k))return false;seen.add(k);return forms[form(q)]>0&&(!types||types[bank.questionType(q)]>0);});
 for(const f of FORMS)if(pool.filter(q=>form(q)===f).length<forms[f])fail((f==='whole'?'整题':'小问')+'题池不足，请调整知识点、难度或数量',409);
 // Exact reachable scores before searching; scores and quotas are never relaxed.
 function reachable(xs,n){const d=Array(n+1).fill(0n);d[0]=1n;const mask=(1n<<BigInt(target+1))-1n;for(const q of xs)for(let k=n;k>0;k--)d[k]|=(d[k-1]<<BigInt(q.marks))&mask;return d[n];}
 function combine(a,b){let out=0n;for(let n=0;n<=target;n++)if((a>>BigInt(n))&1n)out|=b<<BigInt(n);return out;}
 const whole=reachable(pool.filter(q=>form(q)==='whole'),forms.whole),part=reachable(pool.filter(q=>form(q)==='part'),forms.part);
 if(!((combine(whole,part)>>BigInt(target))&1n))fail('所选难度、整题/小问数量与目标总分无法同时满足，请调整设置',409);
 if(types)for(const t of KINDS)if(pool.filter(q=>bank.questionType(q)===t).length<types[t])fail('所选难度下的题型数量不足，请调整设置',409);
 const scope=topicScope(pool,opts),freq=new Map();for(const q of pool)for(const t of q.topics||[])freq.set(t,(freq.get(t)||0)+1);
 let visits=0;const chosen=[],positions=new Map(pool.map((q,i)=>[q.id,i])),lastCell=new Map(),cell=q=>form(q)+':'+bank.questionType(q);
 function search(left){
  const needed=sum(Object.values(forms));if(!needed)return left===0?chosen.map(q=>q.id):null;
  if(++visits%128===0&&Date.now()>deadline)fail('当前条件组合较复杂，尚未找到精确组合；请调整题量或总分后重试',409,{reason:'search-timeout'});
  const available=pool.filter(q=>forms[form(q)]>0&&(!types||types[bank.questionType(q)]>0)&&positions.get(q.id)>(lastCell.get(cell(q))??-1)&&q.marks<=left&&!chosen.some(p=>conflict(p,q)));
  if(available.length<needed)return null;
  const marks=available.map(q=>q.marks).sort((a,b)=>a-b);if(sum(marks.slice(0,needed))>left||sum(marks.slice(-needed))<left)return null;
  function bounds(keys,counts,get){let lo=0,hi=0;for(const k of keys)if(counts[k]){const xs=available.filter(q=>get(q)===k).map(q=>q.marks).sort((a,b)=>a-b);if(xs.length<counts[k])return false;lo+=sum(xs.slice(0,counts[k]));hi+=sum(xs.slice(-counts[k]));}return lo<=left&&left<=hi;}
  if(!bounds(FORMS,forms,form)||types&&!bounds(KINDS,types,q=>bank.questionType(q)))return null;
  let candidates=null,ratio=Infinity;
  for(const f of FORMS)if(forms[f]){const xs=available.filter(q=>form(q)===f);if(xs.length<forms[f])return null;if(xs.length/forms[f]<ratio){candidates=xs;ratio=xs.length/forms[f];}}
  if(types)for(const t of KINDS)if(types[t]){const xs=available.filter(q=>bank.questionType(q)===t);if(xs.length<types[t])return null;if(xs.length/types[t]<ratio){candidates=xs;ratio=xs.length/types[t];}}
  // Try attainable average marks first; shuffle preserves random choice among peers.
  const covered=new Set(chosen.flatMap(q=>q.topics||[]));candidates.sort((a,b)=>coverageGain(b,covered,scope,freq)-coverageGain(a,covered,scope,freq)||Math.abs(a.marks-left/needed)-Math.abs(b.marks-left/needed));
  for(const q of candidates){const f=form(q),t=bank.questionType(q),k=cell(q),old=lastCell.get(k);lastCell.set(k,positions.get(q.id));forms[f]--;if(types)types[t]--;chosen.push(q);const result=search(left-q.marks);chosen.pop();forms[f]++;if(types)types[t]++;if(old===undefined)lastCell.delete(k);else lastCell.set(k,old);if(result)return result;}
  return null;
 }
 const result=search(target);if(!result)fail('排除整题与所属小问重复后，无法满足全部数量和分数条件',409);return improve(bank,result,pool,opts);
}
function range(raw,label,min,max,fallback){
 if(raw===undefined)return fallback;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['min','max'].includes(k)))fail(label+'区间格式无效');
 const a=integer(raw.min,label+'下限',min,max),b=integer(raw.max,label+'上限',min,max);if(a>b)fail(label+'下限不能大于上限');return {min:a,max:b};
}
function flexible(bank,opts){
 const mode=opts.assemblyMode;if(!['ranges','fixed-count','fixed-marks'].includes(mode))fail('组卷匹配方式无效');
 let forms,count;
 if(mode==='fixed-count'){
  const raw=opts.structureCounts;if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!FORMS.includes(k)))fail('整题与小问数量设置无效');
  forms=Object.fromEntries(FORMS.map(k=>{const n=integer(raw[k]??0,'题目数量',0,40);return [k,{min:n,max:n}];}));const n=forms.whole.min+forms.part.min;if(n<1||n>40)fail('整题与小问数量合计需为1–40道');count={min:n,max:n};
 }else{
  count=range(opts.countRange,'总题数',1,40,{min:1,max:40});const raw=opts.structureRanges||{};
  if(typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!FORMS.includes(k)))fail('整题与小问区间格式无效');
  forms={whole:range(raw.whole,'完整大题数量',0,40,{min:0,max:0}),part:range(raw.part,'拆分小问数量',0,40,{min:0,max:40})};
 }
 const marks=mode==='fixed-marks'?(()=>{const n=integer(opts.marks,'目标总分',1,300);return {min:n,max:n};})():mode==='ranges'?range(opts.marksRange,'总分',1,300,{min:1,max:300}):{min:1,max:300};
 let totalByType=null;if(opts.typeCounts!==undefined){const raw=opts.typeCounts;if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!KINDS.includes(k)))fail('题型数量设置无效');totalByType=sum(KINDS.map(k=>integer(raw[k]??0,'题型数量',0,40)));if(totalByType<count.min||totalByType>count.max)fail('各题型数量合计不在设置的题数范围内');}
 const rawPool=bank.filtered({...opts,structure:'all',category:opts.typeCounts||forms.whole.max?'all':opts.category});const pool=opts.typeCounts?rawPool.filter(q=>Number(opts.typeCounts[bank.questionType(q)]||0)>0):rawPool;
 const mask=(1n<<BigInt(marks.max+1))-1n,scoreMask=mask^((1n<<BigInt(marks.min))-1n);
 const dp={};
 for(const f of FORMS){const table=Array(forms[f].max+1).fill(0n);table[0]=1n;for(const q of pool.filter(q=>form(q)===f))for(let n=forms[f].max;n>0;n--)table[n]|=(table[n-1]<<BigInt(q.marks))&mask;dp[f]=table;}
 function combine(a,b,filter=scoreMask){let out=0n;while(a){const low=a&-a,shift=low.toString(2).length-1;out|=b<<BigInt(shift);a-=low;}return out&filter;}
 let typeScores=mask;if(opts.typeCounts){typeScores=1n;for(const k of KINDS){const n=Number(opts.typeCounts[k]||0),table=Array(n+1).fill(0n);table[0]=1n;for(const q of pool.filter(q=>bank.questionType(q)===k))for(let i=n;i>0;i--)table[i]|=(table[i-1]<<BigInt(q.marks))&mask;typeScores=combine(typeScores,table[n],mask);}}
 const possible=[];
 for(let whole=forms.whole.min;whole<=forms.whole.max;whole++)for(let part=forms.part.min;part<=forms.part.max;part++){
  const n=whole+part;if(n<count.min||n>count.max||totalByType!==null&&n!==totalByType)continue;
  const scores=combine(dp.whole[whole],dp.part[part])&typeScores;if(scores)possible.push({whole,part,scores});
 }
 if(!possible.length)fail('当前知识点、难度、题数和分数范围没有可用组合，请调整设置',409);
 const deadline=Date.now()+2200;let attempts=0;
 for(const candidate of shuffle(possible)){
  const scores=[];for(let n=marks.min;n<=marks.max;n++)if((candidate.scores>>BigInt(n))&1n)scores.push(n);
  for(const score of shuffle(scores)){
   if(Date.now()>deadline)fail('区间组合搜索尚未完成，请缩小范围或调整条件后重试',409,{reason:'search-timeout'});
   try{return assemble(bank,{...opts,assemblyMode:'exact',structureCounts:{whole:candidate.whole,part:candidate.part},count:candidate.whole+candidate.part,marks:score},deadline);}catch(error){if(error.status!==409)throw error;if(error.detail?.reason==='search-timeout')throw error;}
   if(++attempts>100)fail('暂未找到同时满足全部条件且不重复的组合，请调整范围后重试',409);
  }
 }
 fail('排除整题与所属小问重复后，没有同时满足所设范围的组合',409);
}
module.exports={assemble,flexible,form,key,conflict,normalize,levels,range,spread,coverageSummary};

};
modules['./bank']=function(require,module,exports){
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {fail,integer,shuffle,sum,unique,copy}=require('./common');
const Assembly=require('./assembly');
const TYPES={short:['简答题',0],process:['综合 / 过程题',1],discussion:['论述题',2],choice:['选择题',3]};
class Bank{
  constructor(folder=path.join(__dirname,'../resources')){this.folder=folder;this.catalog=require(path.join(folder,'catalog.json'));this.questions=new Map(require(path.join(folder,'questions.json')).map(q=>[q.id,q]));this.assets=require(path.join(folder,'assets.json'));this.wordCache=new Map();this.imageLayout=require(path.join(folder,'image-layout.json'));}
  questionType(q){return q.questionType||(q.answerMode==='choice'?'choice':q.category==='discussion'?'discussion':q.answerMode==='short'?'short':'process');}
  paperType(q){return q.answerMode==='choice'?'choice':'comprehensive';}
  isConcept(q){if(!this.conceptKeys)this.conceptKeys=new Set([...this.questions.values()].filter(q=>q.category==='concept').map(q=>q.parent+':'+(q.part||'')));return this.paperType(q)!=='choice'&&this.conceptKeys.has(q.parent+':'+(q.part||''));}
  planningPool(opts){return require('./paper-plan').pool(this,opts);}
  order(ids){return ids.map((id,index)=>({id,index,rank:this.paperType(this.questions.get(id))==='choice'?1:0})).sort((a,b)=>a.rank-b.rank||a.index-b.index).map(x=>x.id);}
  typeCounts(ids){const c={comprehensive:0,choice:0,concept:0};for(const id of ids){const q=this.questions.get(id);c[this.paperType(q)]++;if(this.isConcept(q))c.concept++;}return c;}
  typeSummary(ids){const c=this.typeCounts(ids);return [{id:'comprehensive',label:'综合题'+(c.concept?'（含概念考察 '+c.concept+' 道）':''),count:c.comprehensive},{id:'choice',label:'选择题',count:c.choice}].filter(x=>x.count);}
  filtered(opts){const unit=integer(opts.unit||1,'Unit',1,4),category=opts.category||'normal';const topics=Array.isArray(opts.topics)?opts.topics:String(opts.topics||'').split(',').filter(Boolean);const term=String(opts.search||'').toLowerCase(),levels=Assembly.levels(opts.difficulties);const structure=opts.structure||(category==='normal'?'whole':'part');if(!['whole','part','all'].includes(structure))fail('题目拆分方式无效');const result=[...this.questions.values()].filter(q=>q.unit===unit&&(category==='all'||q.category===category)&&(structure==='all'||Assembly.form(q)===structure)&&(!levels.length||levels.includes(q.difficulty?.stars))&&(!topics.length||q.topics.some(t=>topics.includes(t)))&&(!term||(q.source+' '+q.text+' '+q.focus).toLowerCase().includes(term)));if(category!=='all')return result;const seen=new Set();return result.sort((a,b)=>Number(b.category==='normal')-Number(a.category==='normal')).filter(q=>{const k=Assembly.key(q);if(seen.has(k))return false;seen.add(k);return true;});}
  public(q,answers=false){const r=copy(q);delete r.sourceNote;delete r.sourceSha256;if(!answers){delete r.correct;delete r.answerImages;delete r.explanation;}r.questionType=this.paperType(q);r.isConcept=this.isConcept(q);r.questionTypeLabel=r.questionType==='choice'?'选择题':'综合题'+(r.isConcept?' · 概念考察':'');for(const field of ['questionImages','answerImages','contextImages','sharedContextImages'])if(r[field])r[field]=r[field].map(im=>({...im,url:'cloud-media://'+im.id}));return r;}
  select(opts,used=[]){const excluded=new Set(used),pool=shuffle(this.filtered(opts).filter(q=>!excluded.has(q.id)));if(!pool.length)fail('所选范围已无未出题目，请更换范围或开始新一轮');if(pool.length<10&&!opts.allowPartial)fail('当前范围仅剩 '+pool.length+' 道未出题目，是否开始？',409,{remaining:pool.length});const selected=Assembly.spread(pool,Math.min(10,pool.length),opts);if(selected.length<10&&!opts.allowPartial)fail('排除重复原题后仅剩 '+selected.length+' 道可用题目',409,{remaining:selected.length});return selected.map(q=>q.id);}
  coverage(ids,opts={}){return Assembly.coverageSummary(this,ids,opts);}
  assemble(opts){if(opts.assemblyProtocol==='range-v2')return require('./paper-plan').choose(this,opts);if(opts.assemblyMode&&opts.assemblyMode!=='exact')return Assembly.flexible(this,opts);if(opts.structureCounts!==undefined)return Assembly.assemble(this,opts);if(opts.typeCounts!==undefined)return this.assembleTypes(opts);const count=integer(opts.count||10,'题数',1,40),target=integer(opts.marks||0,'总分',1,300),pool=shuffle(this.filtered(opts));if(pool.length<count)fail('所选范围题目不足');const states=Array.from({length:count+1},()=>new Map());states[0].set(0,[]);for(const q of pool){for(let n=count;n>0;n--)for(const [score,ids] of [...states[n-1]]){const next=score+q.marks;if(next<=target&&!states[n].has(next))states[n].set(next,ids.concat(q.id));}if(states[count].has(target))return states[count].get(target);}fail('题量和总分无法同时满足，请调整设置',409,{possibleMarks:[...states[count].keys()].sort((a,b)=>Math.abs(a-target)-Math.abs(b-target)).slice(0,5)});}
  assembleTypes(opts){
    const raw=opts.typeCounts;if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!TYPES[k]))fail('题型数量设置无效');
    const counts=Object.fromEntries(Object.keys(TYPES).map(k=>[k,integer(raw[k]===undefined?0:raw[k],TYPES[k][0]+'数量',0,40)]));const count=sum(Object.values(counts));if(count<1||count>40)fail('各题型数量合计需为1–40道');if(opts.count!==undefined&&integer(opts.count,'题数',1,40)!==count)fail('总题量与题型数量之和不一致');const target=integer(opts.marks,'总分',1,300);
    const pool=shuffle(this.filtered({...opts,category:'all'})),available=Object.fromEntries(Object.keys(TYPES).map(k=>[k,pool.filter(q=>this.questionType(q)===k)]));
    for(const k of Object.keys(counts)){const n=unique(available[k].map(q=>q.parent)).length;if(n<counts[k])fail('所选范围的'+TYPES[k][0]+'不足：需要'+counts[k]+'道，仅有'+n+'道不重复原题',409);}
    const kinds=Object.keys(counts).filter(k=>counts[k]).sort((a,b)=>unique(available[a].map(q=>q.parent)).length/counts[a]-unique(available[b].map(q=>q.parent)).length/counts[b]);
    const groups=kinds.map(k=>{const seen=new Set();return available[k].filter(q=>{const s=q.parent+':'+q.marks;if(seen.has(s))return false;seen.add(s);return true;});});
    const limit=300,mask=(1n<<301n)-1n;
    const suffix=groups.map((group,i)=>{const n=counts[kinds[i]],table=Array.from({length:group.length+1},()=>Array(n+1).fill(0n));table[group.length][0]=1n;for(let pos=group.length-1;pos>=0;pos--){table[pos][0]=1n;for(let take=1;take<=Math.min(n,group.length-pos);take++)table[pos][take]=table[pos+1][take]|((table[pos+1][take-1]<<BigInt(group[pos].marks))&mask);}return table;});
    function sums(a,b){let out=0n;for(let s=0;s<=limit;s++)if((a>>BigInt(s))&1n)out|=b<<BigInt(s);return out&mask;}
    const tails=Array(kinds.length+1).fill(1n);for(let i=kinds.length-1;i>=0;i--)tails[i]=sums(suffix[i][0][counts[kinds[i]]],tails[i+1]);if(!((tails[0]>>BigInt(target))&1n))fail('当前题型数量与总分无法同时满足，请调整设置',409);
    const reversed=tails.map(bits=>{let n=0n;for(let s=0;s<=limit;s++)if((bits>>BigInt(s))&1n)n|=1n<<BigInt(limit-s);return n;});
    const used=new Set(),started=Date.now();let visits=0;
    const viable=(g,p,n,left)=>left>=0&&left<=limit&&!!(suffix[g][p][n]&(reversed[g+1]>>BigInt(limit-left)));
    function search(g,pos,needed,left){if(++visits%128===0&&Date.now()-started>4000)fail('当前组合搜索未完成，请减少题量或调整总分后重试',409,{reason:'search-timeout'});if(g===groups.length)return left===0?[]:null;if(needed===0)return search(g+1,0,g+1<groups.length?counts[kinds[g+1]]:0,left);if(!viable(g,pos,needed,left))return null;const free=new Set();for(let i=g;i<groups.length;i++){const parents=new Set(groups[i].slice(i===g?pos:0).filter(q=>!used.has(q.parent)).map(q=>q.parent));if(parents.size<(i===g?needed:counts[kinds[i]]))return null;for(const p of parents)free.add(p);}if(free.size<needed+sum(kinds.slice(g+1).map(k=>counts[k])))return null;for(let at=pos;at<=groups[g].length-needed;at++){const q=groups[g][at];if(used.has(q.parent)||q.marks>left||!viable(g,at+1,needed-1,left-q.marks))continue;used.add(q.parent);const result=search(g,at+1,needed-1,left-q.marks);used.delete(q.parent);if(result!==null)return [q.id,...result];}return null;}
    const result=search(0,0,counts[kinds[0]],target);if(result===null)fail('排除重复原题后无法同时满足当前题型数量与总分',409);return result;
  }
  imageWords(id){const a=this.assets[id];if(!a||!a.wordRecord)return null;const shard=a.wordRecord.slice(0,2);if(!this.wordCache.has(shard)){const file=path.join(this.folder,'image-words',shard+'.json');this.wordCache.set(shard,fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{});}return this.wordCache.get(shard)[a.wordRecord]||null;}
  lookup(image,x,y,unit){const r=this.imageWords(image);if(!r)return {found:false,message:'这张图片尚无词语定位数据'};if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)fail('查词位置无效');const px=x*r.width,py=y*r.height,hit=r.words.findIndex(w=>w[1]<=px&&px<=w[3]&&w[2]<=py&&py<=w[4]&&/[a-zA-Z]/.test(w[0]));if(hit<0)return {found:false,message:'请长按英文单词所在位置'};const start=Math.max(0,hit-28),words=r.words.slice(start,hit+29),text=words.map(w=>w[0]).join(' '),offset=sum(words.slice(0,hit-start).map(w=>w[0].length+1))+r.words[hit][0].search(/[a-zA-Z]/);return this.lookupText(text,offset,unit);}
  lookupText(text,offset,unit){if(typeof text!=='string'||text.length>20000||!Number.isSafeInteger(offset)||offset<0||offset>=text.length)fail('查词文字或位置无效');if(!this.dictionary){const core=require(path.join(this.folder,'dictionary/hover-core.js'));this.dictionary=core.makeDictionary(require(path.join(this.folder,'dictionary/glossary.json')),require(path.join(this.folder,'dictionary/extended-glossary.json')));}const result=this.dictionary.lookup(text,offset,'U'+unit,'');if(!result||!result.found)return {found:false,message:'本地词库尚未收录或待校核，不猜译'};return {found:true,term:result.term,wordKey:result.wordKey||null,zh:result.zh,hint:result.hint||'',kind:result.category==='professional'?'physics':'general',source:result.source||'本地词库'};}
}
module.exports={Bank,TYPES};

};
modules['./service']=function(require,module,exports){
'use strict';
const {fail,now,id,hash,copy,unique,sum,integer,text,shuffle,beijing}=require('./common');
class Service{
  constructor(bank,store){this.bank=bank;this.store=store;}
  own(uid,obj){if(obj.owner!==uid)fail('只能操作自己的记录',403);}
  async readableTest(uid,key){const t=await this.store.get('test',key);if(uid!==t.owner&&!(uid===t.reviewer&&await this.store.bound(uid,t.owner))&&!await this.store.isTeacher(uid,t.owner))fail('无权访问这份答题卡',403);return t;}
  async effectiveReviewer(t){return t.reviewer&&await this.store.bound(t.owner,t.reviewer)?t.reviewer:null;}
  async createTest(user,opts){let used=[],assignment=null;const uid=user.id;if(opts.previous){const previous=await this.readableTest(uid,opts.previous);this.own(uid,previous);if(!['random','wrong'].includes(previous.mode))fail('整卷或指定试卷不能继续随机抽题');used=previous.used;opts={...previous.selection,previous:previous.id,allowPartial:!!opts.allowPartial};}let ids,title,mode;
    if(opts.assignmentId){assignment=await this.assignmentAccess(uid,opts.assignmentId);if(uid===assignment.owner||!await this.store.isTeacher(assignment.owner,uid))fail('当前账号不是这项作业的有效学生',403);const existing=await this.assignmentAttempt(uid,assignment.id);if(existing)return existing;ids=assignment.ids.slice();title=assignment.title;mode='assignment';}
    else if(opts.source==='wrong'){ids=await this.selectWrong(uid,opts,used);title='Unit '+(opts.unit||1)+' · 错题自测';mode='wrong';}
    else if(opts.paperId){const p=await this.paperAccess(uid,opts.paperId);ids=p.ids.slice();title=p.title;mode='assigned';}
    else if(opts.session){const p=this.bank.catalog.papers.find(p=>p.unit===Number(opts.unit||1)&&p.session===opts.session);if(!p)fail('未找到正式试卷');ids=p.ids.slice();title=p.title;mode='paper';}
    else{ids=this.bank.select(opts,used);title='Unit '+(opts.unit||1)+' · '+({normal:'知识点测试',concept:'概念考察',discussion:'论述题练习'}[opts.category]||'知识点测试');mode='random';}
    const selection={...opts};delete selection.previous;delete selection.allowPartial;const t={id:id(),owner:uid,title,mode,selection,ids,used:unique([...used,...ids]),answers:{},grades:{},status:'draft',reviewer:null,created:now(),bankVersion:this.bank.catalog.version,coverage:this.bank.coverage(ids,mode==='random'?opts:{paperId:mode})};if(assignment)t.assignmentId=assignment.id;await this.store.save('test',t.id,uid,t);return t;
  }
  async saveAnswers(uid,key,body){const t=await this.readableTest(uid,key);this.own(uid,t);if(t.status!=='draft')fail('已提交的答题卡不能修改');const answers=body.answers||{};if(!answers||typeof answers!=='object'||Array.isArray(answers))fail('答案格式错误');if(body.skipped!==undefined){if(!Array.isArray(body.skipped)||body.skipped.length>t.ids.length||body.skipped.some(qid=>typeof qid!=='string'||!t.ids.includes(qid)))fail('跳过题目不在本次测试中');t.skipped=unique(body.skipped);}for(const [qid,a] of Object.entries(answers)){if(!t.ids.includes(qid)||!a||typeof a!=='object'||Array.isArray(a))fail('答题卡中没有此题或答案格式错误');const choice=a.choice||'';if(choice&&!['A','B','C','D'].includes(choice))fail('选项无效');const value=String(a.text||'');if(value.length>20000)fail('单题文字答案过长');const files=a.attachments||[];if(!Array.isArray(files)||files.length>6)fail('每题最多六张作答图片');for(const f of files)this.own(uid,await this.store.get('upload',f.id));t.answers[qid]={choice,text:value,attachments:files.map(f=>({id:f.id}))};}await this.store.save('test',key,uid,t);return t;}
  async submit(uid,key){const t=await this.readableTest(uid,key);this.own(uid,t);if(t.status!=='draft')fail('这份答题卡已经提交');const skipped=new Set(t.skipped||[]),included=t.ids.filter(qid=>!skipped.has(qid));if(!included.length)fail('所有题目均已跳过，请至少保留一道题再生成答题卡');if(skipped.size){t.originalIds=t.ids.slice();t.ids=included;t.answers=Object.fromEntries(Object.entries(t.answers).filter(([qid])=>included.includes(qid)));t.grades=Object.fromEntries(Object.entries(t.grades).filter(([qid])=>included.includes(qid)));}t.status='submitted';t.submitted=now();if(t.assignmentId){const a=await this.store.get('assignment',t.assignmentId);t.late=t.submitted>a.dueAt;t.deadlineAtSubmission=a.dueAt;if(await this.store.isTeacher(a.owner,uid))t.reviewer=a.owner;}await this.store.save('test',key,uid,t);return t;}
  async grade(uid,key,body){const t=await this.readableTest(uid,key),reviewer=await this.effectiveReviewer(t);if(uid!==(reviewer||t.owner))fail('这份答题卡由指定批改账号评分',403);if(!['submitted','grading'].includes(t.status))fail('答题卡当前不可批改');for(const qid of t.ids){const q=this.bank.questions.get(qid);if(q.answerMode==='choice')t.grades[qid]={score:(t.answers[qid]||{}).choice===q.correct?q.marks:0,comment:'',automatic:true};}for(const [qid,g] of Object.entries(body.grades||{})){if(!t.ids.includes(qid))fail('批改包含答题卡之外的题目');const q=this.bank.questions.get(qid);if(q.answerMode==='choice')continue;if(typeof g.score!=='number'||!Number.isInteger(g.score)||g.score<0||g.score>q.marks)fail('得分需为0至本题满分之间的整数');const comment=String(g.comment||'');if(comment.length>4000)fail('批注过长');t.grades[qid]={score:g.score,comment,automatic:false};}t.status='grading';if(body.finish){const missing=t.ids.filter(qid=>!Object.prototype.hasOwnProperty.call(t.grades,qid));if(missing.length)fail('还有'+missing.length+'道题未填写得分');t.status='graded';t.graded=now();}if(!reviewer)t.reviewer=null;await this.store.save('test',key,t.owner,t);return t;}
  async assign(uid,key,other){const t=await this.readableTest(uid,key);this.own(uid,t);if(t.status!=='submitted'||await this.effectiveReviewer(t))fail('只能提交尚未指定批改人的答题卡');if(!await this.store.isTeacher(other,uid))fail('请先完成学生与教师的绑定',403);t.reviewer=other;await this.store.save('test',key,uid,t);return t;}
  async createPaper(user,body){
    let source=null;
    if(body.sourcePaperId!==undefined){source=this.bank.catalog.papers.find(p=>p.id===body.sourcePaperId);if(!source)fail('未找到所选正式试卷');if(body.unit!==undefined&&Number(body.unit)!==source.unit)fail('所选试卷不属于当前 Unit');}
    let ids=source?source.ids.slice():body.automatic?this.bank.assemble(body):Array.isArray(body.ids)?unique(body.ids):[];
    if(!Array.isArray(ids)||!ids.length||ids.length>600||ids.some(i=>!this.bank.questions.has(i)))fail('请加入有效题目');
    const {conflict,form,normalize}=require('./assembly');if(!source&&!body.automatic)ids=normalize(this.bank,ids);if(ids.length>60)fail('合并后最多保留60道选题单元');for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)if(conflict(this.bank.questions.get(ids[i]),this.bank.questions.get(ids[j])))fail('同一整题与所属小问、或同一小问的不同分类副本不能重复入卷');
    if(!source)ids=this.bank.order(ids);
    const p={id:id(),owner:user.id,title:String(body.title||(source?source.title:'OxfordAQA 9630 自选试卷')).slice(0,100),ids,recipients:[],created:now(),ordering:source?'source-paper':'question-type-choice-last',typeCounts:this.bank.typeCounts(ids),coverage:this.bank.coverage(ids,body.automatic?body:{paperId:'manual'}),structureCounts:{whole:ids.filter(i=>form(this.bank.questions.get(i))==='whole').length,part:ids.filter(i=>form(this.bank.questions.get(i))==='part').length},...(source?{sourcePaperId:source.id,sourcePaperTitle:source.title,sourceSession:source.session,sourceUnit:source.unit}:{})};
    await this.store.save('paper',p.id,user.id,p);return p;
  }
  async paperHidden(uid,key){const h=await this.store.optional('paper-hidden','paper-hidden:'+uid+':'+key);return !!h&&h.hidden!==false;}
  async papersFor(uid){const result=[];for(const p of await this.store.list('paper'))if((uid===p.owner&&!p.deletedAt)||(p.recipients.includes(uid)&&!await this.paperHidden(uid,p.id)))result.push(p);return result;}
  async paperAccess(uid,key){const p=await this.store.get('paper',key);if(uid!==p.owner&&!p.recipients.includes(uid))fail('无权访问这份试卷',403);if((uid===p.owner&&p.deletedAt)||(uid!==p.owner&&await this.paperHidden(uid,key)))fail('试卷已从当前账号列表删除',404);return p;}
  async sendPaper(uid,key,other){const p=await this.paperAccess(uid,key);this.own(uid,p);if(!await this.store.bound(uid,other))fail('请先完成双方账号绑定',403);p.recipients=unique([...p.recipients,other]);await this.store.saveMany([['paper',p],['paper-hidden',{id:'paper-hidden:'+other+':'+key,owner:other,paperId:key,hidden:false}]]);return p;}
  async deletePaper(uid,key){const p=await this.store.get('paper',key);if(uid===p.owner){p.deletedAt=p.deletedAt||now();await this.store.save('paper',key,uid,p);}else if(p.recipients.includes(uid)){const h={id:'paper-hidden:'+uid+':'+key,owner:uid,paperId:key,hidden:true,deletedAt:now()};await this.store.save('paper-hidden',h.id,uid,h);}else fail('只能删除当前账号拥有或收到的试卷',403);return {ok:true};}
  async wrong(uid){const latest=new Map(),retests=new Map(),counts=new Map(),deletions=new Map((await this.store.list('wrong-deletion',uid)).map(d=>[d.questionId,d.through]));for(const t of await this.store.list('test',uid)){if(t.status!=='graded')continue;for(const [qid,g] of Object.entries(t.grades)){if(t.graded<=(deletions.get(qid)||0))continue;const q=this.bank.questions.get(qid);if(t.mode==='wrong'){const old=retests.get(qid)||{count:0,last:null};const last={score:g.score,marks:q.marks,testId:t.id,graded:t.graded};retests.set(qid,{count:old.count+1,last:!old.last||last.graded>old.last.graded?last:old.last});}if(g.score<q.marks){counts.set(qid,(counts.get(qid)||0)+1);if(!latest.has(qid)||t.graded>latest.get(qid).graded)latest.set(qid,{id:t.id+':'+qid,testId:t.id,testTitle:t.title,question:this.bank.public(q,true),grade:g,answer:t.answers[qid]||{},graded:t.graded});}}}const metadata=new Map((await this.store.list('wrong-entry',uid)).map(m=>[m.questionId,m]));for(const [qid,row] of latest){row.meta=metadata.get(qid)||{status:'active',reason:'',correction:'',note:'',attachments:[]};row.wrongCount=counts.get(qid);row.retestCount=(retests.get(qid)||{}).count||0;row.lastRetest=(retests.get(qid)||{}).last||null;}return [...latest.values()].sort((a,b)=>b.graded-a.graded);}
  async wrongEntry(uid,qid){const r=(await this.wrong(uid)).find(r=>r.question.id===qid);if(!r)fail('当前账号的错题库中没有此题',404);return r;}
  async editWrong(uid,qid,body){const row=await this.wrongEntry(uid,qid),m={...row.meta};for(const [field,max] of [['reason',200],['correction',20000],['note',4000]])if(body[field]!==undefined)m[field]=text(body[field],'错题订正',max);if(body.status!==undefined){if(!['active','mastered','removed'].includes(body.status))fail('错题状态无效');m.status=body.status;}if(body.attachments!==undefined){if(!Array.isArray(body.attachments)||body.attachments.length>6)fail('订正最多上传六张图片');for(const f of body.attachments)this.own(uid,await this.store.get('upload',f.id));m.attachments=unique(body.attachments.map(f=>f.id)).map(id=>({id}));}Object.assign(m,{id:'wrong:'+uid+':'+qid,owner:uid,questionId:qid,updated:now()});await this.store.save('wrong-entry',m.id,uid,m);return this.wrongEntry(uid,qid);}
  async deleteWrong(uid,qid){let row;try{row=await this.wrongEntry(uid,qid);}catch(e){if(e.status!==404)throw e;await this.store.get('wrong-deletion','wrong-deletion:'+uid+':'+qid);return {ok:true};}const stamp=now();await this.store.saveMany([['wrong-deletion',{id:'wrong-deletion:'+uid+':'+qid,owner:uid,questionId:qid,through:Math.max(stamp,row.graded),deletedAt:stamp}],['wrong-entry',{id:'wrong:'+uid+':'+qid,owner:uid,questionId:qid,status:'active',reason:'',correction:'',note:'',attachments:[],updated:stamp}]]);return {ok:true};}
  async selectWrong(uid,opts,used){const unit=integer(opts.unit||1,'Unit',1,4),status=opts.wrongStatus||'active';if(!['active','mastered'].includes(status))fail('已移出题目需先恢复');const topics=opts.topics||[];if(!Array.isArray(topics))fail('知识点范围格式错误');let pool=(await this.wrong(uid)).filter(r=>r.question.unit===unit&&r.meta.status===status&&(!topics.length||topics.some(t=>r.question.topics.includes(t)))).map(r=>r.question.id);if(opts.wrongIds!==undefined){if(!Array.isArray(opts.wrongIds)||!opts.wrongIds.length||opts.wrongIds.some(i=>typeof i!=='string'))fail('请选择有效的错题');if(!opts.previous&&opts.wrongIds.some(i=>!pool.includes(i)))fail('勾选题目已不在当前错题范围');pool=unique(opts.wrongIds).filter(i=>pool.includes(i));}pool=pool.filter(i=>!used.includes(i));if(!pool.length)fail('当前范围已无本轮未出的错题');if(pool.length<10&&!opts.allowPartial)fail('当前范围剩余'+pool.length+'道未出的错题，是否全部自测？',409,{remaining:pool.length});return shuffle(pool).slice(0,10);}
  async requireStudent(teacher,student){if(!await this.store.isTeacher(teacher,student))fail('只能查看已接受绑定的学生资料',403);}
  async testsForStudent(uid){return (await this.store.list('test',uid)).sort((a,b)=>b.created-a.created);}
  testSummary(t){return {id:t.id,owner:t.owner,reviewer:t.reviewer,title:t.title,mode:t.mode,status:t.status,created:t.created,submitted:t.submitted||null,graded:t.graded||null,questionCount:t.ids.length,answeredCount:Object.values(t.answers).filter(a=>a.choice||String(a.text||'').trim()||(a.attachments||[]).length).length,maxMarks:sum(t.ids.map(i=>this.bank.questions.get(i).marks)),score:t.status==='graded'?sum(Object.values(t.grades).map(g=>g.score)):null,assignmentId:t.assignmentId||null,late:!!t.late};}
  async studentStats(uid){const tests=await this.testsForStudent(uid),graded=tests.filter(t=>t.status==='graded'),wrong=await this.wrong(uid),maximum=sum(graded.flatMap(t=>t.ids.map(i=>this.bank.questions.get(i).marks))),earned=sum(graded.flatMap(t=>Object.values(t.grades).map(g=>g.score)));return {testCount:tests.length,submittedCount:tests.filter(t=>t.status!=='draft').length,gradedCount:graded.length,wrongCount:wrong.filter(r=>r.meta.status==='active').length,lookupCount:sum((await this.store.lookupRecords(uid)).map(w=>w.count)),scoreRate:maximum?Math.round(1000*earned/maximum)/10:null};}
  async teacherDashboard(uid){const students=[];for(const s of await this.store.students(uid))students.push({...s,stats:await this.studentStats(s.id)});const classrooms=[];for(const c of await this.store.list('classroom',uid))classrooms.push(await this.classroomSummary(c));return {students,classrooms};}
  async studentDetail(teacher,student){await this.requireStudent(teacher,student);return {student:(await this.store.students(teacher)).find(s=>s.id===student),stats:await this.studentStats(student),tests:(await this.testsForStudent(student)).map(t=>this.testSummary(t))};}
  async messageRecord(teacher,student,value,assignment=null,kind='note'){const sender=await this.store.user(teacher);return {id:id(),owner:student,sender:teacher,senderName:sender.name,text:value,kind,assignmentId:assignment,created:now(),readAt:null};}
  async messagesFor(uid){const individual=await this.store.list('message',uid),receipts=new Map((await this.store.list('message-read',uid)).map(r=>[r.id,r.readAt]));const broadcast=(await this.store.list('announcement')).filter(m=>m.recipients.includes(uid)).map(m=>{const mid=hash(m.id+':'+uid).slice(0,24);return {id:mid,owner:uid,sender:m.owner,senderName:m.senderName,text:m.text,kind:m.kind,assignmentId:m.assignmentId,created:m.created,readAt:receipts.get(mid)||null};});return [...individual.map(m=>({...m,readAt:receipts.get(m.id)||m.readAt||null})),...broadcast].sort((a,b)=>b.created-a.created);}
  async studentMessages(teacher,student){await this.requireStudent(teacher,student);return (await this.messagesFor(student)).filter(m=>m.sender===teacher);}
  async leaveMessage(teacher,student,body){await this.requireStudent(teacher,student);const value=text(body.text,'留言',4000,true).trim(),m=await this.messageRecord(teacher,student,value);await this.store.save('message',m.id,student,m);return m;}
  async readMessage(uid,key){const m=(await this.messagesFor(uid)).find(m=>m.id===key);if(!m)fail('无权读取这条消息',403);if(!m.readAt){m.readAt=now();await this.store.save('message-read',key,uid,{id:key,owner:uid,readAt:m.readAt});}return m;}
  async unbindAccounts(uid,other){const relation=await this.store.unbind(uid,other),changes=[];for(const c of await this.store.list('classroom',relation.teacher))if(c.members.includes(relation.student)){c.members=c.members.filter(i=>i!==relation.student);changes.push(['classroom',c]);}for(const t of await this.store.list('test',relation.student))if(t.reviewer===relation.teacher&&t.status!=='graded'){t.reviewer=null;changes.push(['test',t]);}await this.store.saveMany(changes);return {ok:true};}
  async classroomSummary(c){let count=0;for(const uid of c.members)if(await this.store.isTeacher(c.owner,uid))count++;return {id:c.id,owner:c.owner,name:c.name,memberCount:count,created:c.created};}
  async ownClassroom(uid,key){const c=await this.store.get('classroom',key);this.own(uid,c);return c;}
  async saveClassroom(uid,body,key=null){const c=key?await this.ownClassroom(uid,key):{id:id(),owner:uid,created:now(),members:[]};const name=text(body.name===undefined?c.name:body.name,'教室名称',80,true).trim(),members=body.members===undefined?c.members:body.members;if(!Array.isArray(members)||members.some(i=>typeof i!=='string'))fail('教室学生名单格式无效');for(const student of unique(members))if(!await this.store.isTeacher(uid,student))fail('教室只能加入已接受绑定的学生',403);Object.assign(c,{name,members:unique(members),updated:now()});await this.store.save('classroom',c.id,uid,c);return this.classroomDetail(uid,c.id);}
  async classroomDetail(uid,key){const c=await this.ownClassroom(uid,key),students=await this.store.students(uid),assignments=[];for(const a of await this.store.list('assignment',uid))if(a.classroomId===key)assignments.push(await this.assignmentDetail(uid,a.id));return {...c,members:c.members.map(i=>students.find(s=>s.id===i)).filter(Boolean),assignments};}
  deadline(value){if(typeof value!=='number'||!Number.isFinite(value)||value<=now()||value>253402271999)fail('请选择未来的有效截止时间（北京时间）');return Math.floor(value);}
  async announcement(teacher,recipients,value,assignment,kind){const u=await this.store.user(teacher);return {id:id(),owner:teacher,recipients,senderName:u.name,text:value,assignmentId:assignment,kind,created:now()};}
  async createAssignment(uid,classroom,body){const c=await this.ownClassroom(uid,classroom),p=await this.paperAccess(uid,body.paperId);this.own(uid,p);const recipients=[];for(const s of c.members)if(await this.store.isTeacher(uid,s))recipients.push(s);if(!recipients.length)fail('请先将已绑定学生加入教室');const dueAt=this.deadline(body.dueAt),title=text(body.title||p.title,'作业名称',100,true).trim(),a={id:id(),owner:uid,classroomId:c.id,classroomName:c.name,paperId:p.id,title,ids:p.ids.slice(),recipients,dueAt,created:now()};const m=await this.announcement(uid,recipients,'教室“'+c.name+'”布置了试卷：'+title+'。截止：'+beijing(dueAt)+'。',a.id,'assignment');await this.store.saveMany([['assignment',a],['announcement',m]]);return this.assignmentDetail(uid,a.id);}
  async assignmentAccess(uid,key){const a=await this.store.get('assignment',key);if(uid!==a.owner&&!a.recipients.includes(uid))fail('无权查看这项教室作业',403);return a;}
  async assignmentAttempt(uid,key){return (await this.testsForStudent(uid)).find(t=>t.assignmentId===key)||null;}
  async assignmentDetail(uid,key){const a=await this.assignmentAccess(uid,key),teacher=await this.store.user(a.owner),r={id:a.id,owner:a.owner,classroomId:a.classroomId,classroomName:a.classroomName,paperId:a.paperId,title:a.title,dueAt:a.dueAt,created:a.created,role:uid===a.owner?'teacher':'student',teacherName:teacher.name,questionCount:a.ids.length,marks:sum(a.ids.map(i=>this.bank.questions.get(i).marks)),overdue:now()>a.dueAt};if(uid===a.owner){const students=await this.store.students(uid),progress=[];for(const studentId of a.recipients){const s=students.find(s=>s.id===studentId);if(!s){progress.push({studentId,name:'已解绑学生',remark:'',active:false,status:'unbound',testId:null,score:null,maxMarks:r.marks,late:false});continue;}const t=await this.assignmentAttempt(studentId,key);progress.push({studentId,name:s.name,remark:s.remark,active:true,status:t?t.status:'pending',testId:t?t.id:null,score:t&&t.status==='graded'?sum(Object.values(t.grades).map(g=>g.score)):null,maxMarks:r.marks,late:!!(t&&t.late)});}r.progress=progress;r.recipientCount=a.recipients.length;r.submittedCount=progress.filter(p=>['submitted','grading','graded'].includes(p.status)).length;}else{const t=await this.assignmentAttempt(uid,key);Object.assign(r,{active:await this.store.isTeacher(a.owner,uid),testId:t?t.id:null,status:t?t.status:'pending',late:!!(t&&t.late),score:t&&t.status==='graded'?sum(Object.values(t.grades).map(g=>g.score)):null});}return r;}
  async assignmentsFor(uid){const rows=[];for(const a of await this.store.list('assignment'))if(uid===a.owner||a.recipients.includes(uid))rows.push(await this.assignmentDetail(uid,a.id));return rows;}
  async changeDeadline(uid,key,body){const a=await this.assignmentAccess(uid,key);this.own(uid,a);a.dueAt=this.deadline(body.dueAt);a.updated=now();const recipients=[];for(const s of a.recipients)if(await this.store.isTeacher(uid,s))recipients.push(s);const m=await this.announcement(uid,recipients,'作业“'+a.title+'”的截止时间已更新为：'+beijing(a.dueAt)+'。',a.id,'deadline');await this.store.saveMany([['assignment',a],['announcement',m]]);return this.assignmentDetail(uid,key);}
}
module.exports={Service};

};
modules['./pdf-manifest']=function(require,module,exports){
'use strict';
const {fail,hash}=require('./common');
const LABELS={questions:'Question paper / 题目',answers:'Mark scheme / 答案',card:'Answer sheet / 答题卡',analysis:'Review / 试卷解析'};
// Each request contains metadata for at most one question, never image bytes or PDF rendering.
async function exportManifest(bank,record,kind,params,store){
  if(!LABELS[kind])fail('导出类型无效');
  const ids=record.ids.filter(i=>!['card','analysis'].includes(kind)||!(record.skipped||[]).includes(i));
  if(!ids.length)fail('没有可导出的题目');
  const version=hash(JSON.stringify([record.title,ids,record.answers||{},record.grades||{},record.status||'']));
  if(params.version&&params.version!==version)fail('试卷或作答已更新，请重新生成 PDF',409);
  const pick=q=>kind==='answers'?q.answerImages:Object.hasOwn(q,'sharedContextImages')?[...(q.sharedContextImages||[]),...q.questionImages]:(q.contextImages?.length?q.contextImages:q.questionImages);
  let bodyFontPoints=10.5;for(const id of ids){const q=bank.questions.get(id);for(const im of [...pick(q),...(kind==='analysis'?q.answerImages:[])]){const l=bank.imageLayout?.[im.id];if(l)bodyFontPoints=Math.min(bodyFontPoints,515*l.fontPixels/l.width);}}
  if(params.item===undefined)return {protocol:'device-pdf-v1',version,kind,title:record.title,label:LABELS[kind],bodyFontPoints,count:ids.length,units:[...new Set(ids.map(i=>bank.questions.get(i).unit))],marks:ids.reduce((n,i)=>n+bank.questions.get(i).marks,0)};
  const index=Number(params.item);if(!Number.isSafeInteger(index)||index<0||index>=ids.length)fail('导出题目位置无效');
  if(!params.version)fail('请先读取导出清单');
  const q=bank.questions.get(ids[index]),blocks=[],para=(text,size=10)=>{if(text)blocks.push({type:'text',text:String(text),size});};
  const image=im=>{if(!bank.assets[im.id])fail('题图未收录',404);blocks.push({type:'image',url:'cloud-media://'+im.id,width:im.width,height:im.height,layout:bank.imageLayout?.[im.id]||null});};
  const months={'01':'January','06':'June'},session=q.session.slice(0,4)+' '+(months[q.session.slice(4)]||q.session.slice(4)),source='PH0'+q.unit+' / '+session+' / Q'+String(q.number).padStart(2,'0')+(q.part?'.'+q.part:'');
  para(String(index+1).padStart(2,'0')+'   '+source+'   ['+q.marks+(q.marks===1?' mark]':' marks]'),12);if(kind!=='questions')para(q.focus);if(q.difficulty)para('Difficulty: '+q.difficulty.stars+'/5 (teaching estimate)',9);if((q.subparts||[]).length>1)para(q.subparts.map(p=>'Q'+String(q.number).padStart(2,'0')+'.'+p.part+': '+p.difficulty.stars+'/5').join(' | '),9);
  const split=Object.hasOwn(q,'sharedContextImages'),context=kind!=='answers'&&split?(q.sharedContextImages||[]).length:kind!=='answers'&&(q.contextImages||[]).length;
  const images=kind==='answers'?q.answerImages:split?[...(q.sharedContextImages||[]),...q.questionImages]:(context?q.contextImages:q.questionImages);
  if(context)para('Shared context: answer only '+source+'. Original question numbers are retained in the images.',9);
  for(const im of images||[])image(im);
  if(!(images||[]).length&&kind!=='answers')para(q.text);
  if(kind==='answers'){if(q.correct)para('Correct option / 正确选项: '+q.correct);if(q.explanation)para('Model answer / 样例答案: '+q.explanation);}
  if(['card','analysis'].includes(kind)){
    const a=(record.answers||{})[q.id]||{},g=(record.grades||{})[q.id];
    para('Your answer / 作答: '+(a.choice||a.text||'(未作答 / No answer)'));
    const photos=await Promise.all((a.attachments||[]).map(f=>store.get('upload',f.id)));
    for(const f of photos){if(f.owner!==record.owner)fail('作答图片不属于该答题卡',403);blocks.push({type:'image',url:'cloud-private://'+f.id,width:f.width,height:f.height});}
    if(g)para('Score / 得分: '+g.score+'/'+q.marks,11);
    if(kind==='analysis'&&g&&g.score<q.marks){
      para('Correct answer and marking guidance / 正确答案与评分解析',11);
      if(q.correct)para('Correct option / 正确选项: '+q.correct);
      for(const im of q.answerImages||[])image(im);
      if(q.explanation)para('Model answer / 样例答案: '+q.explanation);
    }
    if(g&&g.comment)para('Comment / 批注: '+g.comment);
  }
  return {protocol:'device-pdf-item-v1',version,index,id:q.id,answerMode:q.answerMode,marks:q.marks,blocks};
}
module.exports={exportManifest};

};
modules['./router']=function(require,module,exports){
'use strict';
const {fail,copy,sum,text,integer}=require('./common');
const {exportManifest}=require('./pdf-manifest');
function decorate(t){const r=copy(t);for(const a of Object.values(r.answers||{}))for(const f of a.attachments||[])f.url='cloud-private://'+f.id;return r;}
function decorateWrong(row,includePhotos=true){const r=copy(row);if(includePhotos)for(const key of ['answer','meta'])for(const f of (r[key]||{}).attachments||[])f.url='cloud-private://'+f.id;return r;}
async function route({path,method,body,user,uid,store,service:s,bank,files,cloud,settings}){
  const url=new URL(path,'https://internal.invalid'),p=url.pathname,params=Object.fromEntries(url.searchParams);
  if(p==='/health')return {ok:true,mode:'wechat-cloud',environment:settings.environment,bankVersion:bank.catalog.version,assetsConfigured:!!settings.storagePrefix};
  if(p==='/catalog')return bank.catalog;
  if(p==='/auth/wechat'){if(method!=='POST')fail('请通过微信登录按钮登录');const name=body.name===undefined?'':text(body.name,'昵称',40);return {user:await store.identity(settings.appId,user.openid,name),cloud:true};}
  if(!uid||!await store.optional('user',uid))fail('请先登录',401);
  if(p==='/me'){const u=await store.get('user',uid);if(method==='POST'){u.name=text(body.name,'昵称',40,true).trim();await store.save('user',uid,uid,u);}return {user:{id:u.id,username:u.username,name:u.name,code:u.code},bindings:await store.bindings(uid),localReview:false};}
  if(p==='/bindings/invite'&&method==='POST'){await store.invite(uid,body.code);return {ok:true};}
  if(p==='/bindings/accept'&&method==='POST'){await store.accept(uid,body.id);return {ok:true};}
  if(p==='/bindings/remove'&&method==='POST')return s.unbindAccounts(uid,body.id);
  if(p==='/teacher'&&method==='GET')return s.teacherDashboard(uid);
  if(p.startsWith('/teacher/students/')){const parts=p.slice('/teacher/students/'.length).split('/'),student=parts[0],action=parts[1]||'';await s.requireStudent(uid,student);if(action==='remark'&&method==='POST'){await store.remark(uid,student,body.remark);return {ok:true};}if(action==='messages')return method==='POST'?s.leaveMessage(uid,student,body):{items:await s.studentMessages(uid,student)};if(action==='lookups'&&method==='GET')return {items:await store.lookupRecords(student)};if(action==='wrong'&&method==='GET')return parts[2]?decorateWrong(await s.wrongEntry(student,parts[2])):{items:(await s.wrong(student)).map(r=>decorateWrong(r,false))};if(!action&&method==='GET')return s.studentDetail(uid,student);fail('未找到学生管理操作',404);}
  if(p==='/teacher/classrooms')return method==='POST'?s.saveClassroom(uid,body):{items:await Promise.all((await store.list('classroom',uid)).map(c=>s.classroomSummary(c)))};
  if(p.startsWith('/teacher/classrooms/')){const [key,action]=p.slice('/teacher/classrooms/'.length).split('/');if(action==='assignments'&&method==='POST')return s.createAssignment(uid,key,body);if(!action)return method==='POST'?s.saveClassroom(uid,body,key):s.classroomDetail(uid,key);fail('未找到教室操作',404);}
  if(p.startsWith('/teacher/assignments/')&&p.endsWith('/deadline')&&method==='POST')return s.changeDeadline(uid,p.split('/')[3],body);
  if(p==='/assignments'&&method==='GET')return {items:await s.assignmentsFor(uid)};
  if(p.startsWith('/assignments/')){const [key,action]=p.slice('/assignments/'.length).split('/');if(action==='start'&&method==='POST')return s.createTest({id:uid},{assignmentId:key});if(action==='questions.pdf'&&method==='GET'){const a=await s.assignmentAccess(uid,key);return exportManifest(bank,a,'questions',params,store);}if(!action&&method==='GET')return s.assignmentDetail(uid,key);fail('未找到作业操作',404);}
  if(p==='/messages'&&method==='GET')return {items:await s.messagesFor(uid)};
  if(p.startsWith('/messages/')&&p.endsWith('/read')&&method==='POST')return s.readMessage(uid,p.split('/')[2]);
  if(p==='/questions'&&method==='GET'){let qs=bank.filtered(params);if(params.sort==='question-type')qs=bank.order(qs.map(q=>q.id)).map(i=>bank.questions.get(i));const offset=integer(params.offset||0,'分页位置',0,100000);return {total:qs.length,items:qs.slice(offset,offset+30).map(q=>bank.public(q))};}
  if(p==='/lookup'&&method==='POST'){const unit=integer(body.unit||1,'Unit',1,4),result=body.text!==undefined?bank.lookupText(body.text,body.offset,unit):bank.lookup(body.image,body.x,body.y,unit);if(result.found)result.count=await store.countWord(uid,result.term,result.kind);return result;}
  if(p==='/lookups'&&method==='GET')return {items:await store.lookupRecords(uid)};
  if(p==='/tests'&&method==='POST')return s.createTest({id:uid},body);
  if(p==='/tests'&&method==='GET'){const tests=[];for(const t of await store.list('test'))if(uid===t.owner||(uid===t.reviewer&&await store.bound(uid,t.owner)))tests.push({id:t.id,title:t.title,status:t.status,created:t.created,owner:t.owner,reviewer:t.reviewer});return {items:tests};}
  if(p.startsWith('/tests/')){const [key,action]=p.slice('/tests/'.length).split('/');if(method==='POST'){if(action==='answers')return decorate(await s.saveAnswers(uid,key,body));if(action==='submit')return decorate(await s.submit(uid,key));if(action==='grade')return decorate(await s.grade(uid,key,body));if(action==='assign')return decorate(await s.assign(uid,key,body.id));fail('未找到答题卡操作',404);}const t=await s.readableTest(uid,key);if(['card.pdf','analysis.pdf'].includes(action)){if(action==='analysis.pdf'&&t.status!=='graded')fail('批改完成后才能导出解析');return exportManifest(bank,t,action==='analysis.pdf'?'analysis':'card',params,store);}if(action)fail('未找到答题卡页面',404);const r=decorate(t),reviewer=await s.effectiveReviewer(t);r.reviewer=reviewer;r.questions=t.ids.map(i=>bank.public(bank.questions.get(i),t.status!=='draft'));r.maxMarks=sum(t.ids.map(i=>bank.questions.get(i).marks));r.totalScore=sum(Object.values(t.grades).map(g=>g.score));r.readOnly=uid!==t.owner;r.canGrade=['submitted','grading'].includes(t.status)&&(reviewer||t.owner)===uid;return r;}
  if(p==='/papers'&&method==='POST')return s.createPaper({id:uid},body);
  if(p==='/papers'&&method==='GET')return {items:(await s.papersFor(uid)).map(p=>({...p,count:p.ids.length,marks:sum(p.ids.map(i=>bank.questions.get(i).marks)),typeSummary:bank.typeSummary(p.ids)}))};
  if(p.startsWith('/papers/')){const [key,action]=p.slice('/papers/'.length).split('/');if(action==='delete'&&method==='POST')return s.deletePaper(uid,key);const paper=await s.paperAccess(uid,key);if(action==='send'&&method==='POST')return s.sendPaper(uid,key,body.id);if(['questions.pdf','answers.pdf'].includes(action)&&method==='GET'){if(action==='answers.pdf')s.own(uid,paper);return exportManifest(bank,paper,action==='answers.pdf'?'answers':'questions',params,store);}if(!action)return {...paper,questions:paper.ids.map(i=>bank.public(bank.questions.get(i)))};fail('未找到试卷操作',404);}
  if(p==='/wrong'&&method==='GET')return {items:(await s.wrong(uid)).map(r=>decorateWrong(r,false))};
  if(p.startsWith('/wrong/')){const [qid,action]=p.slice('/wrong/'.length).split('/');if(action==='delete'&&method==='POST')return s.deleteWrong(uid,qid);if(action)fail('未找到错题操作',404);return decorateWrong(method==='POST'?await s.editWrong(uid,qid,body):await s.wrongEntry(uid,qid));}
  if(p==='/uploads/prepare'&&method==='POST')return files.prepare(uid);
  if(p==='/uploads/finalize'&&method==='POST')return files.finalize(uid,body);
  if(p.startsWith('/media/')&&method==='GET')return files.media(uid,p.split('/')[2],false);
  if(p.startsWith('/private-media/')&&method==='GET')return p.endsWith('/chunk')?files.privateChunk(uid,p.split('/')[2],integer(params.offset||0,'下载位置',0,100000000)):files.media(uid,p.split('/')[2],true);
  if(p.startsWith('/exports/')&&p.endsWith('/chunk')&&method==='GET')return files.exportChunk(uid,p.split('/')[2],integer(params.offset||0,'下载位置',0,1000000000));
  fail('未找到云端接口',404);
}
module.exports={route,decorate,decorateWrong};

};
modules['/guest-data/dictionary/hover-core.js']=function(require,module,exports){
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

};
function require(id){if(id==='node:fs')return {existsSync:()=>false};if(id==='node:path')return {join:(...a)=>a.join('/').replace(/\/+/g,'/')};if(Object.hasOwn(data,id))return data[id];if(cache[id])return cache[id].exports;if(!modules[id])throw Error('Unavailable local module '+id);const m={exports:{}};cache[id]=m;modules[id](require,m,m.exports);return m.exports;}
 return {Bank:require('./bank').Bank,Service:require('./service').Service,route:require('./router').route,exportManifest:require('./pdf-manifest').exportManifest,common:require('./common'),data};})();export {GuestEngine};