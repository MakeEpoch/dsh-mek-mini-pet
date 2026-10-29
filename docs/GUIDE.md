# 豆沙接入指南

## 1. 日常操作

| 操作 | Web | Electron 桌面 |
| --- | --- | --- |
| 移动 | 拖动宠物身体或收起按钮；方向键微调 | 拖动顶部「豆沙」条；聚焦宠物后方向键微调 |
| 摸摸 | 点击身体或 ♡，只弹小爱心 | 同左 |
| 设置 | 宠物旁 ⚙；Esc 关闭 | 宠物旁 ⚙；Esc 关闭 |
| 收起 | − 变为可拖动的唤醒按钮 | − 隐藏窗口；宿主或托盘调用 show() 唤醒 |
| 查看任务 | 点击气泡，宿主处理回调；× 临时关闭提醒 | 同左，回调在主进程执行 |
| 休息 | 设置中「休息 / 唤醒」 | 同左 |

安装到 dsh Web 后，收起态内嵌在侧栏头部，完整迷你人物与相邻任务卡片参与正常布局，卡片宽度跟随侧栏伸缩，点人物或 ↗ 展开，收起卡片不显示 ×；找不到侧栏位置时回退到普通悬浮按钮。展开与卸载会恢复原有侧栏样式。

默认角色为豆沙。仍有 working/waiting/error 任务时不进入休息。新任务事件会唤醒休息状态，但不会擅自展开用户已收起的宠物。无声音、无系统通知权限请求；页面隐藏时暂停动画，并尊重系统减少动态效果设置。

安装到 DeepSeek dsh Web 请先看 [dsh 安装说明](DSH_INSTALL.md)。下面是通用 Web/Electron 组件的开发接入。

## 2. Web 安装

无需构建，可复制 `src/` 到 Web 静态资源目录，通过 `<script type="module">` 导入。必须通过 HTTP(S) 访问，不能直接双击 HTML。浏览器需支持 Custom Elements、Shadow DOM、ES Modules、Pointer Events 和 AbortController。

也可运行 `npm pack`，在宿主中 `npm install /absolute/path/dsh-mini-pet-0.4.3.tgz`，然后：

```js
import { createPet } from '@dsh/mini-pet/web';
const pet = createPet({ onOpenTask: ({ id }) => router.push(`/tasks/${encodeURIComponent(id)}`) });
```

只在客户端导入。本模块在加载时注册 Custom Element，SSR 项目应在挂载阶段动态导入。推荐挂到 `document.body`，避免祖先 transform、filter 或 overflow 影响 fixed 悬浮层。桌面宽度小于 268px 或可见高度小于宠物占用高度时，请使用宿主收起按钮。

### API

| 方法 / 选项 | 含义 |
| --- | --- |
| `createPet({ container, storageKey, theme, size, still, onOpenTask })` | 创建并挂载；container 默认 body |
| `pet.updateTask({ id, status, title?, message?, revision? })` | 按 id 新建/替换任务；省略文案使用默认值 |
| `pet.removeTask(id)` / `clearTasks()` | 移除已处理的任务 / 清空全部任务 |
| `pet.show()` / `hide()` | 展开 / 收起；不改任务状态 |
| `pet.configure({ character, theme, size, still, speed, interactions, showBubble, locked })` | 更新角色与偏好 |
| `pet.openSettings()` | 打开快捷设置面板 |
| `pet.element.preferences` | 当前偏好副本 |
| `pet.destroy()` | 移除节点，取消监听器和互动计时器 |
| `pet.element` | 原生 `<dsh-pet-v7>` 节点 |
| `pet.element.snapshot` | 当前状态及只读任务快照 |
| `pet.element.dismissBubble()` | 临时关闭气泡，有新任务更新时再显示 |
| `pet.element.pat()` / `sleep()` | 摸摸 / 切换休息 |
| `pet.element.setPosition(x, y)` / `resetPosition()` | 设置视口内坐标 / 右下角复位 |

角色：`dousha`（豆沙，矢量动画），theme 可改变豆沙的外衣颜色。speed 可选 0.75、1、1.25；interactions、showBubble、locked 分别控制摸摸、任务气泡和位置锁定。

主题：`mint`（鼠尾草）、`peach`（奶桃）、`lilac`（芋泥）。尺寸：`mini` 56px、`tiny` 80px、`small` 112px、`medium` 150px、`large` 186px，是角色区域高度；整组件包含气泡与工具条。`still: true` 暂停 CSS 动画。每个独立宠物实例请分配不同 `storageKey`。

底部工具栏在悬停或键盘聚焦时显示，移开后自动隐藏。关闭 interactions 后隐藏摸摸按钮，点击人物也不会产生互动反馈。摸摸只显示爱心，不切换角色动作；减少动画时爱心静态显示。

气泡 × 是临时关闭，重复的任务快照不会重新显示；状态、标题、消息或 revision 变化时恢复。宿主收到新的消息时可递增 revision，避免同一任务的相同文案无法触发提醒。临时关闭保留透明占位，防止角色上下挪动；showBubble=false 为整体关闭，更新不会覆盖此偏好。

通用 Web 宿主可向 createPet 传入 `onError(error)`：组件初始化、内部交互与动画发生异常时移除该实例并通知宿主。正常配置校验仍会抛错，调用方应处理非法输入。dsh 适配器额外隔离会话订阅、布局监听和异步导航，详见 [故障隔离说明](FAILURE_ISOLATION.md)。

