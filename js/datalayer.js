/**
 * NexaBank Event-Driven Data Layer
 * Compatible with Adobe Experience Platform Web SDK (alloy.js)
 * XDM Schema structured for Banking Services
 *
 * Global object : window.adobeDataLayer  (Adobe standard)
 * AEP Web SDK   : alloy("sendEvent", { xdm: ... })
 *
 * eventType values follow the AEP XDM ExperienceEvent standard:
 *   web.webpagedetails.pageViews      — page view
 *   web.formFilledOut                 — form start / step / submit / error
 *   web.webinteraction.linkClicks     — CTA clicks
 *   web.webinteraction.linkClicks     — navigation clicks (with linkType="other")
 *   commerce.productListViews         — product impression
 */

(function (window) {
  "use strict";

  // ─── Configuration ────────────────────────────────────────────────────────
  var CONFIG = {
    datastreamId: "YOUR_DATASTREAM_ID",  // Replace with your AEP Datastream ID
    orgId: "YOUR_ORG_ID@AdobeOrg",       // Replace with your IMS Org ID
    edgeDomain: "edge.adobedc.net",
    debugMode: true,                      // Set false in production
  };

  // ─── Internal logger ──────────────────────────────────────────────────────
  function log(event, payload) {
    if (CONFIG.debugMode) {
      console.groupCollapsed(
        "%c[NexaBank DataLayer] " + event,
        "color:#c8960c; font-weight:bold;"
      );
      console.log(payload);
      console.groupEnd();
    }
  }

  // ─── XDM Base Builder ─────────────────────────────────────────────────────
  // eventType must be a valid XDM ExperienceEvent type string
  function buildXDMBase(eventType) {
    return {
      eventType: eventType,
      timestamp: new Date().toISOString(),
      web: {
        webPageDetails: {
          name: document.title,
          URL: window.location.href,
          siteSection: getSiteSection(),
          server: window.location.hostname,
        },
        webReferrer: {
          URL: document.referrer || "",
        },
      },
      environment: {
        type: getDeviceType(),
        browserDetails: {
          userAgent: navigator.userAgent,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        },
      },
      _nexabank: {
        bank: {
          brandName: "NexaBank",
          country: "Malaysia",
          division: "Digital Banking",
        },
      },
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function getSiteSection() {
    var path = window.location.pathname;
    if (path.includes("contact"))            return "Contact Us";
    if (path.includes("login"))              return "Login";
    if (path.includes("dashboard"))          return "Dashboard";
    if (path.includes("card-application"))   return "Card Application";
    if (path.includes("savings"))            return "Savings & Deposits";
    if (path.includes("credit-cards"))       return "Credit Cards";
    if (path.includes("home-financing"))     return "Home Financing";
    if (path.includes("personal-financing")) return "Personal Financing";
    if (path === "/" || path.includes("index")) return "Home";
    return "Other";
  }

  function getDeviceType() {
    var w = window.innerWidth;
    if (w < 768)  return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  }

  function generateInteractionId() {
    return "NB-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
  }

  // ─── AEP Web SDK Send ──────────────────────────────────────────────────────
  function sendToAEP(xdm, data) {
    if (typeof window.alloy === "function") {
      window.alloy("sendEvent", {
        xdm: xdm,
        data: data || {},
      })
      .then(function (result) {
        log("AEP sendEvent SUCCESS", result);
      })
      .catch(function (error) {
        log("AEP sendEvent ERROR", error);
      });
    } else {
      log("alloy() not available – event queued in adobeDataLayer only", xdm);
    }
  }

  // ─── Adobe Data Layer — storage model ────────────────────────────────────
  //
  // BEHAVIOUR:
  //   • On REFRESH  — page-scoped events (pageView, productListViews) for the
  //     current page REPLACE their previous entry. No duplicates build up.
  //   • On REDIRECT — all events from prior pages PERSIST. The new page's
  //     events are appended after them.
  //   • Interaction events (login, form, CTA, calculator…) are always appended
  //     and never replaced — each user action is a distinct occurrence.
  //
  // STORAGE STRUCTURE  (localStorage key: "nexaBankDL_store")
  //   {
  //     pages: {
  //       "<pageKey>": {
  //         order: <integer>,   // visit sequence, used for chronological sort
  //         pageScoped: [...],  // pageView + productListViews — replaced on refresh
  //         interactions: [...] // form/login/CTA events — always appended
  //       },
  //       ...
  //     }
  //   }
  //
  // window.adobeDataLayer is built by flattening all pages in visit order,
  // interleaving pageScoped then interactions for each page.
  // ─────────────────────────────────────────────────────────────────────────

  var DL_STORE_KEY = "nexaBankDL_store";

  // Identify the current page — use the filename (e.g. "index.html").
  var _pageKey = (window.location.pathname.split("/").pop() || "index.html")
                  + (window.location.search || "");

  // ── Storage helpers ───────────────────────────────────────────────────────
  function _loadStore() {
    try {
      var raw = localStorage.getItem(DL_STORE_KEY);
      return (raw ? JSON.parse(raw) : null) || { pages: {} };
    } catch (e) {
      return { pages: {} };
    }
  }

  function _saveStore(store) {
    try { localStorage.setItem(DL_STORE_KEY, JSON.stringify(store)); } catch (e) {}
  }

  // ── Bootstrap the store for this page load ───────────────────────────────
  var _store = _loadStore();

  if (!_store.pages[_pageKey]) {
    // First-ever visit to this page — create its slot with the next order index
    var _maxOrder = 0;
    Object.keys(_store.pages).forEach(function (k) {
      if (_store.pages[k].order > _maxOrder) _maxOrder = _store.pages[k].order;
    });
    _store.pages[_pageKey] = { order: _maxOrder + 1, pageScoped: [], interactions: [] };
  } else {
    // Refresh of an already-visited page — clear its pageScoped events so
    // they are replaced (not duplicated) by the fresh page-load events below.
    _store.pages[_pageKey].pageScoped = [];
  }
  // Persist immediately so the cleared pageScoped is in sync.
  _saveStore(_store);

  // ── Flatten store → window.adobeDataLayer ────────────────────────────────
  // Sort pages by visit order and interleave [pageScoped, interactions].
  function _buildDataLayer() {
    var pages = _store.pages;
    var keys  = Object.keys(pages).sort(function (a, b) {
      return pages[a].order - pages[b].order;
    });
    var flat = [];
    keys.forEach(function (k) {
      (pages[k].pageScoped   || []).forEach(function (e) { flat.push(e); });
      (pages[k].interactions || []).forEach(function (e) { flat.push(e); });
    });
    return flat;
  }

  // ── Wrap window.adobeDataLayer ────────────────────────────────────────────
  // Initial population from persisted history.
  window.adobeDataLayer = _buildDataLayer();

  var _originalPush = Array.prototype.push;

  // Override push so callers never need to know about the storage model.
  // Each entry carries a _scope: "pageScoped" | "interaction" flag set by pushEvent().
  window.adobeDataLayer.push = function () {
    var result = _originalPush.apply(this, arguments);
    // The last pushed entry was just added to the live array by _originalPush.
    // We also need to route it to the correct store bucket.
    for (var i = 0; i < arguments.length; i++) {
      var entry = arguments[i];
      if (entry && typeof entry === "object" && entry.event) {
        var bucket = (entry._scope === "pageScoped") ? "pageScoped" : "interactions";
        _store.pages[_pageKey][bucket].push(entry);
      }
    }
    _saveStore(_store);
    return result;
  };

  // ── pushEvent ─────────────────────────────────────────────────────────────
  // scope = "pageScoped"   → replaces on refresh  (pageView, productListViews)
  // scope = "interaction"  → always appends        (login, form, CTA, etc.)
  function pushEvent(eventName, payload, scope) {
    var entry = Object.assign(
      {
        event:   eventName,
        _ts:     new Date().toISOString(),
        _page:   _pageKey,
        _scope:  scope || "interaction",
      },
      payload
    );
    window.adobeDataLayer.push(entry);
    log(eventName, entry);
    return entry;
  }

  /**
   * NexaBankDL.clearHistory()
   * Utility: wipe persisted event history (useful for resetting between demos).
   * Call from browser console: NexaBankDL.clearHistory()
   */

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  var NexaBankDL = {};

  /**
   * PAGE VIEW
   * XDM eventType: web.webpagedetails.pageViews  (AEP Web SDK standard)
   * Fire on every page load / virtual page navigation.
   */
  NexaBankDL.pageView = function (pageData) {
    pageData = pageData || {};
    var xdm = buildXDMBase("web.webpagedetails.pageViews");
    xdm.web.webPageDetails = Object.assign(xdm.web.webPageDetails, {
      name: pageData.pageName || document.title,
      pageViews: { value: 1 },
    });
    xdm._nexabank.page = {
      pageCategory:    pageData.pageCategory    || getSiteSection(),
      pageSubCategory: pageData.pageSubCategory || "",
      pageLanguage:    pageData.pageLanguage    || "en",
      pageType:        pageData.pageType        || "informational",
    };

    // "pageScoped" → replaced on refresh, persisted on redirect
    pushEvent("web.webpagedetails.pageViews", {
      pageName:     xdm.web.webPageDetails.name,
      pageURL:      xdm.web.webPageDetails.URL,
      pageCategory: xdm._nexabank.page.pageCategory,
      xdm: xdm,
    }, "pageScoped");

    sendToAEP(xdm);
  };

  /**
   * FORM START
   * XDM eventType: web.formFilledOut  (AEP Web SDK standard)
   * Fire when the user interacts with the first field of a form.
   */
  NexaBankDL.formStart = function (formData) {
    formData = formData || {};
    var xdm = buildXDMBase("web.formFilledOut");
    xdm.web.webFormFilledOut = {
      name:  formData.formName || "Unknown Form",
      ID:    formData.formID   || generateInteractionId(),
      type:  formData.formType || "enquiry",
      step:  "start",
    };
    xdm._nexabank.form = {
      formID:               xdm.web.webFormFilledOut.ID,
      formName:             xdm.web.webFormFilledOut.name,
      formType:             xdm.web.webFormFilledOut.type,
      formStep:             "start",
      firstFieldInteracted: formData.firstField || "",
    };

    pushEvent("web.formFilledOut", {
      formName: xdm._nexabank.form.formName,
      formID:   xdm._nexabank.form.formID,
      formStep: "start",
      xdm: xdm,
    });

    sendToAEP(xdm);
    return xdm._nexabank.form.formID;
  };

  /**
   * FORM SUBMIT  (formEnd)
   * XDM eventType: web.formFilledOut  (AEP Web SDK standard)
   * Fire on successful form submission.
   */
  NexaBankDL.formSubmit = function (formData) {
    formData = formData || {};
    var xdm = buildXDMBase("web.formFilledOut");
    xdm.web.webFormFilledOut = {
      name:  formData.formName || "Unknown Form",
      ID:    formData.formID   || generateInteractionId(),
      type:  formData.formType || "enquiry",
      step:  "complete",
    };
    xdm._nexabank.form = {
      formID:            xdm.web.webFormFilledOut.ID,
      formName:          xdm.web.webFormFilledOut.name,
      formType:          xdm.web.webFormFilledOut.type,
      formStep:          "complete",
      formSubmitSuccess: true,
      enquiryCategory:   formData.enquiryCategory || "",
    };

    pushEvent("web.formFilledOut", {
      formName:        xdm._nexabank.form.formName,
      formID:          xdm._nexabank.form.formID,
      formStep:        "complete",
      enquiryCategory: xdm._nexabank.form.enquiryCategory,
      xdm: xdm,
    });

    sendToAEP(xdm);
  };

  /**
   * FORM ERROR
   * XDM eventType: web.formFilledOut  (AEP Web SDK standard)
   * Fire when form validation fails.
   */
  NexaBankDL.formError = function (formData) {
    formData = formData || {};
    var xdm = buildXDMBase("web.formFilledOut");
    xdm.web.webFormFilledOut = {
      name: formData.formName || "",
      ID:   formData.formID   || "",
      type: formData.formType || "enquiry",
      step: formData.formStep || "validation",
    };
    xdm._nexabank.form = {
      formID:            xdm.web.webFormFilledOut.ID,
      formName:          xdm.web.webFormFilledOut.name,
      formType:          xdm.web.webFormFilledOut.type,
      formStep:          "error",
      formSubmitSuccess: false,
      errorFields:       formData.errorFields   || [],
      errorMessages:     formData.errorMessages || [],
    };

    pushEvent("web.formFilledOut", {
      formName:      xdm._nexabank.form.formName,
      formStep:      "error",
      errorFields:   xdm._nexabank.form.errorFields,
      errorMessages: xdm._nexabank.form.errorMessages,
      xdm: xdm,
    });

    sendToAEP(xdm);
  };

  /**
   * CTA CLICK
   * XDM eventType: web.webinteraction.linkClicks  (AEP Web SDK standard)
   * Fire on any call-to-action button or link click.
   */
  NexaBankDL.ctaClick = function (ctaData) {
    ctaData = ctaData || {};
    var xdm = buildXDMBase("web.webinteraction.linkClicks");
    xdm.web.webInteraction = {
      name:     ctaData.ctaName || "",
      URL:      ctaData.ctaDestination || "",
      linkType: "other",
      linkClicks: { value: 1 },
    };
    xdm._nexabank.interaction = {
      interactionType: "ctaClick",
      ctaName:         ctaData.ctaName     || "",
      ctaText:         ctaData.ctaText     || "",
      ctaLocation:     ctaData.ctaLocation || getSiteSection(),
      ctaDestination:  ctaData.ctaDestination || "",
      productCategory: ctaData.productCategory || "",
    };

    pushEvent("web.webinteraction.linkClicks", {
      ctaName:     xdm._nexabank.interaction.ctaName,
      ctaText:     xdm._nexabank.interaction.ctaText,
      ctaLocation: xdm._nexabank.interaction.ctaLocation,
      xdm: xdm,
    });

    sendToAEP(xdm);
  };

  /**
   * NAVIGATION CLICK
   * XDM eventType: web.webinteraction.linkClicks  (AEP Web SDK standard)
   * linkType = "other" for internal navigation links.
   */
  NexaBankDL.navigationClick = function (navData) {
    navData = navData || {};
    var xdm = buildXDMBase("web.webinteraction.linkClicks");
    xdm.web.webInteraction = {
      name:     navData.navItem || "",
      URL:      window.location.href,
      linkType: "other",
      linkClicks: { value: 1 },
    };
    xdm._nexabank.interaction = {
      interactionType: "navigationClick",
      navSection:      navData.navSection || "",
      navItem:         navData.navItem    || "",
      navLevel:        navData.navLevel   || "primary",
    };

    pushEvent("web.webinteraction.linkClicks", {
      navSection: xdm._nexabank.interaction.navSection,
      navItem:    xdm._nexabank.interaction.navItem,
      xdm: xdm,
    });

    sendToAEP(xdm);
  };

  /**
   * PRODUCT IMPRESSION
   * XDM eventType: commerce.productListViews  (AEP Web SDK standard)
   * Fire when banking product cards are viewed.
   */
  NexaBankDL.productImpression = function (products) {
    products = products || [];
    var xdm = buildXDMBase("commerce.productListViews");
    xdm.commerce = {
      productListViews: { value: 1 },
    };
    xdm.productListItems = products.map(function (p) {
      return {
        SKU:             p.productID       || "",
        name:            p.productName     || "",
        productCategory: p.productCategory || "Banking",
        _nexabank: {
          productSubCategory: p.productSubCategory || "",
        },
      };
    });

    // "pageScoped" → replaced on refresh, persisted on redirect
    pushEvent("commerce.productListViews", {
      products: xdm.productListItems,
      xdm: xdm,
    }, "pageScoped");

    sendToAEP(xdm);
  };

  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * USER LOGIN — ATTEMPT
   * XDM eventType: web.formFilledOut  (login form submitted with credentials)
   * Fire immediately when the user clicks "Secure Login" (before credential check).
   */
  NexaBankDL.loginAttempt = function (data) {
    data = data || {};
    var xdm = buildXDMBase("web.formFilledOut");
    xdm.web.webFormFilledOut = {
      name: "Online Banking Login",
      ID:   data.formID || generateInteractionId(),
      type: "authentication",
      step: "attempt",
    };
    xdm._nexabank.authentication = {
      event:    "loginAttempt",
      username: data.username || "",
      method:   "usernamePassword",
    };

    pushEvent("nexabank.user.loginAttempt", {
      username: xdm._nexabank.authentication.username,
      method:   xdm._nexabank.authentication.method,
      xdm: xdm,
    });

    sendToAEP(xdm);
  };

  /**
   * USER LOGIN — SUCCESS
   * XDM eventType: web.formFilledOut  (credentials validated, session created)
   * Fire after successful credential validation.
   */
  NexaBankDL.loginSuccess = function (data) {
    data = data || {};
    var xdm = buildXDMBase("web.formFilledOut");
    xdm.web.webFormFilledOut = {
      name: "Online Banking Login",
      ID:   data.formID || generateInteractionId(),
      type: "authentication",
      step: "complete",
    };
    xdm._nexabank.authentication = {
      event:       "loginSuccess",
      username:    data.username || "",
      method:      "usernamePassword",
      sessionStart: new Date().toISOString(),
    };

    pushEvent("nexabank.user.loginSuccess", {
      username:     xdm._nexabank.authentication.username,
      sessionStart: xdm._nexabank.authentication.sessionStart,
      xdm: xdm,
    });

    sendToAEP(xdm);
  };

  /**
   * USER LOGIN — FAILURE
   * XDM eventType: web.formFilledOut  (invalid credentials or validation error)
   * Fire when login fails for any reason.
   */
  NexaBankDL.loginFailure = function (data) {
    data = data || {};
    var xdm = buildXDMBase("web.formFilledOut");
    xdm.web.webFormFilledOut = {
      name: "Online Banking Login",
      ID:   data.formID || generateInteractionId(),
      type: "authentication",
      step: "error",
    };
    xdm._nexabank.authentication = {
      event:        "loginFailure",
      username:     data.username      || "",
      method:       "usernamePassword",
      failureReason: data.reason       || "invalid_credentials",
    };

    pushEvent("nexabank.user.loginFailure", {
      username:      xdm._nexabank.authentication.username,
      failureReason: xdm._nexabank.authentication.failureReason,
      xdm: xdm,
    });

    sendToAEP(xdm);
  };

  /**
   * USER LOGOUT
   * XDM eventType: web.webinteraction.linkClicks  (user-initiated sign-out action)
   * Fire when the user clicks Sign Out.
   */
  NexaBankDL.userLogout = function (data) {
    data = data || {};
    var xdm = buildXDMBase("web.webinteraction.linkClicks");
    xdm.web.webInteraction = {
      name:       "Sign Out",
      URL:        window.location.href,
      linkType:   "other",
      linkClicks: { value: 1 },
    };
    xdm._nexabank.authentication = {
      event:      "logout",
      username:   data.username || (sessionStorage.getItem("nexaUser") || ""),
      logoutTime: new Date().toISOString(),
    };

    pushEvent("nexabank.user.logout", {
      username:   xdm._nexabank.authentication.username,
      logoutTime: xdm._nexabank.authentication.logoutTime,
      xdm: xdm,
    });

    sendToAEP(xdm);
  };

  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * CALCULATOR INTERACTION
   * XDM eventType: web.formFilledOut
   * Covers all steps of a financing calculator:
   *   step = "start"      — user opens / first touches the calculator
   *   step = "next"       — user advances past the input step
   *   step = "emailGate"  — user lands on the email capture step
   *   step = "complete"   — user receives the calculated result
   *
   * @param {object} data
   *   calculatorType : "Home Financing" | "Personal Financing"
   *   step           : "start" | "next" | "emailGate" | "complete"
   *   inputs         : { loanAmount, tenure, rate, downPayment, email }
   *   result         : { monthlyPayment }   (only on "complete")
   */
  NexaBankDL.calculatorInteraction = function (data) {
    data = data || {};
    var xdm = buildXDMBase("web.formFilledOut");
    xdm.web.webFormFilledOut = {
      name: (data.calculatorType || "Financing") + " Calculator",
      ID:   data.calculatorID || generateInteractionId(),
      type: "calculator",
      step: data.step || "start",
    };
    xdm._nexabank.calculator = {
      calculatorType:  data.calculatorType  || "",
      calculatorStep:  data.step            || "start",
      loanAmount:      data.inputs && data.inputs.loanAmount      || null,
      downPayment:     data.inputs && data.inputs.downPayment      || null,
      tenure:          data.inputs && data.inputs.tenure           || null,
      interestRate:    data.inputs && data.inputs.rate             || null,
      emailCaptured:   data.inputs && !!data.inputs.email,
      monthlyPayment:  data.result && data.result.monthlyPayment   || null,
    };

    pushEvent("nexabank.calculator." + (data.step || "start"), {
      calculatorType: xdm._nexabank.calculator.calculatorType,
      step:           xdm._nexabank.calculator.calculatorStep,
      inputs:         data.inputs  || {},
      result:         data.result  || {},
      xdm: xdm,
    });

    sendToAEP(xdm);
  };

  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * CARD APPLICATION — STEP
   * XDM eventType: web.formFilledOut
   * Fire on every step transition in the credit card application:
   *   step = "start"         — page load / first field interaction
   *   step = "personal-info" — Step 1 completed → moving to Step 2
   *   step = "employment"    — Step 2 completed → moving to Step 3
   *   step = "review"        — Step 3 review screen reached
   *   step = "complete"      — Form successfully submitted
   *   step = "error"         — Validation failure on any step
   *
   * @param {object} data
   *   formID       : persistent ID across all steps
   *   step         : one of the step strings above
   *   stepNumber   : 1 | 2 | 3
   *   cardType     : "cashback" | "platinum" | "gold-i"
   *   errorFields  : [] (only on "error")
   */
  NexaBankDL.cardApplicationStep = function (data) {
    data = data || {};
    var xdm = buildXDMBase("web.formFilledOut");
    xdm.web.webFormFilledOut = {
      name: "Credit Card Application",
      ID:   data.formID     || generateInteractionId(),
      type: "application",
      step: data.step       || "start",
    };
    xdm._nexabank.cardApplication = {
      formID:       xdm.web.webFormFilledOut.ID,
      stepName:     data.step        || "start",
      stepNumber:   data.stepNumber  || 0,
      cardType:     data.cardType    || "",
      errorFields:  data.errorFields || [],
    };

    pushEvent("nexabank.cardApplication." + (data.step || "start"), {
      formID:     xdm._nexabank.cardApplication.formID,
      stepName:   xdm._nexabank.cardApplication.stepName,
      stepNumber: xdm._nexabank.cardApplication.stepNumber,
      cardType:   xdm._nexabank.cardApplication.cardType,
      xdm: xdm,
    });

    sendToAEP(xdm);
    return xdm.web.webFormFilledOut.ID;
  };

  /**
   * CARD APPLICATION — COMPLETE
   * XDM eventType: web.formFilledOut (step = "complete")
   * Fire when the application is successfully submitted.
   */
  NexaBankDL.cardApplicationComplete = function (data) {
    data = data || {};
    var xdm = buildXDMBase("web.formFilledOut");
    xdm.web.webFormFilledOut = {
      name: "Credit Card Application",
      ID:   data.formID  || generateInteractionId(),
      type: "application",
      step: "complete",
    };
    xdm._nexabank.cardApplication = {
      formID:        xdm.web.webFormFilledOut.ID,
      stepName:      "complete",
      stepNumber:    3,
      cardType:      data.cardType      || "",
      referenceNo:   data.referenceNo   || "",
      applicantEmail: data.applicantEmail || "",
    };

    pushEvent("nexabank.cardApplication.complete", {
      formID:         xdm._nexabank.cardApplication.formID,
      cardType:       xdm._nexabank.cardApplication.cardType,
      referenceNo:    xdm._nexabank.cardApplication.referenceNo,
      applicantEmail: xdm._nexabank.cardApplication.applicantEmail,
      xdm: xdm,
    });

    sendToAEP(xdm);
  };

  // ─── clearHistory() — public utility ─────────────────────────────────────
  NexaBankDL.clearHistory = function () {
    try { localStorage.removeItem(DL_STORE_KEY); } catch (e) {}
    _store = { pages: {} };
    window.adobeDataLayer.length = 0;
    log("clearHistory", { message: "Event history cleared. window.adobeDataLayer is now empty." });
  };

  // ─── getHistory() — public utility ───────────────────────────────────────
  NexaBankDL.getHistory = function () {
    return window.adobeDataLayer.slice();
  };

  // ─── Debug badge (visible in browser when debugMode = true) ───────────────
  if (CONFIG.debugMode) {
    document.addEventListener("DOMContentLoaded", function () {
      var count = window.adobeDataLayer.length;
      var badge = document.createElement("div");
      badge.id = "dl-debug-badge";
      badge.title = "Adobe DataLayer Debug Mode — window.adobeDataLayer is active. Click to see history in console.";
      badge.style.cursor = "pointer";
      badge.textContent = "📊 AEP DataLayer (" + count + ")";
      badge.addEventListener("click", function () {
        console.group("%c[NexaBank DataLayer] Full Event History (" + window.adobeDataLayer.length + " events)", "color:#c8960c;font-weight:bold;font-size:13px;");
        window.adobeDataLayer.forEach(function (evt, i) {
          console.log("%c[" + i + "] " + evt.event + " @ " + (evt._ts || ""), "color:#57606a;font-size:11px;", evt);
        });
        console.log("%cTip: NexaBankDL.clearHistory() resets the history for a fresh demo.", "color:#3b82d4;font-style:italic;");
        console.groupEnd();
        // update count in badge
        badge.textContent = "📊 AEP DataLayer (" + window.adobeDataLayer.length + ")";
      });

      // Update count whenever new events arrive (poll every 500ms)
      setInterval(function () {
        badge.textContent = "📊 AEP DataLayer (" + window.adobeDataLayer.length + ")";
      }, 500);

      document.body.appendChild(badge);
    });
  }

  // Expose
  window.NexaBankDL = NexaBankDL;
  window.NexaBankDLConfig = CONFIG;

})(window);
