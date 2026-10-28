function (token) {
  'use strict';
  if (window.top !== window) return;
  if (window.__samee3AndroidCleanup) window.__samee3AndroidCleanup();
  var port = null, sequence = 0, pending = {};
  function cleanup() {
    window.removeEventListener('message', connect);
    if (port) port.close();
    Object.keys(pending).forEach(function (id) {
      clearTimeout(pending[id].timer);
      pending[id].reject(new Error('انقطع الاتصال بالتطبيق. أعد فتح الصفحة.'));
    });
    pending = {};
    delete window.Samee3Android;
  }
  function request(type, payload) {
    return new Promise(function (resolve, reject) {
      if (!port) return reject(new Error('الاتصال بأندرويد غير جاهز.'));
      var id = 'r' + (++sequence) + '_' + Date.now();
      var timer = setTimeout(function () {
        delete pending[id]; reject(new Error('انتهت مهلة الطلب. أعد المحاولة.'));
      }, type === 'permission' ? 120000 : 20000);
      pending[id] = { resolve: resolve, reject: reject, timer: timer };
      port.postMessage(JSON.stringify({ id: id, type: type, payload: payload || {} }));
    });
  }
  function connect(event) {
    if (event.data !== token || !event.ports || event.ports.length !== 1) return;
    window.removeEventListener('message', connect);
    port = event.ports[0];
    port.onmessage = function (event) {
      try {
        var result = JSON.parse(event.data), item = pending[result.id];
        if (!item) return;
        clearTimeout(item.timer); delete pending[result.id];
        result.ok ? item.resolve(result.data) : item.reject(new Error(result.error || 'تعذر تنفيذ الطلب.'));
      } catch (_) {}
    };
    port.start();
    Object.defineProperty(window, 'Samee3Android', { configurable: true, value: { request: request } });
    window.dispatchEvent(new Event('samee3:android-ready'));
  }
  window.addEventListener('message', connect);
  window.__samee3AndroidCleanup = cleanup;
}
