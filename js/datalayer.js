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
    if (path.includes("contact"))           return "Contact Us";
    if (path.includes("login"))             return "Login";
    if (path.includes("savings"))           return "Savings & Deposits";
    if (path.includes("credit-cards"))      return "Credit Cards";
    if (path.includes("home-financing"))    return "Home Financing";
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

  // ─── Adobe Data Layer (adobeDataLayer — Adobe standard) ───────────────────
  // https://github.com/adobe/adobe-client-data-layer
  window.adobeDataLayer = window.adobeDataLayer || [];

  function pushEvent(eventName, payload) {
    var entry = Object.assign({ event: eventName }, payload);
    window.adobeDataLayer.push(entry);
    log(eventName, entry);
    return entry;
  }

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

    pushEvent("web.webpagedetails.pageViews", {
      pageName:     xdm.web.webPageDetails.name,
      pageURL:      xdm.web.webPageDetails.URL,
      pageCategory: xdm._nexabank.page.pageCategory,
      xdm: xdm,
    });

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

    pushEvent("commerce.productListViews", {
      products: xdm.productListItems,
      xdm: xdm,
    });

    sendToAEP(xdm);
  };

  // Expose
  window.NexaBankDL = NexaBankDL;
  window.NexaBankDLConfig = CONFIG;

})(window);
