import {difficulty} from './difficulty.js?v=20261028r5';
import {guestUser,guestApi,guestUpload,clearGuest} from './guest.js?v=20261028r5';
export {guestUser,clearGuest};
export const state={user:null,catalog:null,knowledge:null,unit:1,cleanup:null,epoch:0};
export const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const icon=(name,rose=false)=>`<img class="icon" src="/icons/${name}-${rose?'rose':'active'}.png" alt="">`;
export const date=t=>t?new Date(t*1000).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'—';
export const statuses={pending:'未开始',draft:'作答中',submitted:'待批改',grading:'批改中',graded:'已批改',unbound:'已解绑'};
let events=new AbortController(),toastTimer;

export function newPage(){events.abort();events=new AbortController();$('#dictionary').hidden=true;}
export function on(type,selector,fn){document.addEventListener(type,async e=>{const target=e.target.closest(selector);if(!target)return;try{await fn(e,target);}catch(error){if(error.name!=='AbortError')toast(error.message||'操作未完成');}},{signal:events.signal});}
export function main(html){$('#main').innerHTML=html;}
export function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4500);}
export async function api(p,body){
   if(p==='/session')return {user:null};
   if(p==='/config')return {mode:'github-pages',guestOnly:true};
   if(p==='/assignments'||p==='/messages')return {items:[]};
   if(p==='/catalog'){const r=await fetch('/guest-data/catalog.json');if(!r.ok)throw Error('题库目录未加载，请刷新重试');return r.json();}
   if(/^\/(auth|logout|account|teacher|bindings|messages|assignments)(?:\/|$)/.test(p))throw Error('请在完整网站使用账号与教师功能');
   return guestApi(p,body);
  }
  export async function upload(file){return guestUpload(file);}
