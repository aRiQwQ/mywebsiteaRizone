/* 首页：欢迎区与第二区域的显示切换（单页内切换，不跳转） */
(function () {
  "use strict";

  var welcome = document.getElementById("home-welcome");
  var second = document.getElementById("home-second");
  if (!welcome || !second) return;

  var banner = welcome.querySelector(".home-banner");
  if (!banner) return;

  function showSecond() {
    welcome.classList.add("is-hidden");
    second.classList.remove("is-hidden");
  }

  function showWelcome() {
    second.classList.add("is-hidden");
    welcome.classList.remove("is-hidden");
  }

  banner.addEventListener("click", showSecond);
  banner.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      showSecond();
    }
  });
  second.addEventListener("click", showWelcome);
})();
