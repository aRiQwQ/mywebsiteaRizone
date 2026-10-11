/* 留言本：聊天窗口式留言列表，localStorage 持久化 */
(function () {
  "use strict";

  var list = document.getElementById("chat-list");
  var input = document.getElementById("chat-text");
  var sendBtn = document.getElementById("chat-send");
  if (!list || !input || !sendBtn) return;

  var STORAGE_KEY = "arizone-guestbook-v1";
  var MAX_LEN = 200;

  function load() {
    try {
      var arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function save(arr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      /* 存储失败时仅本次会话可见 */
    }
  }

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function fmtTime(ts) {
    var d = new Date(ts);
    return (
      d.getMonth() + 1 + "-" + pad(d.getDate()) + " " +
      pad(d.getHours()) + ":" + pad(d.getMinutes())
    );
  }

  function render() {
    var arr = load();
    list.innerHTML = "";
    arr.forEach(function (m) {
      var li = document.createElement("li");
      var time = document.createElement("time");
      time.textContent = fmtTime(m.ts);
      var msg = document.createElement("span");
      msg.className = "chat-msg";
      msg.textContent = m.text; // textContent 防 XSS
      li.appendChild(time);
      li.appendChild(msg);
      list.appendChild(li);
    });
    // 最新留言在最下面，渲染后滚到底部
    list.scrollTop = list.scrollHeight;
  }

  function send() {
    var text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }
    var arr = load();
    arr.push({ text: text.slice(0, MAX_LEN), ts: Date.now() });
    save(arr);
    input.value = "";
    render();
    input.focus();
  }

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  });

  render();
})();
