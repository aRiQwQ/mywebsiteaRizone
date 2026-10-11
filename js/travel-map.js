/* Travel 世界地图：悬停 1.5 秒缓放 3 倍（以鼠标为中心），移开缓恢复，放大后可拖动，双击插旗 */
(function () {
  "use strict";

  var box = document.getElementById("world-map");
  var inner = document.getElementById("world-map-inner");
  if (!box || !inner) return;

  var ZOOM = 3;        // 放大倍数
  var HOVER_MS = 1500; // 悬停触发时长
  var EASE = 0.07;     // 缓动系数（越小越慢）

  var scale = 1, tx = 0, ty = 0;       // 当前值
  var tScale = 1, tTx = 0, tTy = 0;    // 目标值（缓慢逼近）
  var zoomed = false;                  // 是否处于放大状态
  var hoverTimer = null;
  var rafId = null;

  var dragging = false;
  var dragX = 0, dragY = 0, startTx = 0, startTy = 0;

  function measure() {
    // object-fit: cover，元素盒即可视范围
    return {
      w: box.clientWidth,
      h: box.clientHeight,
    };
  }

  // 平移钳制：不让地图边缘露底
  function clamp(v, min, max) {
    return Math.min(0, Math.max(min, v));
  }

  function clampTargets() {
    var m = measure();
    tTx = clamp(tTx, m.w * (1 - tScale), 0);
    tTy = clamp(tTy, m.h * (1 - tScale), 0);
    tx = clamp(tx, m.w * (1 - scale), 0);
    ty = clamp(ty, m.h * (1 - scale), 0);
  }

  function apply() {
    inner.style.transform =
      "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
  }

  function ensureAnim() {
    if (rafId !== null) return;
    function step() {
      var active = false;
      if (Math.abs(tScale - scale) > 0.0004) {
        scale += (tScale - scale) * EASE;
        active = true;
      } else {
        scale = tScale;
      }
      if (Math.abs(tTx - tx) > 0.25) {
        tx += (tTx - tx) * EASE;
        active = true;
      } else {
        tx = tTx;
      }
      if (Math.abs(tTy - ty) > 0.25) {
        ty += (tTy - ty) * EASE;
        active = true;
      } else {
        ty = tTy;
      }
      clampTargets();
      apply();
      rafId = active ? requestAnimationFrame(step) : null;
    }
    rafId = requestAnimationFrame(step);
  }

  function clearHover() {
    if (hoverTimer !== null) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  }

  function resetView() {
    zoomed = false;
    dragging = false;
    clearHover();
    tScale = 1;
    tTx = 0;
    tTy = 0;
    box.classList.remove("is-zoomed", "is-dragging");
    ensureAnim();
  }

  box.addEventListener("mousemove", function (e) {
    if (zoomed) {
      clearHover(); // 放大状态下不再触发悬停放大，拖动由 drag 处理
      return;
    }
    var r = box.getBoundingClientRect();
    var mx = e.clientX - r.left;
    var my = e.clientY - r.top;
    clearHover();
    hoverTimer = setTimeout(function () {
      hoverTimer = null;
      zoomed = true;
      tScale = ZOOM;
      // 以鼠标点为锚：缩放前后该点在屏幕上的位置不变
      tTx = mx - (ZOOM * (mx - tx)) / scale;
      tTy = my - (ZOOM * (my - ty)) / scale;
      clampTargets();
      box.classList.add("is-zoomed");
      ensureAnim();
    }, HOVER_MS);
  });

  box.addEventListener("mouseleave", resetView);

  // 放大后拖动
  box.addEventListener("mousedown", function (e) {
    if (!zoomed) return;
    e.preventDefault();
    dragging = true;
    dragX = e.clientX;
    dragY = e.clientY;
    startTx = tx;
    startTy = ty;
    box.classList.add("is-dragging");
  });

  window.addEventListener("mousemove", function (e) {
    if (!dragging) return;
    tx = startTx + (e.clientX - dragX);
    ty = startTy + (e.clientY - dragY);
    tTx = tx;
    tTy = ty;
    clampTargets();
    apply();
  });

  window.addEventListener("mouseup", function () {
    if (!dragging) return;
    dragging = false;
    box.classList.remove("is-dragging");
  });

  /* —— 旗子日志：建旗 / 持久化 —— */
  var STORE_KEY = "arizone-travel-flags-v1";
  var DIARY_KEY = "diary_entries"; // 与日志页共享的汇总存储

  function newFlagId() {
    return (
      "flag-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7)
    );
  }

  // 建旗（百分比坐标）：双击插旗和启动恢复共用；点击旗子打开日志编辑
  function createFlag(xPct, yPct, data) {
    var flag = document.createElement("span");
    flag.className = "world-map__flag";
    flag.textContent = "🚩";
    flag.style.left = xPct + "%";
    flag.style.top = yPct + "%";
    flag._data = data || { title: "", text: "", images: [] };
    if (!flag._data.id) flag._data.id = newFlagId(); // 旗子唯一 id，同步日志时去重用
    flag.addEventListener("dblclick", function (e) {
      e.stopPropagation(); // 旗子上双击不再插新旗
    });
    flag.addEventListener("click", function (e) {
      e.stopPropagation();
      openEditor(flag);
    });
    inner.appendChild(flag);
    return flag;
  }

  // 所有旗子的位置和日志写入 localStorage
  function saveFlags() {
    try {
      var flags = [];
      inner.querySelectorAll(".world-map__flag").forEach(function (el) {
        flags.push({
          id: el._data.id,
          x: parseFloat(el.style.left) || 0,
          y: parseFloat(el.style.top) || 0,
          title: el._data.title,
          text: el._data.text,
          images: el._data.images
        });
      });
      localStorage.setItem(STORE_KEY, JSON.stringify(flags));
    } catch (err) {
      console.warn("[travel-map] 日志保存失败（可能超出 localStorage 容量）", err);
    }
  }

  function loadFlags() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "[]") || [];
    } catch (err) {
      return [];
    }
  }

  // 启动时恢复上次插的旗和日志
  loadFlags().forEach(function (item) {
    if (item && typeof item.x === "number" && typeof item.y === "number") {
      createFlag(item.x, item.y, {
        id: item.id,
        title: item.title || "",
        text: item.text || "",
        images: item.images || []
      });
    }
  });

  // 地图日记同步到日志页：写入共享键 diary_entries。
  // 同一面旗反复保存时按 id 更新同一条，不会越攒越多
  function syncToDiary(flag) {
    try {
      var arr = [];
      try {
        var raw = JSON.parse(localStorage.getItem(DIARY_KEY) || "[]");
        if (Array.isArray(raw)) arr = raw;
      } catch (e) {}
      var entry = {
        id: flag._data.id,
        ts: Date.now(),
        title: flag._data.title,
        text: flag._data.text,
        images: flag._data.images.slice(),
        weather: "",
        place:
          "世界地图 · " +
          (parseFloat(flag.style.left) || 0).toFixed(1) + "%, " +
          (parseFloat(flag.style.top) || 0).toFixed(1) + "%",
        source: "map"
      };
      var found = false;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].id === flag._data.id) {
          arr[i] = entry;
          found = true;
          break;
        }
      }
      if (!found) arr.push(entry);
      localStorage.setItem(DIARY_KEY, JSON.stringify(arr));
    } catch (err) {
      console.warn("[travel-map] 同步到日志页失败", err);
    }
  }

  // 双击插旗：屏幕坐标 → 地图坐标系百分比；旗子随容器缩放平移，不会漂移
  box.addEventListener("dblclick", function (e) {
    var m = measure();
    var r = box.getBoundingClientRect();
    var px = (e.clientX - r.left - tx) / scale; // 地图坐标系下的点
    var py = (e.clientY - r.top - ty) / scale;
    // 越界不丢弃，钳到地图边缘
    px = Math.min(m.w, Math.max(0, px));
    py = Math.min(m.h, Math.max(0, py));
    createFlag((px / m.w) * 100, (py / m.h) * 100);
    saveFlags();
  });

  /* —— 旗子日志编辑弹窗 —— */
  var backdrop = document.getElementById("flag-editor");
  var viewSec = document.getElementById("flag-view");
  var viewTitle = document.getElementById("flag-view-title");
  var viewText = document.getElementById("flag-view-text");
  var viewThumbs = document.getElementById("flag-view-thumbs");
  var editBtn = document.getElementById("flag-edit-btn");
  var editSec = document.getElementById("flag-edit-form");
  var titleEl = document.getElementById("flag-title");
  var textEl = document.getElementById("flag-text");
  var imagesEl = document.getElementById("flag-images");
  var thumbsEl = document.getElementById("flag-thumbs");
  var saveEl = document.getElementById("flag-save");
  var closeEl = document.getElementById("flag-close");

  // 编辑状态与弹窗函数放在 IIFE 顶层（之前嵌在 if 块里，
  // 块级函数声明导致旗子点击时取不到 → openEditor is not defined）
  var currentFlag = null; // 正在编辑的旗子
  var draftImages = [];   // 编辑中的图片草稿

  // 打开弹窗：保存过内容 → 查看态；没保存过（新插旗）→ 直接进编辑态
  function openEditor(flag) {
    if (!backdrop || !titleEl) return;
    currentFlag = flag;
    var d = flag._data;
    if (d.title || d.text || d.images.length) {
      showView(d);
    } else {
      showEdit();
    }
    backdrop.hidden = false;
  }

  // 查看态：只读展示标题/正文/图片，点"编辑"进入编辑态
  function showView(d) {
    viewTitle.textContent = d.title || "旅行日志";
    viewText.textContent = d.text || "";
    viewText.hidden = !d.text;
    viewThumbs.innerHTML = "";
    viewThumbs.hidden = !d.images.length;
    d.images.forEach(function (src) {
      var img = document.createElement("img");
      img.src = src;
      img.alt = "日志图片";
      viewThumbs.appendChild(img);
    });
    viewSec.hidden = false;
    editSec.hidden = true;
  }

  // 编辑态：可改标题/正文/图片
  function showEdit() {
    titleEl.value = currentFlag._data.title;
    textEl.value = currentFlag._data.text;
    draftImages = currentFlag._data.images.slice();
    renderThumbs();
    viewSec.hidden = true;
    editSec.hidden = false;
    titleEl.focus();
  }

  function closeEditor() {
    if (!backdrop || !imagesEl) return;
    backdrop.hidden = true;
    currentFlag = null;
    draftImages = [];
    imagesEl.value = "";
  }

    function renderThumbs() {
      thumbsEl.innerHTML = "";
      draftImages.forEach(function (src, i) {
        var wrap = document.createElement("span");
        wrap.className = "flag-editor__thumb";
        var img = document.createElement("img");
        img.src = src;
        img.alt = "日志图片";
        var rm = document.createElement("button");
        rm.type = "button";
        rm.textContent = "×";
        rm.setAttribute("aria-label", "删除图片");
        rm.addEventListener("click", function () {
          draftImages.splice(i, 1);
          renderThumbs();
        });
        wrap.appendChild(img);
        wrap.appendChild(rm);
        thumbsEl.appendChild(wrap);
      });
    }

    // 图片压缩到最长边 800px，避免多图卡内存
    function compress(file) {
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            var max = 800;
            var s = Math.min(1, max / Math.max(img.width, img.height));
            var c = document.createElement("canvas");
            c.width = Math.max(1, Math.round(img.width * s));
            c.height = Math.max(1, Math.round(img.height * s));
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL("image/jpeg", 0.82));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    imagesEl.addEventListener("change", function () {
      var files = Array.prototype.slice.call(imagesEl.files || []);
      if (!files.length) return;
      Promise.all(files.map(compress)).then(function (urls) {
        draftImages = draftImages.concat(urls);
        renderThumbs();
        imagesEl.value = "";
      });
    });

    saveEl.addEventListener("click", function () {
      if (!currentFlag) return;
      currentFlag._data.title = titleEl.value.trim();
      currentFlag._data.text = textEl.value;
      currentFlag._data.images = draftImages.slice();
      syncToDiary(currentFlag); // 同步到日志页汇总（diary_entries）
      closeEditor();
      saveFlags(); // 写入 localStorage，刷新不丢
      resetView(); // 保存后弹窗关闭，地图恢复原始大小
    });

    editBtn.addEventListener("click", function () {
      showEdit();
    });

    closeEl.addEventListener("click", closeEditor);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) closeEditor();
    });
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !backdrop.hidden) closeEditor();
    });

  /* —— 使用说明弹窗 —— */
  var helpBtn = document.getElementById("map-help-btn");
  var helpPop = document.getElementById("map-help");
  var helpCloseBtn = document.getElementById("map-help-close");
  if (helpBtn && helpPop && helpCloseBtn) {
    helpBtn.addEventListener("click", function () {
      helpPop.hidden = false;
      helpBtn.classList.remove("is-wiggling"); // 弹窗出现后问号停止晃动
    });
    // 关闭规则：只认"关闭"按钮；遮罩点击 / Esc 都不关闭
    helpCloseBtn.addEventListener("click", function () {
      helpPop.hidden = true;
    });
  }

  window.addEventListener("resize", function () {
    clampTargets();
    apply();
  });
})();
