# 1.0.1

## 中文

- 版本 **1.0.1**，适配 **DSH 0.2.2-rc.3**，Node.js **>=22.5**。本仓库（`AcuteSZW/dsh-purge-pro`）的首次公开发布，也是 npm 包 `dsh-purge-pro` 的首版。下面先给插件全貌，再列本版内容与已知边界。

### 一、插件是什么

- 装在本机官方 DeepSeek Harness 上的网络安全红队评测插件，官方 Web（`dsh web`，profile `web`）与官方桌面 EXE（profile `desktop`）分开安装、分开应用；社区桌面端不维护。
- 把宿主运行时的提示词改写、审批门、沙箱与会话格式，和模型本身的回答分开，用来做受控评测，也评估默认策略是否该收紧。只处理本机已安装的官方 `@deepseek-ai` 包与本机配置；不是公网扫描器，也不是针对第三方站点的攻击套件，仓库内不含木马、未授权渗透脚本或对外攻击载荷。
- 不写死盘符：按 `$DSH_HOME`、dsh 启动器旁的 `.dsh`，再退回 `~/.dsh`；不改 Harness 源码仓库，在「清洗」里点「应用」才写入。
- 本版代号 **pro**：包名、插件模块名、HTTP 路由、状态目录与命令行统一使用 `dsh-purge-pro` 标识，可与上游 `dsh-purge` 并存安装，互不覆盖对方的配置与数据。

### 二、功能全貌

**清洗 / 补丁**

- 分组查看补丁状态，应用、还原、卸载；应用前把目标文件备份为 `<文件>.dshpurge.bak`，重复应用幂等；`prompt-inject.md` 作为用户文件，还原时保留。
- 提示词编辑与多套规则集（`AGENTS.md` / `CLAUDE.md`）：启用写入 `$DSH_HOME`，删除从列表去掉；每轮注入按「提示词文件 → 勾选的本地规则 → 插件加密默认」依次回落，工作区 baseline 策略 strict / fallback / always 可调。
- Skill 导入压缩包或文件夹到 `$DSH_HOME/skills/<id>/`，由 DSH 加载；卸载插件不删用户 Skill。
- 自己的服务器名单：每行一个 IP 或完整主机名，写入 `$DSH_HOME/net-scope-allow.txt`；大陆、香港、澳门地址默认禁止，未登记不放行，密钥/密码/网段/通配符不接受。

**状态与换包**

- `--status` / `purge_status` 三行：运行时加载（`app.asar` 密封 / `resources/app` 已接管）、补丁生效（写入条数 vs 实际加载条数）、换包阶段与失败原因；账本在 `$DSH_HOME/dsh-purge-pro/asar-swap.json`，日志在 `%TEMP%\dsh-purge-pro-asar-*.log`。
- 密封 asar 下补丁写入但未生效时，可排队空闲接管（`--swap`，不杀进程，关 dsh 后自动换包重开）或立即换包（`--swap-now`）；换包前先验 `resources/app` 树完整并补原生模块，目录不全则中止、桌面保持可用。
- 回退一次 / 回退上一轮留在当前对话，已发送句回到输入框，本轮输出与任务撤掉后重发；多轮后按当前轮定位。

**演练台（红队）**

- 授权后管理靶标、资产、服务/指纹、漏洞与命中、POC/EXP 知识库、现场截图与证据摘录卡、得分点与六段报告；某次演练可导出为目录。
- 环境适配接通工具路径与 FOFA/VPS 等配置；技能库探测 `$DSH_HOME/redteam/skills` 与随包技能；知识库可浏览本机 nuclei 模板，按类别/CVE/组件检索。
- 并发名额：不带 key 的 release 只放最早一条；子代理结束由服务端自动释放，手动释放须带 acquire 返回的 key。

**CLI / 聊天命令**

- CLI：`dsh-purge-pro --status / --apply / --swap / --swap-now / --revert / --uninstall / --edit`。
- 聊天：`/purge status|apply|revert|uninstall|edit|help`，`/rules …`，`/skills …`，`/rewind`；模型工具 `purge_status` / `purge_apply` / `purge_revert`。

### 三、本版内容

**路径安全与分页归一化**

- `lib/redteam/pagination.js`：`normalizeLimit` / `normalizeOffset` 把外部传入的 limit/offset 归一化为有限、非负安全整数，缺失或非数字回落默认值并封顶；资产、漏洞、图谱、模板检索分页全部接入。
- `validate.js` 路径校验为词法包含 + realpath 规范化双重判定：词法在根内但经软链跳到根外的路径被拒；指向缺失/不可达目标的悬空软链按符号链接拒绝。
- `tools.js` schema 路径描述收紧到靶标目录内，不再宣称支持绝对路径导入；`shot_add` 含 `file`（目标文件名）字段。

