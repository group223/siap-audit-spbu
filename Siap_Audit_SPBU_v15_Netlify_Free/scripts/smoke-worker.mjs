import assert from 'node:assert/strict';
import worker from '../worker/index.js';
const base = { element: 'Elemen 1', criteria: [{ code: '1.a', text: 'Logo terlihat', subElement: 'sub' }], photos: [{ data: 'data:image/jpeg;base64,YQ==' }] };
const request = (input = base) => new Request('https://example.test/api/evidence/analyze', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://example.test' }, body: JSON.stringify(input) });
const answer = (criteria = base.criteria, status = 'layak') => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ photoCheck: { status, reason: status === 'layak' ? 'Bukti relevan terlihat.' : 'Foto buram; ambil ulang.' }, summary: 'Foto diperiksa.', results: status === 'ulang' ? [] : criteria.map(x => ({ code: x.code, status: 'terdukung', reason: 'Terlihat.' })) }) }] } }] }), { status: 200 });
const busy = () => new Response(JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand.' } }), { status: 503 });
const originalFetch = globalThis.fetch;
const originalLogs = { info: console.info, warn: console.warn, error: console.error };
let scenarios = 0;
async function checkMock(mock, check, input = base) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return mock(calls.length, url, options);
  };
  try {
    const response = await worker.fetch(request(input), { GEMINI_API_KEY: 'test' }, {});
    const body = await response.json();
    await check(response, body, calls);
    scenarios++;
  } finally { globalThis.fetch = originalFetch; }
}
try {
  console.info = console.warn = console.error = () => {};
  const page = await worker.fetch(new Request('https://example.test/'), {}, {});
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Siap Audit SPBU/);
  const missing = await worker.fetch(request(), {}, {});
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).retryable, false);
  scenarios += 2;
  await checkMock(() => answer(), (res, body, calls) => {
    assert.equal(res.status, 200);
    assert.equal(body.model, 'gemini-3.5-flash-lite');
    assert.equal(body.photoCheck.status, 'layak');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.generationConfig.thinkingConfig.thinkingLevel, 'low');
    assert.equal(calls[0].body.generationConfig.temperature, undefined);
  });
  await checkMock(n => n === 1 ? busy() : answer(), (res, body, calls) => {
    assert.equal(res.status, 200);
    assert.equal(body.model, 'gemini-3.8-flash');
    assert.equal(calls.length, 2);
  });
  await checkMock(() => busy(), (res, body, calls) => {
    assert.equal(res.status, 503);
    assert.equal(body.code, 'AI_BUSY');
    assert.equal(body.providerStatus, 503);
    assert.equal(body.retryable, true);
    assert.equal(calls.length, 2);
    assert.match(body.error, /sibuk/);
  });
  await checkMock(() => new Response('<html>Service unavailable</html>', { status: 503 }), (res, body) => {
    assert.equal(res.status, 503);
    assert.equal(body.code, 'AI_BUSY');
  });
  await checkMock(() => new Response(JSON.stringify({ error: { message: 'Rate limit', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '40s' }] } }), { status: 429 }), (res, body, calls) => {
    assert.equal(res.status, 429);
    assert.equal(body.code, 'AI_RATE_LIMIT');
    assert.equal(body.retryAfter, 40);
    assert.equal(calls.length, 1);
  });
  await checkMock(() => new Response(JSON.stringify({ error: { message: 'Daily requestsPerDay quota' } }), { status: 429 }), (res, body, calls) => {
    assert.equal(res.status, 429);
    assert.equal(body.code, 'AI_DAILY_QUOTA');
    assert.equal(body.retryable, false);
    assert.equal(calls.length, 1);
  });
  await checkMock(() => new Response(JSON.stringify({ error: { message: 'Denied' } }), { status: 403 }), (res, body, calls) => {
    assert.equal(res.status, 403);
    assert.equal(body.retryable, false);
    assert.equal(body.code, 'AI_ACCESS_DENIED');
    assert.equal(calls.length, 1);
  });
  await checkMock(() => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }), { status: 200 }), (res, body) => {
    assert.equal(res.status, 502);
    assert.equal(body.code, 'AI_INVALID_RESPONSE');
    assert.equal(body.photoCheck, undefined);
  });
  await checkMock(() => { throw new DOMException('Timed out', 'AbortError'); }, (res, body) => {
    assert.equal(res.status, 504);
    assert.equal(body.code, 'AI_TIMEOUT');
  });
  await checkMock(() => answer(base.criteria, 'ulang'), (res, body) => {
    assert.equal(res.status, 200);
    assert.equal(body.photoCheck.status, 'ulang');
  });
  const criteria = Array.from({ length: 56 }, (_, i) => ({ code: `3.${i + 1}`, text: `Butir ${i + 1}` }));
  await checkMock(() => answer(criteria), (res, body, calls) => {
    assert.equal(res.status, 200);
    assert.equal(body.results.length, 56);
    assert.equal(body.results[55].status, 'terdukung');
    assert.match(calls[0].body.contents[0].parts[0].text, /3\.56 \| Butir 56/);
  }, { ...base, criteria });

// Hosted account authorization is enforced by Sites. This suite checks Worker compatibility and request validation.
{
  let called = 0;
  globalThis.fetch = async () => { called++; return answer(); };
  const legacy = new Request('https://example.test/api/evidence/analyze', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://example.test', 'x-access-code': 'obsolete-value' }, body: JSON.stringify(base) });
  let res = await worker.fetch(legacy, { GEMINI_API_KEY: 'test' }, {});
  assert.equal(res.status, 200); assert.equal(called, 1);
  called = 0;
  const crossOrigin = new Request('https://example.test/api/evidence/analyze', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://other.test' }, body: JSON.stringify(base) });
  res = await worker.fetch(crossOrigin, { GEMINI_API_KEY: 'test' }, {});
  assert.equal(res.status, 403); assert.equal((await res.json()).code, 'INVALID_ORIGIN');
  res = await worker.fetch(new Request('https://example.test/api/evidence/analyze'), { GEMINI_API_KEY: 'test' }, {});
  assert.equal(res.status, 405); assert.equal((await res.json()).code, 'METHOD_NOT_ALLOWED');
  assert.equal(called, 0);
  globalThis.fetch = originalFetch; scenarios += 3;
}

} finally {
  globalThis.fetch = originalFetch;
  Object.assign(console, originalLogs);
}
console.log(`Worker checks passed (${scenarios} scenarios, including provider errors and all 56 criteria).`);
