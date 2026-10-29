import { readFile, writeFile } from 'node:fs/promises';
const bytes = await readFile(new URL('../assets/xiaoyin/spritesheet.webp', import.meta.url));
const uri = `data:image/webp;base64,${bytes.toString('base64')}`;
await writeFile(new URL('../src/xiaoyin-data.js', import.meta.url), `// Generated from the user-owned original Xiaoyin sprite sheet. See assets/xiaoyin/README.md.\nexport const xiaoyinSheet = ${JSON.stringify(uri)};\n`);
console.log(`Embedded Xiaoyin: ${bytes.length} bytes`);
