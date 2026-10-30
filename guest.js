import {GuestEngine as E} from './guest-engine.js?v=20261030r3';
export const guestUser=Object.freeze({id:'browser-guest',username:'guest',name:'游客',guest:true,code:''});
const {fail,copy,now,id,hash}=E.common;
const databaseName='oxfordaqa-physics-guest-v1';let opening,engine;
const urls=new Map();
function database(){if(!opening)opening=new Promise((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'key'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('无法打开浏览器本地存储，请检查浏览器设置或使用账号登录'));});return opening;}
async function readAll(){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('records','readonly'),request=tx.objectStore('records').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function writeAll(records,clear=false){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite'),store=tx.objectStore('records');if(clear)store.clear();for(const r of records)store.put(r);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(new Error('本地保存失败，可能是浏览器存储空间不足；请保留当前页面后重试'));});}
async function locked(fn){if(!navigator.locks)throw new Error('此浏览器不支持游客记录的安全保存，请使用新版浏览器或登录账号');return navigator.locks.request('oxfordaqa-guest-records',fn);}
class Store{
 constructor(rows){this.rows=new Map(rows.map(r=>[r.key,r]));this.dirty=new Map();}
 async optional(kind,key){return structuredClone(this.rows.get(kind+':'+key)?.body||null);}
 async get(kind,key){const r=await this.optional(kind,key);if(!r)fail('未找到本浏览器中的对应记录',404);return r;}
 async list(kind,owner){return [...this.rows.values()].filter(r=>r.kind===kind&&(owner===undefined||r.owner===owner)).map(r=>structuredClone(r.body)).sort((a,b)=>(b.updated||b.created||0)-(a.updated||a.created||0));}
 async save(kind,key,owner,body){const r={key:kind+':'+key,kind,id:key,owner,body:structuredClone({...body,id:key,owner})};this.rows.set(r.key,r);this.dirty.set(r.key,r);}
 async saveMany(rows){for(const [kind,r] of rows)await this.save(kind,r.id,r.owner,r);}
 async user(uid){return uid===guestUser.id?{...guestUser}:null;}
 async bindings(){return [];}async students(){return [];}async bound(){return false;}async isTeacher(){return false;}
 async lookupRecords(){return (await this.list('lookup',guestUser.id)).sort((a,b)=>b.count-a.count).map(({word,kind,count})=>({word,kind,count}));}
 async countWord(uid,word,kind){const key=hash(kind+':'+word),old=await this.optional('lookup',key),count=(old?.count||0)+1;await this.save('lookup',key,uid,{word,kind,count,updated:now()});return count;}
}
async function json(file){const r=await fetch('/guest-data/'+file+'?v=20261030r3',{cache:'no-store'});if(!r.ok)throw new Error('游客题库读取失败，请刷新页面重试');return r.json();}
async function init(){if(!engine)engine=Promise.all(['catalog.json','questions.json','assets.json','dictionary/glossary.json','dictionary/extended-glossary.json','image-layout.json'].map(json)).then(([catalog,questions,assets,glossary,extended,imageLayout])=>{E.data['/guest-data/dictionary/glossary.json']=glossary;E.data['/guest-data/dictionary/extended-glossary.json']=extended;return Object.assign(Object.create(E.Bank.prototype),{folder:'/guest-data',catalog,questions:new Map(questions.map(q=>[q.id,q])),assets,imageLayout,wordCache:new Map()});}).catch(e=>{engine=null;throw e;});return engine;}
async function photoURL(store,key){if(!urls.has(key)){const f=await store.get('upload',key);if(f.owner!==guestUser.id)fail('无权读取此本地图片',403);urls.set(key,URL.createObjectURL(f.blob));}return urls.get(key);}
async function decorate(value,store){if(Array.isArray(value))return Promise.all(value.map(v=>decorate(v,store)));if(!value||typeof value!=='object')return value;const bank=await init(),r={};for(const [key,v] of Object.entries(value)){if(typeof v==='string'&&v.startsWith('cloud-media://'))r[key]=bank.assets[v.slice(14)]?.websitePath||'/media/'+encodeURIComponent(v.slice(14));else if(typeof v==='string'&&v.startsWith('cloud-private://'))r[key]=await photoURL(store,v.slice(16));else r[key]=await decorate(v,store);}return r;}
export async function guestApi(path,body){const bank=await init();return locked(async()=>{const store=new Store(await readAll()),uid=guestUser.id;
 // The guest identity exists only inside this browser. It is never a server user or login cookie.
 store.rows.set('user:'+uid,{kind:'user',id:uid,owner:uid,body:{...guestUser}});
 const service=new E.Service(bank,store),url=new URL(path,location.origin),p=url.pathname,params=Object.fromEntries(url.searchParams);let result;
 if(/^\/(teacher|bindings|messages\/|assignments\/)/.test(p)||p.endsWith('/send')||p.endsWith('/assign'))fail('师生绑定、发送试卷和教室作业需要登录账号',403);
 if(p==='/export'){
  const kind=params.kind,type=params.type;let record;if(type==='paper'){record=await service.paperAccess(uid,params.id);if(!['questions','answers'].includes(kind))fail('导出类型无效');}else if(type==='test'){record=await service.readableTest(uid,params.id);if(!['card','analysis'].includes(kind))fail('导出类型无效');if(kind==='analysis'&&record.status!=='graded')fail('批改后才能导出解析');}else fail('游客模式不支持导出此内容');result=await E.exportManifest(bank,record,kind,params,store);
 }else if(p==='/lookup'){
  if(body?.image){const asset=bank.assets[body.image];if(asset?.wordRecord){const shard=asset.wordRecord.slice(0,2);if(!bank.wordCache.has(shard))bank.wordCache.set(shard,await json('image-words/'+shard+'.json'));}}
  result=body?.text!==undefined?bank.lookupText(body.text,body.offset,body.unit||1):bank.lookup(body.image,body.x,body.y,body.unit||1);if(result.found)result.count=await store.countWord(uid,result.term,result.kind);
 }else if(p==='/me')result={user:{...guestUser},bindings:[],localReview:true};
 else result=await E.route({path,method:body===undefined?'GET':'POST',body:body||{},user:{},uid,store,service,bank,files:{},settings:{}});
 const decorated=await decorate(result,store);if(store.dirty.size)await writeAll([...store.dirty.values()]);return decorated;
 });}
export async function guestUpload(file){if(!file.size||file.size>8*1024*1024)throw new Error('每张图片需小于 8 MB');if(!['image/jpeg','image/png'].includes(file.type))throw new Error('请选择 JPEG 或 PNG 图片');const bitmap=await createImageBitmap(file);const width=bitmap.width,height=bitmap.height;bitmap.close();if(!width||!height||width*height>20000000)throw new Error('图片尺寸过大，请压缩后重试');const key=id();return locked(async()=>{await writeAll([{key:'upload:'+key,id:key,kind:'upload',owner:guestUser.id,body:{id:key,owner:guestUser.id,blob:file,width,height,mime:file.type,size:file.size,created:now()}}]);const url=URL.createObjectURL(file);urls.set(key,url);return {id:key,url};});}
export async function clearGuest(){await locked(()=>writeAll([],true));for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();}
