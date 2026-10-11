/* 日志页：发帖 + 日记列表，localStorage 持久化（最新在前） */
(function () {
  "use strict";

  var KEY = "arizone-diary-v1";
  var MAP_KEY = "diary_entries"; // Travel 地图旗子日记（由 travel-map.js 写入）
  var list = document.getElementById("diary-list");
  var textEl = document.getElementById("diary-text");
  var weatherEl = document.getElementById("diary-weather");
  var placeEl = document.getElementById("diary-place");
  var imageEl = document.getElementById("diary-image");
  var fileNameEl = document.getElementById("diary-file-name");
  var sendBtn = document.getElementById("diary-send");
  if (!list || !textEl || !sendBtn) return;

  var pendingImage = null; // 上传图片的 dataURL

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw === null) {
        // 首次访问：放入一条示例日记
        return [
          {
            ts: new Date(2026, 9, 11).getTime(),
            text: "这是一个日记本 test^^",
            weather: "☀️",
            place: "家",
            img: null,
          },
        ];
      }
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function loadMapEntries() {
    try {
      var arr = JSON.parse(localStorage.getItem(MAP_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function save(arr) {
    try {
      localStorage.setItem(KEY, JSON.stringify(arr));
      return true;
    } catch (e) {
      return false; // 多为存图片超出本地存储配额
    }
  }

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function fmtDate(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  // 上传图片压缩到最长边 800px，避免撑爆 localStorage
  function fileToDataUrl(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 800;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        cb(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function makeCard(entry) {
    var card = document.createElement("article");
    card.className = "diary-card";

    var head = document.createElement("div");
    head.className = "diary-card__head";
    var date = document.createElement("time");
    date.textContent = fmtDate(entry.ts);
    var weather = document.createElement("span");
    weather.className = "diary-card__weather";
    weather.textContent = entry.weather || "";
    head.appendChild(date);
    head.appendChild(weather);

    card.appendChild(head);

    if (entry.place) {
      var place = document.createElement("p");
      place.className = "diary-card__place";
      place.textContent = "📍 " + entry.place;
      card.appendChild(place);
    }

    if (entry.title) {
      var ttl = document.createElement("h3");
      ttl.className = "diary-card__title";
      ttl.textContent = entry.title; // textContent 防 XSS
      card.appendChild(ttl);
    }

    if (entry.text) {
      var text = document.createElement("p");
      text.className = "diary-card__text";
      text.textContent = entry.text; // textContent 防 XSS
      card.appendChild(text);
    }

    // 本页日记是单图 img，地图日记是多图 images，统一成数组渲染
    var imgs = entry.images || (entry.img ? [entry.img] : []);
    imgs.forEach(function (src) {
      if (!src) return;
      var img = document.createElement("img");
      img.className = "diary-card__img";
      img.src = src;
      img.alt = "日记图片";
      card.appendChild(img);
    });

    return card;
  }

  function render() {
    var arr = load().concat(loadMapEntries()); // 本页日记 + 地图旗子日记
    arr.sort(function (a, b) {
      return b.ts - a.ts; // 最新在最前
    });
    list.innerHTML = "";
    if (!arr.length) {
      var empty = document.createElement("p");
      empty.className = "diary-empty";
      empty.textContent = "还没有日记，写第一篇吧 ♪";
      list.appendChild(empty);
      return;
    }
    arr.forEach(function (entry) {
      list.appendChild(makeCard(entry));
    });
  }

  function send() {
    var text = textEl.value.trim();
    var place = placeEl.value.trim();
    if (!text && !pendingImage) {
      textEl.focus();
      return;
    }
    var entry = {
      ts: Date.now(),
      text: text,
      weather: weatherEl ? weatherEl.value : "",
      place: place,
      img: pendingImage,
    };
    var arr = load();
    arr.unshift(entry); // 新的排最前
    if (!save(arr)) {
      entry.img = null; // 存不下时先尝试丢图
      if (!save(arr)) {
        alert("保存失败：本地存储空间不足，请删掉几张带图的日记再试");
        return;
      }
      fileNameEl.textContent = "（图片太大未能保存，文字已发表）";
    }
    pendingImage = null;
    imageEl.value = "";
    fileNameEl.textContent = "";
    textEl.value = "";
    placeEl.value = "";
    render();
  }

  sendBtn.addEventListener("click", send);
  textEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send();
    }
  });

  imageEl.addEventListener("change", function () {
    var file = imageEl.files && imageEl.files[0];
    if (!file) return;
    fileNameEl.textContent = "处理中…";
    fileToDataUrl(file, function (dataUrl) {
      pendingImage = dataUrl;
      fileNameEl.textContent = "已选图片：" + file.name;
    });
  });

  render();
})();
