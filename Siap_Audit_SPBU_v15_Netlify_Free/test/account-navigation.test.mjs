import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {harness,ORIGIN} from './cloud-helpers.mjs';
import {loginPage,appAccountBar} from '../server/pages.mjs';

function browserSession(h,mode,cookie){
 const page=mode==='login'?loginPage():appAccountBar({username:'bapal6',name:'Pengelola',role:'admin'});
 const script=[...page.matchAll(/<script>(.*?)<\/script>/gs)].map(x=>x[1]).find(x=>x.includes('session-navigation:start'));
 assert.ok(script,'the actual account script must be present');
 const handlers=new Map(),windows=new Map(),redirects=[],calls=[];let override=null,cleared=false;
 const button={textContent:mode==='login'?'Masuk':'Keluar',disabled:false};
 const form={action:ORIGIN+(mode==='login'?'/auth/login':'/auth/logout'),fields:{username:'bapal6',password:h.env.ADMIN_PASSWORD},attrs:{},box:null,
  closest:()=>form,querySelector:selector=>selector==='[data-session-message]'?form.box:button,append:box=>form.box=box,
  setAttribute:(name,value)=>form.attrs[name]=value,removeAttribute:name=>delete form.attrs[name],reset(){this.fields={};cleared=true;}
 };
 class FormData{constructor(form){this.values=Object.entries(form.fields);}[Symbol.iterator](){return this.values[Symbol.iterator]();}}
 const context=vm.createContext({URL,URLSearchParams,FormData,AbortController,setTimeout,clearTimeout,
  document:{addEventListener:(name,fn)=>handlers.set(name,fn),createElement:()=>({dataset:{},setAttribute(){},textContent:''})},
  location:{href:form.action,replace:url=>redirects.push(url)},addEventListener:(name,fn)=>windows.set(name,fn),
  fetch:async(url,options={})=>{
   calls.push({url,options});
   const real=async()=>{
    const headers={...options.headers,...(cookie?{cookie}:{}),...(options.method==='POST'?{origin:ORIGIN}:{})};
    const response=await h.app(new Request(ORIGIN+url,{...options,headers}),{ip:'192.0.2.90'});
    const next=response.headers.get('set-cookie');if(next)cookie=/Max-Age=0/.test(next)?undefined:next.split(';')[0];
    return response;
   };
   return override?override(url,options,real):real();
  }
 });context.window=context;new vm.Script(script).runInContext(context);
 return {context,form,button,redirects,calls,windows,get cookie(){return cookie},get cleared(){return cleared},override:fn=>override=fn,
  async submit(){let prevented=false;await handlers.get('submit')({target:form,preventDefault(){prevented=true}});assert.ok(prevented);},
  async pageshow(persisted=true){windows.get('pageshow')({persisted});await new Promise(setImmediate);await new Promise(setImmediate);}
 };
}

