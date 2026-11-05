// Landing page interactions: receipts reel, lightbox, count-up, holo card,
// sticky CTA and reveal-on-scroll. Everything degrades to static content.
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hasIO = "IntersectionObserver" in window;

  /* ---------- receipts reel: duplicate each row once for a seamless loop ---------- */
  var tracks = document.querySelectorAll(".marquee__track");
  for (var t = 0; t < tracks.length; t++) {
    var track = tracks[t];
    var originals = Array.prototype.slice.call(track.children);
    originals.forEach(function (node) {
      var clone = node.cloneNode(true);
      clone.setAttribute("data-clone", "");
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("tabindex", "-1");
      track.appendChild(clone);
    });
  }

  /* ---------- lightbox ---------- */
  var lightbox = document.getElementById("lightbox");
  var lbImg = document.getElementById("lightbox-img");
  var lbCaption = document.getElementById("lightbox-caption");
  var slips = Array.prototype.slice.call(document.querySelectorAll(".slip:not([data-clone])"));
  var current = -1;

  function showSlip(index) {
    if (!slips.length) return;
    current = (index + slips.length) % slips.length;
    var slip = slips[current];
    var thumb = slip.querySelector("img");
    lbImg.src = slip.getAttribute("data-full");
    lbImg.alt = thumb ? thumb.alt : "";
    lbCaption.textContent = slip.getAttribute("data-caption") || "";
  }

  function openLightbox(index) {
    if (!lightbox || typeof lightbox.showModal !== "function") return;
    showSlip(index);
    if (!lightbox.open) lightbox.showModal();
    document.body.classList.add("scroll-locked");
  }

  if (lightbox) {
    document.addEventListener("click", function (event) {
      var slip = event.target.closest && event.target.closest(".slip");
      if (!slip) return;
      var full = slip.getAttribute("data-full");
      // Map clones back to their original so prev/next works from either copy.
      var index = -1;
      for (var i = 0; i < slips.length; i++) {
        if (slips[i].getAttribute("data-full") === full) index = i;
      }
      if (index >= 0) openLightbox(index);
    });

    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) lightbox.close();
    });
    lightbox.addEventListener("close", function () {
      document.body.classList.remove("scroll-locked");
      if (slips[current]) slips[current].focus({ preventScroll: true });
    });
    lightbox.addEventListener("keydown", function (event) {
      if (event.key === "ArrowRight") showSlip(current + 1);
      if (event.key === "ArrowLeft") showSlip(current - 1);
    });
    lightbox.querySelector("[data-lb-next]").addEventListener("click", function () {
      showSlip(current + 1);
    });
    lightbox.querySelector("[data-lb-prev]").addEventListener("click", function () {
      showSlip(current - 1);
    });
    lightbox.querySelector("[data-lb-close]").addEventListener("click", function () {
      lightbox.close();
    });
  }

  /* ---------- count-up ---------- */
  function countUp(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    var prefix = el.getAttribute("data-prefix") || "";
    if (!target || reduceMotion) return;
    var start = null;
    var duration = 1600;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(target * eased).toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(frame);
    }
    el.textContent = prefix + "0";
    requestAnimationFrame(frame);
  }

  /* ---------- reveal on scroll + count-up trigger ---------- */
  var reveals = document.querySelectorAll(".reveal");
  var counters = document.querySelectorAll("[data-count]");
  if (hasIO && !reduceMotion) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          var counter = entry.target.querySelector && entry.target.querySelector("[data-count]");
          if (counter && !counter.hasAttribute("data-counted")) {
            counter.setAttribute("data-counted", "");
            countUp(counter);
          }
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    for (var r = 0; r < reveals.length; r++) io.observe(reveals[r]);
  } else {
    for (var k = 0; k < reveals.length; k++) reveals[k].classList.add("is-in");
  }
  // Counters outside a .reveal block still show their final value (no animation).
  void counters;

  /* ---------- holo card tilt ---------- */
  var holo = document.querySelector("[data-holo]");
  if (holo && finePointer && !reduceMotion) {
    holo.addEventListener("pointermove", function (event) {
      var rect = holo.getBoundingClientRect();
      var mx = (event.clientX - rect.left) / rect.width;
      var my = (event.clientY - rect.top) / rect.height;
      holo.style.setProperty("--mx", mx.toFixed(3));
      holo.style.setProperty("--my", my.toFixed(3));
      holo.style.setProperty("--rx", ((0.5 - my) * 8).toFixed(2) + "deg");
      holo.style.setProperty("--ry", ((mx - 0.5) * 10).toFixed(2) + "deg");
      holo.style.setProperty("--prox", "1");
      holo.setAttribute("data-active", "true");
    });
    holo.addEventListener("pointerleave", function () {
      holo.style.setProperty("--rx", "0deg");
      holo.style.setProperty("--ry", "0deg");
      holo.style.setProperty("--prox", "0");
      holo.removeAttribute("data-active");
    });
  }

  /* ---------- sticky CTA (phones): show once the hero CTA scrolls away,
     hide again while the offer card or closing CTA is on screen ---------- */
  var sticky = document.getElementById("sticky-cta");
  var watched = ["hero-cta", "offer-cta", "closing-cta"]
    .map(function (id) {
      return document.getElementById(id);
    })
    .filter(Boolean);
  if (sticky && hasIO && watched.length) {
    var visible = {};
    var heroPassed = false;
    var stickyLink = sticky.querySelector("a");
    var update = function () {
      var anyOnScreen = watched.some(function (el) {
        return visible[el.id];
      });
      var show = heroPassed && !anyOnScreen;
      sticky.classList.toggle("is-visible", show);
      sticky.setAttribute("aria-hidden", show ? "false" : "true");
      if (stickyLink) stickyLink.setAttribute("tabindex", show ? "0" : "-1");
    };
    var stickyIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible[entry.target.id] = entry.isIntersecting;
        if (entry.target.id === "hero-cta") {
          heroPassed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        }
      });
      update();
    });
    watched.forEach(function (el) {
      stickyIO.observe(el);
    });
  }
})();
