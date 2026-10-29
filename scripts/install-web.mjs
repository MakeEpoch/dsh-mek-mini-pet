import { readFile, mkdir, copyFile, realpath, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const project = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh');
const profile = join(dshHome, 'profiles', 'web');
const manifestPath = join(profile, 'package.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const plugin = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
if (!manifest.dsh?.profile?.bundles?.includes('@deepseek-ai/dsh-web-app')) throw new Error('Expected an existing dsh Web profile; refusing to initialize or replace it');
const client = await readFile(join(project, 'lib', 'client.js'), 'utf8');
if (!client.includes('window.__ModuleLoader__.load(')) throw new Error('Missing dsh client bundle; run npm run build first');
const spec = `link:${project}`;
console.log(JSON.stringify({ profile, plugin: plugin.name, version: plugin.version, source: spec }, null, 2));
if (process.argv.includes('--dry-run')) process.exit(0);
const alreadyInstalled = manifest.dependencies?.[plugin.name] === spec && manifest.dsh.profile.bundles.includes(plugin.name);
let backup;
if (!alreadyInstalled) {
  backup = join(profile, '.plugin-manager', `mini-pet-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await mkdir(backup, { recursive: true, mode: 0o700 });
  const saved = [];
  for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.patch.yml', 'cordis.yml']) {
    try { await copyFile(join(profile, name), join(backup, name)); saved.push(name); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await writeFile(join(backup, 'backup.json'), JSON.stringify({ profile, project, files: saved }, null, 2), { mode: 0o600 });
  console.log(`Backup: ${backup}`);
  const result = spawnSync('dsh', ['plugin', '--profile', 'web', 'add', spec, '--offline', '--ignore-scripts'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) { console.error(`dsh installer failed. Backup kept at ${backup}`); process.exit(result.status || 1); }
}
// Independent readback: both the manifest selection and actual resolver path must agree.
const installed = JSON.parse(await readFile(manifestPath, 'utf8'));
const installedPath = await realpath(join(profile, 'node_modules', '@dsh', 'mini-pet'));
if (installed.dependencies?.[plugin.name] !== spec || !installed.dsh.profile.bundles.includes(plugin.name) || installedPath !== project)
  throw new Error('dsh package installation did not read back as enabled at the expected path');
await mkdir(join(project, 'artifacts'), { recursive: true });
let previousReceipt;
try {
  const value = JSON.parse(await readFile(join(project, 'artifacts', 'dsh-install.json'), 'utf8'));
  if (alreadyInstalled && value.profile === profile && value.source === project) previousReceipt = value;
} catch { /* No prior receipt is required for independent installation verification. */ }
await writeFile(join(project, 'artifacts', 'dsh-install.json'), JSON.stringify({
  ...previousReceipt,
  installedAt: previousReceipt?.installedAt || new Date().toISOString(),
  verifiedAt: new Date().toISOString(), profile, source: project, version: plugin.version,
  backup: backup || previousReceipt?.backup || null, packageVerified: true, enabledInManifest: true,
  compositionVerified: previousReceipt?.version === plugin.version && previousReceipt?.compositionVerified || false,
  browserActivationVerified: previousReceipt?.version === plugin.version && previousReceipt?.browserActivationVerified || false
}, null, 2));
console.log(alreadyInstalled ? 'Already installed: Web profile link and bundle selection verified.' : 'Installed: Web profile link and bundle selection verified.');
