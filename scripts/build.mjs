// Publish only the self-contained page. Repository documentation and tests stay private.
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const html = await readFile(new URL('../index.html', import.meta.url));
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const script = html.toString().match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('Expected one inline application script');
const digest = createHash('sha256').update(script).digest('base64');
const policy = config.headers[0].headers.find(header => header.key === 'Content-Security-Policy').value;
if (!policy.includes(`'sha256-${digest}'`)) throw new Error('CSP script hash does not match index.html');
const output = new URL('../public/', import.meta.url);
await mkdir(output, { recursive: true });
const unexpected = (await readdir(output)).filter(name => name !== 'index.html');
if (unexpected.length) throw new Error('Unexpected files in the static output directory');
await writeFile(new URL('index.html', output), html);
console.log('Static output verified: index.html only');