**POC 文件与 SQLite 并发一致性**

- `lib/redteam/poc-file-transaction.js`：POC 文件先在暂存区落盘，提升到目标目录发生在 SQLite COMMIT 之前；事务失败按补偿逻辑还原旧文件；启动时扫描未完成事务恢复；拦截受管根内软链祖先与悬空软链。
- `store-core.js`：靶标库与知识库连接都设 `busy_timeout = 5000`，并发写入最多等 5 秒，超时仍返回锁错误，不合并冲突写入；共享引用文件在删除/更新时仍被其他行引用则保留；截图与证据同名不覆盖已有文件；路径经 realpath 规范化做 containment。
- 边界：这是补偿事务，不提供跨文件系统与 SQLite 的原子性；进程/机器崩溃时序、TOCTOU 竞态与目录 fsync 持久性不在本 Node 实现覆盖范围内。

**测试、基准与工程基线**

- 4 个回归脚本（靶标库多进程、POC 文件多进程、POC 清理竞争、攻击文件路径冲突）与 2 个基准（得分报告、代表性截图），连同 POC 事务单测登记进 `package.json` scripts；`selftest.mjs` 覆盖分页归一化、截图同名冲突、路径软链断言。
- `engines.node` 为 `>=22.5`；`dshTarget` 对齐 `0.2.2-rc.3`。

**文档与部署脚本**

- README 中英文不含赞助打赏与加密货币地址表，也不含整段法律免责与合规声明；中英文切换链接、标题层级、代码围栏已修正。
- `deploy-local.bat` 按 GBK/CP936 保存并去掉 `chcp 65001`，避免中文 Windows cmd 把一行拆成残片命令。

### 四、已知边界

- 本版只支持 dsh 0.2；dsh 0.1.7（含 rc.1/rc.2）请用上游 `dsh-purge` 的 1.1.39 及更早标签。
- 对不上的补丁显示待应用或跳过，不会乱改文件；未装的可选包显示跳过，不挡应用完成。
- 与上游 `dsh-purge` 并存安装时，两者各自独立生效；不要对同一份宿主文件同时应用两边的补丁。
- 补偿事务不构成跨资源原子性，见上「POC 文件与 SQLite 并发一致性」。
- npm 首发版本为 1.0.1：1.0.0 在 npm 侧被占位版本锁住、未对外放出，安装请用 1.0.1。

## English

- **1.0.1**, targeting **DSH 0.2.2-rc.3**, Node.js **>=22.5**. First public release of this repository (`AcuteSZW/dsh-purge-pro`) and the first version of the npm package `dsh-purge-pro`. The notes below cover the plugin as a whole, then what this release contains and its known boundaries.

### 1: what it is

- A local red-team evaluation plugin for the official DeepSeek Harness. Official Web (`dsh web`, profile `web`) and the official desktop EXE (profile `desktop`) are installed and applied separately; community desktops are not maintained.
- It separates host-side runtime prompt rewriting, approval gates, sandbox and session format from the model's own answers, for controlled evaluation and for judging whether the default policy should be tightened. It only touches the official `@deepseek-ai` packages and local config on this machine; it is not a public scanner and not an attack kit against third-party sites. The repo ships no malware, unauthorized exploit scripts, or payloads aimed at the public internet.
- No drive-letter pinning: it resolves `$DSH_HOME`, then `.dsh` beside the dsh launcher, then `~/.dsh`. It does not modify the Harness source checkout; files are written only when Apply is clicked in Clean.
- This edition is tagged **pro**: package name, plugin module names, HTTP routes, state directory and CLI all use the `dsh-purge-pro` identity, so it can be installed alongside upstream `dsh-purge` without either overwriting the other's config or data.

### 2: feature overview

**Clean / patches**

- Grouped patch status with apply, revert, uninstall; each target is backed up as `<file>.dshpurge.bak` before patching; re-apply is idempotent; `prompt-inject.md` is kept as a user file on revert.
- Prompt editing and multiple rule sets (`AGENTS.md` / `CLAUDE.md`): enabled sets write to `$DSH_HOME`, deletion removes them from the list. Per-turn injection falls back prompt file → checked local rules → sealed plugin default; the workspace baseline policy is strict / fallback / always.
- Skills import an archive or folder into `$DSH_HOME/skills/<id>/` and are loaded by DSH; uninstalling the plugin does not delete user skills.
- Own-server allowlist: one IP or full hostname per line, written to `$DSH_HOME/net-scope-allow.txt`. Mainland China, Hong Kong and Macau addresses are denied by default; anything unlisted stays blocked; keys, passwords, CIDRs and wildcards are not accepted.

