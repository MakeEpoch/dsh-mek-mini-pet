/** Install an immutable package into an existing DSH Web profile. */
import { copyFile, mkdir, readFile, realpath, writeFile, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, relative, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const source = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const home = process.env.DSH_HOME || join(homedir(), '.dsh');
const profileName = process.env.DSH_PROFILE || 'web';
if (!/^[\w-]+$/.test(profileName)) throw new Error('Invalid profile name');
const profile = await realpath(join(home, 'profiles', profileName));
const manifestPath = join(profile, 'package.json');
const before = JSON.parse(await readFile(manifestPath, 'utf8'));
const plugin = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
if (!before.dsh?.profile?.bundles?.includes('@deepseek-ai/dsh-web-app')) throw new Error('Target must be an existing DSH Web profile');
const client = await readFile(join(source, 'lib/client.js'), 'utf8');
if (!client.includes('window.__ModuleLoader__.load(') || !client.includes(plugin.name)) throw new Error('Client bundle missing or invalid; build first');
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ profile, plugin: plugin.name, version: plugin.version, mode: 'packed archive in profile' }, null, 2));
  process.exit(0);
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: source, encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr || ''}`);
  return result.stdout;
}
const artifacts = join(source, 'artifacts');
await mkdir(artifacts, { recursive: true });
const pack = JSON.parse(run(process.env.NPM_BIN || 'npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', artifacts]));
if (pack.length !== 1) throw new Error('Expected one archive');
const bytes = await readFile(join(artifacts, pack[0].filename));
const sha256 = createHash('sha256').update(bytes).digest('hex');
const cache = join(profile, '.plugin-manager', 'packages');
await mkdir(cache, { recursive: true, mode: 0o700 });
const archive = join(cache, `${plugin.name.split('/').pop()}-${plugin.version}-${sha256}.tgz`);
const spec = `file:${archive}`;
const alreadyInstalled = before.dependencies?.[plugin.name] === spec;
let backup = null;
if (!alreadyInstalled) {
  backup = join(profile, '.plugin-manager', `${plugin.name.split('/').pop()}-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await mkdir(backup, { recursive: true, mode: 0o700 });
  for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.patch.yml', 'cordis.yml']) {
    try { const target = join(backup, name); await copyFile(join(profile, name), target); await chmod(target, 0o600); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  console.log(`Backup: ${backup}`);
}
await writeFile(archive, bytes, { mode: 0o600 });
await chmod(archive, 0o600);
if (!alreadyInstalled) run(process.env.DSH_BIN || 'dsh', ['plugin', '--profile', profileName, 'add', '-w', spec, '--ignore-scripts', ...(process.argv.includes('--offline') ? ['--offline'] : [])], { stdio: 'inherit' });
const after = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!after.dsh.profile.bundles.includes(plugin.name)) { after.dsh.profile.bundles.push(plugin.name); await writeFile(manifestPath, JSON.stringify(after, null, 2) + '\n'); }
if (after.dependencies?.[plugin.name] !== spec || !after.dsh?.profile?.bundles?.includes(plugin.name)) throw new Error('Installation manifest readback failed');
for (const [name, value] of Object.entries(before.dependencies || {})) if (name !== plugin.name && after.dependencies?.[name] !== value) throw new Error(`Unrelated dependency changed: ${name}`);
if (JSON.stringify(before.dsh.profile.bundles) !== JSON.stringify(after.dsh.profile.bundles.filter(name => name !== plugin.name || before.dsh.profile.bundles.includes(name)))) throw new Error('Profile bundles changed unexpectedly');
const resolved = await realpath(join(profile, 'node_modules', ...plugin.name.split('/')));
const rel = relative(profile, resolved);
if (!rel || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) throw new Error('Installed package resolves outside the profile');
const installed = JSON.parse(await readFile(join(resolved, 'package.json'), 'utf8'));
if (installed.name !== plugin.name || installed.version !== plugin.version) throw new Error('Installed package identity mismatch');
const bundle = await readFile(join(resolved, 'lib/client.js'));
if (createHash('sha256').update(bundle).digest('hex') !== createHash('sha256').update(client).digest('hex')) throw new Error('Installed client differs from source');
const receipt = { profile, plugin: plugin.name, version: plugin.version, sha256, archive, backup, alreadyInstalled, resolver: resolved, browserActivationVerified: false };
await writeFile(join(artifacts, 'dsh-install.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify(receipt, null, 2));
