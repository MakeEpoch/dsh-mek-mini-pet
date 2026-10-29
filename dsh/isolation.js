/** A resource boundary owned by this plugin, never a global error handler. */
export function createIsolation(report = () => {}) {
  const disposers = [];
  let stopped = false;
  const notify = (phase, error) => { try { report(phase, error); } catch { /* Diagnostics cannot affect the host. */ } };
  const release = off => { try { off(); } catch (error) { notify('cleanup', error); } };
  const dispose = () => {
    if (stopped) return;
    stopped = true;
    while (disposers.length) release(disposers.pop());
  };
  const fail = (phase, error) => { if (stopped) return; dispose(); notify(phase, error); };
  return {
    get stopped() { return stopped; },
    own(off) { if (typeof off === 'function') { if (stopped) release(off); else disposers.push(off); } return off; },
    guard(phase, fn) {
      return (...args) => {
        if (stopped) return;
        try {
          const result = fn(...args);
          return result && typeof result.then === 'function' ? Promise.resolve(result).catch(error => fail(phase, error)) : result;
        } catch (error) { fail(phase, error); }
      };
    },
    fail, dispose
  };
}
