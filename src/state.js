export const STATES = Object.freeze({
  idle: { label: '待命中', message: '你忙你的，我在这里。' },
  working: { label: '专心工作', message: '正在努力，稍等一下下。' },
  waiting: { label: '需要你看看', message: '有件事，想请你决定。' },
  success: { label: '已完成', message: '这件事做好啦，来看看吧。' },
  review: { label: '可以查看', message: '这轮运行已结束，点击查看结果。' },
  error: { label: '遇到问题', message: '遇到一点问题，一起看看？' },
  sleeping: { label: '休息中', message: '呼……有事再叫我。' }
});

const priorities = { error: 4, waiting: 3, working: 2, success: 1, review: 1 };
export class PetState {
  #tasks = new Map();
  #sequence = 0;
  update(task) {
    if (!task || typeof task.id !== 'string' || !task.id.trim() || task.id.length > 128)
      throw new TypeError('task.id must be a non-empty string, at most 128 characters');
    if (!Object.hasOwn(priorities, task.status)) throw new TypeError('Unknown task.status');
    if (this.#tasks.size >= 100 && !this.#tasks.has(task.id)) throw new RangeError('Clear old tasks before adding more than 100 tasks');
    const next = Object.freeze({ id: task.id, status: task.status,
      title: String(task.title ?? '当前任务').slice(0, 100),
      message: String(task.message ?? STATES[task.status].message).slice(0, 180),
      revision: String(task.revision ?? '').slice(0, 128),
      sequence: ++this.#sequence });
    this.#tasks.set(task.id, next);
    return this.snapshot();
  }
  remove(id) { this.#tasks.delete(id); return this.snapshot(); }
  clear() { this.#tasks.clear(); return this.snapshot(); }
  snapshot() {
    const tasks = [...this.#tasks.values()].sort((a, b) => priorities[b.status] - priorities[a.status] || b.sequence - a.sequence);
    return { status: tasks[0]?.status ?? 'idle', task: tasks[0] ?? null, tasks };
  }
}

export function clampPosition(position, viewport, size) {
  return {
    x: Math.round(Math.max(0, Math.min(Number.isFinite(position?.x) ? position.x : viewport.width - size.width - 24, Math.max(0, viewport.width - size.width)))),
    y: Math.round(Math.max(0, Math.min(Number.isFinite(position?.y) ? position.y : viewport.height - size.height - 24, Math.max(0, viewport.height - size.height))))
  };
}
