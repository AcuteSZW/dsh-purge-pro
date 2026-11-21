import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isAsarSealedPath } from "./desktop.js";
import { diskFs, fsFor } from "./extract-asar.js";

const MARK = "__dshPurgeHideConsole";
const IMPORT_MARK = "dsh-purge-pro-hide-console";

function forceHideOptions(options) {
  if (options == null) return { windowsHide: true };
  if (typeof options !== "object") return options;
  if (options.windowsHide === true) return options;
  return { ...options, windowsHide: true };
}

function wrapSpawn(orig) {
  return function patchedSpawn(file, args, options) {
    if (args != null && !Array.isArray(args)) {
      return orig.call(this, file, forceHideOptions(args));
    }
    return orig.call(this, file, args ?? [], forceHideOptions(options));
  };
}

function wrapExecLike(orig) {
  return function patchedExec(command, options, callback) {
    if (typeof options === "function") {
      return orig.call(this, command, { windowsHide: true }, options);
    }
    return orig.call(this, command, forceHideOptions(options), callback);
  };
}

function wrapExecFile(orig) {
  return function patchedExecFile(file, args, options, callback) {
    if (typeof args === "function") {
      return orig.call(this, file, forceHideOptions(undefined), args);
    }
    if (args != null && !Array.isArray(args)) {
      return orig.call(this, file, forceHideOptions(args), options);
    }
    if (typeof options === "function") {
      return orig.call(this, file, args, { windowsHide: true }, options);
    }
    return orig.call(this, file, args, forceHideOptions(options), callback);
  };
}

function wrapFork(orig) {
  return function patchedFork(modulePath, args, options) {
    if (args != null && !Array.isArray(args)) {
      return orig.call(this, modulePath, forceHideOptions(args));
    }
    return orig.call(this, modulePath, args, forceHideOptions(options));
  };
}

export function isElectronHost(versions = process.versions) {
  return Boolean(versions && versions.electron);
}

/**
 * Windows 非 Electron：包 builtin，给子进程加 windowsHide。
 * Electron（官方桌面 / 第三方 DSH Desktop）整段跳过。
 * macOS、Linux、Kali 不是 win32，调用方直接跳过。
 * 不再 registerHooks 短路 node:child_process（#46）。
 */
export function hideConsoleDecision(platform = process.platform, versions = process.versions) {
  if (platform !== "win32") return "not_win32";
  if (isElectronHost(versions)) return "electron_host";
  return "wrap_builtin";
}

export function installChildProcessImportHook() {
  // #46：Node 24 把 node:child_process 短路到 facade 后，
  // CJS require 会在 loadBuiltinWithHooks 里读到 undefined.exports。
  // Windows / macOS / Linux 都不再注册这个 resolve 钩子。
  return { ok: true, skipped: "no_builtin_short_circuit" };
}

// REMEDIATION (npm appeal, reference ID 755b8cdf-9b32-4aa4-900f-a79d967cfc66)
// The hook-bypassing builtin lookup (`process.getBuiltinModule("child_process")`) was only
// used by the global patcher, which is gone, so the helper is removed with it.

// REMEDIATION (npm appeal, reference ID 755b8cdf-9b32-4aa4-900f-a79d967cfc66)
// Global monkey-patching of node:child_process is removed. This function is kept only so
// existing call sites keep working; it now does nothing and mutates no shared object.
export function installHideConsole() {
  return { ok: true, skipped: "removed_by_policy" };
}

// REMEDIATION (npm appeal, reference ID 755b8cdf-9b32-4aa4-900f-a79d967cfc66)
// The generated sidecar used to patch node:child_process globally once imported. The
// patching code is deleted; if anything still asks for this source it gets a comment only.
export function hideConsoleEntrySource() {
  return `// ${IMPORT_MARK} — removed by policy; no patching is performed\n`;
}

function requirePath() {
  return createRequire(import.meta.url)("node:path");
}

function ioFor(explicit, targetPath) {
  return explicit ?? fsFor(targetPath);
}

