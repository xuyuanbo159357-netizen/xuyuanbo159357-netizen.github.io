/* Shared learning navigation on the original knowledge pages. */
(async()=>{
 const data=JSON.parse(document.getElementById('page-data')?.textContent||'{}');
 const session={user:null};
 const account=document.querySelector('.studio-account');if(account&&session.user)account.textContent=session.user.name;
 let queue=Promise.resolve();window.addEventListener('physics-knowledge-query',e=>{const last=Object.entries(e.detail?.terms||{}).sort((a,b)=>String(b[1].lastQueriedAt).localeCompare(String(a[1].lastQueriedAt)))[0];if(!last)return;queue=queue.catch(()=>{}).then(async()=>{const body={text:last[0],offset:0,unit:Number(String(data.unit||'U1').replace('U',''))||1};if(session.user){const r=await fetch('/api/lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error('查词次数同步失败');}else{const {guestApi}=await import('/guest.js');await guestApi('/lookup',body);}}).catch(()=>{small.textContent='本次查词已保存在浏览器词库；学习记录更新未完成，请检查连接。';});});
 const main=document.querySelector('main');if(!main)return;
 const panel=document.createElement('section');panel.className='studio-study-bar';
 const label=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent='学习与练习，在同一个空间';small.textContent='前往学习首页选择测试类型，或进入组卷系统。';label.append(strong,small);panel.append(label);
 const a=document.createElement('a');a.href='/#/home';a.textContent='测试与组卷 →';panel.append(a);
 main.prepend(panel);
})().catch(()=>{ /* The notes remain usable when the account service is unavailable. */ });
