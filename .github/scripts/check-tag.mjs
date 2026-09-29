/**
 * The tag being released must name `package.json`'s version, as `v<version>`. Takes the tag as its
 * argument, or `GITHUB_REF_NAME`; exits 1 when they differ.
 */
import { readFileSync } from 'node:fs';

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

if (tag !== `v${version}`) {
  console.error(`tag ${tag} does not name package.json's version ${version}: expected v${version}`);
  process.exit(1);
}
console.log(`tag ${tag} names version ${version}`);
