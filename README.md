# 小音与豆沙 · DSH Mini Pet

一个安静陪你工作的小宠物插件。包含小音和原创豆沙兔角色，可在设置中切换；默认显示豆沙。可嵌入 Web，并提供 Electron 适配。插件没有额外运行时依赖。

**安装到你正在用的 dsh Web：** 在 `.` 运行 `npm run install:dsh:web`，然后重启 dsh Web 并刷新页面。当前版本 0.4.4，会自动订阅真实会话状态；详见 [dsh 安装说明](docs/DSH_INSTALL.md)。

参考 Codex Mini/Pets 的「悬浮陪伴 + 任务状态 + 快速回到任务」交互，插件实现与豆沙角色为本项目原创，小音图集由维护者授权随项目分发。[官方参考](https://developers.openai.com/codex/app/settings#pets)。运行时不连接 Codex 账户。

## 先玩一下

需要 Node.js 20 或以上。在项目目录运行：

```sh
npm run dev
```

浏览器打开 <http://127.0.0.1:4173>。不用安装依赖。演示页的任务为手动模拟；安装到 dsh Web 后由插件适配器订阅真实会话。

- 拖动宠物改变位置；聚焦后可用方向键微调。设置中可锁定位置。
- 底部按钮平时自动隐藏，悬停或键盘聚焦时显示。
- 点击角色或 ♡ 摸摸，只弹出小爱心，人物保持当前动作；关闭摸摸后隐藏爱心按钮。减少动画时显示静态爱心。
- 在宠物身边的 ⚙ 中选择角色、大小、动画速度、互动、气泡和锁定位置；大小最低 56px，不再占用 dsh 主设置入口。
- ☾ 切换休息／唤醒；正在工作或等待处理时会明确提示不能休息。
- 点击 − 收起：收起态直接嵌入侧栏头部，完整迷你人物在左、任务摘要在右，卡片随侧栏宽度自动伸缩；不裁成圆形头像，不把气泡留在原悬浮位置。点人物或卡片右上角 ↗ 展开，收起卡片不显示 ×；展开后的任务气泡仍可关闭，新消息或状态提醒到来时恢复。侧栏没有可用位置时，退回可拖动的悬浮按钮。
- 点击任务气泡，触发宿主的 `onOpenTask`；× 临时关闭气泡，有新消息或任务状态提醒时再显示，重复快照不重复弹出。
- 外衣、体型、位置、收起和减少动画偏好保存在当前源的 localStorage；任务内容只在内存中。

## 接入 Web

```js
import { createPet } from './src/index.js';

const pet = createPet({
  theme: 'mint', // mint / peach / lilac
  size: 'medium', // mini (56px) / tiny (80px) / small / medium / large
  storageKey: 'dsh.my-pet',
  onOpenTask: ({ id }) => openTaskInYourApp(id),
});

pet.updateTask({
  id: 'task-123',
  status: 'working',
  title: '正在整理工作区',
  message: '正在检查待办事项。',
});

// 收到真实完成事件后再更新：
pet.updateTask({ id: 'task-123', status: 'success', title: '工作区已整理' });
// 用户处理完后移除，或统一清空：
pet.removeTask('task-123');
// 宿主卸载时清理：
pet.destroy();
```

插件故障时的降级与恢复见 [故障隔离说明](docs/FAILURE_ISOLATION.md)。

API、Vue/React 接入、Electron 示例和任务生命周期见 [完整接入说明](docs/GUIDE.md)。给宠物的性格、提醒规则和状态指导见 [豆沙指导说明](docs/PET_INSTRUCTIONS.md)。

## Electron 桌面悬浮窗

在已有 Electron 项目中引用 `electron/main.cjs`；独立试用先在本地安装 Electron：

```sh
npm install --no-save --package-lock=false electron
npm run demo:electron
```

演示会创建透明置顶窗口及托盘菜单。使用顶部「豆沙」拖动条移动窗口；收起后从托盘唤醒。托盘菜单可模拟任务。窗口不读取屏幕、文件或终端，也不发送网络请求。

Electron 桌面层需要在目标操作系统实际验收。Wayland 的窗口定位限制见 [Electron 官方文档](https://www.electronjs.org/docs/latest/api/browser-window#platform-notices)；必要时用 Xwayland/X11 运行。Web 模式只在页面内悬浮，跨应用悬浮由 Electron 模式提供。

## 验证与打包

```sh
npm test                # 状态机、并发任务、Electron 适配的模拟边界检查
npm run build           # 修改源码后重新构建 dsh 客户端；需先 npm install
npm run pack:check      # 查看 npm 包内容
npm pack               # 生成可交付的 .tgz
```

可选浏览器交互检查（先启动 `npm run dev`）：

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:browser
```

可以设置 `CHROME_PATH` 使用本机 Chrome，`DSH_DEMO_URL` 指定演示地址。截图输出到 `artifacts/`。本项目未发布到 npm，宿主可用本地路径或打包后的 tgz 安装。

结构：`src/` 是通用组件，`dsh/` 是 dsh 适配器，`lib/` 是已构建客户端，`electron/` 是桌面桥接，`demo/` 是交互展示，`examples/electron/` 是带托盘的启动示例。

代码采用 MIT License，详见 [LICENSE](LICENSE)；小音图集的授权范围见 [素材说明](assets/xiaoyin/README.md)。
