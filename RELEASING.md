# 发版指引（dsh-purge-pro）

本仓库：`E:\ai-agent\deepseek-harness-tools\dsh-purge-pro`，origin = `https://github.com/AcuteSZW/dsh-purge-pro.git`。
npm 包：`dsh-purge-pro`（账号 `lucas-song`，凭据在 `C:\Users\songzhiwei\.npmrc`）。

## 两条发布通道，各管一半

| 通道 | 谁触发 | 产物 |
|---|---|---|
| GitHub Release | push 到 `main` 后由 `.github/workflows/release.yml` 自动跑 | `v<版本>` tag + `dsh-purge-pro-<版本>.zip` |
| npm | 本机手动 `npm publish` | `dsh-purge-pro@<版本>` |

CI 只认 `main` 分支，并且先 `gh release view` 判重：同一版本再推不会重复发包。

## 一、改完代码后的自检

```powershell
cd E:\ai-agent\deepseek-harness-tools\dsh-purge-pro
node --check lib/index.js
node --check lib/core.js
node --check lib/reapply.js
node --input-type=module -e "import './lib/index.js'"
node scripts/selftest.mjs
node lib/redteam/poc-file-transaction.test.js
```

四个多进程回归脚本可以按需再跑：`npm run test:target-db-multiprocess`、`test:poc-file-multiprocess`、`test:poc-cleanup-race`、`test:attack-file-path-collision`。
软链相关用例在本机没有创建符号链接权限时会打印 SKIP，属预期，不算失败。

## 二、升版本

```powershell
cd E:\ai-agent\deepseek-harness-tools\dsh-purge-pro
npm version <新版本> --no-git-tag-version
```

同时把 `release-notes.md` **第一行**改成 `# <新版本>`——CI 会逐字比对这一行，不匹配直接 exit 1。
新条目写在最上面，中英文各一段，历史条目保留在下面。

## 三、提交并推送（GitHub Release 由 CI 完成）

```powershell
cd E:\ai-agent\deepseek-harness-tools\dsh-purge-pro
git add -A
git commit -m "<新版本>: 一句话说明"
git push
```

推送后到 Actions 看 `Release` 工作流；成功后 `https://github.com/AcuteSZW/dsh-purge-pro/releases/tag/v<新版本>` 就有 zip。

## 四、发到 npm

```powershell
cd E:\ai-agent\deepseek-harness-tools\dsh-purge-pro
.\publish.ps1
```

要点：

- **`--registry=https://registry.npmjs.org` 不能省**。本机默认源是 npmmirror，省了会发到镜像站。
- 凭据用 **Granular Access Token（勾 Bypass 2FA）**，写在 `C:\Users\songzhiwei\.npmrc`。浏览器登录留下的 token 隔夜就废。
- **PUT 报 404 而 `npm whoami` 报 401 → 是 token 过期，不是包没了**。npm 对没权限的 PUT 一律回 404。
- 助手环境里可能带着沙箱的 `NPM_CONFIG_USERCONFIG`，脚本已显式传 `--userconfig`。
- 发布后先看 `https://registry.npmjs.org/dsh-purge-pro/<版本>` 这个端点：能取到就说明已上架；根路径短暂显示 `0.0.0-stage` 是 npm 的占位，等一两分钟会被真实版本替换。

验证：

```powershell
npm view dsh-purge-pro version --registry=https://registry.npmjs.org
```

## 五、装进 profile 验证

```powershell
cd C:\Users\songzhiwei\.dsh\profiles\web
pnpm add dsh-purge-pro@<版本>
```

用 `pnpm add` 而不是 `pnpm install`：后者只按 lockfile 补齐，不会把已装旧版本升上去。
装完确认磁盘上是新代码，再重启 DSH。

**不要和上游 `dsh-purge` 同时装**：两者补丁行 id 已经分开（`dsh-purge` / `dsh-purge-pro`），但都对宿主同一批文件做写入，同时对同一份宿主文件应用两边补丁会互相覆盖。

## 六、出问题怎么撤

- 标记版本有问题（推荐）：

  ```
  npm deprecate dsh-purge-pro@<版本> "原因，改用 <可用版本>"
  ```

- 24 小时内可彻底删版本：

  ```
  npm unpublish dsh-purge-pro@<版本> --force --registry=https://registry.npmjs.org
  ```

- GitHub 侧：`git revert <commit>` 后正常走三、四步；已有 Release 需在网页或 API 手工删。

## 七、这个仓库的坑

- 到 github.com 的连接时通时断：本仓库 `.git/config` 里配了仓库级代理 `http://127.0.0.1:10808`，换网络后失效就 `git config --local --unset http.proxy`。
- 仓库 `files` 里的 `lib/default-prompt-inject.md` 是构建输入，npm 包里按 `!lib/default-prompt-inject.md` 排除，别当成漏打包。
- `screenshots.json`、`docs/preview/*.png` 会进包，改界面截图记得同步。