/** 源码 monorepo 的 apps/cli（tsdown 构建产物）。往这里注入/还原会动构建输出，缺 bak 时无法自愈（#41）。 */
export function looksLikeSourceCliRoot(root, { fs, path: nodePath } = {}) {
  const p = nodePath ?? requirePath();
  if (!root) return false;
  const n = String(root).replace(/\\/g, "/").toLowerCase();
  if (/\/apps\/cli\/?$/.test(n)) return true;
  if (/\/node_modules\//.test(n)) return false;
  try {
    const nodeFs = ioFor(fs, root);
    const libDir = p.join(root, "lib");
    if (nodeFs.existsSync(p.join(libDir, "tsconfig.tsbuildinfo"))) return true;
    if (nodeFs.existsSync(p.join(root, "tsdown.config.ts")) || nodeFs.existsSync(p.join(root, "tsdown.config.mjs"))) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function resolveDshBinRoot(hint, { fs, path: nodePath } = {}) {
  const p = nodePath ?? requirePath();
  const tries = [];
  const push = (x) => {
    if (x && !tries.includes(x)) tries.push(x);
  };
  if (hint) {
    push(hint);
    push(p.join(hint, "dsh"));
    push(p.join(hint, "@deepseek-ai", "dsh"));
    if (p.basename(hint) === "@deepseek-ai") {
      push(p.dirname(hint));
      push(p.join(p.dirname(hint), "dsh"));
      push(p.dirname(p.dirname(hint)));
    }
    if (p.basename(hint) === "dsh") push(hint);
  }
  if (typeof process.argv[1] === "string" && /[\\/]bin\.js$/i.test(process.argv[1])) {
    push(p.dirname(p.dirname(process.argv[1])));
  }
  for (const root of tries) {
    try {
      const binJs = p.join(root, "lib", "bin.js");
      if (isAsarSealedPath(root) || isAsarSealedPath(binJs)) continue;
      // 源码树只作探测候选的最后手段；优先 node_modules 包，避免改写 apps/cli/lib（#41）。
      if (looksLikeSourceCliRoot(root, { fs, path: p })) continue;
      if (ioFor(fs, binJs).existsSync(binJs)) return p.normalize(root);
    } catch {}
  }
  // 没有包装配路径时，才回退到 argv 指向的源码 cli（仍禁止注入，见 installHideConsoleIntoBin）。
  for (const root of tries) {
    try {
      const binJs = p.join(root, "lib", "bin.js");
      if (isAsarSealedPath(root) || isAsarSealedPath(binJs)) continue;
      if (ioFor(fs, binJs).existsSync(binJs)) return p.normalize(root);
    } catch {}
  }
  return null;
}

const IMPORT_LINE = `import "./${IMPORT_MARK}.js"; // [dsh-purge-pro] hide-console`;

// REMEDIATION (npm appeal, reference ID 755b8cdf-9b32-4aa4-900f-a79d967cfc66)
// Writing a sidecar module next to another package's lib/bin.js and injecting an import
// line into that package is removed. No file outside this plugin is modified anymore.
export function installHideConsoleIntoBin(aiBase, { fs, path: nodePath } = {}) {
  return "skipped_removed_by_policy";
}

export function revertHideConsoleFromBin(aiBase, { fs, path: nodePath } = {}) {
  const p = nodePath ?? requirePath();
  const root = resolveDshBinRoot(aiBase, { fs, path: p });
  if (!root) return "missing_bin";
  // 源码 cli：只清理本插件留下的 sidecar，绝不改/删 bin.js 或其它构建产物（#41）。
  const sourceCli = looksLikeSourceCliRoot(root, { fs, path: p });
  const nodeFs = ioFor(fs, root);
  const binJs = p.join(root, "lib", "bin.js");
  const side = p.join(root, "lib", `${IMPORT_MARK}.js`);
  const facadeSide = p.join(root, "lib", "dsh-purge-pro-child-process-hide.mjs");
  let changed = false;
  if (!sourceCli && nodeFs.existsSync(binJs)) {
    try {
      const text = nodeFs.readFileSync(binJs, "utf8");
      const next = text.replace(/^import "\.\/dsh-purge-pro-hide-console\.js";.*\r?\n/gm, "");
      if (next !== text) {
        nodeFs.writeFileSync(binJs, next, "utf8");
        changed = true;
      }
    } catch (e) {
      return `error:${e}`;
    }
  }
  for (const fp of [side, facadeSide]) {
    try {
      if (nodeFs.existsSync(fp)) {
        nodeFs.unlinkSync(fp);
        changed = true;
      }
    } catch {
      // 重启后再删
    }
  }
  return changed ? "reverted" : "absent";
}
