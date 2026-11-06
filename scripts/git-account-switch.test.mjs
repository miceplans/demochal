import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const scriptPath = join(process.cwd(), 'scripts/git-account-switch.sh');

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'git-account-switch-'));
  const binDirectory = join(directory, 'bin');
  const accountPath = join(directory, 'active-account');
  const configPath = join(directory, 'gitconfig');
  await writeFile(accountPath, 'hjy080530\n');
  await mkdir(binDirectory);
  await writeFile(
    join(binDirectory, 'gh'),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "api" ]]; then cat "$FAKE_GH_ACCOUNT_FILE"; exit 0; fi
if [[ "$1" == "auth" && "$2" == "switch" ]]; then
  [[ "\${FAKE_GH_SWITCH_FAIL:-}" != "1" ]] || exit 1
  printf '%s\\n' "$6" > "$FAKE_GH_ACCOUNT_FILE"
  exit 0
fi
exit 1
`,
  );
  await chmod(join(binDirectory, 'gh'), 0o755);

  const env = {
    ...process.env,
    PATH: `${binDirectory}:${process.env.PATH}`,
    FAKE_GH_ACCOUNT_FILE: accountPath,
    GIT_CONFIG_GLOBAL: configPath,
    GIT_CONFIG_NOSYSTEM: '1',
  };
  return { accountPath, configPath, env };
}

async function setAuthor(env, name, email) {
  await execFileAsync('git', ['config', '--global', 'user.name', name], { env });
  await execFileAsync('git', ['config', '--global', 'user.email', email], { env });
}

async function author(env) {
  const name = await execFileAsync('git', ['config', '--global', '--get', 'user.name'], { env });
  const email = await execFileAsync('git', ['config', '--global', '--get', 'user.email'], { env });
  return [name.stdout.trim(), email.stdout.trim()];
}

test('switches the GitHub CLI account and Git author together', async () => {
  const { accountPath, env } = await createFixture();
  await setAuthor(env, 'hjy080530', 'bomaye119@gmail.com');

  await execFileAsync('bash', [scriptPath, 'miceplanscom-lab'], { env });

  assert.equal((await readFile(accountPath, 'utf8')).trim(), 'miceplanscom-lab');
  assert.deepEqual(await author(env), ['miceplanscom-lab', 'miceplans.com@gmail.com']);
});

test('keeps the Git author when GitHub CLI account switching fails', async () => {
  const { env } = await createFixture();
  await setAuthor(env, 'hjy080530', 'bomaye119@gmail.com');

  await assert.rejects(
    execFileAsync('bash', [scriptPath, 'miceplanscom-lab'], {
      env: { ...env, FAKE_GH_SWITCH_FAIL: '1' },
    }),
  );

  assert.deepEqual(await author(env), ['hjy080530', 'bomaye119@gmail.com']);
});

test('rejects an unsupported account before changing Git author data', async () => {
  const { env } = await createFixture();
  await setAuthor(env, 'hjy080530', 'bomaye119@gmail.com');

  await assert.rejects(execFileAsync('bash', [scriptPath, 'unknown-account'], { env }));

  assert.deepEqual(await author(env), ['hjy080530', 'bomaye119@gmail.com']);
});

test('install makes git aitubswitch invoke the account switcher', async () => {
  const { accountPath, env } = await createFixture();
  await setAuthor(env, 'hjy080530', 'bomaye119@gmail.com');

  await execFileAsync('bash', [scriptPath, 'install'], { env });
  const alias = await execFileAsync('git', ['config', '--global', '--get', 'alias.aitubswitch'], {
    env,
  });
  assert.match(alias.stdout, /git-account-switch\.sh/);

  await execFileAsync('git', ['aitubswitch', 'miceplanscom-lab'], { env });

  assert.equal((await readFile(accountPath, 'utf8')).trim(), 'miceplanscom-lab');
  assert.deepEqual(await author(env), ['miceplanscom-lab', 'miceplans.com@gmail.com']);
});
