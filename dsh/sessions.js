/** Read existing public Client sources only; never retain/open history or call a model. */
export function watchSessions({ sessions, statuses, publish, onError }) {
  const bound = new Map(), previous = new Map(), reminders = new Set(), acknowledged = new Set(), messageRevisions = new Map();
  const removers = [];
  let disposed = false, reconciling = false, again = false;
  const release = off => { try { off(); } catch { /* Other subscriptions must still be released. */ } };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const off of removers) release(off);
    for (const item of bound.values()) release(item.off);
    bound.clear();
  };
  const guarded = fn => (...args) => {
    if (disposed) return;
    try { return fn(...args); }
    catch (error) {
      dispose();
      if (!onError) throw error;
      onError(error);
    }
  };
  const reconcile = guarded(() => {
    if (disposed) return;
    if (reconciling) { again = true; return; }
    reconciling = true;
    try {
      do {
        again = false;
        const list = sessions.list.getSnapshot();
        const statusMap = statuses.getSnapshot();
        const ids = new Set([...(list.ids ?? []), ...statusMap.keys()]);
        // Subscribe only to references already owned by the host UI.
        for (const [id, entry] of bound) {
          const binding = sessions.binding(id);
          if (!ids.has(id) || binding?.session !== entry.face || binding?.eventSource !== entry.events) { entry.off(); bound.delete(id); }
        }
        for (const id of ids) {
          const binding = sessions.binding(id), face = binding?.session;
          if (face && !bound.has(id)) {
            const events = binding.eventSource;
            let lastMessageKey;
            const offFace = face.subscribe(reconcile);
            let offEvents;
            try { offEvents = events?.subscribe(guarded(() => {
              const change = events.getSnapshot()?.change;
              if (!change) return;
              const entries = change.kind === 'append' ? change.entries : change.kind === 'settle-assistant' && change.entry ? [change.entry] : [];
              for (const { event } of entries) {
                let key;
                if (event?.type === 'assistant/live-chunk') key = `assistant:${event.data?.attemptId}`;
                if (event?.type === 'assistant/message') key = `assistant:${change.attemptId ?? event.data?.attemptId ?? event.seq}`;
                if (event?.type === 'user/message') key = `user:${event.seq}`;
                if (!key || key === lastMessageKey) continue;
                lastMessageKey = key;
                messageRevisions.set(id, (messageRevisions.get(id) ?? 0) + 1);
                reminders.add(id); acknowledged.delete(id);
              }
              reconcile();
            })); } catch (error) { release(offFace); throw error; }
            bound.set(id, { face, events, off: () => { release(offFace); if (offEvents) release(offEvents); } });
          }
        }
        const tasks = [];
        for (const id of ids) {
          const row = list.byId?.[id];
          if (row?.origin === 'subagent' || row?.parentId) continue;
          const status = statusMap.get(id);
          const running = status?.running; // Undefined stays unknown.
          const snapshot = bound.get(id)?.face.getSnapshot();
          const error = snapshot?.lastAgentError || snapshot?.promptError || snapshot?.openState === 'error';
          if (running === true) { reminders.delete(id); acknowledged.delete(id); }
          if (running === false && previous.get(id) === true) reminders.add(id);
          if (typeof running === 'boolean') previous.set(id, running);
          let state, message;
          if (error) { state = 'error'; message = '会话报告了问题，点击查看具体原因。'; }
          else if (status?.pendingInteraction) { state = 'waiting'; message = '有一项输入或确认需要你处理，点击查看。'; }
          else if (running === true) { state = 'working'; message = 'dsh 正在运行这个会话。'; }
          else if ((reminders.has(id) || status?.completionUnread) && !acknowledged.has(id)) { state = 'review'; message = '这轮运行已结束，点击查看结果。'; }
          if (state) tasks.push({ id, status: state, title: row?.displayTitle || row?.title || 'dsh 会话', message,
            revision: `${row?.updatedAt ?? ''}:${messageRevisions.get(id) ?? 0}` });
        }
        for (const id of new Set([...previous.keys(), ...messageRevisions.keys()])) if (!ids.has(id)) { previous.delete(id); reminders.delete(id); acknowledged.delete(id); messageRevisions.delete(id); }
        const priority = { error: 4, waiting: 3, working: 2, review: 1 };
        // Keep the bounded pet model useful even with a very large session catalog.
        tasks.sort((a, b) => priority[b.status] - priority[a.status]);
        publish(tasks.slice(0, 100));
      } while (again && !disposed);
    } finally { reconciling = false; }
  });
  try {
    removers.push(sessions.list.subscribe(reconcile));
    removers.push(statuses.subscribe(reconcile));
    reconcile();
  } catch (error) {
    dispose();
    if (!onError) throw error;
    onError(error);
  }
  return {
    acknowledge(id) { acknowledged.add(id); reminders.delete(id); reconcile(); },
    dispose
  };
}
