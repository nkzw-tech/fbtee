import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const repositoryDirectory = fileURLToPath(new URL('../../../', import.meta.url));
const outputDirectory =
  process.env.FBTEE_NATIVE_ARTIFACTS_OUTPUT_DIRECTORY || join(packageDirectory, 'artifacts');
const platformPackages = readdirSync(join(packageDirectory, 'npm'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => [
    entry.name,
    JSON.parse(readFileSync(join(packageDirectory, 'npm', entry.name, 'package.json'), 'utf8')),
  ]);
const expectedArtifacts = new Set(
  platformPackages.flatMap(([platform, packageJson]) => [
    packageJson.main,
    `fbtee.${platform}${platform.startsWith('win32-') ? '.exe' : ''}`,
  ]),
);

const run = (command, args) =>
  execFileSync(command, args, {
    cwd: repositoryDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();

const collectArtifacts = (directory, artifacts = new Map()) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      collectArtifacts(path, artifacts);
    } else if (entry.isFile() && expectedArtifacts.has(entry.name)) {
      artifacts.set(entry.name, path);
    }
  }
  return artifacts;
};

const downloadDirectory = mkdtempSync(join(tmpdir(), 'fbtee-native-artifacts-'));
try {
  const suppliedDirectory = process.env.FBTEE_NATIVE_ARTIFACTS_DIRECTORY;
  if (suppliedDirectory) {
    for (const [name, path] of collectArtifacts(suppliedDirectory)) {
      copyFileSync(path, join(downloadDirectory, name));
    }
  } else {
    let commit;
    let runId;
    const changes = run('git', ['status', '--porcelain', '--untracked-files=no']);
    if (changes) {
      throw new Error('Commit all tracked changes before downloading release artifacts.');
    }
    try {
      commit = run('git', ['rev-parse', 'HEAD']);
      const runs = JSON.parse(
        run('gh', [
          'run',
          'list',
          '--workflow',
          'push.yml',
          '--commit',
          commit,
          '--status',
          'success',
          '--limit',
          '1',
          '--json',
          'databaseId,headSha',
        ]),
      );
      runId = runs.find(({ headSha }) => headSha === commit)?.databaseId;
    } catch (error) {
      throw new Error(
        'Unable to query GitHub Actions artifacts. Install and authenticate the GitHub CLI (`gh auth login`), or set FBTEE_NATIVE_ARTIFACTS_DIRECTORY.',
        { cause: error },
      );
    }
    if (!runId) {
      throw new Error(
        `No successful push workflow with native artifacts was found for commit ${commit}. Push this commit and wait for CI before releasing.`,
      );
    }
    run('gh', [
      'run',
      'download',
      String(runId),
      '--pattern',
      'oxc-binding-*',
      '--dir',
      downloadDirectory,
    ]);
  }

  const artifacts = collectArtifacts(downloadDirectory);
  const missing = [...expectedArtifacts].filter((name) => !artifacts.has(name));
  if (missing.length > 0) {
    throw new Error(`Downloaded artifacts are incomplete:\n${missing.join('\n')}`);
  }

  rmSync(outputDirectory, { force: true, recursive: true });
  mkdirSync(outputDirectory, { recursive: true });
  for (const name of expectedArtifacts) {
    copyFileSync(artifacts.get(name), join(outputDirectory, basename(name)));
  }
} finally {
  rmSync(downloadDirectory, { force: true, recursive: true });
}
