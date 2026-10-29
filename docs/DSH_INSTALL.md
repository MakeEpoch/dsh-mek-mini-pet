# 安装到 DeepSeek dsh Web

项目目录：`.`。父目录 `dsh/` 用于放多个独立插件。

本插件当前版本 0.4.4，按本机 dsh 0.2.1-rc.2 的正式插件协议实现。它包含 Cordis Host 空入口、bundle patch、`dsh.client` 清单及已构建的 `lib/client.js`，无需改 dsh 的官方源码。

## 安装到当前 Web profile

```sh
cd .
npm run install:dsh:web
```

安装器要求现有 `~/.dsh/profiles/web`（或 `$DSH_HOME/profiles/web`）存在并已选择本插件。它先打包、备份 profile 清单与配置，再把带 SHA-256 的安装包复制到 profile 内，通过 DSH 插件管理器安装。运行中的插件使用独立快照，源码变更不会直接影响它。

可先执行 `node scripts/install-web.mjs --dry-run` 查看目标；缓存齐全时可用 `node scripts/install-web.mjs --offline`。安装和包校验不会自动重启 DSH，也不代表浏览器已加载。

安装后，在原来运行 dsh Web 的地方重启 `dsh web`，再刷新该 Web 页面。启用 HMR 的宿主可能直接加载；本次安装会分别记录磁盘安装与浏览器激活证据，不将它们混为一谈。演示地址 `http://127.0.0.1:4173` 是独立展示页，不是你的 dsh Web 地址。

## 安装后的行为

- 宠物挂在 dsh Web 页面里，默认使用豆沙，可在设置中切换小音，右下角显示，可拖动与收起。
- 底部工具栏自动隐藏，悬停或键盘聚焦时显示；通过 ⚙ 选择角色与配置，不再注册 dsh 主设置页面。配置保存在当前浏览器，不同步到其他设备。
- 收起后，宠物作为真实 DOM 子节点嵌入侧栏头部：左侧为 64px 迷你人物，右侧任务卡片填满剩余空间并跟随侧栏宽度伸缩。它在正常布局中占位，不覆盖下方新会话按钮或右侧开关。点人物或 ↗ 展开，收起卡片不显示 ×。恢复或卸载会还原宿主标志、文字和原行高。若侧栏无可用位置，则退回可拖动的悬浮按钮。
- 角色大小最低 56px；收起后的唤醒按钮仍可拖动。摸摸只弹爱心，人物保持当前动作；关闭互动后隐藏爱心按钮。
- 气泡上的 × 可临时关闭提醒，有新消息或状态提醒时再显示。设置中的「显示任务气泡」用于整体开关。
- 使用 `ctx.sessions.list` 与 `ctx.uiSession.sessionStatus` 订阅真实会话；等待用户输入时显示提醒。
- 新消息检测只订阅宿主已经持有的 eventSource，使用消息标识与事件类型，不读取正文或打开历史；同一条流式消息不会逐 token 重新弹出气泡。
- 点击气泡通过 `ctx.uiWorkspace.openSession(id)` 回到对应会话。
- 「运行结束」使用 review / 可以查看；不把运行停止直接说成任务成功。
- 错误仅来自当前已由宿主持有的 Session 公共快照，不为读取错误而打开历史会话。
- 没有后台轮询，不发模型请求，不代替用户批准或重试，不改聊天数据。
- 当前只显示主会话；插件禁用时注销监听器并移除宠物。Web 页面以外不悬浮。

## 检查与卸载

在 dsh 的「插件」页面找到 `dsh-mek-mini-pet`，可关闭或移除。命令行卸载：

```sh
npm_config_ignore_scripts=true dsh plugin --profile web remove dsh-mek-mini-pet
```

随后重启 dsh Web 并刷新页面。安装器的独立回读结果在 `artifacts/dsh-install.json`；profile 原始文件备份留在 `~/.dsh/profiles/web/.plugin-manager/mini-pet-backup-*`。正常卸载使用 dsh 管理器；不要直接恢复整个旧 profile，以免覆盖安装之后其他插件的更改。

## 开发更新

```sh
cd .
npm install
npm run build
npm test
```

只在插件目录安装构建依赖。若仅使用随包附带的已构建产物，安装到 dsh 时不需要执行 npm install。修改后重新构建、重新打包安装，再刷新宿主。普通 Web/Electron 组件 API 从 `dsh-mek-mini-pet/web` 导入；包根入口留给 dsh Cordis Host。旧版 0.1.0 的根入口导入方式从此版本调整为 `/web`。

0.4.4 更新后请重启 dsh Web 并完整刷新页面，以移除旧版设置入口并加载新版组件。小音图集与豆沙角色随客户端 bundle 交付。

遇到启动失败时可先用上面的命令卸载插件，保留源码排查；插件自身的异常隔离范围与恢复步骤见 [故障隔离说明](FAILURE_ISOLATION.md)。修复期间应先停用，验证通过并确认需要恢复后再安装。
