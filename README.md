# NexaBank Demo Website

A fully static, production-ready banking demo website built for **Adobe Experience Platform (AEP)** client demonstrations. Inspired by Maybank2u's visual language, instrumented with a complete event-driven data layer compatible with the **AEP Web SDK (alloy.js)**.

---

## 📁 Project Structure

```
nexabank/
├── index.html              # Homepage — hero, login card, products, promotions
├── contact.html            # Contact Us — channels, FAQ accordion, enquiry form
├── savings-deposits.html   # Savings & Deposits product page
├── credit-cards.html       # Credit Cards product page + product impression DL
├── home-financing.html     # Home Financing — 3-step EMI calculator + DL
├── personal-financing.html # Personal Financing — 3-step calculator + DL
├── card-application.html   # 3-step credit card application form + full DL
├── dashboard.html          # Authenticated dashboard (protected by sessionStorage)
├── css/
│   └── styles.css          # Full responsive stylesheet (Maybank-inspired palette)
└── js/
    ├── datalayer.js        # AEP-compatible event-driven data layer
    └── main.js             # UI wiring, login logic, nav/CTA auto-wiring
```

---

## 🚀 Deployment

### Option 1 – Netlify (recommended, zero config)
1. Go to [netlify.com](https://netlify.com) → **Add new site → Deploy manually**
2. Drag and drop the entire `nexabank/` folder into the Netlify drop zone
3. Your site is live instantly at a `*.netlify.app` URL

### Option 2 – GitHub Pages
1. Push the `nexabank/` contents to a GitHub repo (e.g. `nexaBank`)
2. Go to **Settings → Pages → Source → Deploy from branch → main / (root)**
3. Access at `https://<username>.github.io/<repo>/`

### Option 3 – Azure Static Web Apps
1. Create a **Static Web App** resource in Azure Portal
2. Connect to the GitHub repo containing `nexabank/`
3. Set **App location** to `/nexabank` and leave **API location** blank

### Option 4 – Local Development
```
# No build step needed — open directly in browser
open nexabank/index.html
```
Or serve locally with any static server:
```bash
npx serve nexabank
# or
python -m http.server 8080 --directory nexabank
```

---

## 🔑 Login Credentials (Demo)

| Username | Password |
|----------|----------|
| `rroy1`  | `1234`   |

The login form fires `nexabank.user.loginAttempt` → `nexabank.user.loginSuccess` (or `loginFailure`) via the data layer. On success, `sessionStorage.setItem("nexaUser", username)` is set and the user is redirected to `dashboard.html`.

---

## 📊 Data Layer Architecture

### Global Object
```js
window.adobeDataLayer   // Adobe Client Data Layer (standard array)
window.NexaBankDL       // NexaBank public API object
window.NexaBankDLConfig // Config: datastreamId, orgId, debugMode
```

### Configuration (`js/datalayer.js` lines 21-26)
```js
var CONFIG = {
  datastreamId: "YOUR_DATASTREAM_ID",  // ← Replace with AEP Datastream ID
  orgId:        "YOUR_ORG_ID@AdobeOrg",// ← Replace with IMS Org ID
  edgeDomain:   "edge.adobedc.net",
  debugMode:    true,                  // ← Set false in production
};
```

### Events Reference

| Event Name | XDM eventType | Fired When |
|---|---|---|
| `web.webpagedetails.pageViews` | `web.webpagedetails.pageViews` | Every page load |
| `nexabank.user.loginAttempt` | `web.formFilledOut` | Login button clicked |
| `nexabank.user.loginSuccess` | `web.formFilledOut` | Valid credentials |
| `nexabank.user.loginFailure` | `web.formFilledOut` | Invalid credentials / empty fields |
| `nexabank.user.logout` | `web.webinteraction.linkClicks` | Sign Out button |
| `web.formFilledOut` (start) | `web.formFilledOut` | First field focused in any form |
| `web.formFilledOut` (complete) | `web.formFilledOut` | Form successfully submitted |
| `web.formFilledOut` (error) | `web.formFilledOut` | Form validation failure |
| `web.webinteraction.linkClicks` | `web.webinteraction.linkClicks` | Any `[data-cta-name]` element |
| `web.webinteraction.linkClicks` | `web.webinteraction.linkClicks` | Any `[data-nav-section]` element |
| `commerce.productListViews` | `commerce.productListViews` | Product page load (all 4 product pages + homepage) |
| `nexabank.calculator.start` | `web.formFilledOut` | First input focus in calculator |
| `nexabank.calculator.emailGate` | `web.formFilledOut` | Next → clicked with valid inputs |
| `nexabank.calculator.complete` | `web.formFilledOut` | Show My Result clicked with valid email |
| `nexabank.cardApplication.start` | `web.formFilledOut` | Card application page load |
| `nexabank.cardApplication.personal-info` | `web.formFilledOut` | Step 1 → Step 2 |
| `nexabank.cardApplication.employment` | `web.formFilledOut` | Step 2 → Step 3 |
| `nexabank.cardApplication.review` | `web.formFilledOut` | Review screen reached |
| `nexabank.cardApplication.error` | `web.formFilledOut` | Validation failure on any step |
| `nexabank.cardApplication.complete` | `web.formFilledOut` | Application submitted |

### Inspecting Events in Browser DevTools
```js
// Console commands to inspect the data layer:
window.adobeDataLayer                          // Full event array
window.adobeDataLayer[window.adobeDataLayer.length - 1]  // Last event
window.adobeDataLayer.filter(e => e.event === "nexabank.user.loginSuccess")
```
The **📊 AEP DataLayer** badge visible in the bottom-right corner confirms debug mode is active.

---

## 🔌 Connecting to Adobe Experience Platform

### Step 1 – Create a Datastream
1. In AEP UI → **Data Collection → Datastreams → Create Datastream**
2. Select your schema (or create one with `ExperienceEvent` base class)
3. Add **Adobe Analytics** and/or **Adobe Experience Platform** services
4. Copy the **Datastream ID**

### Step 2 – Get Your IMS Org ID
1. In AEP UI → click your profile avatar (top right)
2. Copy the value from **"Organization ID"** (format: `xxxxxxxx@AdobeOrg`)

### Step 3 – Update Config
In `js/datalayer.js` (lines 21-26):
```js
var CONFIG = {
  datastreamId: "abc12345-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  orgId:        "ABCDEF12345@AdobeOrg",
  edgeDomain:   "edge.adobedc.net",
  debugMode:    false,  // disable debug badge in production
};
```

### Step 4 – Enable the Alloy Bootstrap
Uncomment the alloy bootstrap block in any `<head>` (already in `index.html` and `contact.html`):
```html
<script>
  !function(n,o){o.forEach(function(o){n[o]||((n.__alloyNS=n.__alloyNS||
  []).push(o),n[o]=function(){var u=arguments;return new Promise(function(i,l)
  {n[o].q.push([i,l,u])})},n[o].q=[])})}(window,["alloy"]);
</script>
<script src="https://cdn1.adoberesources.net/alloy/2.19.2/alloy.min.js" async></script>
```
The `alloy("configure", {...})` call in `js/main.js` (currently commented out) will activate automatically once alloy.js loads.

### Step 5 – Adobe Tags (Launch) Alternative
If using Adobe Tags instead of direct alloy.js:
1. Create a **Tag property** in Data Collection UI
2. Add the **AEP Web SDK extension** and configure it with your Datastream
3. Create a **Rule**: Event = "Library Loaded" → Action = "Send event" with `%event.xdm%` mapped to the `web.adobeDataLayer` events
4. Replace the alloy CDN script tag with your Tags embed code

---

## 🏗 XDM Schema Recommendations

For optimal use with AEP, create a custom XDM schema with:

```
ExperienceEvent (base)
  └─ web (Web)
      ├─ webPageDetails
      ├─ webFormFilledOut
      └─ webInteraction
  └─ commerce (Commerce)
      └─ productListViews
  └─ _nexabank (Custom field group: "NexaBank Fields")
      ├─ bank { brandName, country, division }
      ├─ page { pageCategory, pageSubCategory, pageType, pageLanguage }
      ├─ form { formID, formName, formType, formStep, firstFieldInteracted, ... }
      ├─ authentication { event, username, method, failureReason, sessionStart }
      ├─ calculator { calculatorType, calculatorStep, loanAmount, tenure, ... }
      └─ cardApplication { formID, stepName, stepNumber, cardType, referenceNo }
```

---

## 🎨 Design Notes

- Colour palette: **Golden yellow `#f5a623`** (primary) + **Deep navy `#1a1a2e`** (secondary)
- Fonts: System UI stack (`-apple-system, "Segoe UI", system-ui, sans-serif`)
- Breakpoints: 1024px (tablet), 768px (mobile), 480px (small mobile)
- No external CSS frameworks — fully custom styles in `css/styles.css`

---

## 📋 Pages Overview

| Page | URL | Description |
|---|---|---|
| Homepage | `index.html` | Hero, login card, product cards, promotions, app banner |
| Contact Us | `contact.html` | Channel cards, FAQ accordion, sticky enquiry form |
| Savings & Deposits | `savings-deposits.html` | 3 product cards, features, CTA |
| Credit Cards | `credit-cards.html` | 3 card options, eligibility, apply links |
| Home Financing | `home-financing.html` | 3 loan packages, 3-step EMI calculator |
| Personal Financing | `personal-financing.html` | 3 loan plans, 3-step instalment calculator |
| Card Application | `card-application.html` | 3-step form: Personal → Employment → Review |
| Dashboard | `dashboard.html` | Auth-protected: accounts, transactions, quick actions |

---

## 🔒 Security Notes

- This is a **demo/prototype only** — no real banking data, credentials, or PII
- Credentials are hardcoded in `main.js` for demo purposes — **never do this in production**
- `sessionStorage` auth state resets on browser tab close
- PIDM, Bank Negara Malaysia, and all regulatory references are fictional for demo use

---

*Built for IBM Client Demo · NexaBank Berhad is a fictional entity*