事件：`dsh-pet:open-task` 的 `detail` 是当前任务快照；`dsh-pet:pat` 表示用户摸摸。`onOpenTask` 只是前一事件的便利封装。气泡中的任务标题与消息以 `textContent` 输出，不接受 HTML。

### Vue 3

```js
import { onMounted, onBeforeUnmount } from 'vue';
let pet, disposed = false;
onMounted(async () => {
  const { createPet } = await import('@dsh/mini-pet/web');
  if (!disposed) pet = createPet({ onOpenTask: task => console.log(task.id) });
});
onBeforeUnmount(() => { disposed = true; pet?.destroy(); });
```

建议在应用根组件统一挂载，避免路由切换时重复创建。

### React

```jsx
import { useEffect } from 'react';
export function PetMount() {
  useEffect(() => {
    let disposed = false, pet;
    import('@dsh/mini-pet/web').then(({ createPet }) => {
      if (!disposed) pet = createPet({ onOpenTask: ({ id }) => console.log(id) });
    });
    return () => { disposed = true; pet?.destroy(); };
  }, []);
  return null;
}
```

在实际集成中把实例保存到应用服务或 ref，并在卸载时注销宿主任务订阅。框架示例只演示生命周期；未在独立 Vue/React 应用运行验收。

## 3. 接入真实任务

| 宿主事件 | status | 宠物反应 |
| --- | --- | --- |
| 任务开始 / 进度更新 | working | 轻晃、忙碌小手 |
| 等待用户输入或确认 | waiting | 歪头、问号 |
| 任务确实成功结束 | success | 小跳、星星 |
| 收到失败事件 | error | 低头、错误色标 |
| 所有任务已移除 | 自动 idle | 呼吸、眨眼 |

优先级：**error > waiting > working > review/success > idle**。同级优先显示最近更新的任务。任务最多 100 个；宿主应在用户处理完结果后调用 removeTask，不应永久累积历史任务。成功态不会定时自动清除，避免用户回来时错过结果。review 用于运行停止但尚未确认业务结果的情形；success 仅供宿主明确确认成功时使用。Task id 是非空字符串，最多 128 字符；title 最多 100 字符，message 最多 180 字符；非法状态直接抛错，不改变已有状态。

```js
function onTaskEvent(event) {
  // 在你的事件总线上调用；这是适配示例，并非内置的 dsh 总线协议。
  const states = { started: 'working', progress: 'working', needs_input: 'waiting', completed: 'success', failed: 'error' };
  if (event.type === 'dismissed') return pet.removeTask(event.taskId);
  if (states[event.type]) pet.updateTask({ id: event.taskId, status: states[event.type], title: event.title, message: event.summary });
}
```

请使用可显示的摘要。不要传入密钥、令牌、私人路径或完整日志。摸摸和换色仅改变表现，不改变任何业务结果。插件本身没有 LLM、AI 聊天、任务执行、数据采集或后台自动读屏能力。

## 4. Electron 主进程

```js
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const { createDesktopPet } = require('@dsh/mini-pet/electron');
let pet;
app.whenReady().then(async () => {
  pet = createDesktopPet({ BrowserWindow, ipcMain, screen }, {
    theme: 'mint', size: 'medium',
    onOpenTask: ({ id }) => {
      // 定位并显示你自己的主窗口，再通知它打开 id 对应任务。
      console.log('open task', id);
    },
  });
  await pet.ready;
  pet.updateTask({ id: 'build', status: 'working', title: '构建中' });
});
app.on('before-quit', () => pet?.destroy());
```

主进程 API：`updateTask`、`removeTask`、`clearTasks`、`configure({ theme, size })`、`show`、`hide`、`destroy`，以及 `window` 和 `ready`。任务可以在 ready 前更新，renderer 就绪后会同步当前快照。主进程保存当前任务，renderer 不直接持有通用 IPC 能力。正式宿主必须提供托盘或菜单唤醒入口；完整托盘示例位于 `examples/electron/main.cjs`。创建后 await ready，以处理页面加载失败。

桌面位置当前仅保持到窗口关闭；再次启动在主屏右下角创建。Web 位置会保存。原生透明窗口的空白矩形区域仍接收输入，暂未实现逐像素鼠标穿透。原生移动使用顶部拖动条。多屏、透明、托盘行为需在 Windows/macOS/Linux 目标环境检查，Linux Wayland 可能限制窗口定位与置顶。桌面模式使用独立本地 HTML、预加载桥接、contextIsolation、sandbox，禁用 Node integration 和导航/弹窗；参考 [Electron 安全说明](https://www.electronjs.org/docs/latest/tutorial/security)。

## 5. 外观扩展与验收

修改 `src/art.js` 中的 SVG 可换角色，保留 `.creature`、`.eyes`、`.sleep-eyes`、`.mouth`、`.right-arm`、`.effect` 类名以复用动作。`src/styles.js` 定义各状态动画。无需图片服务或外部字体。若宿主有严格 CSP，当前组件的 shadow 内联样式需由宿主允许或按自身 nonce/adoptedStyleSheets 策略适配。

发布前执行 npm test 与浏览器交互检查；桌面版还需在目标系统验证启动、置顶、拖动、收起唤醒、多屏边界、点击任务返回宿主和退出后无残留进程。项目的模拟 Electron 测试不等于原生窗口验收。
