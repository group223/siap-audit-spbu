import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { harness, audit, path, save, ELEMENT, JPEG } from './cloud-helpers.mjs';
import { VIDEO_CHUNK, VIDEO_LIMIT } from '../server/videos.mjs';

const hash=data=>createHash('sha256').update(data).digest('hex');
function clip(size=48){const bytes=Buffer.alloc(size,7);bytes.writeUInt32BE(24,0);bytes.write('ftypisom',4);return bytes;}
const poster='data:image/jpeg;base64,'+Buffer.from(JPEG).toString('base64');
function specification(bytes,extra={}){return{hash:hash(bytes),type:'video/mp4',size:bytes.length,duration:4,width:640,height:360,poster,name:'uji-video.mp4',...extra};}
async function fixture(size=VIDEO_CHUNK+67){const h=harness(),owner=await h.login(),a=audit();await save(h,owner.cookie,a);const bytes=clip(size),base=path(a)+'/videos/v1';return{h,owner,a,bytes,base};}
async function upload(f){const{h,owner,bytes,base}=f;const started=await h.request(base+'/start',{cookie:owner.cookie,json:specification(bytes)});assert.equal(started.status,200);const info=await started.json();
 for(const index of info.missing)assert.equal((await h.request(base+'/chunks/'+index,{cookie:owner.cookie,bytes:bytes.subarray(index*VIDEO_CHUNK,Math.min(bytes.length,(index+1)*VIDEO_CHUNK)),headers:{'content-type':'application/octet-stream'}})).status,200);
 const result=await h.request(base+'/complete',{cookie:owner.cookie,json:{}});assert.equal(result.status,200);return result.json();}
async function link(f,ref){f.a.evidence[ELEMENT]=[{id:'v1',name:'uji-video.mp4',type:'video/mp4',size:f.bytes.length,duration:4,width:640,height:360,sourceCode:'1.1.1.a',cloudHash:ref.cloudHash}];assert.equal((await save(f.h,f.owner.cookie,f.a,1)).status,200);}

