// Whop embedded checkout (full Checkout Element) for the 2-Day Pass.
// Docs: https://docs.whop.com/elements/beta/checkout/overview
(function () {
  "use strict";

  var PLAN_ID = "plan_rFD30uR1jYf1w"; // 2-Day Pass — $9.99
  var HOSTED_CHECKOUT_URL = "https://whop.com/checkout/" + PLAN_ID;
  var SDK_WAIT_MS = 12000;

  var trigger = document.getElementById("get-access");
  var dialog = document.getElementById("checkout-dialog");
  var loadingEl = document.getElementById("checkout-loading");
  var errorEl = document.getElementById("checkout-error");
  var mountEl = document.getElementById("whop-checkout");

  if (!trigger || !dialog || typeof dialog.showModal !== "function") {
    // Very old browser: leave the plain link to Whop's hosted checkout in place.
    return;
  }

  // One checkout session for the life of the page. The plan never changes, so
  // closing and reopening the dialog shows the same session (entered details and
  // any in-progress payment step are kept) instead of minting a new one.
  var checkout = null;
  var state = "idle"; // idle | loading | ready | failed

  function show(el, visible) {
    el.hidden = !visible;
  }

  function showLoading() {
    show(loadingEl, true);
    show(errorEl, false);
  }

  function showReady() {
    show(loadingEl, false);
    show(errorEl, false);
  }

  function showError() {
    show(loadingEl, false);
    show(errorEl, true);
  }

  function waitForSdk(timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (typeof window.WhopElements === "function") return resolve(window.WhopElements);
      var started = Date.now();
      var timer = setInterval(function () {
        if (typeof window.WhopElements === "function") {
          clearInterval(timer);
          resolve(window.WhopElements);
        } else if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          reject(new Error("Whop Elements script did not load"));
        }
      }, 100);
    });
  }

  // Where the buyer lands after an off-site bank step (3DS etc.). Only set on a
  // real https origin (or localhost) — Whop requires https here.
  function returnUrl() {
    var loc = window.location;
    var isLocal = loc.hostname === "localhost" || loc.hostname === "127.0.0.1";
    if (loc.protocol !== "https:" && !(isLocal && loc.protocol === "http:")) return undefined;
    return new URL("thanks.html", loc.href).href;
  }

  function startCheckout() {
    if (state === "loading" || state === "ready") return;
    state = "loading";
    showLoading();

    waitForSdk(SDK_WAIT_MS)
      .then(function (WhopElements) {
        var whop = WhopElements({
          appearance: {
            theme: { appearance: "dark", accentColor: "violet", grayColor: "mauve" },
            variables: { "--radius": "8px" },
            classes: {
              "whop-CheckoutPayButton": {
                backgroundColor: "#8b84c4",
                borderColor: "#8b84c4",
                color: "#0b0a14",
              },
            },
          },
        });

        var options = {
          plan: PLAN_ID,
          onComplete: function (result) {
            // Fires before any returnUrl navigation and can repeat when a session is
            // restored. Put analytics/pixels here, deduplicated by result.paymentId.
            // Do NOT fulfil from here — fulfil from Whop webhooks.
            document.dispatchEvent(new CustomEvent("aia:checkout-complete", { detail: result }));
          },
        };
        var url = returnUrl();
        if (url) options.returnUrl = url;

        checkout = whop.checkout.create(options);

        var element = checkout.create("checkout", {
          onReady: function () {
            state = "ready";
            showReady();
          },
          onError: function (e) {
            // The element keeps its own fallback visible for in-flow errors; only
            // swap to our fallback if it never finished loading.
            if (state !== "ready") {
              state = "failed";
              showError();
            }
            if (window.console) console.warn("[whop checkout]", e && (e.code || e.message));
          },
        });
        element.mount(mountEl);
      })
      .catch(function (err) {
        state = "failed";
        showError();
        if (window.console) console.warn("[whop checkout]", err && err.message);
      });
  }

  function openDialog() {
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("scroll-locked");
    if (state === "failed") {
      // Let the buyer retry a failed load: tear down any half-built handle first.
      if (checkout) {
        try {
          checkout.destroy();
        } catch (_) {}
        checkout = null;
      }
      mountEl.innerHTML = "";
      state = "idle";
    }
    startCheckout();
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  trigger.addEventListener("click", function (event) {
    // Modifier-clicks keep the normal "open Whop checkout in a new tab" behaviour.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    openDialog();
  });

  dialog.addEventListener("close", function () {
    document.body.classList.remove("scroll-locked");
  });

  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) closeDialog(); // backdrop click
  });

  var closeBtn = dialog.querySelector("[data-close]");
  if (closeBtn) closeBtn.addEventListener("click", closeDialog);

  // Fallback link target in case the markup above is edited.
  trigger.setAttribute("href", HOSTED_CHECKOUT_URL);
})();
