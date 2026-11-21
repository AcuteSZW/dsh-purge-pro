# Security remediation

Context: a publish of `dsh-purge-pro@1.0.0` was rejected by npm's publish-time malware scan
(SHA-512 `BQv2cx+ahoNfklC46GH+nCrtqyYiiU3G+ivp8wVA2e4fQuF0bH7SvMZVECLr/iUqA8qhqnPg5SRcG+AY8TVxcQ==`,
reference ID `755b8cdf-9b32-4aa4-900f-a79d967cfc66`), and the publishing account was suspended
as a precaution. That version was withdrawn and will not be republished under any name or
account.

This commit removes the two behaviours that read as malware heuristics. Both are verifiable
in this diff.

## 1. Global `node:child_process` interception — removed

- `lib/child-process-hide.mjs` no longer obtains the builtin module through
  `process.getBuiltinModule()` and no longer reassigns `spawn`, `spawnSync`, `exec`,
  `execSync`, `execFile`, `execFileSync`, `fork` on the shared builtin object.
  It now only exports thin wrappers that pass `windowsHide: true` for calls routed through
  this module. Importing the file mutates nothing.
- `lib/hide-console.js`: `installHideConsole()` is a no-op returning
  `{ ok: true, skipped: "removed_by_policy" }`; the module-level `installHideConsole()` call
  at import time is deleted; the code generator that embedded the patching snippet is
  deleted; the helper that reached the builtin through `process.getBuiltinModule()` is
  deleted.

## 2. Writing into another package's files — removed

`installHideConsoleIntoBin()` is a no-op returning `"skipped_removed_by_policy"`. The plugin
no longer writes a sidecar module next to another package's `lib/bin.js` and no longer
injects an `import` line into that file. `revertHideConsoleFromBin()` is kept, so a machine
that already carries an injected line can still be cleaned up.

## 3. Remote self-update — removed

`lib/update.js` gains `SELF_UPDATE_DISABLED = true`; `_applyUpdateImpl` returns immediately
with `error: "self-update removed: dsh-purge-pro no longer downloads or executes remote code"`.
Consequently the plugin no longer:

- fetches an archive from `codeload.github.com` / `raw.githubusercontent.com`
- extracts it over its own `lib`/`bin` files (`extractZipArchive`)
- runs `git fetch` / `reset --hard` against its own directory
- spawns `lib/reapply-cli.js` to re-apply patches with `--expose-internals`

Version *checking* (`checkUpdate`) is read-only metadata reads and stays intact.

## Not touched in this commit (inventoried, not removed)

- `lib/core.js` `nodeShimInject()` writes a small `DSH_HOME` bootstrap shim into the host's
  launcher script. It does not patch `child_process`; it sets an env var. Tracked separately.
- `lib/skills.js` extracts user-supplied skill archives. Not part of the finding.

## Timeline

- 2026-11-17T12:08:52Z — `dsh-purge-pro@1.0.0` blocked by publish-time scan, account suspended
- 2026-11-18 — reinstatement request submitted (npm support ticket 5018018)
- This commit — remediation applied and linked into the same ticket
