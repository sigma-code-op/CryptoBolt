// Submit every URL in sitemap.xml to IndexNow (Bing, Yandex, Seznam, Naver...).
// Run AFTER you deploy:  npm run indexnow
// The key file 9923e279636d1a4240cc5e02657feaf7.txt must be live at https://cryptobolt.io/9923e279636d1a4240cc5e02657feaf7.txt
import { readFileSync } from 'node:fs';

const HOST = 'cryptobolt.io';
const KEY = '9923e279636d1a4240cc5e02657feaf7';
const urls = [...readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
console.log(`IndexNow: submitted ${urls.length} URLs -> HTTP ${res.status}`);
if (res.status >= 400) console.log(await res.text());