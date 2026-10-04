import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildSite } from '../scripts/build.mjs';
import { buildInfo } from '../scripts/build-info.mjs';
import { verifyBuild, sha256 } from '../scripts/verify-build.mjs';
import { createSiteServer } from '../scripts/serve.mjs';
const exec = promisify(execFile);

/** Small real esbuild fixture: exercise runtime file imports, CSS URLs and HTML links. */
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'jungle-deploy-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ['src', 'public/assets/audio', 'assets/source/audio', 'scripts', 'bin']) await mkdir(join(root, path), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({version:'1.2.3'}));
  await writeFile(join(root, 'src/config.ts'), 'export const CONFIG = {};');
  const audio = Buffer.from('retained audio fixture');
  await writeFile(join(root, 'assets/source/audio/elephant-trumpet.ogg'), audio);
  await writeFile(join(root, 'public/assets/audio/elephant-trumpet.wav'), audio);
  await writeFile(join(root, 'assets/source/audio/provenance.json'), JSON.stringify({sourceSha256:sha256(audio),derivedSha256:sha256(audio)}));
  await writeFile(join(root, 'assets/source/audio/tiger-roar.mp3'), audio);
  await writeFile(join(root, 'public/assets/audio/tiger-roar.wav'), audio);
  await writeFile(join(root, 'assets/source/audio/tiger-provenance.json'), JSON.stringify({sourceFile:'assets/source/audio/tiger-roar.mp3',derivedFile:'public/assets/audio/tiger-roar.wav',sourceSha256:sha256(audio),derivedSha256:sha256(audio)}));
  await writeFile(join(root, 'public/assets/audio/ATTRIBUTION.txt'), 'Fixture provenance');
  await writeFile(join(root, 'public/assets/jungle.png'), 'pixels v1');
  await writeFile(join(root, 'public/assets/jungle.json'), '{"version":1}');
  await writeFile(join(root, 'public/extra.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await writeFile(join(root, 'public/style.css'), '.scene{color:green;background:url("./extra.svg")}');
  await writeFile(join(root, 'public/index.html'), '<link rel="stylesheet" href="./style.css"><img src="./extra.svg"><script type="module" src="./app.js"></script>');
  await writeFile(join(root, 'src/main.ts'), `import a from '../public/assets/jungle.png?url';\nimport b from '../public/assets/jungle.json?url';\nimport c from '../public/assets/audio/elephant-trumpet.wav?url';\nglobalThis.urls=[a,b,c].map(p=>new URL(p,import.meta.url).href);\n`);
  await buildSite(root);
  return root;
}

const entry = (files, name) => Object.keys(files).find(path => path.startsWith(`assets/${name}-`) && !path.endsWith('.map'));

test('build metadata identifies archives, clean revisions and modified configuration', async t => {
  const root = await fixture(t);
  const archive = await buildInfo(root);
  assert.equal(archive.version, '1.2.3');
  assert.equal(archive.revision, null);
  assert.equal(archive.modified, null);
  await exec('git', ['init', '--quiet'], {cwd:root});
  await exec('git', ['add', 'package.json', 'src', 'public', 'assets'], {cwd:root});
  await writeFile(join(root, '.gitignore'), 'dist/\n');
  await exec('git', ['add', '.gitignore'], {cwd:root});
  await exec('git', ['-c', 'user.name=Build Test', '-c', 'user.email=build@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Fixture'], {cwd:root});
  const clean = await buildInfo(root);
  assert.match(clean.revision, /^[a-f0-9]{40}$/);
  assert.ok(Number.isFinite(Date.parse(clean.committedAt)));
  assert.equal(clean.modified, false);
  await writeFile(join(root, 'src/config.ts'), 'export const CONFIG = { changed: true };');
  const modified = await buildInfo(root);
  assert.equal(modified.modified, true);
  assert.equal(modified.revision, clean.revision);
  assert.notEqual(modified.configSha256, clean.configSha256);
  assert.deepEqual(await buildInfo(root), modified);
});

test('builds are deterministic and changes propagate through hashed asset URLs and HTML', async t => {
  const root=await fixture(t),dist=join(root,'dist');
  const first=await verifyBuild(dist);
  await buildSite(root);assert.deepEqual(await verifyBuild(dist),first);
  assert.ok(entry(first.files,'ATTRIBUTION'));assert.equal(Object.keys(first.files).filter(p=>p.endsWith('.png')).length,1);
  await writeFile(join(root,'public/assets/jungle.png'),'pixels v2');
  await buildSite(root);const second=await verifyBuild(dist);
  assert.notEqual(Object.keys(first.files).find(p=>p.endsWith('.png')),Object.keys(second.files).find(p=>p.endsWith('.png')));
  assert.notEqual(entry(first.files,'app'),entry(second.files,'app'));
  assert.notEqual(first.files['index.html'],second.files['index.html']);
  assert.equal(entry(first.files,'style'),entry(second.files,'style'));
  // Even source-map-only changes must not reuse a cached URL with different bytes.
  await writeFile(join(root,'src/main.ts'),'// changed source positions\n'+await readFile(join(root,'src/main.ts'),'utf8'));
  await buildSite(root);const third=await verifyBuild(dist);
  for(const [path,digest] of Object.entries(second.files))if(path!=='index.html'&&third.files[path])assert.equal(third.files[path],digest,`immutable URL reused: ${path}`);
  await writeFile(join(root,'public/style.css'),'.scene{color:red;background:url("./extra.svg")}');
  await buildSite(root);const fourth=await verifyBuild(dist);
  assert.notEqual(entry(third.files,'style'),entry(fourth.files,'style'));
});

test('build verification rejects missing, changed and unexpected files', async t => {
  const root=await fixture(t),dist=join(root,'dist'),manifest=await verifyBuild(dist),path=entry(manifest.files,'app');
  const source=await readFile(join(dist,path));await writeFile(join(dist,path),'truncated');
  await assert.rejects(verifyBuild(dist),/checksum mismatch/);
  await writeFile(join(dist,path),source);await writeFile(join(dist,'stale.js'),'old');
  await assert.rejects(verifyBuild(dist),/inventory changed/);
  await rm(join(dist,'stale.js'));await rm(join(dist,path));await assert.rejects(verifyBuild(dist),/inventory changed/);
});

test('cached preview serves the exact asset graph under both upload prefixes with correct headers', async t => {
  const root=await fixture(t),dist=join(root,'dist');
  for(const basePath of ['/jungle-dev/','/jungle/']){
    const server=createSiteServer(dist,{cache:true,basePath});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    try{
      const base=`http://127.0.0.1:${server.address().port}${basePath}`;
      const redirect=await fetch(base.slice(0,-1)+'?seed=0',{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),basePath+'?seed=0');
      const index=await fetch(base);assert.equal(index.headers.get('cache-control'),'public,max-age=300,must-revalidate');
      const html=await index.text(),refs=[...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map(m=>m[1]);
      for(const ref of refs){const response=await fetch(new URL(ref,base));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'public,max-age=86400,immutable');}
      const manifest=await verifyBuild(dist),app=entry(manifest.files,'app'),js=await(await fetch(new URL(app,base))).text();
      for(const match of js.matchAll(/"(\.\/(?:jungle|elephant-trumpet)-[A-Z0-9]+\.(?:json|png|wav))"/g))assert.equal((await fetch(new URL(match[1],new URL(app,base)))).status,200);
      assert.equal((await fetch(new URL('.build-manifest.json',base))).status,403);
      const missing=await fetch(new URL('assets/missing.png',base));assert.equal(missing.status,404);assert.equal(missing.headers.get('cache-control'),'no-store');
    }finally{await new Promise(resolve=>server.close(resolve));}
  }
});

/** The real upload shell runs with recording-only npm/gcloud/sleep executables. No network. */
async function uploadFixture(t){
  const root=await fixture(t);
  await cp('upload.sh',join(root,'upload.sh'));await cp('scripts/verify-build.mjs',join(root,'scripts/verify-build.mjs'));
  const program=`#!${process.execPath}\nimport{appendFileSync,copyFileSync,readFileSync}from'node:fs';import{basename}from'node:path';
const tool=basename(process.argv[1]),args=process.argv.slice(2);appendFileSync(process.env.CALL_LOG,JSON.stringify({tool,args})+'\\n');
if(process.env.FAIL_AT&&(process.env.FAIL_AT===tool||process.env.FAIL_AT===args[1]))process.exit(9);
if(tool==='gcloud'&&args[1]==='cp')copyFileSync(args[2],process.env.REMOTE_INDEX);
if(tool==='gcloud'&&args[1]==='cat')process.stdout.write(process.env.CHANGED_INDEX?'different release':readFileSync(process.env.REMOTE_INDEX));\n`;
  for(const tool of ['npm','gcloud','sleep'])await writeFile(join(root,'bin',tool),program,{mode:0o755});
  // Executable extensionless mocks need ESM interpretation on Node 22.
  await writeFile(join(root,'bin/package.json'),'{"type":"module"}');
  const log=join(root,'calls.jsonl');
  const run=async(args,extra={})=>{
    await writeFile(log,'');let status=0;
    try{await exec('bash',['upload.sh',...args],{cwd:root,env:{...process.env,PATH:join(root,'bin')+':'+process.env.PATH,CALL_LOG:log,REMOTE_INDEX:join(root,'remote-index'),...extra}});}catch(error){status=error.code;}
    return{status,calls:(await readFile(log,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line))};
  };
  return{root,run};
}

test('upload requires an explicit environment and never builds or contacts gcloud for invalid arguments', async t=>{
  const {run}=await uploadFixture(t);
  for(const args of [[],['--clean'],['staging'],['dev','prod'],['dev','--clean','--clean'],['prod','--unknown']]){
    const result=await run(args);assert.notEqual(result.status,0);assert.deepEqual(result.calls,[]);
  }
  assert.deepEqual(await run(['--help']),{status:0,calls:[]});
});

test('uploads publish assets first, index last, and cleanup waits and stays within its environment', async t=>{
  const {run}=await uploadFixture(t);
  for(const environment of ['dev','prod'])for(const clean of [false,true]){
    const {status,calls}=await run([environment,...clean?['--clean']:[]]);assert.equal(status,0);
    assert.equal(calls[0].tool,'npm');assert.deepEqual(calls[0].args,['run','build']);
    const cloud=calls.filter(c=>c.tool==='gcloud'),destination=environment==='dev'?'gs://muthanna.com/jungle-dev/':'gs://muthanna.com/jungle/';
    assert.equal(cloud[0].args[1],'rsync');assert.equal(cloud[0].args[3],destination);
    assert.ok(cloud[0].args.includes('--cache-control=public,max-age=86400,immutable'));
    assert.ok(!cloud[0].args.includes('--delete-unmatched-destination-objects'));
    assert.equal(cloud[1].args[1],'cp');assert.equal(cloud[1].args[3],destination+'index.html');
    assert.ok(cloud[1].args.includes('--cache-control=public,max-age=300,must-revalidate'));
    if(clean){
      assert.deepEqual(calls[3],{tool:'sleep',args:['360']});assert.equal(cloud[2].args[1],'cat');
      assert.equal(cloud[3].args[3],destination);assert.ok(cloud[3].args.includes('--delete-unmatched-destination-objects'));
      const pattern=cloud[3].args.find(a=>a.startsWith('--exclude=')).slice(10),exclude=new RegExp(pattern);
      assert.ok(exclude.test('index.html'));assert.ok(exclude.test('.build-manifest.json'));assert.ok(!exclude.test('app.js'));
    }else assert.equal(cloud.length,2);
  }
});

test('failed builds/uploads or a changed remote release cannot trigger cleanup', async t=>{
  const {root,run}=await uploadFixture(t);
  for(const failure of ['npm','rsync','cp']){
    const result=await run(['dev','--clean'],{FAIL_AT:failure});assert.notEqual(result.status,0);
    assert.ok(!result.calls.some(c=>c.args.includes('--delete-unmatched-destination-objects')));
    if(failure==='rsync')assert.ok(!result.calls.some(c=>c.args[1]==='cp'));
  }
  const changed=await run(['prod','--clean'],{CHANGED_INDEX:'1'});assert.notEqual(changed.status,0);assert.ok(!changed.calls.some(c=>c.args.includes('--delete-unmatched-destination-objects')));
  await writeFile(join(root,'dist/index.html'),'corrupted release');
  const invalid=await run(['dev','--clean']);assert.notEqual(invalid.status,0);assert.ok(!invalid.calls.some(c=>c.tool==='gcloud'));
});
