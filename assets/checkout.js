// Whop embedded checkout (full Checkout Element) for every pass sold on this page.
// Docs: https://docs.whop.com/elements/beta/checkout/overview
//
// Any link with data-checkout opens the checkout dialog. data-checkout="plan_…"
// picks the plan; an empty data-checkout means the 2-Day Pass. Each link's href is
// Whop's hosted checkout for that plan, which is what you get without JavaScript.
(function () {
  "use strict";

  var PLANS = {
    plan_rFD30uR1jYf1w: { name: "2-Day Pass", item: "premium" }, // $9.99 for 2 days, then $49.99/mo
    plan_Tgd2zkJOW7NKc: { name: "FIFA Premium Pass", item: "fifa" }, // $99.99 one-time
  };
  var DEFAULT_PLAN = "plan_rFD30uR1jYf1w";
  var SDK_WAIT_MS = 12000;

  var triggers = document.querySelectorAll("[data-checkout]");
  var dialog = document.getElementById("checkout-dialog");
  var titleEl = document.getElementById("checkout-title");
  var loadingEl = document.getElementById("checkout-loading");
  var errorEl = document.getElementById("checkout-error");
  var errorLink = errorEl ? errorEl.querySelector("a") : null;
  var mountEl = document.getElementById("whop-checkout");

  function hostedUrl(plan) {
    return "https://whop.com/checkout/" + plan;
  }

  function planFor(el) {
    var plan = el.getAttribute("data-checkout");
    return PLANS[plan] ? plan : DEFAULT_PLAN;
  }

  // Keep every fallback href pointing at the right plan.
  for (var i = 0; i < triggers.length; i++) {
    triggers[i].setAttribute("href", hostedUrl(planFor(triggers[i])));
  }

  if (!triggers.length || !dialog || typeof dialog.showModal !== "function") {
    // Very old browser: the plain links to Whop's hosted checkout stay in charge.
    return;
  }

  // One live checkout at a time. Reopening the same pass reuses its session, so
  // entered details and any in-progress bank step survive closing the dialog.
  // Picking a different pass destroys that session and starts a new one; the
  // generation counter makes callbacks from a replaced session do nothing.
  var whop = null;
  var current = null; // { plan, handle, state: "loading" | "ready" | "failed" }
  var generation = 0;

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

  // Where the buyer lands after checkout / an off-site bank step (3DS etc.).
  // Root-absolute so it works whether this page is served at "/" or at Whop's
  // "/experiences/exp_…" path; ?item= tells the thank-you page which pass it was.
  // Only set on https (or localhost): Whop requires it.
  function returnUrl(plan) {
    var loc = window.location;
    var isLocal = loc.hostname === "localhost" || loc.hostname === "127.0.0.1";
    if (loc.protocol !== "https:" && !(isLocal && loc.protocol === "http:")) return undefined;
    return loc.origin + "/thanks.html?item=" + PLANS[plan].item;
  }

  function teardown() {
    generation++;
    if (current && current.handle) {
      try {
        current.handle.destroy();
      } catch (_) {}
    }
    current = null;
    mountEl.innerHTML = "";
  }

  function startCheckout(plan) {
    if (current && current.plan === plan && current.state !== "failed") {
      if (current.state === "ready") showReady();
      else showLoading();
      return;
    }

    teardown(); // different pass, or retrying a failed load
    var myGen = generation;
    var session = { plan: plan, handle: null, state: "loading" };
    current = session;
    showLoading();

    waitForSdk(SDK_WAIT_MS)
      .then(function (WhopElements) {
        if (myGen !== generation) return; // superseded while the SDK loaded

        if (!whop) {
          whop = WhopElements({
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
        }

        var options = {
          plan: plan,
          onComplete: function (result) {
            // Fires before any returnUrl navigation and can repeat when a session is
            // restored. Put analytics/pixels here, deduplicated by result.paymentId.
            // Do NOT fulfil from here — fulfil from Whop webhooks.
            document.dispatchEvent(
              new CustomEvent("aia:checkout-complete", { detail: { plan: plan, result: result } })
            );
          },
        };
        var url = returnUrl(plan);
        if (url) options.returnUrl = url;

        session.handle = whop.checkout.create(options);
        session.handle
          .create("checkout", {
            onReady: function () {
              if (myGen !== generation) return;
              session.state = "ready";
              showReady();
            },
            onError: function (e) {
              if (myGen !== generation) return;
              // The element shows its own fallback for in-flow errors; only swap to
              // ours if it never finished loading.
              if (session.state !== "ready") {
                session.state = "failed";
                showError();
              }
              if (window.console) console.warn("[whop checkout]", e && (e.code || e.message));
            },
          })
          .mount(mountEl);
      })
      .catch(function (err) {
        if (myGen !== generation) return;
        session.state = "failed";
        showError();
        if (window.console) console.warn("[whop checkout]", err && err.message);
      });
  }

  function openDialog(plan) {
    var name = PLANS[plan].name;
    if (titleEl) titleEl.textContent = "🔒 Secure checkout · " + name;
    dialog.setAttribute("aria-label", "Checkout: " + name);
    if (errorLink) errorLink.setAttribute("href", hostedUrl(plan));
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("scroll-locked");
    startCheckout(plan);
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("[data-checkout]");
    if (!link) return;
    // Modifier-clicks keep the normal "open Whop checkout in a new tab" behaviour.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    openDialog(planFor(link));
  });

  dialog.addEventListener("close", function () {
    document.body.classList.remove("scroll-locked");
  });

  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) closeDialog(); // backdrop click
  });

  var closeBtn = dialog.querySelector("[data-close]");
  if (closeBtn) closeBtn.addEventListener("click", closeDialog);
})();