**Status and asar swap**

- `--status` / `purge_status` report three lines: runtime source (sealed `app.asar` vs unpacked `resources/app`), effective count (written vs actually loaded), and swap phase/last error. Ledger at `$DSH_HOME/dsh-purge-pro/asar-swap.json`, logs at `%TEMP%\dsh-purge-pro-asar-*.log`.
- When patches are written but not effective under a sealed asar, queue an idle takeover (`--swap`, no process kill; swap and relaunch after dsh closes) or swap now (`--swap-now`). The swap verifies the `resources/app` tree and restores native modules before killing anything; an incomplete tree aborts and keeps the desktop usable.
- Rewind one step / last round stays in the current chat: the sent line returns to the composer and this turn's output and tasks are dropped before resend; later turns bound by the current turn.

**Drill console (red team)**

- After authorization: engagements, assets, services/fingerprints, vulns and hits, POC/EXP knowledge base, screenshots and evidence cards, score points and a six-part report; an engagement can be exported to a folder.
- Env adapt wires tool paths and FOFA/VPS config; the skill catalog probes `$DSH_HOME/redteam/skills` and bundled skills; the knowledge browser lists local nuclei templates searchable by category/CVE/component.
- Concurrency slots: a release without a key keeps only the oldest reservation; subagent end releases server-side; a manual release must carry the acquire key.

**CLI / chat commands**

- CLI: `dsh-purge-pro --status / --apply / --swap / --swap-now / --revert / --uninstall / --edit`.
- Chat: `/purge status|apply|revert|uninstall|edit|help`, `/rules …`, `/skills …`, `/rewind`; model tools `purge_status` / `purge_apply` / `purge_revert`.

### 3: this release

**Path safety and pagination normalization**

- `lib/redteam/pagination.js`: `normalizeLimit` / `normalizeOffset` coerce caller-supplied limit/offset to finite non-negative safe integers; missing or non-numeric values fall back to default and are capped. Asset, vuln, graph and template search pagination all use it.
- `validate.js` path checks combine lexical containment with realpath canonicalization: a path lexically inside the root but resolving out through a symlink is rejected; a dangling symlink whose target is missing or inaccessible is refused as a symlink.
- `tools.js` schema path descriptions are tightened to inside the engagement directory (absolute-path import is no longer advertised); `shot_add` covers the `file` (target filename) field.

**POC file and SQLite concurrency consistency**

- `lib/redteam/poc-file-transaction.js`: POC files are staged beside the destination and promoted before the SQLite COMMIT; a failed transaction restores the prior file as compensation; unfinished transactions are recovered on startup; in-root symlink ancestors and dangling links are blocked.
- `store-core.js`: both target and knowledge connections set `busy_timeout = 5000`, so concurrent writes wait at most 5 s and still return a lock error on timeout instead of merging conflicting writes; files still referenced by other rows are kept on shared-ref delete/update; screenshots and evidence no longer overwrite an existing same-named file; paths are realpath-canonicalized for containment.
- Boundary: this is compensating behavior, not cross-resource atomicity; process/machine crash timing, TOCTOU races and directory fsync durability are not covered by this Node implementation.

**Tests, benchmarks and engineering baseline**

- Four regression scripts (target-db multiprocess, POC-file multiprocess, POC cleanup race, attack-file path collision) and two benchmarks (score report, representative shots), registered in `package.json` scripts alongside the POC transaction unit test; `selftest.mjs` covers pagination normalization, same-name screenshot conflict and path symlink assertions.
- `engines.node` is `>=22.5`; `dshTarget` aligned to `0.2.2-rc.3`.

**Docs and deploy script**

- README (CN/EN) ships without the sponsor/tips block and crypto address table, and without the strict legal-disclaimer and compliance-use section; swapped CN/EN switch links, heading levels and fenced blocks are fixed.
- `deploy-local.bat` is saved as GBK/CP936 without `chcp 65001`, so a Chinese Windows cmd no longer splits a line into fragment commands.

### 4: known boundaries

- This release supports dsh 0.2 only; dsh 0.1.7 (rc.1/rc.2) should use upstream `dsh-purge` tags 1.1.39 and earlier.
- Patches whose needles no longer match show pending or skipped and do not rewrite files; optional packages that are not installed show skipped and do not block Apply.
- When installed next to upstream `dsh-purge`, each works independently; do not apply both to the same host file at the same time.
- The compensating transaction is not cross-resource atomic; see the POC file and SQLite consistency boundary above.
- npm ships 1.0.1 as the first public version: 1.0.0 stayed locked behind a registry holding version and was never released; install 1.0.1.