test('video uploads in bounded chunks and streams the exact original bytes after metadata is committed',async()=>{
 const f=await fixture(2*VIDEO_CHUNK+501),ref=await upload(f);assert.equal(ref.cloudHash,hash(f.bytes));assert.equal((await f.h.request(f.base,{cookie:f.owner.cookie})).status,404);await link(f,ref);
 const r=await f.h.request(f.base,{cookie:f.owner.cookie});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'video/mp4');assert.equal(Number(r.headers.get('content-length')),f.bytes.length);assert.equal(r.headers.get('accept-ranges'),'bytes');assert.deepEqual(Buffer.from(await r.arrayBuffer()),f.bytes);assert.match(r.headers.get('cache-control'),/private/);assert.equal(r.headers.get('netlify-cdn-cache-control'),'no-store');
 const a=await(await f.h.request(path(f.a),{cookie:f.owner.cookie})).json();assert.equal(a.audit.evidence[ELEMENT][0].posterUrl,f.base+'/poster');assert.equal(a.audit.evidence[ELEMENT][0]._linkedHash,ref.cloudHash);
});
test('video playback supports seeking, suffix ranges, HEAD, ETags and safe unsatisfiable ranges',async()=>{
 const f=await fixture(),ref=await upload(f);await link(f,ref);
 for(const range of ['bytes=1-9',`bytes=${VIDEO_CHUNK-3}-${VIDEO_CHUNK+5}`,'bytes=-11','bytes=0-999999999']){
  const r=await f.h.request(f.base,{cookie:f.owner.cookie,headers:{range}});assert.equal(r.status,206);const match=r.headers.get('content-range').match(/^bytes (\d+)-(\d+)\/(\d+)$/);assert.equal(Number(match[3]),f.bytes.length);assert.deepEqual(Buffer.from(await r.arrayBuffer()),f.bytes.subarray(Number(match[1]),Number(match[2])+1));
 }
 for(const range of ['bytes=999999999-','bytes=9-2','bytes=-0','bytes=0-1,4-8','items=0-1','bytes=-'])assert.equal((await f.h.request(f.base,{cookie:f.owner.cookie,headers:{range}})).status,416);
 const head=await f.h.request(f.base,{cookie:f.owner.cookie,method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal(Number(head.headers.get('content-length')),f.bytes.length);
 assert.equal((await f.h.request(f.base,{cookie:f.owner.cookie,headers:{'if-none-match':head.headers.get('etag')}})).status,304);
 const changed=await f.h.request(f.base,{cookie:f.owner.cookie,headers:{range:'bytes=0-1','if-range':'"old"'}});assert.equal(changed.status,200);await changed.arrayBuffer();
});
test('video and poster reads, uploads and AI references require the correct station account',async()=>{
 const f=await fixture(48),ref=await upload(f);await link(f,ref);const own=await f.h.staff(f.owner.cookie,'own'),other=await f.h.staff(f.owner.cookie,'other','64.702.02');
 for(const suffix of ['', '/poster']){assert.equal((await f.h.request(f.base+suffix)).status,401);assert.equal((await f.h.request(f.base+suffix,{cookie:other.cookie})).status,403);const ok=await f.h.request(f.base+suffix,{cookie:own.cookie});assert.equal(ok.status,200);await ok.arrayBuffer();}
 for(const suffix of ['/start','/complete','/chunks/0'])assert.equal((await f.h.request(f.base+suffix,{cookie:other.cookie,json:{}})).status,403);
 const input={element:ELEMENT,videoRef:{station:'6470110',auditID:f.a.id,mediaID:'v1'},criteria:[{code:'1.1.1.a',text:'Seragam'}]};assert.equal((await f.h.request('/api/evidence/analyze',{cookie:other.cookie,json:input})).status,403);
});
test('partial video upload resumes and retries without replacing already accepted bytes',async()=>{
 const f=await fixture(),opts={cookie:f.owner.cookie,json:specification(f.bytes)};assert.equal((await f.h.request(f.base+'/start',opts)).status,200);
 const first=f.bytes.subarray(0,VIDEO_CHUNK),chunkOpts={cookie:f.owner.cookie,bytes:first};assert.equal((await f.h.request(f.base+'/chunks/0',chunkOpts)).status,200);assert.equal((await f.h.request(f.base+'/chunks/0',chunkOpts)).status,200);
 const changed=Buffer.from(first);changed[20]^=1;assert.equal((await f.h.request(f.base+'/chunks/0',{cookie:f.owner.cookie,bytes:changed})).status,409);
 const resumed=await(await f.h.request(f.base+'/start',opts)).json();assert.deepEqual(resumed.missing,[1]);assert.equal((await f.h.request(f.base+'/complete',{cookie:f.owner.cookie,json:{}})).status,409);
 await f.h.request(f.base+'/chunks/1',{cookie:f.owner.cookie,bytes:f.bytes.subarray(VIDEO_CHUNK)});const final=await(await f.h.request(f.base+'/complete',{cookie:f.owner.cookie,json:{}})).json();assert.equal(final.cloudHash,hash(f.bytes));assert.equal((await(await f.h.request(f.base+'/start',opts)).json()).complete,true);
});
test('video identity is immutable across changed hashes, MIME types and sizes',async()=>{
 const f=await fixture(48);await upload(f);
 for(const extra of [{hash:'a'.repeat(64)},{type:'video/quicktime'},{size:49}]){const r=await f.h.request(f.base+'/start',{cookie:f.owner.cookie,json:specification(f.bytes,extra)});assert.equal(r.status,409);}
});
test('unsupported, oversized and overlong clips and malformed posters never become video records',async()=>{
 const f=await fixture(48);
 for(const extra of [{type:'image/svg+xml'},{size:VIDEO_LIMIT+1},{duration:61},{duration:0},{poster:'data:image/svg+xml;base64,AAAA'},{width:0},{hash:'invalid'}]){assert.equal((await f.h.request(f.base+'/start',{cookie:f.owner.cookie,json:specification(f.bytes,extra)})).status,400);}
 assert.equal(f.h.data.values.has('videos/6470110/s1/v1/ready.json'),false);
});
test('incorrect video magic, whole-file hashes, chunk lengths and indexes are rejected',async()=>{
 for(const corrupt of ['magic','hash']){const f=await fixture(48);if(corrupt==='magic')f.bytes.fill(0);const spec=specification(f.bytes,corrupt==='hash'?{hash:'b'.repeat(64)}:{});await f.h.request(f.base+'/start',{cookie:f.owner.cookie,json:spec});assert.equal((await f.h.request(f.base+'/chunks/0',{cookie:f.owner.cookie,bytes:f.bytes.subarray(0,47)})).status,400);assert.equal((await f.h.request(f.base+'/chunks/3',{cookie:f.owner.cookie,bytes:f.bytes})).status,400);await f.h.request(f.base+'/chunks/0',{cookie:f.owner.cookie,bytes:f.bytes});assert.equal((await f.h.request(f.base+'/complete',{cookie:f.owner.cookie,json:{}})).status,400);}
});
test('a video cannot be referenced in audit metadata until its verified upload is complete',async()=>{
 const f=await fixture(48);await f.h.request(f.base+'/start',{cookie:f.owner.cookie,json:specification(f.bytes)});const ref={cloudHash:hash(f.bytes)};f.a.evidence[ELEMENT]=[{id:'v1',type:'video/mp4',size:f.bytes.length,duration:4,cloudHash:ref.cloudHash}];assert.equal((await save(f.h,f.owner.cookie,f.a,1)).status,400);assert.equal((await f.h.request(f.base+'/poster',{cookie:f.owner.cookie})).status,404);
});
test('authenticated video AI reads the stored clip, preserves MIME type and rejects the wrong element',async()=>{
 const f=await fixture(48),ref=await upload(f);await link(f,ref);let seen;const original=globalThis.fetch;
 globalThis.fetch=async(_url,options)=>{seen=JSON.parse(options.body);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({photoCheck:{status:'layak',reason:'Video relevan'},summary:'Video diperiksa',results:[{code:'1.1.1.a',status:'terdukung',reason:'Terlihat'}]})}]}}]});};
 try{const input={element:ELEMENT,focusCode:'1.1.1.a',videoRef:{station:'6470110',auditID:f.a.id,mediaID:'v1'},criteria:[{code:'1.1.1.a',text:'Seragam operator'}]};const r=await f.h.request('/api/evidence/analyze',{cookie:f.owner.cookie,json:input});assert.equal(r.status,200);const parts=seen.contents[0].parts;assert.equal(parts[1].inline_data.mime_type,'video/mp4');assert.deepEqual(Buffer.from(parts[1].inline_data.data,'base64'),f.bytes);assert.match(parts[0].text,/video/i);assert.equal((await f.h.request('/api/evidence/analyze',{cookie:f.owner.cookie,json:{...input,element:'Elemen lain'}})).status,403);}finally{globalThis.fetch=original;}
});
test('deleting an audit hides its video and restoring the audit restores access',async()=>{
 const f=await fixture(48),ref=await upload(f);await link(f,ref);assert.equal((await f.h.request(path(f.a)+'/delete',{cookie:f.owner.cookie,json:{baseRevision:2}})).status,200);assert.equal((await f.h.request(f.base,{cookie:f.owner.cookie})).status,404);assert.equal((await f.h.request(path(f.a)+'/restore',{cookie:f.owner.cookie,json:{baseRevision:3}})).status,200);const restored=await f.h.request(f.base,{cookie:f.owner.cookie});assert.equal(restored.status,200);await restored.arrayBuffer();
});
