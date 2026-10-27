(() => {
  const host=document.querySelector('#canvas-map'); if(!host)return;
  const NS='http://www.w3.org/2000/svg', colors={1:'#c65e64',2:'#ce9349',3:'#a89b43',4:'#4d9a75',5:'#4c92b4',6:'#937ab8'};
  const svg=document.createElementNS(NS,'svg'),world=document.createElementNS(NS,'g');svg.append(world);host.append(svg);
  let scale=1,x=0,y=0,bounds=[0,0,1000,1000],drag=null,moved=false;
  function el(tag,attrs,parent=world){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs||{}))e.setAttribute(k,v);parent.append(e);return e}
  function transform(){world.setAttribute('transform',`translate(${x} ${y}) scale(${scale})`);const z=document.querySelector('#zoom-value');if(z)z.textContent=Math.round(scale*100)+'%'}
  function fit(){const r=host.getBoundingClientRect();scale=Math.min(r.width/(bounds[2]+180),r.height/(bounds[3]+180));x=(r.width-bounds[2]*scale)/2-bounds[0]*scale;y=(r.height-bounds[3]*scale)/2-bounds[1]*scale;transform()}
  function zoom(f,cx=host.clientWidth/2,cy=host.clientHeight/2){const next=Math.max(.025,Math.min(4,scale*f));x=cx-(cx-x)*next/scale;y=cy-(cy-y)*next/scale;scale=next;transform()}
  host.onwheel=e=>{e.preventDefault();const r=host.getBoundingClientRect();zoom(e.deltaY<0?1.13:1/1.13,e.clientX-r.left,e.clientY-r.top)};
  host.onpointerdown=e=>{if(e.button!==0)return;drag={sx:e.clientX,sy:e.clientY,x,y};moved=false;host.setPointerCapture(e.pointerId);host.classList.add('dragging')};
  host.onpointermove=e=>{if(!drag)return;if(Math.abs(e.clientX-drag.sx)+Math.abs(e.clientY-drag.sy)>5)moved=true;x=drag.x+e.clientX-drag.sx;y=drag.y+e.clientY-drag.sy;transform()};
  host.onpointerup=e=>{if(!moved&&drag){const r=host.getBoundingClientRect();const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('a[data-note]');if(hit)location.href=hit.getAttribute('href')}drag=null;host.classList.remove('dragging')};
  svg.addEventListener('click',e=>{if(moved)e.preventDefault()});
  host.onkeydown=e=>{if(e.key==='+')zoom(1.2);if(e.key==='-')zoom(1/1.2);if(e.key==='0')fit()};
  document.querySelector('#fit').onclick=fit;document.querySelector('#zoom-in').onclick=()=>zoom(1.3);document.querySelector('#zoom-out').onclick=()=>zoom(1/1.3);window.addEventListener('resize',fit);
  function splitTitle(text,max=28){const lines=[];for(const line of text.split(/\n/)){let part='',len=0;for(const c of line){let w=c.charCodeAt(0)>255?1.8:1;if(len+w>max&&part){lines.push(part);part='';len=0}part+=c;len+=w}if(part)lines.push(part)}return lines}
  function textLines(parent,text,cx,cy,width,font=23,maxlines=7){const lines=splitTitle(text,width/(font*.55)).slice(0,maxlines),t=el('text',{'text-anchor':'middle',x:cx,y:cy-(lines.length-1)*font*.69,style:`font-size:${font}px`},parent);lines.forEach((line,i)=>{const span=el('tspan',{x:cx,dy:i?font*1.38:0},t);span.textContent=line});return t}
  function point(n,side){return side==='left'?[n.x,n.y+n.height/2]:side==='right'?[n.x+n.width,n.y+n.height/2]:side==='top'?[n.x+n.width/2,n.y]:[n.x+n.width/2,n.y+n.height]}
  const vec={left:[-1,0],right:[1,0],top:[0,-1],bottom:[0,1]};
  function canvas(data){
    world.replaceChildren();const defs=el('defs',{}),marker=el('marker',{id:'arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:8,markerHeight:8,orient:'auto-start-reverse'},defs);el('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'context-stroke'},marker);
    const ns=new Map(data.nodes.map(n=>[n.id,n]));
    const minx=Math.min(...data.nodes.map(n=>n.x)),miny=Math.min(...data.nodes.map(n=>n.y)),maxx=Math.max(...data.nodes.map(n=>n.x+n.width)),maxy=Math.max(...data.nodes.map(n=>n.y+n.height));bounds=[minx,miny,maxx-minx,maxy-miny];
    data.nodes.filter(n=>n.type==='group').forEach(n=>{const g=el('g',{class:'canvas-group'}),c=colors[n.color]||'#73939e';el('rect',{x:n.x,y:n.y,width:n.width,height:n.height,rx:18,fill:c,stroke:c,'stroke-width':3},g);const t=el('text',{x:n.x+20,y:n.y+43},g);t.textContent=n.label||''});
    (data.edges||[]).forEach(e=>{const a=ns.get(e.fromNode),b=ns.get(e.toNode);if(!a||!b)return;const p=point(a,e.fromSide||'right'),q=point(b,e.toSide||'left'),v=vec[e.fromSide||'right'],w=vec[e.toSide||'left'],dist=Math.min(350,Math.max(90,Math.hypot(q[0]-p[0],q[1]-p[1])*.35)),c1=[p[0]+v[0]*dist,p[1]+v[1]*dist],c2=[q[0]+w[0]*dist,q[1]+w[1]*dist];
      const g=el('g',{class:'canvas-edge'}),path=el('path',{d:`M${p} C${c1} ${c2} ${q}`,stroke:colors[e.color]||'#7795a5'},g);if(e.toEnd!=='none')path.setAttribute('marker-end','url(#arrow)');if(e.fromEnd==='arrow')path.setAttribute('marker-start','url(#arrow)');
      if(e.label){const mx=(p[0]+3*c1[0]+3*c2[0]+q[0])/8,my=(p[1]+3*c1[1]+3*c2[1]+q[1])/8;textLines(g,e.label,mx,my-12,500,20,3)}
    });
    data.nodes.filter(n=>n.type!=='group').forEach(n=>{const g=el(n.url?'a':'g',{class:'canvas-node',...(n.url?{href:n.url,'data-note':'true'}:{})}),c=colors[n.color]||'#7296a0';el('rect',{x:n.x,y:n.y,width:n.width,height:n.height,rx:12,fill:'#fff',stroke:c},g);el('rect',{x:n.x,y:n.y+12,width:7,height:n.height-24,rx:3,fill:c,stroke:'none'},g);const text=n.title||n.text||n.file||'',clean=text.replace(/^#+\s*/gm,'').replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g,(_,a,b)=>b||a).replace(/[*`]/g,'');textLines(g,clean,n.x+n.width/2,n.y+n.height/2,n.width-32,23,Math.floor(n.height/30));const title=el('title',{},g);title.textContent=clean});fit();
  }
  if(host.dataset.map)fetch(host.dataset.map).then(r=>r.json()).then(canvas);
  if(host.dataset.graph)fetch(host.dataset.graph).then(r=>r.json()).then(data=>{
    function draw(){
      const filter=document.querySelector('#graph-unit').value;
      const nodes=data.nodes.filter(n=>filter==='all'||n.unit===filter||n.unit==='通用');const set=new Set(nodes.map(n=>n.id));const edges=data.edges.filter(([s,t])=>set.has(s)&&set.has(t));
      const centers={U1:[-1300,-650],U2:[1300,-650],U3:[1300,1250],U4:[-1300,1250],'通用':[0,0]},counts={},positions=new Map();
      for(const n of nodes){const group=n.unit,c=centers[group]||[0,0],i=counts[group]||0;counts[group]=i+1;const a=i*2.3999632297,r=120+Math.sqrt(i)*76;positions.set(n.id,[c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r])}
      world.replaceChildren();for(const[s,t]of edges){const p=positions.get(s),q=positions.get(t);el('line',{x1:p[0],y1:p[1],x2:q[0],y2:q[1],class:'graph-edge'})}
      for(const n of nodes){const p=positions.get(n.id),a=el('a',{href:n.url,'data-note':'true',class:'graph-node'});el('circle',{cx:p[0],cy:p[1],r:n.title.includes('知识谱系')?17:8,fill:({U1:'#2e9383',U2:'#428bb7',U3:'#9770ba',U4:'#c79349','通用':'#71838f'})[n.unit]},a);const t=el('text',{x:p[0]+12,y:p[1]+6,fill:'#354a58'},a);t.textContent=n.title.length>46?n.title.slice(0,46)+'…':n.title;const title=el('title',{},a);title.textContent=n.title}
      const ps=[...positions.values()],xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]);bounds=[Math.min(...xs)-30,Math.min(...ys)-30,Math.max(...xs)-Math.min(...xs)+480,Math.max(...ys)-Math.min(...ys)+60];
      document.querySelector('#graph-count').textContent=`${nodes.length} 个知识节点 · ${edges.length} 条笔记链接 / linked relationships`;fit();
    }document.querySelector('#graph-unit').onchange=draw;draw();
  });
})();
