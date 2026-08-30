/**
 * NexaBank – Main JavaScript
 * Handles UI interactions, AEP Web SDK bootstrap, and datalayer event wiring
 */

(function () {
  "use strict";

  // ─── AEP Web SDK Bootstrap ─────────────────────────────────────────────────
  // Uncomment and configure when deploying with real AEP credentials
  /*
  !function(n,o){o.forEach(function(o){n[o]||((n.__alloyNS=n.__alloyNS||
  []).push(o),n[o]=function(){var u=arguments;return new Promise(function(i,l)
  {n[o].q.push([i,l,u])})},n[o].q=[])})}(window,["alloy"]);

  alloy("configure", {
    datastreamId: window.NexaBankDLConfig.datastreamId,
    orgId:        window.NexaBankDLConfig.orgId,
    edgeDomain:   window.NexaBankDLConfig.edgeDomain,
    clickCollectionEnabled: true,
    context: ["web", "device", "environment", "placeContext"],
  });
  */

  // ─── DOM Ready ─────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    initNavigation();
    initMobileMenu();
    initLoginForm();
    initTabSwitcher();
    wireNavDataLayer();
    wireCTADataLayer();
    firePageView();
  });

  // ─── Page View ─────────────────────────────────────────────────────────────
  function firePageView() {
    var meta = document.querySelector("meta[name='page-data']");
    var pageData = {};
    if (meta) {
      try {
        pageData = JSON.parse(meta.getAttribute("content"));
      } catch (e) {}
    }
    if (window.NexaBankDL) {
      window.NexaBankDL.pageView(pageData);
    }
  }

  // ─── Navigation ────────────────────────────────────────────────────────────
  function initNavigation() {
    // Dropdown hover for desktop
    var dropdownItems = document.querySelectorAll(".nav-item.has-dropdown");
    dropdownItems.forEach(function (item) {
      item.addEventListener("mouseenter", function () {
        this.querySelector(".dropdown-menu") &&
          (this.querySelector(".dropdown-menu").style.display = "block");
      });
      item.addEventListener("mouseleave", function () {
        this.querySelector(".dropdown-menu") &&
          (this.querySelector(".dropdown-menu").style.display = "none");
      });
    });

    // Active link
    var currentPath = window.location.pathname.split("/").pop() || "index.html";
    var navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach(function (link) {
      if (link.getAttribute("href") === currentPath) {
        link.classList.add("active");
      }
    });
  }

  function initMobileMenu() {
    var toggle = document.getElementById("mobileMenuToggle");
    var nav = document.getElementById("mainNav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", nav.classList.contains("open"));
    });
  }

  // ─── Login / Tab Form ──────────────────────────────────────────────────────
  function initTabSwitcher() {
    var tabs = document.querySelectorAll(".tab-btn");
    var panes = document.querySelectorAll(".tab-pane");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.classList.remove("active"); });
        panes.forEach(function (p) { p.classList.remove("active"); });
        tab.classList.add("active");
        var target = document.getElementById(tab.dataset.tab);
        if (target) target.classList.add("active");
      });
    });
  }

  function initLoginForm() {
    var form = document.getElementById("loginForm");
    if (!form) return;
    var formID = null;
    var formStarted = false;

    // Form Start – first field focus
    var fields = form.querySelectorAll("input, select");
    fields.forEach(function (field) {
      field.addEventListener(
        "focus",
        function () {
          if (!formStarted) {
            formStarted = true;
            formID = window.NexaBankDL.formStart({
              formName: "Online Banking Login",
              formType: "authentication",
              firstField: field.name || field.id,
            });
          }
        },
        { once: false }
      );
    });

    // Form Submit
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var usernameEl = form.querySelector("#username");
      var passwordEl = form.querySelector("#password");
      var errors = [];

      if (!usernameEl || !usernameEl.value.trim()) errors.push("username");
      if (!passwordEl || !passwordEl.value.trim()) errors.push("password");

      if (errors.length > 0) {
        // ── Empty-field validation failure ────────────────────────
        window.NexaBankDL.loginFailure({
          formID:  formID,
          username: usernameEl ? usernameEl.value.trim() : "",
          reason:   "empty_fields",
        });
        window.NexaBankDL.formError({
          formID:        formID,
          formName:      "Online Banking Login",
          formType:      "authentication",
          formStep:      "submit",
          errorFields:   errors,
          errorMessages: errors.map(function (f) {
            return f.charAt(0).toUpperCase() + f.slice(1) + " is required";
          }),
        });
        showFormError(form, errors);
        return;
      }

      var VALID_CREDENTIALS = { "rroy1": "1234" };
      var enteredUser = usernameEl.value.trim();
      var enteredPass = passwordEl.value.trim();

      // ── Push login attempt before credential check ────────────
      window.NexaBankDL.loginAttempt({
        formID:   formID,
        username: enteredUser,
      });

      if (!VALID_CREDENTIALS[enteredUser] || VALID_CREDENTIALS[enteredUser] !== enteredPass) {
        // ── Invalid credentials ───────────────────────────────────
        window.NexaBankDL.loginFailure({
          formID:  formID,
          username: enteredUser,
          reason:   "invalid_credentials",
        });
        window.NexaBankDL.formError({
          formID:        formID,
          formName:      "Online Banking Login",
          formType:      "authentication",
          formStep:      "submit",
          errorFields:   ["credentials"],
          errorMessages: ["Invalid username or password"],
        });
        showCredentialError(form);
        return;
      }

      // ── Valid login ───────────────────────────────────────────
      window.NexaBankDL.loginSuccess({
        formID:   formID,
        username: enteredUser,
      });
      window.NexaBankDL.formSubmit({
        formID:          formID,
        formName:        "Online Banking Login",
        formType:        "authentication",
        enquiryCategory: "login",
      });

      sessionStorage.setItem("nexaUser", enteredUser);
      showLoginSuccess(form, enteredUser);
    });
  }

  function showCredentialError(form) {
    var existing = form.querySelector(".credentials-error");
    if (!existing) {
      var errDiv = document.createElement("div");
      errDiv.className = "credentials-error field-error";
      errDiv.style.marginTop = "10px";
      errDiv.style.textAlign = "center";
      errDiv.textContent = "Invalid username or password. Please try again.";
      form.querySelector(".btn-login").parentNode.insertBefore(errDiv, form.querySelector(".btn-login"));
    }
    var usernameEl = form.querySelector("#username");
    var passwordEl = form.querySelector("#password");
    if (usernameEl) usernameEl.classList.add("input-error");
    if (passwordEl) passwordEl.classList.add("input-error");
  }

  function showFormError(form, errorFields) {
    errorFields.forEach(function (fieldName) {
      var field = form.querySelector("#" + fieldName);
      if (field) {
        field.classList.add("input-error");
        var err = field.parentNode.querySelector(".field-error");
        if (!err) {
          err = document.createElement("span");
          err.className = "field-error";
          field.parentNode.appendChild(err);
        }
        err.textContent =
          fieldName.charAt(0).toUpperCase() + fieldName.slice(1) + " is required";
        field.addEventListener(
          "input",
          function () {
            field.classList.remove("input-error");
            if (err) err.textContent = "";
          },
          { once: true }
        );
      }
    });
  }

  function showLoginSuccess(form, username) {
    var btn = form.querySelector(".btn-login");
    if (btn) {
      btn.textContent = "Logging in…";
      btn.disabled = true;
    }
    // Remove any credential error
    var credErr = form.querySelector(".credentials-error");
    if (credErr) credErr.remove();

    setTimeout(function () {
      window.location.href = "dashboard.html";
    }, 800);
  }

  // ─── DataLayer: Navigation wiring ─────────────────────────────────────────
  function wireNavDataLayer() {
    var navLinks = document.querySelectorAll("[data-nav-section]");
    navLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        window.NexaBankDL &&
          window.NexaBankDL.navigationClick({
            navSection: link.dataset.navSection || "",
            navItem: link.textContent.trim(),
            navLevel: link.dataset.navLevel || "primary",
          });
      });
    });
  }

  // ─── DataLayer: CTA wiring ─────────────────────────────────────────────────
  function wireCTADataLayer() {
    var ctaButtons = document.querySelectorAll("[data-cta-name]");
    ctaButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.NexaBankDL &&
          window.NexaBankDL.ctaClick({
            ctaName: btn.dataset.ctaName || "",
            ctaText: btn.textContent.trim(),
            ctaLocation: btn.dataset.ctaLocation || "",
            ctaDestination: btn.href || btn.dataset.ctaDestination || "",
            productCategory: btn.dataset.productCategory || "",
          });
      });
    });
  }

  // ─── Contact Form wiring (contact.html) ────────────────────────────────────
  window.initContactForm = function () {
    var form = document.getElementById("contactForm");
    if (!form) return;
    var formID = null;
    var formStarted = false;

    var fields = form.querySelectorAll("input, select, textarea");
    fields.forEach(function (field) {
      field.addEventListener("focus", function () {
        if (!formStarted) {
          formStarted = true;
          formID = window.NexaBankDL.formStart({
            formName: "Contact Us Enquiry",
            formType: "enquiry",
            firstField: field.name || field.id || field.tagName,
          });
        }
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var errors = [];
      fields.forEach(function (field) {
        if (field.required && !field.value.trim()) {
          errors.push(field.name || field.id);
        }
        if (field.type === "email" && field.value && !isValidEmail(field.value)) {
          errors.push("email-format");
        }
      });

      if (errors.length > 0) {
        window.NexaBankDL.formError({
          formID: formID,
          formName: "Contact Us Enquiry",
          formType: "enquiry",
          formStep: "submit",
          errorFields: errors,
          errorMessages: errors.map(function (f) { return f + " is invalid"; }),
        });
        highlightErrors(form, errors);
        return;
      }

      var category = form.querySelector("#enquiryType");
      window.NexaBankDL.formSubmit({
        formID: formID,
        formName: "Contact Us Enquiry",
        formType: "enquiry",
        enquiryCategory: category ? category.value : "general",
      });
      showContactSuccess(form);
    });
  };

  function highlightErrors(form, errorFields) {
    errorFields.forEach(function (fieldName) {
      var field = form.querySelector('[name="' + fieldName + '"], #' + fieldName);
      if (field) {
        field.classList.add("input-error");
        field.addEventListener("input", function () {
          field.classList.remove("input-error");
        }, { once: true });
      }
    });
  }

  function showContactSuccess(form) {
    var successMsg = document.getElementById("contactSuccess");
    if (successMsg) {
      form.style.display = "none";
      successMsg.style.display = "block";
    }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
})();
