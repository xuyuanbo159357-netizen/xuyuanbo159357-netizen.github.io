import {state,$,esc,icon,newPage,main,api,toast,installMedia,confirm,guestUser} from './core.js?v=20261028r6';
import {home,selection,exam,result,installExports} from './views.js?v=20261028r6';
import {papers,wrong,wrongEdit,profile,teacher,student,classroom,assignment,privacy} from './account.js?v=20261028r6';

const navs=[['home','home','学习首页'],['assemble','compose','组卷系统'],['papers','papers','我的试卷'],['wrong','wrong','我的错题库'],['teacher','discussion','教师管理'],['profile','profile','我的账号']];
const desktopNavs=[navs[0],['knowledge','concept','知识库学习','/knowledge.html'],['maps','history','知识谱系图','/maps.html'],['analysis','compose','考试分析总览','/exam-analysis.html'],...navs.slice(1)];
const navHref=(id,url)=>['profile','teacher'].includes(id)?'https://oxfordaqa-physics-studio.vercel.app/#/'+id:url||(id==='assemble'?'#/select/assemble':'#/'+id);
let previous='',switching=false;
function shell(){const current=location.hash.split('/')[1]?.split('?')[0]||'home',assemble=current==='select'&&location.hash.split('/')[2]?.split('?')[0]==='assemble',active=assemble?'assemble':['select','exam','result'].includes(current)?'home':['student','classroom','assignment'].includes(current)?'teacher':current;
 $('#app').innerHTML=`<aside class="sidebar"><a href="#/home" class="brand"><div class="brand-symbol">φ</div><div><strong>Physics Studio</strong><small>OXFORDAQA · 9630</small></div></a><div class="nav-label">LEARN WITH PURPOSE</div><nav aria-label="主要导航">${desktopNavs.map(([id,i,label,url])=>`<a href="${navHref(id,url)}" class="nav-item ${active===id?'active':''}" ${active===id?'aria-current="page"':''}>${icon(i)}${label}</a>`).join('')}</nav><div class="sidebar-bottom">独立物理学习工具<br>International AS / A-level<div style="margin-top:12px"><a href="#/privacy">隐私与数据</a><a href="https://oxfordaqa-physics-studio.vercel.app/#/profile">账号与反馈</a></div></div></aside><div class="workspace"><header class="topbar"><span class="crumb">PHYSICS 9630 <span style="padding:0 9px;color:#b8c8db">/</span> ${esc(navs.find(n=>n[0]===active)?.[2]||'学习空间')}</span><a class="user-button" href="https://oxfordaqa-physics-studio.vercel.app/#/profile"><span class="avatar">${esc((state.user?.name||'访')[0])}</span><span>${esc(state.user?.guest?'游客 · 本地记录':state.user?.name||'登录学习账号')}</span></a></header><main class="content" id="main" tabindex="-1"><div class="loading">正在载入…</div></main></div><nav class="mobile-bottom" aria-label="手机导航"><a href="/knowledge.html">${icon('concept')}<span>知识库</span></a>${navs.filter(n=>!['teacher','assemble'].includes(n[0])).map(([id,i,label])=>`<a href="#/${id}" class="${active===id?'active':''}">${icon(i)}<span>${label.replace('学习首页','首页').replace('我的账号','我的').replace('我的错题库','错题库')}</span></a>`).join('')}</nav>`;
}
async function route(){
 if(switching)return;switching=true;
 const requested=location.hash||'#/home';
 try{
  if(state.cleanup){const cleanup=state.cleanup;state.cleanup=null;try{await cleanup();}catch(e){if(!await confirm('草稿保存失败',e.message+'。是否仍要离开当前题目？')){location.hash=previous;state.cleanup=cleanup;return;}}}
  state.mediaCleanup?.();state.mediaCleanup=null;newPage();state.epoch++;shell();
  const [path,query='']=requested.replace(/^#\/?/,'').split('?'),[name='home',id]=path.split('/'),params=new URLSearchParams(query);
  const views={home:()=>home(),select:()=>selection(id||'normal',params),exam:()=>exam(id),result:()=>result(id,params),papers,wrong,'wrong-edit':()=>wrongEdit(id),profile,teacher,student:()=>student(id),classroom:()=>classroom(id),assignment:()=>assignment(id),privacy};
  if(!views[name])throw new Error('页面不存在，请从侧栏重新选择');
  await views[name]();installMedia();installExports();previous=requested;document.title=(name==='exam'?'正在作答 · ':'')+'Physics Studio · OxfordAQA 9630';scrollTo(0,0);
 }catch(e){main(`<section class="card"><h2>暂时无法载入</h2><p class="notice warning" style="margin:20px 0">${esc(e.message)}</p><button class="btn secondary" id="retry-page">重新载入</button> <a class="btn soft" href="#/home">返回首页</a></section>`);$('#retry-page').onclick=()=>route();}
 finally{switching=false;if((location.hash||'#/home')!==requested)queueMicrotask(route);}
}
window.addEventListener('hashchange',route);
window.addEventListener('physics-auth',()=>{const name=state.user?.guest?'游客 · 本地记录':state.user?.name||'登录学习账号';const b=$('.topbar .user-button');if(b)b.innerHTML=`<span class="avatar">${esc((state.user?.name||'访')[0])}</span><span>${esc(name)}</span>`;});
async function boot(){try{const [catalog,session,knowledge]=await Promise.all([api('/catalog'),api('/session'),fetch('/knowledge-index.json').then(r=>r.json())]);state.catalog=catalog;state.user=session.user||guestUser;state.knowledge=knowledge;await route();}catch(e){$('#app').innerHTML=`<div class="card" style="max-width:600px;margin:60px auto"><h1>学习空间暂未连接</h1><p class="intro">${esc(e.message)}</p><p>请确认网页服务已经启动，再重新打开。</p><button class="btn" id="retry-app">重试</button></div>`;$('#retry-app').onclick=()=>location.reload();}}
boot();