test('logout works as a normal HTML form and redirects to login after clearing the cookie',async()=>{
 const h=harness(),owner=await h.login();
 const response=await h.request('/auth/logout',{cookie:owner.cookie,method:'POST',headers:{accept:'text/html'}});
 assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/auth/login?notice=logged-out');assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
 const login=await h.request('/auth/login?notice=logged-out',{headers:{accept:'text/html'}});assert.match(await login.text(),/Anda sudah keluar/);
 assert.equal((await h.request('/auth/session')).status,401);
});
test('the account-bar logout submission preserves device changes before clearing the session',async()=>{
 const h=harness(),owner=await h.login(),b=browserSession(h,'app',owner.cookie);let persisted=false;
 b.context.SPBU_BEFORE_LOGOUT=async()=>{persisted=true;return true};
 b.override((url,options,real)=>{assert.ok(persisted);assert.equal(options.credentials,'same-origin');return real()});
 await b.submit();assert.deepEqual(b.redirects,['/auth/login?notice=logged-out']);assert.equal(b.cookie,undefined);assert.equal(b.calls.length,1);assert.equal(b.button.disabled,true);
});
test('repeated logout taps send one request and display progress',async()=>{
 const h=harness(),owner=await h.login(),b=browserSession(h,'app',owner.cookie);let release;
 b.context.SPBU_BEFORE_LOGOUT=async()=>true;
 b.override(async(_url,_options,real)=>{await new Promise(resolve=>release=resolve);return real()});
 const first=b.submit();await new Promise(setImmediate);assert.equal(b.button.textContent,'Keluar…');assert.equal(b.button.disabled,true);
 await b.submit();assert.equal(b.calls.length,1);release();await first;assert.equal(b.redirects.length,1);
});
test('a failed logout keeps the session and re-enables the button for retry',async()=>{
 const h=harness(),owner=await h.login(),b=browserSession(h,'app',owner.cookie);let resumed=false;
 b.context.SPBU_BEFORE_LOGOUT=async()=>true;b.context.SPBU_LOGOUT_FAILED=()=>resumed=true;
 b.override(async()=>{throw new TypeError('Failed to fetch')});await b.submit();
 assert.equal(b.redirects.length,0);assert.equal(b.cookie,owner.cookie);assert.equal(b.button.disabled,false);assert.equal(b.button.textContent,'Keluar');assert.ok(resumed);assert.ok(b.form.box.textContent);
 b.override((_url,_options,real)=>real());await b.submit();assert.equal(b.cookie,undefined);
});
test('logout stops when the latest device changes cannot be persisted',async()=>{
 const h=harness(),owner=await h.login(),b=browserSession(h,'app',owner.cookie);
 b.context.SPBU_BEFORE_LOGOUT=async()=>false;await b.submit();assert.equal(b.calls.length,0);assert.equal(b.cookie,owner.cookie);assert.match(b.form.box.textContent,/Cadangkan audit/);
});
test('successful login replaces the login history entry and clears the form password',async()=>{
 const h=harness(),b=browserSession(h,'login');await b.submit();assert.deepEqual(b.redirects,['/']);assert.ok(b.cleared);assert.ok(b.cookie);
});
test('incorrect login stays on the form and reports the error',async()=>{
 const h=harness(),b=browserSession(h,'login');b.form.fields.password='incorrect';await b.submit();assert.equal(b.redirects.length,0);assert.equal(b.button.disabled,false);assert.match(b.form.box.textContent,/tidak sesuai/);
});
test('a cached login page returns an active account to the app without logging out',async()=>{
 const h=harness(),owner=await h.login(),b=browserSession(h,'login',owner.cookie);await b.pageshow();assert.deepEqual(b.redirects,['/']);assert.equal(b.cookie,owner.cookie);assert.equal(b.calls[0].url,'/auth/session');assert.equal(b.calls[0].options.cache,'no-store');
});
test('a cached app page after logout returns to login; a cached login page stays logged out',async()=>{
 const h=harness(),app=browserSession(h,'app'),login=browserSession(h,'login');await app.pageshow();await login.pageshow();assert.deepEqual(app.redirects,['/auth/login']);assert.equal(login.redirects.length,0);
});
test('browser history restoration with a valid cookie does not issue a logout request',async()=>{
 const h=harness(),owner=await h.login(),b=browserSession(h,'app',owner.cookie);await b.pageshow();assert.equal(b.redirects.length,0);assert.equal(b.cookie,owner.cookie);assert.equal(b.calls.length,1);assert.equal(b.calls[0].url,'/auth/session');
});

test('staff logout clears the cookie without waiting for the account store',async()=>{
 const h=harness(),owner=await h.login(),staff=await h.staff(owner.cookie,'staff1');let reads=0;
 h.accounts.getWithMetadata=async()=>{reads++;throw new Error('Account store unavailable')};
 const response=await h.request('/auth/logout',{cookie:staff.cookie,method:'POST'});
 assert.equal(response.status,200);assert.equal((await response.json()).ok,true);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);assert.equal(reads,0);
});
test('logout retains method and origin checks even if account configuration is missing',async()=>{
 const h=harness();h.env.ADMIN_PASSWORD='';
 assert.equal((await h.request('/auth/logout')).status,405);
 const cross=await h.request('/auth/logout',{method:'POST',origin:'https://outside.example'});assert.equal(cross.status,403);assert.equal(cross.headers.get('set-cookie'),null);
 const same=await h.request('/auth/logout',{method:'POST'});assert.equal(same.status,200);assert.match(same.headers.get('set-cookie'),/Max-Age=0/);
});
test('a fresh login or app document does not make a redundant session request',async()=>{
 const h=harness(),owner=await h.login();
 for(const mode of ['login','app']){const b=browserSession(h,mode,owner.cookie);await b.pageshow(false);assert.equal(b.calls.length,0);assert.equal(b.redirects.length,0);}
});
