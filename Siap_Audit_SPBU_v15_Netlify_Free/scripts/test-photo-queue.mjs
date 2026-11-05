import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const html = await readFile(new URL('../frontend/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>(.*?)<\/script>/gs)].map(x => x[1]);
const hook = 'load().then(()=>{render();pumpPhotoReviews()});';
assert.ok(scripts.some(s => s.includes(hook)), 'test harness must replace the actual application startup');
const expose = 'globalThis.auditTest={getState:()=>S,getUI:()=>ui,setState:v=>{S=v;ui.sid=v.sessions[0]?.id||null;ui.view="sess";ui.open[0]=true},load,persistState,migratePhotoReviewState,enqueuePhotoReview,pumpPhotoReviews,elementEvidenceHtml,render,openCamera};';
const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
function harness({ store = new Map(), now = 1793608000000 } = {}) {
  let clock = now, timerId = 0, fetcher = async () => { throw new Error('Unexpected request'); };
  const timers = new Map(), handlers = new Map(), removedStorage = [];
  const app = { innerHTML: '', addEventListener() {} };
  const video = { srcObject: null, play: async () => {}, videoWidth: 640, videoHeight: 480 };
  const toast = { textContent: '', classList: { add() {}, remove() {} } };
  const document = { getElementById: id => id === 'app' ? app : id === 'camera-video' ? video : toast, addEventListener: (name, fn) => { const list = handlers.get('document:'+name)||[]; list.push(fn); handlers.set('document:'+name,list); }, querySelectorAll: () => [] };
  const indexedDB = { open: name => {
    const req = {};
    queueMicrotask(() => {
      const db = { objectStoreNames: { contains: () => true }, close() {}, createObjectStore() {}, transaction: () => {
        const tx = { objectStore: () => ({
          put: (value, key) => { store.set(name+':'+key, structuredClone(value)); queueMicrotask(() => tx.oncomplete?.()); },
          get: key => { const r = {}; queueMicrotask(() => { r.result = structuredClone(store.get(name+':'+key)); r.onsuccess?.(); }); return r; }
        }) }; return tx;
      } };
      req.result = db; req.onsuccess?.();
    });
    return req;
  } };
  const context = vm.createContext({ console, document, indexedDB, navigator: { onLine: true, mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } }, location: { protocol: 'https:' }, localStorage: { getItem: () => null, setItem() {}, removeItem: key => removedStorage.push(key) },
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } },
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id,{fn,at:clock+Number(delay||0)}); return id; }, clearTimeout: id => timers.delete(id),
    fetch: (...args) => fetcher(...args), AbortController, Response, URL, Blob, Intl, structuredClone, confirm: () => true, scrollTo() {},
    addEventListener: (name, fn) => { const list = handlers.get('window:'+name)||[]; list.push(fn); handlers.set('window:'+name,list); }
  });
  context.window = context;
  for (const script of scripts) new vm.Script(script.replace(hook, expose)).runInContext(context);
  const api = context.auditTest;
  const seed = context.CHECKLIST_DATA;
  const el = seed[0].element;
  const photo = id => ({ id, name: id+'.jpg', type: 'image/jpeg', data: 'data:image/jpeg;base64,YQ==', aiReview: { status: 'queued', attempts: 0, nextAttemptAt: 0 } });
  function state(photos) { return { legacyMigrated: true, sessions: [{ id:'s1', station:'Uji antrean', number:'64.TEST', city:'Uji', date:'2026-11-02', items:{}, evidence:{[el]:photos}, aiEvidence:{} }] }; }
  return { api, el, seed, store, context, app, video, handlers, photo, state, removedStorage,
    fetch: fn => { fetcher = fn; },
    clock: () => clock,
    click: dataset => { const b={dataset}; const target={closest:()=>b}; for(const fn of handlers.get('document:click')||[]) fn({target}); },
    online: value => { context.navigator.onLine=value; for(const fn of handlers.get('window:'+(value?'online':'offline'))||[]) fn(); },
    advance: async ms => { clock+=ms; for(let round=0;round<20;round++){const due=[...timers].filter(([,x])=>x.at<=clock);if(!due.length)break;for(const[id,x]of due){timers.delete(id);x.fn()}await flush();}await flush(); }
  };
}
const busy = () => new Response(JSON.stringify({error:'Gemini sedang sibuk. Foto tetap tersimpan.',code:'AI_BUSY',retryable:true,retryAfter:15}),{status:503});
function success(options, status='layak') { const input=JSON.parse(options.body); return new Response(JSON.stringify({model:'test-model',photoCheck:{status,reason:status==='layak'?'Bukti relevan.':'Foto buram; ambil ulang.'},results:input.criteria.map(x=>({code:x.code,status:'terdukung',reason:'Terlihat.'}))}),{status:200}); }
function photos(h) { return h.api.getState().sessions[0].evidence[h.el]; }
let scenarios=0;
// A service outage keeps the photo, persists a delayed retry, and resumes after a reload.
{
  const h=harness();h.api.setState(h.state([h.photo('a')]));let calls=0;h.fetch(async()=>{calls++;return busy()});h.api.enqueuePhotoReview('s1',0,0);await flush();
  assert.equal(calls,1);assert.equal(photos(h).length,1);assert.equal(photos(h)[0].aiReview.status,'retry_wait');
  const saved=structuredClone(h.store);
  const r=harness({store:saved,now:h.clock()});let resumed=0;r.fetch(async(_url,opts)=>{resumed++;return success(opts)});await r.api.load();r.api.pumpPhotoReviews();await flush();assert.equal(resumed,0);
  await r.advance(15001);assert.equal(resumed,1);assert.equal(photos(r)[0].id,'a');assert.equal(photos(r)[0].aiReview.status,'done');scenarios++;
}
// Retry attempts stop at three. Manual retry reuses the same image, with no recapture.
{
  const h=harness();h.api.setState(h.state([h.photo('a')]));let calls=0;h.fetch(async()=>{calls++;return busy()});h.api.enqueuePhotoReview('s1',0,0);await flush();await h.advance(16000);await h.advance(31000);
  assert.equal(calls,3);assert.equal(photos(h).length,1);assert.equal(photos(h)[0].aiReview.status,'failed');assert.match(h.app.innerHTML,/Coba lagi/);await h.advance(3600000);assert.equal(calls,3);
  const sameData=photos(h)[0].data;h.fetch(async(_url,opts)=>{calls++;return success(opts)});h.click({act:'retry-evidence',el:'0',id:'a'});await flush();assert.equal(calls,4);assert.equal(photos(h)[0].data,sameData);assert.equal(photos(h)[0].aiReview.status,'done');scenarios++;
}
// An offline photo waits safely and starts when the browser reconnects.
{
  const h=harness();h.api.setState(h.state([h.photo('a')]));let calls=0;h.fetch(async(_url,opts)=>{calls++;return success(opts)});h.online(false);h.api.enqueuePhotoReview('s1',0,0);await flush();assert.equal(calls,0);assert.equal(photos(h)[0].aiReview.status,'queued');h.online(true);await flush();assert.equal(calls,1);assert.equal(photos(h)[0].aiReview.status,'done');scenarios++;
}
// Invalid AI output must never delete a photo.
{
  const h=harness();h.api.setState(h.state([h.photo('a')]));h.fetch(async()=>new Response('{}',{status:200}));h.api.enqueuePhotoReview('s1',0,0);await flush();assert.equal(photos(h).length,1);assert.equal(photos(h)[0].aiReview.status,'retry_wait');scenarios++;
}
// Rejection keeps the photo, marks it for retake, and leaves earlier accepted evidence and its numbering untouched.
{
  const h=harness();const a=h.photo('a'),b=h.photo('b');b.aiReview={status:'done',attempts:1};const state=h.state([a,b]);state.sessions[0].aiEvidence[h.el]={checkedAt:new Date().toISOString(),photoReviews:[{photoId:'b',photoIndex:2,results:[{code:h.seed[0].code,status:'terdukung',reason:'Bukti foto B.',photoNumbers:[2]}]}],results:[{code:h.seed[0].code,status:'terdukung',reason:'Bukti foto B.',photoNumbers:[2]}]};h.api.setState(state);h.fetch(async(_url,opts)=>success(opts,'ulang'));h.api.enqueuePhotoReview('s1',0,0);await flush();assert.equal(photos(h).length,2);assert.equal(photos(h)[0].aiReview.status,'retake');assert.equal(photos(h)[1].id,'b');const ai=h.api.getState().sessions[0].aiEvidence[h.el];assert.equal(ai.photoReviews[0].photoIndex,2);assert.equal(ai.results[0].photoNumbers[0],2);assert.match(ai.lastRejected.message,/buram/);scenarios++;
}
// New captures can queue while a review is in flight. Opening/refreshing the camera preserves its stream.
{
  const h=harness();h.api.setState(h.state([h.photo('a'),h.photo('b')]));const pending=[];let calls=0;h.fetch((_url,opts)=>{calls++;return new Promise(resolve=>pending.push(()=>resolve(success(opts))))});h.api.enqueuePhotoReview('s1',0,0);h.api.enqueuePhotoReview('s1',0,1);await flush();assert.equal(calls,1);assert.equal(h.api.getUI().analysisQueue.length,1);assert.equal(photos(h).length,2);assert.match(h.app.innerHTML,/data-act="open-camera" data-el="0">/);
  await h.api.openCamera(0);const stream=h.video.srcObject;assert.ok(stream);h.api.render(true);assert.equal(h.video.srcObject,stream);
  pending.shift()();await flush();assert.equal(calls,2);pending.shift()();await flush();assert.ok(photos(h).every(p=>p.aiReview.status==='done'));scenarios++;
}
// Thumbnail taps open a preview without invoking deletion.
{
  const h=harness();const p=h.photo('a');p.aiReview={status:'failed',attempts:3,message:'Gemini sedang sibuk.'};h.api.setState(h.state([p]));h.api.render(true);h.click({act:'preview-evidence',el:'0',id:'a',i:'0'});assert.equal(photos(h).length,1);assert.equal(h.api.getUI().preview.photoId,'a');assert.match(h.app.innerHTML,/Pratinjau foto bukti/);scenarios++;
}
// No additional AI code is sent or requested; an expired account session preserves the photo and asks for account sign-in.
{
  const h=harness();h.api.setState(h.state([h.photo('a')]));let prompts=0;h.context.prompt=()=>{prompts++;throw new Error('A shared-code prompt must not be shown')};
  h.fetch(async(_url,opts)=>{assert.equal(opts.headers['x-access-code'],undefined);return new Response('Account session expired',{status:401})});
  h.api.enqueuePhotoReview('s1',0,0);await flush();
  assert.equal(prompts,0);assert.equal(photos(h).length,1);assert.equal(photos(h)[0].aiReview.status,'failed');assert.equal(photos(h)[0].aiReview.code,'AUTH_REQUIRED');assert.match(photos(h)[0].aiReview.message,/akun/);
  assert.equal(h.removedStorage.length,1);assert.equal(h.removedStorage[0],'siap-audit-akses');scenarios++;
}
console.log(`Photo queue checks passed (${scenarios} scenarios: persistence, retry budget, offline, rejection, camera and preview).`);