export function heading(eyebrow,title,subtitle=''){return `<div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${subtitle?`<p class="intro">${esc(subtitle)}</p>`:''}`;}
export function units(unit){return `<div class="units">${[1,2,3,4].map(u=>`<button class="chip ${unit===u?'active':''}" data-unit="${u}" aria-pressed="${unit===u}">U${u}</button>`).join('')}</div>`;}
export function empty(text){return `<div class="empty">${esc(text)}</div>`;}
export function link(route,label,cls='btn secondary'){return `<a class="${cls}" href="#/${route}">${esc(label)}</a>`;}
export function knowledgeLinks(q){const items=(q.topics||[]).map(id=>state.knowledge?.topics[id]).filter(Boolean);return difficulty(q)+(items.length?`<div class="knowledge-links"><span>知识点回顾</span>${items.map(t=>`<a href="${esc(t.url)}">${esc(t.title)} ↗</a>`).join('')}</div>`:'');}
export function testLink(t){return `#/${t.status==='draft'?'exam':'result'}/${t.id}`;}
export function modal(title,content,{confirm='确定',cancel='取消',form=false,wide=false}={}){
 return new Promise(resolve=>{const last=document.activeElement,root=$('#modal-root');root.innerHTML=`<div class="modal-overlay"><section class="modal ${wide?'image-modal':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">${esc(title)}</h2><div class="${form?'':'modal-content'}">${content}</div><div class="actions">${cancel?`<button class="btn secondary" id="modal-cancel">${esc(cancel)}</button>`:''}<button class="btn" id="modal-confirm">${esc(confirm)}</button></div></section></div>`;
  const finish=result=>{root.innerHTML='';document.removeEventListener('keydown',key);last?.focus();resolve(result);};
  $('#modal-confirm').onclick=()=>{if(form){const f=$('form',root);if(f&&!f.reportValidity())return;finish(Object.fromEntries(new FormData(f)));}else finish(true);};
  if(cancel)$('#modal-cancel').onclick=()=>finish(false);
  function key(e){if(e.key==='Escape'&&cancel)finish(false);if(e.key==='Tab'){const items=$$('button,a,input,select,textarea',root).filter(x=>!x.disabled);if(!items.length)return;const a=items[0],b=items.at(-1);if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}}}
  document.addEventListener('keydown',key);($('input,select,textarea',root)||$('#modal-confirm')).focus();
 });
}
export const confirm=(title,text)=>modal(title,esc(text));
export const formModal=(title,fields,confirmText='保存')=>modal(title,`<form>${fields}</form>`,{form:true,confirm:confirmText});
export function textField(name,label,value='',{type='text',max=100,required=true}={}){return `<label class="field label">${esc(label)}<input class="input" name="${name}" type="${type}" value="${esc(value)}" maxlength="${max}" ${required?'required':''}></label>`;}
export async function person(people,title='选择接收账号'){if(!people.length)throw new Error('请先在“我的”中完成账号绑定');const r=await formModal(title,`<label class="label">已绑定账号<select class="input" name="id">${people.map(p=>`<option value="${esc(p.id)}">${esc(p.remark||p.name)}</option>`).join('')}</select></label>`,'确定');return r&&r.id;}
export function requireUser(){if(state.user)return true;location.hash='/profile';toast('登录后保存个人答题卡、错题和试卷');return false;}
export function requireAccount(){if(state.user&&!state.user.guest)return true;location.hash='/profile';toast('师生绑定、发送试卷和教室作业需要登录账号');return false;}
export async function startTest(options){if(!requireUser())return;try{return await api('/tests',options);}catch(e){if(!e.detail?.remaining)throw e;const n=e.detail.remaining;if(await confirm(options.previous?'本轮剩余题目不足十道':'所选范围不足十道',`当前还有 ${n} 道可用题目，是否全部开始？`))return api('/tests',{...options,allowPartial:true});}}
export function media(images,unit,text=''){
 const list=images||[];return list.length?list.map(im=>`<div class="media-wrap" data-image="${esc(im.id)}" data-unit="${unit}"><img class="question-image" data-lookup="${esc(im.id)}" data-unit="${unit}" src="${esc(im.url||'/media/'+im.id)}" alt="真题题图，可放大查看" loading="lazy" draggable="false"><div class="image-error" hidden>题图加载失败。<button class="text-button" data-retry="${esc(im.id)}">重新加载</button></div><div class="media-tools"><span>停留 / 长按英文 2 秒查词</span><button class="text-button" data-preview="${esc(im.url||'/media/'+im.id)}">放大查看 ↗</button></div></div>`).join(''):`<p class="pre lookup-text" data-unit="${unit}">${esc(text||'当前没有题图')}</p>`;
}
export function attachments(items,{editable=false}={}){return `<div class="attachments">${(items||[]).map(a=>`<div class="attachment"><a href="${esc(a.url)}" target="_blank" rel="noopener"><img src="${esc(a.url)}" alt="手写作答图片"></a>${editable?`<button type="button" class="text-button danger" data-remove-photo="${esc(a.id)}">移除</button>`:''}</div>`).join('')}</div>`;}
export function uploadInput(id='answer-upload'){return `<label class="upload-area" for="${id}">${icon('camera')}<span>拍照 / 上传手写过程（最多六张）</span><input id="${id}" type="file" accept="image/*" multiple hidden></label>`;}
export function installMedia(){
 let timer=null,point=null,lastKey='',lastLookup=0;
 const cancel=()=>{clearTimeout(timer);timer=null;};
 function hide(){cancel();$('#dictionary').hidden=true;}
 async function lookup(body,x,y,key){if(Date.now()-lastLookup<1800&&key===lastKey)return;lastKey=key;lastLookup=Date.now();if(!state.user){toast('登录后可查词并保存查询次数');return;}
  try{const r=await api('/lookup',body);const el=$('#dictionary');el.innerHTML=r.found?`<strong>${esc(r.term)}</strong>${esc(r.zh)}${r.hint?`<div class="muted">${esc(r.hint)}</div>`:''}<div class="muted">${r.kind==='physics'?'专业重点词库':'一般英文词库'} · 已查询 ${r.count} 次</div>`:esc(r.message||'本地词库未收录该词，不猜译');el.hidden=false;el.style.left=Math.max(12,Math.min(x,innerWidth-el.offsetWidth-12))+'px';el.style.top=Math.max(12,Math.min(y+16,innerHeight-el.offsetHeight-16))+'px';}catch(e){toast(e.message);}}
 function schedule(e,im){const rect=im.getBoundingClientRect(),x=e.clientX,y=e.clientY,key=im.dataset.lookup+':'+Math.round((x-rect.left)/5)+':'+Math.round((y-rect.top)/5);if(point&&point.im===im&&Math.hypot(point.x-x,point.y-y)<5)return;cancel();point={im,x,y};timer=setTimeout(()=>lookup({image:im.dataset.lookup,unit:Number(im.dataset.unit),x:(x-rect.left)/rect.width,y:(y-rect.top)/rect.height},x,y,key),2000);}
 on('pointermove','[data-lookup]',(e,im)=>{if(e.pointerType==='mouse')schedule(e,im);});
 on('pointerdown','[data-lookup]',(e,im)=>{hide();point=null;schedule(e,im);});
 on('pointerout','[data-lookup]',()=>{cancel();point=null;});
 on('pointerup','[data-lookup]',e=>{if(e.pointerType!=='mouse'){cancel();point=null;}});
 on('contextmenu','[data-lookup]',e=>e.preventDefault());
 function scheduleText(e,el){const x=e.clientX,y=e.clientY;let node,offset;const p=document.caretPositionFromPoint?.(x,y),r=!p&&document.caretRangeFromPoint?.(x,y);node=p?.offsetNode||r?.startContainer;offset=p?.offset??r?.startOffset;if(!node||node.nodeType!==3||!el.contains(node)){cancel();point=null;return;}const range=document.createRange();range.selectNodeContents(el);range.setEnd(node,offset);const text=el.textContent,at=Math.min(text.length-1,range.toString().length);if(at<0||!/[a-zA-Z]/.test(text[at])){cancel();point=null;return;}if(point?.im===el&&Math.hypot(point.x-x,point.y-y)<5)return;cancel();point={im:el,x,y};timer=setTimeout(()=>lookup({text,offset:at,unit:Number(el.dataset.unit)||1},x,y,'text:'+text.slice(at,at+15)),2000);}
 on('pointermove','.lookup-text',(e,el)=>{if(e.pointerType==='mouse')scheduleText(e,el);});
 on('pointerdown','.lookup-text',(e,el)=>{hide();point=null;scheduleText(e,el);});
 on('pointerout','.lookup-text',()=>{cancel();point=null;});
 on('pointerup','.lookup-text',e=>{if(e.pointerType!=='mouse'){cancel();point=null;}});
 on('pointerdown','#main',e=>{if(!e.target.closest('[data-lookup],.lookup-text'))hide();});
 on('click','[data-preview]',async(e,b)=>{hide();await modal('原图查看',`<img src="${esc(b.dataset.preview)}" alt="原题完整图片">`,{wide:true,cancel:false,confirm:'关闭'});});
 on('click','[data-retry]',(e,b)=>{const wrap=b.closest('.media-wrap'),im=$('img',wrap);im.src=im.src.split('?')[0]+'?retry='+Date.now();$('.image-error',wrap).hidden=true;im.hidden=false;});
 document.addEventListener('error',e=>{if(e.target.matches('.question-image')){e.target.hidden=true;$('.image-error',e.target.parentNode).hidden=false;}},{capture:true,signal:events.signal});
 state.mediaCleanup=cancel;
}
export async function copy(text){try{await navigator.clipboard.writeText(text);toast('已复制');}catch{await modal('复制内容',`<input class="input" value="${esc(text)}" readonly>`,{form:false,cancel:false,confirm:'关闭'});}}
export function taskButton(selector,fn){on('click',selector,async(e,b)=>{if(b.disabled)return;b.disabled=true;try{await fn(e,b);}finally{if(b.isConnected)b.disabled=false;}});}
