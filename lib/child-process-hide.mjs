// REMEDIATION (npm appeal, reference ID 755b8cdf-9b32-4aa4-900f-a79d967cfc66)
// This module used to patch node:child_process globally (spawn/spawnSync/exec/execSync/
// execFile/execFileSync/fork) and to reach the builtin through process.getBuiltinModule()
// in order to bypass module load hooks. Both of those behaviours are removed here.
//
// What remains: thin per-call wrappers that only pass `windowsHide: true` for calls made
// through this module. Importing this file no longer mutates any global object, and it no
// longer obtains the builtin module through a hook-bypassing path.

import * as childProcess from "node:child_process";

function hide(options) {
  if (options == null) return { windowsHide: true };
  if (typeof options !== "object") return options;
  if (options.windowsHide === true) return options;
  return { ...options, windowsHide: true };
}

export function spawn(file, args, options) {
  return childProcess.spawn(file, args ?? [], hide(options));
}

export function spawnSync(file, args, options) {
  return childProcess.spawnSync(file, args ?? [], hide(options));
}

export function exec(command, options, callback) {
  if (typeof options === "function") return childProcess.exec(command, hide(undefined), options);
  return childProcess.exec(command, hide(options), callback);
}

export function execSync(command, options) {
  return childProcess.execSync(command, hide(options));
}

export function execFile(file, args, options, callback) {
  if (typeof args === "function") return childProcess.execFile(file, hide(undefined), args);
  if (typeof options === "function") return childProcess.execFile(file, args ?? [], hide(undefined), options);
  return childProcess.execFile(file, args ?? [], hide(options), callback);
}

export function execFileSync(file, args, options) {
  return childProcess.execFileSync(file, args ?? [], hide(options));
}

export function fork(modulePath, args, options) {
  return childProcess.fork(modulePath, args ?? [], hide(options));
}

export const ChildProcess = childProcess.ChildProcess;
export default childProcess;
