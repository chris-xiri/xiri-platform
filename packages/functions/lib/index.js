"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/utils/emailUtils.ts
var emailUtils_exports = {};
__export(emailUtils_exports, {
  generatePersonalizedEmail: () => generatePersonalizedEmail,
  getTemplate: () => getTemplate,
  parseAddress: () => parseAddress,
  replaceVariables: () => replaceVariables,
  sendEmail: () => sendEmail,
  sendTemplatedEmail: () => sendTemplatedEmail
});
async function getTemplate(templateId) {
  try {
    const doc = await db2.collection("templates").doc(templateId).get();
    if (!doc.exists) {
      console.error(`Template ${templateId} not found`);
      return null;
    }
    return doc.data();
  } catch (error11) {
    console.error("Error fetching template:", error11);
    return null;
  }
}
function replaceVariables(content, variables) {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
}
async function generatePersonalizedEmail(templateId, variables) {
  try {
    const template = await getTemplate(templateId);
    if (!template) return null;
    const model4 = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `You are a professional email writer for Xiri Facility Solutions.

Take this email template and personalize it while maintaining the core message:

Subject: ${template.subject}
Body:
${template.content}

Variables to use:
${Object.entries(variables).map(([key, val]) => `- ${key}: ${val}`).join("\n")}

Instructions:
1. Replace all {{variables}} with the actual values
2. Make the tone warm and professional
3. Keep it concise (under 150 words)
4. Output ONLY the email in this format:
SUBJECT: [subject line]
BODY:
[email body]`;
    const result = await model4.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    const response = result.response.text();
    const subjectMatch = response.match(/SUBJECT:\s*(.+)/);
    const bodyMatch = response.match(/BODY:\s*([\s\S]+)/);
    if (!subjectMatch || !bodyMatch) {
      return {
        subject: replaceVariables(template.subject, variables),
        body: replaceVariables(template.content, variables)
      };
    }
    return {
      subject: subjectMatch[1].trim(),
      body: bodyMatch[1].trim()
    };
  } catch (error11) {
    console.error("Error generating email:", error11);
    return null;
  }
}
function parseAddress(raw) {
  const empty = { streetAddress: "", city: "", state: "", zip: "" };
  if (!raw || raw === "Unknown") return empty;
  const zipMatch = raw.match(/\b(\d{5})(-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[1] : "";
  let cleaned = raw.replace(/\b\d{5}(-\d{4})?\b/, "").trim().replace(/,\s*$/, "");
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      streetAddress: parts[0],
      city: parts[1],
      state: parts[2].replace(/[^A-Za-z]/g, "").substring(0, 2).toUpperCase(),
      zip
    };
  } else if (parts.length === 2) {
    const stateMatch = parts[1].match(/^([A-Z]{2})\b/);
    if (stateMatch) {
      return { streetAddress: "", city: parts[0], state: stateMatch[1], zip };
    }
    return { streetAddress: parts[0], city: parts[1], state: "", zip };
  } else if (parts.length === 1) {
    const stateMatch = parts[0].match(/\b([A-Z]{2})\b/);
    if (stateMatch) {
      const beforeState = parts[0].substring(0, parts[0].indexOf(stateMatch[1])).trim();
      return { streetAddress: "", city: beforeState, state: stateMatch[1], zip };
    }
    return { streetAddress: "", city: parts[0], state: "", zip };
  }
  return empty;
}
function extractZipFromAddress(address) {
  return parseAddress(address).zip || null;
}
async function sendTemplatedEmail(vendorId, templateId, customVariables) {
  try {
    const vendorDoc = await db2.collection("vendors").doc(vendorId).get();
    if (!vendorDoc.exists) {
      console.error(`Vendor ${vendorId} not found`);
      return;
    }
    const vendor = vendorDoc.data();
    const variables = {
      vendorName: vendor?.businessName || "Vendor",
      zipCode: vendor?.zipCode || extractZipFromAddress(vendor?.address) || "your area",
      specialty: vendor?.specialty || "your trade",
      portalLink: `https://xiri.ai/vendor/onboarding/${vendorId}`,
      ...customVariables
    };
    const email = await generatePersonalizedEmail(templateId, variables);
    if (!email) {
      console.error("Failed to generate email");
      return;
    }
    let resendId;
    try {
      const { data } = await resend.emails.send({
        from: "Xiri Facility Solutions <onboarding@xiri.ai>",
        replyTo: "chris@xiri.ai",
        to: vendor?.email || "",
        subject: email.subject,
        html: email.body
      });
      resendId = data?.id;
      console.log(`\u2705 Email sent to ${vendor?.companyName}: ${email.subject} (Resend ID: ${data?.id})`);
    } catch (error11) {
      console.error("\u274C Resend API error:", error11);
      await db2.collection("vendor_activities").add({
        vendorId,
        type: "EMAIL_FAILED",
        description: `Failed to send email: ${email.subject}`,
        createdAt: admin2.firestore.FieldValue.serverTimestamp(),
        metadata: {
          templateId,
          subject: email.subject,
          to: vendor?.email || "unknown",
          error: String(error11)
        }
      });
      return;
    }
    await db2.collection("vendor_activities").add({
      vendorId,
      type: "EMAIL_SENT",
      description: `Email sent: ${email.subject}`,
      createdAt: admin2.firestore.FieldValue.serverTimestamp(),
      metadata: {
        templateId,
        subject: email.subject,
        body: email.body,
        to: vendor?.email || "unknown",
        from: "Xiri Facility Solutions <onboarding@xiri.ai>",
        replyTo: "chris@xiri.ai",
        resendId
        // NEW: Track Resend email ID
      }
    });
  } catch (error11) {
    console.error("Error sending email:", error11);
  }
}
async function sendEmail(to, subject, html, attachments, from, vendorId, templateId) {
  try {
    const tags = [];
    if (vendorId) tags.push({ name: "vendorId", value: vendorId });
    if (templateId) tags.push({ name: "templateId", value: templateId });
    const { data, error: error11 } = await resend.emails.send({
      from: from || "Xiri Facility Solutions <onboarding@xiri.ai>",
      replyTo: "chris@xiri.ai",
      to,
      subject,
      html,
      attachments,
      ...tags.length > 0 ? { tags } : {}
    });
    if (error11) {
      console.error("\u274C Resend API error:", error11);
      return { success: false };
    }
    console.log(`\u2705 Email sent to ${to}: ${subject} (ID: ${data?.id})`);
    return { success: true, resendId: data?.id };
  } catch (err) {
    console.error("Error sending raw email:", err);
    return { success: false };
  }
}
var admin2, import_generative_ai, import_resend, db2, genAI, resend;
var init_emailUtils = __esm({
  "src/utils/emailUtils.ts"() {
    "use strict";
    admin2 = __toESM(require("firebase-admin"));
    import_generative_ai = require("@google/generative-ai");
    import_resend = require("resend");
    db2 = admin2.firestore();
    genAI = new import_generative_ai.GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    resend = new import_resend.Resend(process.env.RESEND_API_KEY || "re_dummy_key");
  }
});

// src/agents/sodaSourcer.ts
var sodaSourcer_exports = {};
__export(sodaSourcer_exports, {
  searchVendorsSoda: () => searchVendorsSoda
});
async function searchNycDca(query, location, dcaCategory, limit = 50) {
  let where = "license_status='Active'";
  if (dcaCategory) {
    where += ` AND business_category='${dcaCategory.replace(/'/g, "''")}'`;
  } else {
    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const searchTerms = queryWords.length > 0 ? queryWords : ["clean", "janitor", "maintenance", "hvac"];
    const nameFilter = searchTerms.map((w) => `upper(business_name) like '%${w.toUpperCase()}%'`).join(" OR ");
    where += ` AND (${nameFilter})`;
  }
  const boroughMap = {
    "manhattan": "Manhattan",
    "nyc": "",
    "new york": "",
    "brooklyn": "Brooklyn",
    "queens": "Queens",
    "bronx": "Bronx",
    "staten island": "Staten Island"
  };
  const normalizedLoc = location.toLowerCase().trim();
  const borough = boroughMap[normalizedLoc];
  if (borough) {
    where += ` AND address_borough='${borough}'`;
  }
  try {
    const params = new URLSearchParams({
      "$limit": String(limit),
      "$where": where,
      "$select": "business_name,business_category,contact_phone,address_building,address_street_name,address_city,address_state,address_zip,address_borough,license_status,lic_expir_dd,latitude,longitude",
      "$order": "business_name ASC"
    });
    console.log(`[SODA/NYC] Querying DCA: ${where}`);
    const response = await import_axios.default.get(`${NYC_DCA_ENDPOINT}?${params}`);
    const results = response.data || [];
    console.log(`[SODA/NYC] Found ${results.length} results from NYC DCA`);
    return results.map((item) => ({
      name: item.business_name,
      description: `NYC DCA Licensed ${item.business_category} (${item.license_status})`,
      location: `${item.address_building} ${item.address_street_name}, ${item.address_city}, ${item.address_state} ${item.address_zip}`,
      phone: item.contact_phone,
      source: "nyc_open_data",
      dcaCategory: item.business_category,
      rating: void 0,
      user_ratings_total: void 0
    }));
  } catch (error11) {
    console.error("[SODA/NYC] Error:", error11.message);
    return [];
  }
}
async function searchNyState(query, location, limit = 50) {
  const queryWords = query.toLowerCase().split(/[\s,\/]+/).filter((w) => w.length > 3);
  const nameFilters = queryWords.map((w) => `upper(current_entity_name) like '%${w.toUpperCase()}%'`).join(" OR ");
  const locationWords = location.toLowerCase().split(/[\s,\/]+/).filter((w) => w.length > 2);
  let locFilter = "";
  if (locationWords.length > 0) {
    const locConditions = locationWords.map(
      (w) => `(upper(dos_process_city) like '%${w.toUpperCase()}%' OR upper(county) like '%${w.toUpperCase()}%')`
    ).join(" OR ");
    locFilter = ` AND (${locConditions})`;
  }
  const where = `(${nameFilters || "current_entity_name like '%CLEAN%'"})${locFilter}`;
  try {
    const params = new URLSearchParams({
      "$limit": String(limit),
      "$where": where,
      "$order": "initial_dos_filing_date DESC"
    });
    console.log(`[SODA/NYS] Querying State Corps: ${where}`);
    const response = await import_axios.default.get(`${NYS_CORP_ENDPOINT}?${params}`);
    const results = response.data || [];
    console.log(`[SODA/NYS] Found ${results.length} results from NY State`);
    return results.map((b) => ({
      name: titleCase(b.current_entity_name || ""),
      description: `${b.entity_type_desc || "Business Entity"} \u2014 Registered in NY State. Filed: ${b.initial_dos_filing_date ? new Date(b.initial_dos_filing_date).toLocaleDateString() : "N/A"}`,
      location: [b.dos_process_address_1, b.dos_process_city, "NY", b.dos_process_zip].filter(Boolean).join(", "),
      phone: void 0,
      source: "ny_state_corps",
      rating: void 0,
      user_ratings_total: void 0
    }));
  } catch (error11) {
    console.error("[SODA/NYS] Error:", error11.message);
    return [];
  }
}
async function searchVendorsSoda(query, location, dcaCategory) {
  const normalizedLoc = location.toLowerCase().trim();
  const isNycBorough = ["manhattan", "brooklyn", "queens", "bronx", "staten island", "nyc", "new york city", "new york"].includes(normalizedLoc);
  const isLongIsland = ["nassau", "suffolk", "long island", "garden city", "mineola", "hempstead", "hicksville", "huntington", "babylon", "islip"].includes(normalizedLoc);
  const results = [];
  if (isNycBorough || !isLongIsland) {
    const nycResults = await searchNycDca(query, location, dcaCategory, 25);
    results.push(...nycResults);
  }
  const nysResults = await searchNyState(query, location, 25);
  results.push(...nysResults);
  const seen = /* @__PURE__ */ new Set();
  const deduped = results.filter((v) => {
    const key = v.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`[SODA] Total: ${deduped.length} unique vendors (${results.length} before dedup)`);
  return deduped;
}
function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
var import_axios, NYC_DCA_ENDPOINT, NYS_CORP_ENDPOINT;
var init_sodaSourcer = __esm({
  "src/agents/sodaSourcer.ts"() {
    "use strict";
    import_axios = __toESM(require("axios"));
    NYC_DCA_ENDPOINT = "https://data.cityofnewyork.us/resource/w7w3-xahh.json";
    NYS_CORP_ENDPOINT = "https://data.ny.gov/resource/n9v6-gdp6.json";
  }
});

// src/utils/queueUtils.ts
var queueUtils_exports = {};
__export(queueUtils_exports, {
  cancelLeadTasks: () => cancelLeadTasks,
  cancelVendorTasks: () => cancelVendorTasks,
  enqueueTask: () => enqueueTask,
  fetchPendingTasks: () => fetchPendingTasks,
  updateTaskStatus: () => updateTaskStatus
});
async function enqueueTask(db23, task) {
  return db23.collection(COLLECTION).add({
    ...task,
    status: "PENDING",
    retryCount: 0,
    createdAt: /* @__PURE__ */ new Date()
  });
}
async function fetchPendingTasks(db23) {
  const now = admin3.firestore.Timestamp.now();
  const snapshot = await db23.collection(COLLECTION).where("status", "in", ["PENDING", "RETRY"]).where("scheduledAt", "<=", now).limit(10).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
async function updateTaskStatus(db23, taskId, status, updates = {}) {
  await db23.collection(COLLECTION).doc(taskId).update({
    status,
    ...updates
  });
}
async function cancelVendorTasks(db23, vendorId) {
  const snapshot = await db23.collection(COLLECTION).where("vendorId", "==", vendorId).where("status", "in", ["PENDING", "RETRY"]).get();
  const batch = db23.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { status: "CANCELLED", cancelledAt: /* @__PURE__ */ new Date() });
  });
  await batch.commit();
  return snapshot.size;
}
async function cancelLeadTasks(db23, leadId) {
  const snapshot = await db23.collection(COLLECTION).where("leadId", "==", leadId).where("status", "in", ["PENDING", "RETRY"]).get();
  const batch = db23.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { status: "CANCELLED", cancelledAt: /* @__PURE__ */ new Date() });
  });
  await batch.commit();
  return snapshot.size;
}
var admin3, COLLECTION;
var init_queueUtils = __esm({
  "src/utils/queueUtils.ts"() {
    "use strict";
    admin3 = __toESM(require("firebase-admin"));
    COLLECTION = "outreach_queue";
  }
});

// ../shared/src/TaxCertificateService.js
var require_TaxCertificateService = __commonJS({
  "../shared/src/TaxCertificateService.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.generateST1201 = generateST12012;
    var pdf_lib_1 = require("pdf-lib");
    var fs = __importStar(require("fs"));
    var path = __importStar(require("path"));
    var CERT_VALIDITY_YEARS = 3;
    async function generateST12012(vendorData, xiriData, projectData) {
      if (!vendorData.salesTaxId || vendorData.salesTaxId.trim().length === 0) {
        return {
          success: false,
          error: "Vendor does not have a valid Sales Tax ID (Certificate of Authority). Cannot generate ST-120.1."
        };
      }
      try {
        const now = /* @__PURE__ */ new Date();
        const issueDate = now.toLocaleDateString("en-US");
        const expiry = new Date(now);
        expiry.setFullYear(expiry.getFullYear() + CERT_VALIDITY_YEARS);
        const expiryDate = expiry.toISOString().split("T")[0];
        const templatePath = path.resolve(__dirname, "templates", "st120_1_template.pdf");
        const templateBytes = fs.readFileSync(templatePath);
        const pdfDoc = await pdf_lib_1.PDFDocument.load(templateBytes);
        const form = pdfDoc.getForm();
        form.getTextField("name of vendor").setText(vendorData.businessName);
        form.getTextField("street address1").setText(vendorData.address || "");
        form.getTextField("city1").setText(vendorData.city || "");
        form.getTextField("state1").setText(vendorData.state || "");
        form.getTextField("zip code 1").setText(vendorData.zip || "");
        form.getTextField("enter your sales tax vendor id number").setText(vendorData.salesTaxId);
        form.getTextField("name of purchasing contractor").setText(xiriData.businessName);
        form.getTextField("street address2").setText(xiriData.address);
        form.getTextField("city2").setText(xiriData.city);
        form.getTextField("state2").setText(xiriData.state);
        form.getTextField("zip code 2").setText(xiriData.zip);
        form.getTextField("line 2 1").setText(projectData.projectName);
        const fullProjectAddress = [
          projectData.projectAddress,
          projectData.projectCity,
          projectData.projectState,
          projectData.projectZip
        ].filter(Boolean).join(", ");
        form.getTextField("line 2 2").setText(fullProjectAddress);
        form.getTextField("line 2 3").setText(projectData.ownerName);
        form.getTextField("line 2 4").setText(projectData.ownerAddress);
        form.getCheckBox("box m").check();
        form.getTextField("type or print name and title of owner").setText(`${xiriData.signerName}, ${xiriData.signerTitle}`);
        form.getTextField("date prepared").setText(issueDate);
        if (xiriData.signatureImageBase64) {
          try {
            const sigBytes = Buffer.from(xiriData.signatureImageBase64, "base64");
            let sigImage;
            try {
              sigImage = await pdfDoc.embedPng(sigBytes);
            } catch {
              sigImage = await pdfDoc.embedJpg(sigBytes);
            }
            const pages = pdfDoc.getPages();
            const lastPage = pages[pages.length - 1];
            const { height } = lastPage.getSize();
            lastPage.drawImage(sigImage, {
              x: 72,
              y: height - 720,
              // near bottom of form
              width: 150,
              height: 40
            });
          } catch (sigErr) {
            console.warn("Could not embed signature image:", sigErr);
          }
        }
        form.flatten();
        const pdfBytes = await pdfDoc.save();
        return {
          success: true,
          pdfBytes,
          issueDate: now.toISOString().split("T")[0],
          // ISO for storage
          expiryDate
        };
      } catch (error11) {
        return {
          success: false,
          error: `Failed to generate ST-120.1: ${error11.message}`
        };
      }
    }
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  adminUpdateAuthUser: () => adminUpdateAuthUser,
  calculateNrr: () => calculateNrr,
  changeMyPassword: () => changeMyPassword,
  clearPipeline: () => clearPipeline,
  enrichFromWebsite: () => enrichFromWebsite,
  generateLeads: () => generateLeads,
  generateMonthlyInvoices: () => generateMonthlyInvoices,
  handleUnsubscribe: () => handleUnsubscribe,
  onAuditFailed: () => onAuditFailed,
  onAuditSubmitted: () => onAuditSubmitted,
  onAwaitingOnboarding: () => onAwaitingOnboarding,
  onClientCancelled: () => onClientCancelled,
  onDocumentUploaded: () => onDocumentUploaded,
  onIncomingMessage: () => onIncomingMessage,
  onInvoicePaid: () => onInvoicePaid,
  onLeadQualified: () => onLeadQualified,
  onLeadUpdated: () => onLeadUpdated,
  onOnboardingComplete: () => onOnboardingComplete,
  onQuoteAccepted: () => onQuoteAccepted,
  onStaffUpdated: () => onStaffUpdated,
  onVendorApproved: () => onVendorApproved,
  onVendorCreated: () => onVendorCreated,
  onVendorUpdated: () => onVendorUpdated,
  onWorkOrderAssigned: () => onWorkOrderAssigned,
  onWorkOrderHandoff: () => onWorkOrderHandoff,
  optimizeTemplate: () => optimizeTemplate,
  processCommissionPayouts: () => processCommissionPayouts,
  processMailQueue: () => processMailQueue,
  processOutreachQueue: () => processOutreachQueue,
  resendWebhook: () => resendWebhook,
  respondToQuote: () => respondToQuote,
  runRecruiterAgent: () => runRecruiterAgent,
  sendBookingConfirmation: () => sendBookingConfirmation,
  sendOnboardingInvite: () => sendOnboardingInvite,
  sendQuoteEmail: () => sendQuoteEmail,
  sourceProperties: () => sourceProperties,
  testSendEmail: () => testSendEmail,
  weeklyTemplateOptimizer: () => weeklyTemplateOptimizer
});
module.exports = __toCommonJS(index_exports);
var import_https6 = require("firebase-functions/v2/https");

// src/utils/firebase.ts
var admin = __toESM(require("firebase-admin"));
var dotenv = __toESM(require("dotenv"));
dotenv.config();
if (!admin.apps.length) {
  admin.initializeApp();
}
var db = admin.firestore();
try {
  db.settings({ ignoreUndefinedProperties: true });
} catch (error11) {
  console.log("Firestore settings usage note:", error11);
}

// src/agents/recruiter.ts
var import_generative_ai2 = require("@google/generative-ai");
init_emailUtils();
function normalizeUrl(url) {
  if (!url) return "";
  return url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "").trim();
}
var API_KEY = process.env.GEMINI_API_KEY || "";
var genAI2 = new import_generative_ai2.GoogleGenerativeAI(API_KEY);
var model = genAI2.getGenerativeModel({ model: "gemini-2.0-flash" });
var analyzeVendorLeads = async (rawVendors, jobQuery, hasActiveContract = false, previewOnly = false) => {
  console.log("!!! RECRUITER AGENT UPDATED - V4 (Robust Dedup + Blacklist) !!!");
  let analyzed = 0;
  let qualified = 0;
  const errors = [];
  const batch = db.batch();
  const previewVendors = [];
  if (rawVendors.length === 0) return { analyzed, qualified, errors };
  const threshold = hasActiveContract ? 50 : 0;
  const modeDescription = hasActiveContract ? "URGENT FULFILLMENT: We need high-quality vendors ready to deploy. Be strict." : "DATABASE BUILDING: We are building a supply list. ACCEPT ALL VENDORS. Do not filter. Score is for reference only.";
  let vendorsToAnalyze = rawVendors;
  let prompt = "";
  try {
    let dismissedNames = /* @__PURE__ */ new Set();
    let dismissedPhones = /* @__PURE__ */ new Set();
    let dismissedWebsites = /* @__PURE__ */ new Set();
    try {
      const dismissedSnapshot = await db.collection("dismissed_vendors").get();
      if (!dismissedSnapshot.empty) {
        for (const doc of dismissedSnapshot.docs) {
          const d = doc.data();
          if (d.businessName) dismissedNames.add(d.businessName.toLowerCase().trim());
          if (d.phone) dismissedPhones.add(d.phone.replace(/\D/g, ""));
          if (d.website) dismissedWebsites.add(normalizeUrl(d.website));
        }
        console.log(`Loaded ${dismissedNames.size} dismissed vendor names, ${dismissedPhones.size} phones, ${dismissedWebsites.size} websites.`);
      }
    } catch (dismissErr) {
      console.warn("Could not check dismissed_vendors:", dismissErr.message);
    }
    const vendorsToProcess = [];
    const duplicateUpdates = [];
    let existingByNameLower = /* @__PURE__ */ new Map();
    let existingByPhone = /* @__PURE__ */ new Map();
    let existingByWebsite = /* @__PURE__ */ new Map();
    try {
      const existingSnap = await db.collection("vendors").select("businessName", "businessNameLower", "phone", "website").get();
      for (const doc of existingSnap.docs) {
        const data = doc.data();
        const nameLower = (data.businessNameLower || data.businessName || "").toLowerCase().trim();
        if (nameLower) existingByNameLower.set(nameLower, doc.id);
        if (data.phone) existingByPhone.set(data.phone.replace(/\D/g, ""), doc.id);
        if (data.website) existingByWebsite.set(normalizeUrl(data.website), doc.id);
      }
      console.log(`Loaded ${existingByNameLower.size} existing vendors for dedup (names: ${existingByNameLower.size}, phones: ${existingByPhone.size}, websites: ${existingByWebsite.size}).`);
    } catch (err) {
      console.warn("Could not pre-load vendors for dedup:", err.message);
    }
    console.log(`Checking ${rawVendors.length} vendors for duplicates and blacklist...`);
    for (const vendor of rawVendors) {
      const bName = vendor.name || vendor.companyName || vendor.title || "";
      const bNameLower = bName.toLowerCase().trim();
      const bPhone = (vendor.phone || "").replace(/\D/g, "");
      const bWebsite = normalizeUrl(vendor.website || "");
      const isBlacklisted = bNameLower && dismissedNames.has(bNameLower) || bPhone && bPhone.length >= 7 && dismissedPhones.has(bPhone) || bWebsite && dismissedWebsites.has(bWebsite);
      if (isBlacklisted) {
        console.log(`\u26D4 Blacklisted vendor skipped: ${bName}`);
        continue;
      }
      const existingDocId = bNameLower && existingByNameLower.get(bNameLower) || bPhone && bPhone.length >= 7 && existingByPhone.get(bPhone) || bWebsite && existingByWebsite.get(bWebsite) || null;
      if (existingDocId) {
        console.log(`\u{1F501} Duplicate vendor skipped: ${bName} (matches ${existingDocId})`);
        duplicateUpdates.push(
          db.collection("vendors").doc(existingDocId).update({
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          })
        );
      } else {
        vendorsToProcess.push(vendor);
      }
    }
    if (duplicateUpdates.length > 0) {
      await Promise.all(duplicateUpdates);
      console.log(`Updated ${duplicateUpdates.length} existing vendors.`);
    }
    if (vendorsToProcess.length === 0) {
      console.log("All vendors were duplicates or blacklisted. Sourcing complete.");
      return { analyzed, qualified, errors };
    }
    vendorsToAnalyze = vendorsToProcess;
    const templateDoc = await db.collection("templates").doc("recruiter_analysis_prompt").get();
    if (!templateDoc.exists) {
      throw new Error("Recruiter analysis prompt not found in database");
    }
    const template = templateDoc.data();
    const vendorList = JSON.stringify(vendorsToAnalyze.map((v, i) => ({
      index: i,
      name: v.name || v.companyName,
      description: v.description || v.services,
      address: v.location || v.address || v.vicinity,
      // Google Places often uses 'vicinity'
      website: v.website,
      phone: v.phone
    })));
    prompt = template?.content.replace(/\{\{query\}\}/g, jobQuery).replace(/\{\{modeDescription\}\}/g, modeDescription).replace(/\{\{threshold\}\}/g, threshold.toString()).replace(/\{\{vendorList\}\}/g, vendorList);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    console.log("Gemini Raw Response:", text);
    const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const analysis = JSON.parse(jsonStr);
    analyzed = analysis.length;
    for (const item of analysis) {
      if (item.isQualified || threshold === 0) {
        qualified++;
        const originalVendor = vendorsToAnalyze[item.index];
        if (!originalVendor) {
          console.warn(`Analysis returned index ${item.index} but we only have ${vendorsToAnalyze.length} vendors.`);
          continue;
        }
        const bName = originalVendor.name || originalVendor.companyName || originalVendor.title || "Unknown Vendor";
        const vendorRef = db.collection("vendors").doc();
        const rawAddr = originalVendor.location || item.address || "Unknown";
        const parsed = parseAddress(rawAddr);
        const newVendor = {
          id: vendorRef.id,
          businessName: bName,
          businessNameLower: bName.toLowerCase().trim(),
          capabilities: item.services || (item.primarySpecialty ? [item.primarySpecialty] : item.specialty ? [item.specialty] : []),
          specialty: item.primarySpecialty || item.specialty || item.services?.[0] || void 0,
          contactName: item.contactName || void 0,
          address: rawAddr,
          streetAddress: parsed.streetAddress || void 0,
          city: item.city || parsed.city || void 0,
          state: item.state || parsed.state || void 0,
          zip: item.zip || parsed.zip || void 0,
          country: item.country || "USA",
          phone: originalVendor.phone || item.phone || void 0,
          email: originalVendor.email || item.email || void 0,
          website: originalVendor.website || item.website || void 0,
          dcaCategory: originalVendor.dcaCategory || void 0,
          fitScore: item.fitScore,
          aiReasoning: item.reasoning || void 0,
          hasActiveContract,
          onboardingTrack: hasActiveContract ? "FAST_TRACK" : "STANDARD",
          status: "pending_review",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        console.log(`Adding qualified vendor to batch: ${newVendor.businessName}`);
        if (previewOnly) {
          const isDismissed = dismissedNames.has((newVendor.businessName || "").toLowerCase().trim());
          previewVendors.push({ ...newVendor, isDismissed });
        } else {
          batch.set(vendorRef, newVendor);
        }
      }
    }
    if (qualified > 0 && !previewOnly) {
      console.log(`Committing batch of ${qualified} vendors...`);
      await batch.commit();
      console.log("Batch commit successful.");
    } else if (previewOnly) {
      console.log(`Preview mode: ${qualified} vendors ready for review (not saved).`);
    } else {
      console.log("No qualified vendors to commit.");
    }
  } catch (err) {
    console.error("AI Analysis Failed:", err.message);
    console.error("Prompt used:", prompt);
    errors.push(err.message);
    console.log("Saving raw vendors with 'pending_review' status due to AI failure...");
    for (const originalVendor of vendorsToAnalyze) {
      const vendorRef = db.collection("vendors").doc();
      const bName = originalVendor.name || originalVendor.companyName || originalVendor.title || "Unknown Vendor";
      const rawAddr = originalVendor.location || originalVendor.address || "Unknown";
      const parsed = parseAddress(rawAddr);
      const newVendor = {
        id: vendorRef.id,
        businessName: bName,
        capabilities: [],
        address: rawAddr,
        streetAddress: parsed.streetAddress || void 0,
        city: parsed.city || void 0,
        state: parsed.state || void 0,
        zip: parsed.zip || void 0,
        phone: originalVendor.phone || void 0,
        email: originalVendor.email || void 0,
        website: originalVendor.website || void 0,
        dcaCategory: originalVendor.dcaCategory || void 0,
        fitScore: 0,
        status: "pending_review",
        hasActiveContract,
        onboardingTrack: hasActiveContract ? "FAST_TRACK" : "STANDARD",
        aiReasoning: `AI Analysis Failed: ${err.message}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      batch.set(vendorRef, newVendor);
      if (previewOnly) {
        previewVendors.push(newVendor);
      }
      qualified++;
    }
    if (qualified > 0 && !previewOnly) {
      console.log(`Committing batch of ${qualified} fallback vendors...`);
      await batch.commit();
    }
  }
  return { analyzed, qualified, errors, vendors: previewOnly ? previewVendors : void 0 };
};

// src/agents/sourcer.ts
var import_axios2 = __toESM(require("axios"));
var searchVendors = async (query, location, provider = "google_maps", dcaCategory) => {
  console.log(`Searching for: "${query}" in "${location}" [provider: ${provider}]`);
  if (provider === "nyc_open_data") {
    const { searchVendorsSoda: searchVendorsSoda2 } = await Promise.resolve().then(() => (init_sodaSourcer(), sodaSourcer_exports));
    return searchVendorsSoda2(query, location, dcaCategory);
  }
  const apiKey = process.env.SERPER_API_KEY || "02ece77ffd27d2929e3e79604cb27e1dfaa40fe7";
  if (!apiKey) {
    console.warn("SERPER_API_KEY is not set. Returning mock data.");
    return getMockVendors(query, location);
  }
  const fullQuery = `${query} in ${location}`;
  console.log(`Searching for: ${fullQuery} using Serper (places)...`);
  let googleResults = [];
  try {
    const response = await import_axios2.default.post(
      "https://google.serper.dev/places",
      { q: fullQuery },
      { headers: { "X-API-KEY": apiKey.trim(), "Content-Type": "application/json" } }
    );
    const places = response.data.places || [];
    console.log(`Serper returned ${places.length} raw results.`);
    const rawVendors = places.map((place) => ({
      name: place.title,
      description: `${place.category || ""} - ${place.address || ""}`,
      location: place.address,
      phone: place.phoneNumber,
      website: place.website,
      source: "google_maps_serper",
      rating: place.rating,
      user_ratings_total: place.userRatingsTotal
    }));
    googleResults = rawVendors.filter((v) => v.rating === void 0 || v.rating >= 3.5);
    console.log(`Filtered ${rawVendors.length} -> ${googleResults.length} vendors (Rating >= 3.5 or N/A).`);
  } catch (error11) {
    console.error("Error searching vendors via Google:", error11.message);
    if (provider !== "all") {
      throw new Error(`Failed to source vendors: ${error11.message}`);
    }
  }
  if (provider === "all") {
    const { searchVendorsSoda: searchVendorsSoda2 } = await Promise.resolve().then(() => (init_sodaSourcer(), sodaSourcer_exports));
    const sodaResults = await searchVendorsSoda2(query, location, dcaCategory);
    const combined = [...googleResults, ...sodaResults];
    const seen = /* @__PURE__ */ new Set();
    const deduped = combined.filter((v) => {
      const key = v.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    console.log(`Combined: ${googleResults.length} Google + ${sodaResults.length} SODA = ${deduped.length} unique`);
    return deduped;
  }
  return googleResults;
};
var getMockVendors = (query, location) => {
  return [
    {
      name: "Mock Cleaning Services " + location,
      description: "Deep comercial cleaning and janitorial services.",
      location,
      source: "mock"
    },
    {
      name: "Test HVAC Solutions " + location,
      description: "HVAC maintenance and repair.",
      location,
      source: "mock"
    },
    {
      name: "General Facilities Co",
      description: "We do everything including plumbing and electrical.",
      location,
      source: "mock"
    }
  ];
};

// src/agents/propertySourcer.ts
var MockPropertyProvider = class {
  constructor() {
    this.name = "mock";
  }
  async search(params) {
    console.log(`[MockPropertyProvider] Searching "${params.query}" in "${params.location}"...`);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const mockProperties = [
      {
        name: "Williston Park Medical Plaza",
        address: "420 Willis Ave",
        city: "Williston Park",
        state: "NY",
        zip: "11596",
        propertyType: "medical_office",
        squareFootage: 8500,
        yearBuilt: 2005,
        ownerName: "WP Medical Holdings LLC",
        ownerPhone: "(516) 555-0101",
        tenantName: "CityMD Urgent Care",
        tenantCount: 1,
        lastSalePrice: 24e5,
        lastSaleDate: "2021-06-15",
        source: "mock",
        sourceId: "MOCK-001"
      },
      {
        name: "Mineola Surgical Center",
        address: "155 E 2nd St",
        city: "Mineola",
        state: "NY",
        zip: "11501",
        propertyType: "medical_office",
        squareFootage: 12e3,
        yearBuilt: 2010,
        ownerName: "Mineola Health Properties Inc",
        ownerPhone: "(516) 555-0202",
        tenantName: "North Shore Ambulatory Surgery",
        tenantCount: 1,
        lastSalePrice: 42e5,
        lastSaleDate: "2019-03-22",
        source: "mock",
        sourceId: "MOCK-002"
      },
      {
        name: "New Hyde Park Dialysis Suite",
        address: "700 Lakeville Rd",
        city: "New Hyde Park",
        state: "NY",
        zip: "11040",
        propertyType: "medical_office",
        squareFootage: 5200,
        yearBuilt: 2015,
        ownerName: "NHP Realty Corp",
        ownerPhone: "(516) 555-0303",
        tenantName: "DaVita Kidney Care",
        tenantCount: 1,
        lastSalePrice: 18e5,
        lastSaleDate: "2022-09-10",
        source: "mock",
        sourceId: "MOCK-003"
      },
      {
        name: "Herricks Auto Center",
        address: "200 Herricks Rd",
        city: "New Hyde Park",
        state: "NY",
        zip: "11040",
        propertyType: "auto_dealership",
        squareFootage: 22e3,
        yearBuilt: 1998,
        ownerName: "Herricks Motors LLC",
        ownerPhone: "(516) 555-0404",
        tenantName: "Herricks Toyota",
        tenantCount: 1,
        lotSize: 45e3,
        lastSalePrice: 55e5,
        lastSaleDate: "2018-01-20",
        source: "mock",
        sourceId: "MOCK-004"
      },
      {
        name: "Floral Park Urgent Care",
        address: "265 Jericho Tpke",
        city: "Floral Park",
        state: "NY",
        zip: "11001",
        propertyType: "medical_office",
        squareFootage: 4800,
        yearBuilt: 2012,
        ownerName: "FP Healthcare Properties",
        ownerPhone: "(516) 555-0505",
        tenantName: "GoHealth Urgent Care",
        tenantCount: 1,
        lastSalePrice: 15e5,
        lastSaleDate: "2020-07-05",
        source: "mock",
        sourceId: "MOCK-005"
      },
      {
        name: "Garden City Auto Mile",
        address: "500 Stewart Ave",
        city: "Garden City",
        state: "NY",
        zip: "11530",
        propertyType: "auto_dealership",
        squareFootage: 35e3,
        yearBuilt: 2001,
        ownerName: "GC Auto Holdings LLC",
        ownerPhone: "(516) 555-0606",
        tenantName: "Legacy Honda",
        tenantCount: 1,
        lotSize: 8e4,
        lastSalePrice: 82e5,
        lastSaleDate: "2017-11-30",
        source: "mock",
        sourceId: "MOCK-006"
      }
    ];
    let filtered = mockProperties;
    if (params.minSquareFootage) {
      filtered = filtered.filter((p) => (p.squareFootage || 0) >= params.minSquareFootage);
    }
    if (params.maxSquareFootage) {
      filtered = filtered.filter((p) => (p.squareFootage || 0) <= params.maxSquareFootage);
    }
    const queryLower = params.query.toLowerCase();
    if (queryLower.includes("medical") || queryLower.includes("urgent") || queryLower.includes("surgery") || queryLower.includes("dialysis")) {
      filtered = filtered.filter((p) => p.propertyType === "medical_office");
    } else if (queryLower.includes("auto") || queryLower.includes("dealer")) {
      filtered = filtered.filter((p) => p.propertyType === "auto_dealership");
    }
    const maxResults = params.maxResults || 25;
    const results = filtered.slice(0, maxResults);
    console.log(`[MockPropertyProvider] Returning ${results.length} mock properties.`);
    return results;
  }
};
var providers = {
  mock: () => new MockPropertyProvider()
  // attom: () => new AttomPropertyProvider(),
  // reonomy: () => new ReonomyPropertyProvider(),
};
function getPropertyProvider(name) {
  const factory = providers[name];
  if (!factory) {
    console.warn(`[PropertySourcer] Unknown provider "${name}", falling back to mock.`);
    return new MockPropertyProvider();
  }
  return factory();
}
var searchProperties = async (query, location, providerName = "mock") => {
  console.log(`[PropertySourcer] Sourcing: "${query}" in "${location}" via ${providerName}`);
  const provider = getPropertyProvider(providerName);
  try {
    const properties = await provider.search({ query, location });
    console.log(`[PropertySourcer] ${provider.name} returned ${properties.length} results.`);
    const singleTenant = properties.filter((p) => !p.tenantCount || p.tenantCount === 1);
    console.log(`[PropertySourcer] After single-tenant filter: ${singleTenant.length}`);
    return singleTenant;
  } catch (error11) {
    console.error(`[PropertySourcer] Error sourcing properties: ${error11.message}`);
    throw new Error(`Failed to source properties: ${error11.message}`);
  }
};

// src/triggers/onVendorApproved.ts
var import_firestore = require("firebase-functions/v2/firestore");
var import_firestore2 = require("firebase-functions/v2/firestore");
var import_params = require("firebase-functions/params");
var admin4 = __toESM(require("firebase-admin"));
var logger = __toESM(require("firebase-functions/logger"));

// src/utils/websiteScraper.ts
var cheerio = __toESM(require("cheerio"));
var import_generative_ai3 = require("@google/generative-ai");
var TIMEOUT_MS = 15e3;
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!response.ok) return null;
    const html = await response.text();
    return { html, $: cheerio.load(html) };
  } catch {
    return null;
  }
}
async function scrapeWebsite(url, geminiApiKey) {
  try {
    const homepage = await fetchPage(url);
    if (!homepage) {
      return { success: false, error: `Could not fetch ${url}` };
    }
    const structuredData = extractStructuredData(homepage.$);
    const patternData = extractFromPatterns(homepage.$, homepage.html);
    const linkData = extractMailtoAndTel(homepage.$);
    const additionalPages = findAdditionalPages(homepage.$, url);
    const contactPageResults = [];
    let allAdditionalHtml = "";
    for (const pageUrl of additionalPages.slice(0, 3)) {
      const page = await fetchPage(pageUrl);
      if (!page) continue;
      const pagePatterns = extractFromPatterns(page.$, page.html);
      const pageLinks = extractMailtoAndTel(page.$);
      const hasForm = page.$("form").length > 0;
      if (hasForm) pagePatterns.contactFormUrl = pageUrl;
      contactPageResults.push({
        ...pagePatterns,
        email: pageLinks.email || pagePatterns.email,
        phone: pageLinks.phone || pagePatterns.phone
      });
      allAdditionalHtml += page.html + "\n";
    }
    const mergedContact = mergeContactPages(contactPageResults);
    const combinedData = {
      email: structuredData.email || linkData.email || mergedContact.email || patternData.email,
      phone: structuredData.phone || linkData.phone || mergedContact.phone || patternData.phone,
      address: structuredData.address || mergedContact.address || patternData.address,
      businessName: structuredData.businessName || patternData.businessName,
      contactFormUrl: mergedContact.contactFormUrl,
      socialMedia: {
        linkedin: patternData.socialMedia?.linkedin || mergedContact.socialMedia?.linkedin,
        facebook: patternData.socialMedia?.facebook || mergedContact.socialMedia?.facebook,
        twitter: patternData.socialMedia?.twitter || mergedContact.socialMedia?.twitter
      },
      confidence: "low",
      source: "web-scraper"
    };
    if (!combinedData.email) {
      const genericEmail = findGenericEmail(homepage.html, allAdditionalHtml);
      if (genericEmail) {
        combinedData.email = genericEmail;
      }
    }
    if (!combinedData.email || !combinedData.phone) {
      const aiHtml = allAdditionalHtml.length > 500 ? allAdditionalHtml : homepage.html;
      const aiData = await extractWithAI(aiHtml, geminiApiKey);
      combinedData.email = combinedData.email || aiData.email;
      combinedData.phone = combinedData.phone || aiData.phone;
      combinedData.address = combinedData.address || aiData.address;
      combinedData.businessName = combinedData.businessName || aiData.businessName;
    }
    if (combinedData.email) {
      combinedData.email = validateEmail(combinedData.email);
    }
    if (combinedData.phone) {
      combinedData.phone = formatPhone(combinedData.phone);
    }
    combinedData.confidence = determineConfidence(structuredData, patternData, mergedContact, linkData);
    return { success: true, data: combinedData };
  } catch (error11) {
    return { success: false, error: error11.message };
  }
}
function extractMailtoAndTel($) {
  let email;
  let phone;
  $('a[href^="mailto:"]').each((_, elem) => {
    if (email) return;
    const href = $(elem).attr("href");
    if (href) {
      const addr = href.replace("mailto:", "").split("?")[0].trim().toLowerCase();
      if (!addr.match(/^(noreply|no-reply|support|webmaster)@/i)) {
        email = addr;
      }
    }
  });
  $('a[href^="tel:"]').each((_, elem) => {
    if (phone) return;
    const href = $(elem).attr("href");
    if (href) {
      phone = href.replace("tel:", "").replace(/[^\d+]/g, "").trim();
    }
  });
  return { email, phone };
}
function extractStructuredData($) {
  const data = {};
  data.email = $('meta[property="og:email"]').attr("content") || $('meta[name="contact:email"]').attr("content");
  data.phone = $('meta[property="og:phone_number"]').attr("content") || $('meta[name="contact:phone"]').attr("content");
  $('script[type="application/ld+json"]').each((_, elem) => {
    try {
      let jsonItems = JSON.parse($(elem).html() || "{}");
      if (jsonItems["@graph"]) jsonItems = jsonItems["@graph"];
      if (!Array.isArray(jsonItems)) jsonItems = [jsonItems];
      for (const json of jsonItems) {
        const type = json["@type"];
        if (type === "Organization" || type === "LocalBusiness" || type === "CleaningService" || type === "ProfessionalService" || type === "HomeAndConstructionBusiness") {
          data.email = data.email || json.email;
          data.phone = data.phone || json.telephone;
          data.businessName = data.businessName || json.name;
          if (json.address) {
            data.address = typeof json.address === "string" ? json.address : [
              json.address.streetAddress,
              json.address.addressLocality,
              json.address.addressRegion,
              json.address.postalCode
            ].filter(Boolean).join(", ");
          }
        }
      }
    } catch {
    }
  });
  data.businessName = data.businessName || $('meta[property="og:site_name"]').attr("content") || $("title").text().split("|")[0].split("-")[0].split("\u2013")[0].trim() || $("h1").first().text().trim();
  return data;
}
function extractFromPatterns($, html) {
  const data = { socialMedia: {} };
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = html.match(emailRegex) || [];
  const personalEmails = emails.filter(
    (email) => !email.match(/^(info|admin|noreply|no-reply|support|hello|contact|webmaster|sales|marketing)@/i) && !email.includes("example.com") && !email.includes("domain.com") && !email.includes("sentry.io") && !email.includes("wixpress.com") && !email.includes("wordpress.") && !email.includes("@e.")
    // tracking pixels
  );
  data.email = personalEmails[0];
  const phoneRegex = /(\+1[-.\\s]?)?\(?\d{3}\)?[-.\\s]?\d{3}[-.\\s]?\d{4}/g;
  const phones = html.match(phoneRegex) || [];
  data.phone = phones[0];
  const footerText = $('footer, [class*="footer"], [class*="contact"], [class*="address"], [itemtype*="PostalAddress"]').text();
  const addressRegex = /\d{1,5}\s[\w\s.]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Way|Ct|Court|Pl|Place|Pkwy|Parkway)[.,]?\s[\w\s]+,\s*[A-Z]{2}\s*\d{5}/gi;
  const addresses = footerText.match(addressRegex) || html.match(addressRegex) || [];
  data.address = data.address || addresses[0]?.trim();
  $('a[href*="linkedin.com"]').each((_, elem) => {
    const href = $(elem).attr("href");
    if (href && (href.includes("/company/") || href.includes("/in/"))) {
      data.socialMedia.linkedin = href;
    }
  });
  $('a[href*="facebook.com"]').each((_, elem) => {
    const href = $(elem).attr("href");
    if (href && !href.includes("sharer") && !href.includes("share.php")) {
      data.socialMedia.facebook = href;
    }
  });
  $('a[href*="twitter.com"], a[href*="x.com"]').each((_, elem) => {
    const href = $(elem).attr("href");
    if (href && !href.includes("intent/tweet")) {
      data.socialMedia.twitter = href;
    }
  });
  return data;
}
function findAdditionalPages($, baseUrl) {
  const keywords = [
    "contact",
    "about",
    "about-us",
    "our-team",
    "team",
    "location",
    "locations",
    "reach-us",
    "get-in-touch",
    "connect",
    "find-us",
    "staff",
    "leadership"
  ];
  const found = /* @__PURE__ */ new Set();
  $("a").each((_, elem) => {
    const href = $(elem).attr("href");
    const text = $(elem).text().toLowerCase().trim();
    if (!href) return;
    if (href.startsWith("#") || href.startsWith("tel:") || href.startsWith("mailto:")) return;
    const lowerHref = href.toLowerCase();
    const isMatch = keywords.some((kw) => lowerHref.includes(kw) || text.includes(kw));
    if (!isMatch) return;
    try {
      const fullUrl = new URL(href, baseUrl).href;
      if (new URL(fullUrl).hostname === new URL(baseUrl).hostname) {
        found.add(fullUrl);
      }
    } catch {
    }
  });
  return Array.from(found);
}
function findGenericEmail(...htmlSources) {
  const combined = htmlSources.join(" ");
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const allEmails = combined.match(emailRegex) || [];
  const genericEmails = allEmails.filter(
    (email) => email.match(/^(info|contact|hello|office|service|services|team|admin)@/i) && !email.includes("example.com") && !email.includes("domain.com") && !email.includes("wixpress.com")
  );
  return genericEmails[0]?.toLowerCase();
}
function mergeContactPages(pages) {
  const merged = { socialMedia: {} };
  for (const p of pages) {
    merged.email = merged.email || p.email;
    merged.phone = merged.phone || p.phone;
    merged.address = merged.address || p.address;
    merged.contactFormUrl = merged.contactFormUrl || p.contactFormUrl;
    if (p.socialMedia) {
      merged.socialMedia.linkedin = merged.socialMedia.linkedin || p.socialMedia.linkedin;
      merged.socialMedia.facebook = merged.socialMedia.facebook || p.socialMedia.facebook;
      merged.socialMedia.twitter = merged.socialMedia.twitter || p.socialMedia.twitter;
    }
  }
  return merged;
}
async function extractWithAI(html, geminiApiKey) {
  try {
    const genAI6 = new import_generative_ai3.GoogleGenerativeAI(geminiApiKey);
    const model4 = genAI6.getGenerativeModel({ model: "gemini-1.5-flash" });
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").substring(0, 15e3);
    const prompt = `Extract business contact information from this website content. 
This is a commercial cleaning or janitorial company. Find the owner/manager's direct contact info if possible.

Return ONLY a JSON object with these fields (use null if not found):
{
  "email": "email address (prefer personal/owner email over generic info@)",
  "phone": "primary phone number in format (xxx) xxx-xxxx",
  "address": "full physical address if available",
  "businessName": "official business name"
}

Website content:
${text}`;
    const result = await model4.generateContent(prompt);
    const response = result.response.text();
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return {
        email: data.email && data.email !== "null" && data.email !== null ? data.email : void 0,
        phone: data.phone && data.phone !== "null" && data.phone !== null ? data.phone : void 0,
        address: data.address && data.address !== "null" && data.address !== null ? data.address : void 0,
        businessName: data.businessName && data.businessName !== "null" && data.businessName !== null ? data.businessName : void 0
      };
    }
    return {};
  } catch (error11) {
    console.error("AI extraction error:", error11);
    return {};
  }
}
function determineConfidence(structured, pattern, contact, links) {
  if (structured.email || structured.phone) return "high";
  if (links.email || links.phone) return "high";
  if (contact.email || contact.phone) return "medium";
  if (pattern.email || pattern.phone) return "low";
  return "low";
}
function validateEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return void 0;
  if (email.match(/^(noreply|no-reply|donotreply|bounce|mailer-daemon|postmaster)@/i)) {
    return void 0;
  }
  return email.toLowerCase();
}
function formatPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6, 10)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.substring(1, 4)}) ${digits.substring(4, 7)}-${digits.substring(7, 11)}`;
  }
  return void 0;
}
async function deepMailtoScan(baseUrl) {
  const visited = /* @__PURE__ */ new Set();
  let foundEmail;
  let foundPhone;
  try {
    const homepage = await fetchPage(baseUrl);
    if (!homepage) return { pagesScanned: 0 };
    const internalLinks = /* @__PURE__ */ new Set();
    homepage.$("a").each((_, elem) => {
      const href = homepage.$(elem).attr("href");
      if (!href || href.startsWith("#") || href.startsWith("tel:") || href.startsWith("mailto:")) return;
      try {
        const fullUrl = new URL(href, baseUrl).href;
        if (new URL(fullUrl).hostname === new URL(baseUrl).hostname) {
          internalLinks.add(fullUrl);
        }
      } catch {
      }
    });
    const homeResult = extractMailtoAndTel(homepage.$);
    if (homeResult.email) foundEmail = homeResult.email;
    if (homeResult.phone) foundPhone = homeResult.phone;
    visited.add(baseUrl);
    if (foundEmail) return { email: foundEmail, phone: foundPhone, pagesScanned: 1 };
    const pagesToCheck = Array.from(internalLinks).slice(0, 5);
    for (const pageUrl of pagesToCheck) {
      if (visited.has(pageUrl)) continue;
      visited.add(pageUrl);
      const page = await fetchPage(pageUrl);
      if (!page) continue;
      const pageResult = extractMailtoAndTel(page.$);
      if (pageResult.email && !foundEmail) foundEmail = pageResult.email;
      if (pageResult.phone && !foundPhone) foundPhone = pageResult.phone;
      const obfuscatedEmails = page.html.match(/href\s*=\s*["']mailto:([^"'?]+)/gi) || [];
      for (const match of obfuscatedEmails) {
        const email = match.replace(/href\s*=\s*["']mailto:/i, "").trim().toLowerCase();
        if (email && !email.match(/^(noreply|no-reply|support|webmaster)@/i)) {
          foundEmail = foundEmail || email;
        }
      }
      if (foundEmail) break;
    }
    return { email: foundEmail, phone: foundPhone, pagesScanned: visited.size };
  } catch (error11) {
    console.error("Deep mailto scan error:", error11);
    return { pagesScanned: visited.size };
  }
}
async function searchWebForEmail(businessName, location, domain, serperApiKey) {
  const apiKey = serperApiKey || process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.warn("No SERPER_API_KEY available for web email search.");
    return { source: "serper_skipped" };
  }
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(\+1[-.\\s]?)?\(?\d{3}\)?[-.\\s]?\d{3}[-.\\s]?\d{4}/g;
  const queries = [];
  if (domain) {
    queries.push(`site:${domain} email OR contact`);
  }
  queries.push(`"${businessName}" ${location} email contact`);
  for (const query of queries) {
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey.trim(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ q: query, num: 5 }),
        signal: AbortSignal.timeout(1e4)
      });
      if (!response.ok) continue;
      const data = await response.json();
      const organic = data.organic || [];
      for (const result of organic) {
        const text = `${result.snippet || ""} ${result.title || ""}`;
        const emails = text.match(emailRegex) || [];
        const phones = text.match(phoneRegex) || [];
        const validEmails = emails.filter(
          (e) => !e.includes("example.com") && !e.includes("domain.com") && !e.includes("sentry.io") && !e.includes("wixpress.com") && !e.includes("wordpress.") && !e.match(/^(noreply|no-reply|bounce|mailer-daemon)@/i)
        );
        if (validEmails.length > 0) {
          return {
            email: validEmails[0].toLowerCase(),
            phone: phones[0],
            source: "serper_web_search"
          };
        }
      }
      if (data.knowledgeGraph) {
        const kg = data.knowledgeGraph;
        if (kg.email) {
          return { email: kg.email.toLowerCase(), phone: kg.phone, source: "serper_knowledge_graph" };
        }
        if (kg.phone && !data.organic?.length) {
          return { phone: kg.phone, source: "serper_knowledge_graph" };
        }
      }
    } catch (error11) {
      console.error(`Serper search error for query "${query}":`, error11);
    }
  }
  return { source: "serper_exhausted" };
}

// src/utils/emailVerification.ts
async function verifyEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: "Invalid email format" };
  }
  const domain = email.split("@")[1];
  try {
    const mxRecords = await resolveMX(domain);
    if (mxRecords && mxRecords.length > 0) {
      return { valid: true, deliverable: true };
    } else {
      return { valid: true, deliverable: false, reason: "No MX records found" };
    }
  } catch (error11) {
    return { valid: true, deliverable: false, reason: "Domain not found" };
  }
}
async function resolveMX(domain) {
  const dns = await import("dns");
  const { promisify } = await import("util");
  const resolveMx = promisify(dns.resolveMx);
  try {
    return await resolveMx(domain);
  } catch (error11) {
    return [];
  }
}
function isDisposableEmail(email) {
  const disposableDomains = [
    "tempmail.com",
    "guerrillamail.com",
    "10minutemail.com",
    "mailinator.com",
    "throwaway.email",
    "temp-mail.org"
  ];
  const domain = email.split("@")[1].toLowerCase();
  return disposableDomains.includes(domain);
}
function isRoleBasedEmail(email) {
  const roleBasedPrefixes = [
    "info",
    "admin",
    "support",
    "sales",
    "contact",
    "hello",
    "help",
    "noreply",
    "no-reply",
    "webmaster",
    "postmaster",
    "hostmaster",
    "abuse"
  ];
  const prefix = email.split("@")[0].toLowerCase();
  return roleBasedPrefixes.includes(prefix);
}

// src/utils/phoneValidation.ts
function validatePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    const formatted = `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6, 10)}`;
    return {
      valid: true,
      formatted,
      type: determinePhoneType(digits)
    };
  } else if (digits.length === 11 && digits[0] === "1") {
    const formatted = `(${digits.substring(1, 4)}) ${digits.substring(4, 7)}-${digits.substring(7, 11)}`;
    return {
      valid: true,
      formatted,
      type: determinePhoneType(digits.substring(1))
    };
  } else {
    return {
      valid: false,
      reason: `Invalid phone number length: ${digits.length} digits`
    };
  }
}
function determinePhoneType(digits) {
  const areaCode = digits.substring(0, 3);
  const prefix = digits.substring(3, 6);
  const voipAreaCodes = ["800", "888", "877", "866", "855", "844", "833"];
  if (voipAreaCodes.includes(areaCode)) {
    return "voip";
  }
  return "unknown";
}

// src/triggers/onVendorApproved.ts
if (!admin4.apps.length) {
  admin4.initializeApp();
}
var GEMINI_API_KEY = (0, import_params.defineSecret)("GEMINI_API_KEY");
var SERPER_API_KEY = (0, import_params.defineSecret)("SERPER_API_KEY");
console.log("Loading vendor enrichment triggers...");
var onVendorApproved = (0, import_firestore.onDocumentUpdated)({
  document: "vendors/{vendorId}",
  secrets: [GEMINI_API_KEY, SERPER_API_KEY]
}, async (event) => {
  if (!event.data) return;
  const newData = event.data.after.data();
  const oldData = event.data.before.data();
  const vendorId = event.params.vendorId;
  if (!newData || !oldData) return;
  if (newData.status !== "qualified" || oldData.status === "qualified") return;
  logger.info(`[UPDATE] Vendor ${vendorId} status changed to qualified.`);
  await runEnrichPipeline(vendorId, newData, oldData.status);
});
var onVendorCreated = (0, import_firestore2.onDocumentCreated)({
  document: "vendors/{vendorId}",
  secrets: [GEMINI_API_KEY, SERPER_API_KEY]
}, async (event) => {
  if (!event.data) return;
  const data = event.data.data();
  const vendorId = event.params.vendorId;
  if (!data) return;
  if (data.status !== "qualified") return;
  logger.info(`[CREATE] Vendor ${vendorId} created with status qualified.`);
  await runEnrichPipeline(vendorId, data, "new");
});
async function runEnrichPipeline(vendorId, vendorData, previousStatus) {
  try {
    await db.collection("vendor_activities").add({
      vendorId,
      type: "STATUS_CHANGE",
      description: "Vendor approved \u2014 starting onboarding pipeline.",
      createdAt: /* @__PURE__ */ new Date(),
      metadata: {
        oldStatus: previousStatus,
        newStatus: "qualified",
        onboardingTrack: vendorData.onboardingTrack || "STANDARD"
      }
    });
    const vendorEmail = vendorData.email?.trim();
    const vendorWebsite = vendorData.website?.trim();
    if (vendorEmail) {
      logger.info(`Vendor ${vendorId} has email (${vendorEmail}). Proceeding to outreach.`);
      await setOutreachPending(vendorId, vendorData);
      return;
    }
    if (vendorWebsite) {
      logger.info(`Vendor ${vendorId} has no email but has website. Enriching...`);
      await db.collection("vendors").doc(vendorId).update({
        outreachStatus: "ENRICHING",
        enrichmentStartedAt: /* @__PURE__ */ new Date(),
        statusUpdatedAt: /* @__PURE__ */ new Date()
      });
      await db.collection("vendor_activities").add({
        vendorId,
        type: "ENRICHMENT",
        description: `Scraping ${vendorWebsite} for contact info...`,
        createdAt: /* @__PURE__ */ new Date()
      });
      try {
        const scrapedResult = await scrapeWebsite(vendorWebsite, GEMINI_API_KEY.value());
        if (!scrapedResult.success || !scrapedResult.data) {
          logger.warn(`Enrichment failed for ${vendorId}: ${scrapedResult.error}`);
          await markNeedsContact(vendorId, "Website scrape failed");
          return;
        }
        const scrapedData = scrapedResult.data;
        const updateData = { updatedAt: admin4.firestore.FieldValue.serverTimestamp() };
        const enrichedFields = [];
        let foundEmail;
        if (scrapedData.email) {
          const emailVerification = await verifyEmail(scrapedData.email);
          if (emailVerification.valid && emailVerification.deliverable && !isDisposableEmail(scrapedData.email) && !isRoleBasedEmail(scrapedData.email)) {
            foundEmail = scrapedData.email;
            updateData.email = foundEmail;
            enrichedFields.push("email");
          } else {
            logger.info(`Scraped email ${scrapedData.email} failed verification.`);
          }
        }
        if (scrapedData.phone && !vendorData.phone) {
          const phoneValidation = validatePhone(scrapedData.phone);
          if (phoneValidation.valid) {
            updateData.phone = phoneValidation.formatted;
            enrichedFields.push("phone");
          }
        }
        if (scrapedData.address && !vendorData.address) {
          updateData.address = scrapedData.address;
          enrichedFields.push("address");
        }
        if (scrapedData.socialMedia) {
          const sm = {};
          if (scrapedData.socialMedia.linkedin) {
            sm.linkedin = scrapedData.socialMedia.linkedin;
            enrichedFields.push("linkedin");
          }
          if (scrapedData.socialMedia.facebook) {
            sm.facebook = scrapedData.socialMedia.facebook;
            enrichedFields.push("facebook");
          }
          if (scrapedData.socialMedia.twitter) {
            sm.twitter = scrapedData.socialMedia.twitter;
            enrichedFields.push("twitter");
          }
          if (Object.keys(sm).length > 0) updateData.socialMedia = sm;
        }
        if (scrapedData.contactFormUrl) {
          updateData.contactFormUrl = scrapedData.contactFormUrl;
          enrichedFields.push("contactFormUrl");
        }
        updateData.enrichment = {
          lastEnriched: admin4.firestore.FieldValue.serverTimestamp(),
          enrichedFields,
          enrichmentSource: "auto_onboarding",
          scrapedWebsite: vendorWebsite,
          confidence: scrapedData.confidence
        };
        if (enrichedFields.length > 0) {
          await db.collection("vendors").doc(vendorId).update(updateData);
        }
        await db.collection("vendor_activities").add({
          vendorId,
          type: "ENRICHMENT",
          description: enrichedFields.length > 0 ? `Enriched ${enrichedFields.length} field(s): ${enrichedFields.join(", ")}` : "No new fields found from website.",
          createdAt: /* @__PURE__ */ new Date(),
          metadata: { enrichedFields, confidence: scrapedData.confidence }
        });
        if (foundEmail) {
          logger.info(`Found email ${foundEmail} for vendor ${vendorId} via website scrape. Proceeding to outreach.`);
          const updatedDoc = await db.collection("vendors").doc(vendorId).get();
          await setOutreachPending(vendorId, updatedDoc.data() || vendorData);
          return;
        }
        logger.info(`No email from scrape for ${vendorId}. Trying deep mailto scan...`);
        const mailtoResult = await deepMailtoScan(vendorWebsite);
        if (mailtoResult.email) {
          const mailtoVerification = await verifyEmail(mailtoResult.email);
          if (mailtoVerification.valid && mailtoVerification.deliverable) {
            await db.collection("vendors").doc(vendorId).update({
              email: mailtoResult.email,
              "enrichment.enrichedFields": admin4.firestore.FieldValue.arrayUnion("email"),
              "enrichment.enrichmentSource": "deep_mailto_scan",
              updatedAt: admin4.firestore.FieldValue.serverTimestamp()
            });
            await db.collection("vendor_activities").add({
              vendorId,
              type: "ENRICHMENT",
              description: `Deep mailto scan found email (scanned ${mailtoResult.pagesScanned} pages)`,
              createdAt: /* @__PURE__ */ new Date(),
              metadata: { email: mailtoResult.email, pagesScanned: mailtoResult.pagesScanned }
            });
            logger.info(`Found email ${mailtoResult.email} via deep mailto for ${vendorId}.`);
            const updatedDoc = await db.collection("vendors").doc(vendorId).get();
            await setOutreachPending(vendorId, updatedDoc.data() || vendorData);
            return;
          }
        }
        const vendorName2 = vendorData.businessName || vendorData.name || "";
        const vendorLocation2 = vendorData.address || vendorData.location || "";
        let domain;
        try {
          domain = new URL(vendorWebsite).hostname;
        } catch {
        }
        logger.info(`No email from mailto scan for ${vendorId}. Trying Serper web search...`);
        const webResult = await searchWebForEmail(vendorName2, vendorLocation2, domain, SERPER_API_KEY.value());
        if (webResult.email) {
          const webVerification = await verifyEmail(webResult.email);
          if (webVerification.valid && webVerification.deliverable) {
            await db.collection("vendors").doc(vendorId).update({
              email: webResult.email,
              "enrichment.enrichedFields": admin4.firestore.FieldValue.arrayUnion("email"),
              "enrichment.enrichmentSource": webResult.source,
              updatedAt: admin4.firestore.FieldValue.serverTimestamp()
            });
            await db.collection("vendor_activities").add({
              vendorId,
              type: "ENRICHMENT",
              description: `Serper web search found email via ${webResult.source}`,
              createdAt: /* @__PURE__ */ new Date(),
              metadata: { email: webResult.email, source: webResult.source }
            });
            logger.info(`Found email ${webResult.email} via ${webResult.source} for ${vendorId}.`);
            const updatedDoc = await db.collection("vendors").doc(vendorId).get();
            await setOutreachPending(vendorId, updatedDoc.data() || vendorData);
            return;
          }
        }
        if (scrapedData.contactFormUrl) {
          logger.info(`All enrichment failed for ${vendorId}, but found contact form: ${scrapedData.contactFormUrl}`);
          await db.collection("vendors").doc(vendorId).update({
            outreachStatus: "NEEDS_MANUAL_OUTREACH",
            statusUpdatedAt: /* @__PURE__ */ new Date(),
            "enrichment.exhausted": true,
            "enrichment.sourcesAttempted": ["website_scrape", "deep_mailto", "serper_web_search"]
          });
          await db.collection("vendor_activities").add({
            vendorId,
            type: "NEEDS_MANUAL_OUTREACH",
            description: `No email found after 3-layer enrichment. Contact form: ${scrapedData.contactFormUrl}`,
            createdAt: /* @__PURE__ */ new Date(),
            metadata: { contactFormUrl: scrapedData.contactFormUrl, sourcesAttempted: 3 }
          });
        } else {
          await db.collection("vendors").doc(vendorId).update({
            "enrichment.exhausted": true,
            "enrichment.sourcesAttempted": ["website_scrape", "deep_mailto", "serper_web_search"]
          });
          await markNeedsContact(vendorId, "No email found after 3-layer enrichment (scrape \u2192 mailto \u2192 web search)");
        }
      } catch (enrichError) {
        logger.error(`Enrichment error for ${vendorId}:`, enrichError);
        await markNeedsContact(vendorId, `Enrichment error: ${enrichError.message}`);
      }
      return;
    }
    logger.info(`Vendor ${vendorId} has no email and no website. Trying Serper web search...`);
    const vendorName = vendorData.businessName || vendorData.name || "";
    const vendorLocation = vendorData.address || vendorData.location || "";
    if (vendorName) {
      const webResult = await searchWebForEmail(vendorName, vendorLocation, void 0, SERPER_API_KEY.value());
      if (webResult.email) {
        const webVerification = await verifyEmail(webResult.email);
        if (webVerification.valid && webVerification.deliverable) {
          await db.collection("vendors").doc(vendorId).update({
            email: webResult.email,
            enrichment: {
              lastEnriched: admin4.firestore.FieldValue.serverTimestamp(),
              enrichedFields: ["email"],
              enrichmentSource: webResult.source
            },
            updatedAt: admin4.firestore.FieldValue.serverTimestamp()
          });
          await db.collection("vendor_activities").add({
            vendorId,
            type: "ENRICHMENT",
            description: `Serper web search found email via ${webResult.source} (no website on file)`,
            createdAt: /* @__PURE__ */ new Date(),
            metadata: { email: webResult.email, source: webResult.source }
          });
          logger.info(`Found email ${webResult.email} via web search for ${vendorId} (no website).`);
          const updatedDoc = await db.collection("vendors").doc(vendorId).get();
          await setOutreachPending(vendorId, updatedDoc.data() || vendorData);
          return;
        }
      }
    }
    await db.collection("vendors").doc(vendorId).update({
      "enrichment.exhausted": true,
      "enrichment.sourcesAttempted": vendorName ? ["serper_web_search"] : ["none_available"]
    });
    await markNeedsContact(
      vendorId,
      vendorName ? "No email found \u2014 web search exhausted, no website on file" : "No email, no website, no business name \u2014 cannot enrich"
    );
  } catch (error11) {
    logger.error("Error in enrich pipeline:", error11);
  }
}
async function checkProfileCompleteness(vendorId, vendorData) {
  const missing = [];
  if (!vendorData.businessName) missing.push("businessName");
  const hasCapabilities = Array.isArray(vendorData.capabilities) && vendorData.capabilities.length > 0;
  const hasSpecialty = !!vendorData.specialty;
  if (!hasCapabilities && !hasSpecialty) missing.push("services/capabilities");
  if (!vendorData.email) missing.push("email");
  return missing;
}
async function setOutreachPending(vendorId, vendorData) {
  const missingFields = await checkProfileCompleteness(vendorId, vendorData);
  if (missingFields.length > 0) {
    logger.warn(`Vendor ${vendorId} profile incomplete. Missing: ${missingFields.join(", ")}. Blocking outreach.`);
    await db.collection("vendors").doc(vendorId).update({
      outreachStatus: "PROFILE_INCOMPLETE",
      statusUpdatedAt: /* @__PURE__ */ new Date()
    });
    await db.collection("vendor_activities").add({
      vendorId,
      type: "PROFILE_INCOMPLETE",
      description: `Outreach blocked \u2014 missing: ${missingFields.join(", ")}. Complete the vendor profile to enable outreach.`,
      createdAt: /* @__PURE__ */ new Date(),
      metadata: { missingFields }
    });
    return;
  }
  await db.collection("vendors").doc(vendorId).update({
    outreachStatus: "PENDING",
    statusUpdatedAt: /* @__PURE__ */ new Date()
  });
  const { enqueueTask: enqueueTask2 } = await Promise.resolve().then(() => (init_queueUtils(), queueUtils_exports));
  await enqueueTask2(db, {
    vendorId,
    type: "GENERATE",
    scheduledAt: /* @__PURE__ */ new Date(),
    metadata: {
      companyName: vendorData.businessName,
      specialty: vendorData.specialty || vendorData.capabilities?.[0] || null,
      capabilities: vendorData.capabilities || [],
      contactName: vendorData.contactName || null,
      city: vendorData.city || null,
      state: vendorData.state || null,
      zip: vendorData.zip || null,
      phone: vendorData.phone || null,
      hasActiveContract: vendorData.hasActiveContract || false,
      status: vendorData.status
    }
  });
  logger.info(`Outreach GENERATE task enqueued for vendor ${vendorId}`);
}
async function markNeedsContact(vendorId, reason) {
  await db.collection("vendors").doc(vendorId).update({
    outreachStatus: "NEEDS_CONTACT",
    statusUpdatedAt: /* @__PURE__ */ new Date()
  });
  await db.collection("vendor_activities").add({
    vendorId,
    type: "NEEDS_CONTACT",
    description: `Manual outreach required: ${reason}`,
    createdAt: /* @__PURE__ */ new Date()
  });
  logger.info(`Vendor ${vendorId} marked NEEDS_CONTACT: ${reason}`);
}

// src/triggers/outreachWorker.ts
var import_scheduler = require("firebase-functions/v2/scheduler");
var admin6 = __toESM(require("firebase-admin"));
var logger2 = __toESM(require("firebase-functions/logger"));
init_queueUtils();

// src/agents/salesOutreach.ts
var import_generative_ai4 = require("@google/generative-ai");
var admin5 = __toESM(require("firebase-admin"));
var API_KEY2 = process.env.GEMINI_API_KEY || "";
var genAI3 = new import_generative_ai4.GoogleGenerativeAI(API_KEY2);
var model2 = genAI3.getGenerativeModel({ model: "gemini-2.0-flash" });
var db3 = admin5.firestore();
var generateSalesOutreachContent = async (lead, sequence = 0) => {
  try {
    const templateId = sequence === 0 ? "sales_outreach_prompt" : "sales_followup_prompt";
    const templateDoc = await db3.collection("templates").doc(templateId).get();
    if (!templateDoc.exists) {
      throw new Error(`Template '${templateId}' not found in database`);
    }
    const template = templateDoc.data();
    const facilityType = lead.facilityType || "commercial facility";
    const prettyFacilityType = facilityType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const sqft = lead.propertySourcing?.squareFootage;
    const sqftStr = sqft ? `${sqft.toLocaleString()} sq ft` : "N/A";
    const prompt = template?.content.replace(/\{\{businessName\}\}/g, lead.businessName || "your practice").replace(/\{\{contactName\}\}/g, lead.contactName || "there").replace(/\{\{facilityType\}\}/g, prettyFacilityType).replace(/\{\{squareFootage\}\}/g, sqftStr).replace(/\{\{address\}\}/g, lead.address || "").replace(/\{\{sequence\}\}/g, String(sequence)).replace(/\{\{tenantName\}\}/g, lead.propertySourcing?.tenantName || lead.businessName || "").replace(/\{\{ownerName\}\}/g, lead.propertySourcing?.ownerName || "");
    const result = await model2.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/^```json/gm, "").replace(/^```/gm, "").trim();
    const jsonContent = JSON.parse(text);
    return {
      email: jsonContent.email,
      generatedAt: /* @__PURE__ */ new Date()
    };
  } catch (error11) {
    console.error("[SalesOutreach] Error generating content:", error11);
    return {
      email: {
        subject: "Error",
        body: "Error generating content. Please draft manually."
      },
      error: true
    };
  }
};

// src/triggers/outreachWorker.ts
init_emailUtils();
if (!admin6.apps.length) {
  admin6.initializeApp();
}
var db4 = admin6.firestore();
var processOutreachQueue = (0, import_scheduler.onSchedule)({
  schedule: "every 1 minutes",
  secrets: ["RESEND_API_KEY", "GEMINI_API_KEY"]
}, async (event) => {
  logger2.info("Processing outreach queue...");
  try {
    const tasks = await fetchPendingTasks(db4);
    if (tasks.length === 0) {
      logger2.info("No pending tasks found.");
      return;
    }
    logger2.info(`Found ${tasks.length} tasks to process.`);
    for (const task of tasks) {
      try {
        if (task.leadId) {
          if (task.type === "GENERATE") {
            await handleLeadGenerate(task);
          } else if (task.type === "FOLLOW_UP") {
            await handleLeadFollowUp(task);
          } else if (task.type === "SEND") {
            await handleLeadSend(task);
          }
        } else {
          if (task.type === "GENERATE") {
            await handleGenerate(task);
          } else if (task.type === "SEND") {
            await handleSend(task);
          } else if (task.type === "FOLLOW_UP") {
            await handleFollowUp(task);
          }
        }
      } catch (err) {
        logger2.error(`Error processing task ${task.id}:`, err);
        const newRetryCount = (task.retryCount || 0) + 1;
        const status = newRetryCount > 5 ? "FAILED" : "RETRY";
        const nextAttempt = /* @__PURE__ */ new Date();
        nextAttempt.setMinutes(nextAttempt.getMinutes() + Math.pow(2, newRetryCount));
        await updateTaskStatus(db4, task.id, status, {
          retryCount: newRetryCount,
          scheduledAt: admin6.firestore.Timestamp.fromDate(nextAttempt),
          error: String(err)
        });
        if (status === "FAILED" && task.vendorId) {
          await db4.collection("vendors").doc(task.vendorId).update({
            outreachStatus: "FAILED",
            statusUpdatedAt: /* @__PURE__ */ new Date()
          });
          await db4.collection("vendor_activities").add({
            vendorId: task.vendorId,
            type: "OUTREACH_FAILED",
            description: `Outreach failed after ${newRetryCount} attempts: ${String(err).slice(0, 200)}`,
            createdAt: /* @__PURE__ */ new Date(),
            metadata: { error: String(err).slice(0, 500), retryCount: newRetryCount, taskType: task.type }
          });
        }
      }
    }
  } catch (error11) {
    logger2.error("Fatal error in queue processor:", error11);
  }
});
async function handleGenerate(task) {
  logger2.info(`Generating content for task ${task.id}`);
  const vendorDoc = await db4.collection("vendors").doc(task.vendorId).get();
  const vendor = vendorDoc.exists ? vendorDoc.data() : task.metadata;
  const sequence = task.metadata?.sequence || 1;
  const templateId = `vendor_outreach_${sequence}`;
  const templateDoc = await db4.collection("templates").doc(templateId).get();
  if (!templateDoc.exists) {
    throw new Error(`Email template ${templateId} not found in Firestore. Run seed-email-templates.js to create them.`);
  }
  const template = templateDoc.data();
  const onboardingUrl = `https://xiri.ai/contractor?vid=${task.vendorId}`;
  const services = Array.isArray(vendor?.capabilities) && vendor.capabilities.length > 0 ? vendor.capabilities.join(", ") : vendor?.specialty || "Facility Services";
  const contactName = vendor?.contactName || vendor?.businessName || "there";
  const mergeVars = {
    vendorName: vendor?.companyName || vendor?.businessName || "your company",
    contactName,
    city: vendor?.city || "your area",
    state: vendor?.state || "",
    services,
    specialty: vendor?.specialty || vendor?.capabilities?.[0] || "Services",
    onboardingUrl
  };
  let subject = template.subject || "";
  let body = template.body || "";
  for (const [key, value] of Object.entries(mergeVars)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    subject = subject.replace(regex, value);
    body = body.replace(regex, value);
  }
  body = body.replace(/\[ONBOARDING_LINK\]/g, onboardingUrl);
  const emailResult = { subject, body };
  await db4.collection("vendor_activities").add({
    vendorId: task.vendorId,
    type: "OUTREACH_QUEUED",
    description: `Outreach email draft generated from template (sequence ${sequence}).`,
    createdAt: /* @__PURE__ */ new Date(),
    metadata: {
      email: emailResult,
      preferredChannel: "EMAIL",
      templateId,
      sequence
    }
  });
  const scheduledTime = /* @__PURE__ */ new Date();
  await enqueueTask(db4, {
    vendorId: task.vendorId,
    type: "SEND",
    scheduledAt: admin6.firestore.Timestamp.fromDate(scheduledTime),
    metadata: {
      email: emailResult,
      channel: "EMAIL",
      sequence,
      templateId
    }
  });
  await updateTaskStatus(db4, task.id, "COMPLETED");
  logger2.info(`Task ${task.id} completed (template: ${templateId}). Send scheduled.`);
}
async function handleSend(task) {
  logger2.info(`Executing SEND for task ${task.id}`);
  const vendorDoc = await db4.collection("vendors").doc(task.vendorId).get();
  const vendor = vendorDoc.exists ? vendorDoc.data() : null;
  const vendorEmail = vendor?.email || task.metadata?.email?.to;
  let sendSuccess = false;
  let resendId;
  let htmlBody = "";
  if (vendorEmail) {
    const emailData = task.metadata.email;
    htmlBody = `<div style="font-family: sans-serif; line-height: 1.6;">${(emailData?.body || "").replace(/\n/g, "<br/>")}</div>`;
    const result = await sendEmail(
      vendorEmail,
      emailData?.subject || "Xiri Facility Solutions \u2014 Partnership Opportunity",
      htmlBody,
      void 0,
      // no attachments
      void 0,
      // default from
      task.vendorId ?? void 0,
      // tag email with vendorId for webhook tracking
      task.metadata.templateId ?? void 0
      // tag with templateId for stats tracking
    );
    sendSuccess = result.success;
    resendId = result.resendId;
    if (!sendSuccess) {
      logger2.error(`Failed to send email to ${vendorEmail} for task ${task.id}`);
      throw new Error(`Resend email failed for vendor ${task.vendorId}`);
    }
  } else {
    logger2.warn(`No email for task ${task.id}. Channel: ${task.metadata.channel}`);
    sendSuccess = false;
  }
  await db4.collection("vendor_activities").add({
    vendorId: task.vendorId,
    type: sendSuccess ? "OUTREACH_SENT" : "OUTREACH_FAILED",
    description: sendSuccess ? `Automated ${task.metadata.channel} sent to ${vendorEmail || "vendor"}.` : `Failed to send ${task.metadata.channel} to vendor.`,
    createdAt: /* @__PURE__ */ new Date(),
    metadata: {
      channel: task.metadata.channel,
      to: vendorEmail || "unknown",
      from: "Xiri Facility Solutions <onboarding@xiri.ai>",
      replyTo: "chris@xiri.ai",
      // Full email fields for activity feed preview
      subject: task.metadata.channel === "SMS" ? null : task.metadata.email?.subject,
      body: task.metadata.channel === "SMS" ? task.metadata.sms : task.metadata.email?.body,
      html: task.metadata.channel === "SMS" ? null : htmlBody,
      templateId: task.metadata.templateId || null,
      resendId: resendId || null
    }
  });
  await updateTaskStatus(db4, task.id, sendSuccess ? "COMPLETED" : "FAILED");
  if (sendSuccess) {
    await db4.collection("vendors").doc(task.vendorId).update({
      status: "awaiting_onboarding",
      outreachStatus: "SENT",
      outreachChannel: task.metadata.channel,
      outreachSentAt: /* @__PURE__ */ new Date(),
      statusUpdatedAt: /* @__PURE__ */ new Date()
    });
    if (task.metadata.templateId) {
      try {
        await db4.collection("templates").doc(task.metadata.templateId).update({
          "stats.sent": admin6.firestore.FieldValue.increment(1),
          "stats.lastUpdated": /* @__PURE__ */ new Date()
        });
        logger2.info(`Template ${task.metadata.templateId}: stats.sent incremented`);
      } catch (statsErr) {
        logger2.warn("Template stats.sent update failed:", statsErr);
      }
    }
    await db4.collection("vendor_activities").add({
      vendorId: task.vendorId,
      type: "STATUS_CHANGE",
      description: `Pipeline advanced: qualified \u2192 awaiting_onboarding (outreach ${task.metadata.channel} delivered)`,
      createdAt: /* @__PURE__ */ new Date(),
      metadata: { from: "qualified", to: "awaiting_onboarding", trigger: "outreach_sent" }
    });
  } else {
    await db4.collection("vendors").doc(task.vendorId).update({
      outreachStatus: "PENDING",
      outreachChannel: task.metadata.channel,
      outreachTime: /* @__PURE__ */ new Date()
    });
  }
}
async function handleFollowUp(task) {
  logger2.info(`Processing FOLLOW_UP task ${task.id} (sequence ${task.metadata?.sequence})`);
  const vendorDoc = await db4.collection("vendors").doc(task.vendorId).get();
  const vendor = vendorDoc.exists ? vendorDoc.data() : null;
  if (!vendor) {
    logger2.warn(`Vendor ${task.vendorId} not found, marking task completed.`);
    await updateTaskStatus(db4, task.id, "COMPLETED");
    return;
  }
  if (vendor.status !== "awaiting_onboarding") {
    logger2.info(`Vendor ${task.vendorId} is now '${vendor.status}', skipping follow-up.`);
    await updateTaskStatus(db4, task.id, "COMPLETED");
    return;
  }
  const vendorEmail = vendor.email || task.metadata?.email;
  if (!vendorEmail) {
    logger2.warn(`No email for vendor ${task.vendorId}, skipping follow-up.`);
    await updateTaskStatus(db4, task.id, "COMPLETED");
    return;
  }
  const engagement = vendor.emailEngagement?.lastEvent;
  const sequence = task.metadata?.sequence || 1;
  let variantSuffix = "";
  let variantId = "standard";
  if (engagement === "bounced") {
    logger2.info(`Vendor ${task.vendorId} email bounced, flagging for manual outreach.`);
    await db4.collection("vendors").doc(task.vendorId).update({
      outreachStatus: "NEEDS_MANUAL",
      statusUpdatedAt: /* @__PURE__ */ new Date()
    });
    await db4.collection("vendor_activities").add({
      vendorId: task.vendorId,
      type: "NEEDS_MANUAL_OUTREACH",
      description: `Follow-up #${sequence} skipped \u2014 previous email bounced. Manual outreach needed.`,
      createdAt: /* @__PURE__ */ new Date(),
      metadata: { sequence, reason: "bounce" }
    });
    await updateTaskStatus(db4, task.id, "COMPLETED");
    return;
  } else if (engagement === "opened" || engagement === "clicked") {
    variantSuffix = "_warm";
    variantId = "warm";
  } else if (engagement === "delivered") {
    variantSuffix = "_cold";
    variantId = "cold";
  }
  const baseTemplateId = `vendor_outreach_${sequence + 1}`;
  let templateId = `${baseTemplateId}${variantSuffix}`;
  let templateDoc = await db4.collection("templates").doc(templateId).get();
  if (!templateDoc.exists && variantSuffix) {
    templateId = baseTemplateId;
    variantId = "standard";
    templateDoc = await db4.collection("templates").doc(templateId).get();
  }
  if (!templateDoc.exists) {
    logger2.info(`No template ${templateId} found. Follow-up sequence complete for vendor ${task.vendorId}.`);
    await updateTaskStatus(db4, task.id, "COMPLETED");
    return;
  }
  const template = templateDoc.data();
  const onboardingUrl = `https://xiri.ai/contractor?vid=${task.vendorId}`;
  const services = Array.isArray(vendor.capabilities) && vendor.capabilities.length > 0 ? vendor.capabilities.join(", ") : vendor.specialty || "Facility Services";
  const contactName = vendor.contactName || vendor.businessName || "there";
  const mergeVars = {
    vendorName: vendor.companyName || vendor.businessName || "your company",
    contactName,
    city: vendor.city || "your area",
    state: vendor.state || "",
    services,
    specialty: vendor.specialty || vendor.capabilities?.[0] || "Services",
    onboardingUrl
  };
  let subject = template.subject || "";
  let body = template.body || "";
  for (const [key, value] of Object.entries(mergeVars)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    subject = subject.replace(regex, value);
    body = body.replace(regex, value);
  }
  body = body.replace(/\[ONBOARDING_LINK\]/g, onboardingUrl);
  const htmlBody = `<div style="font-family: sans-serif; line-height: 1.6;">${body.replace(/\n/g, "<br/>")}</div>`;
  const { success: sendSuccess, resendId } = await sendEmail(
    vendorEmail,
    subject,
    htmlBody,
    void 0,
    void 0,
    task.vendorId ?? void 0,
    templateId
  );
  await db4.collection("vendor_activities").add({
    vendorId: task.vendorId,
    type: sendSuccess ? "FOLLOW_UP_SENT" : "OUTREACH_FAILED",
    description: sendSuccess ? `Follow-up #${sequence} sent to ${vendorEmail}` : `Failed to send follow-up #${sequence} to ${vendorEmail}`,
    createdAt: /* @__PURE__ */ new Date(),
    metadata: {
      sequence,
      channel: "EMAIL",
      to: vendorEmail,
      from: "Xiri Facility Solutions <onboarding@xiri.ai>",
      subject,
      body,
      html: htmlBody,
      templateId,
      variantId,
      resendId: resendId || null
    }
  });
  if (sendSuccess) {
    await updateTaskStatus(db4, task.id, "COMPLETED");
    logger2.info(`Follow-up #${sequence} sent to ${vendorEmail} (template: ${templateId})`);
    try {
      await db4.collection("templates").doc(templateId).update({
        "stats.sent": admin6.firestore.FieldValue.increment(1),
        "stats.lastUpdated": /* @__PURE__ */ new Date()
      });
      logger2.info(`Template ${templateId}: stats.sent incremented`);
    } catch (statsErr) {
      logger2.warn("Template stats.sent update failed:", statsErr);
    }
  } else {
    throw new Error(`Failed to send follow-up #${sequence} to ${vendorEmail}`);
  }
}
async function handleLeadGenerate(task) {
  logger2.info(`[SalesOutreach] Generating intro email for lead ${task.leadId}`);
  const leadData = task.metadata;
  const outreachResult = await generateSalesOutreachContent(leadData, 0);
  if (outreachResult.error) {
    throw new Error("AI Generation Failed for sales outreach");
  }
  await db4.collection("lead_activities").add({
    leadId: task.leadId,
    type: "OUTREACH_QUEUED",
    description: `Sales outreach email generated for ${leadData.businessName || "lead"}.`,
    createdAt: /* @__PURE__ */ new Date(),
    metadata: { email: outreachResult.email }
  });
  await enqueueTask(db4, {
    leadId: task.leadId,
    type: "SEND",
    scheduledAt: admin6.firestore.Timestamp.fromDate(/* @__PURE__ */ new Date()),
    metadata: {
      email: outreachResult.email,
      toEmail: leadData.email,
      businessName: leadData.businessName
    }
  });
  await updateTaskStatus(db4, task.id, "COMPLETED");
  logger2.info(`[SalesOutreach] Lead ${task.leadId} intro email generated, SEND queued.`);
}
async function handleLeadSend(task) {
  logger2.info(`[SalesOutreach] Sending email for lead ${task.leadId}`);
  const toEmail = task.metadata?.toEmail;
  if (!toEmail) {
    logger2.warn(`[SalesOutreach] No email for lead ${task.leadId}, skipping.`);
    await updateTaskStatus(db4, task.id, "COMPLETED");
    return;
  }
  const emailData = task.metadata.email;
  const htmlBody = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.7;">${(emailData?.body || "").replace(/\n/g, "<br/>")}</div>`;
  const sendSuccess = await sendEmail(
    toEmail,
    emailData?.subject || "Xiri Facility Solutions \u2014 Simplify Your Facility Management",
    htmlBody
  );
  await db4.collection("lead_activities").add({
    leadId: task.leadId,
    type: sendSuccess ? "OUTREACH_SENT" : "OUTREACH_FAILED",
    description: sendSuccess ? `Sales email sent to ${toEmail}.` : `Failed to send sales email to ${toEmail}.`,
    createdAt: /* @__PURE__ */ new Date(),
    metadata: { to: toEmail, subject: emailData?.subject }
  });
  await updateTaskStatus(db4, task.id, sendSuccess ? "COMPLETED" : "FAILED");
  if (sendSuccess) {
    await db4.collection("leads").doc(task.leadId).update({
      outreachStatus: "SENT",
      outreachSentAt: /* @__PURE__ */ new Date()
    });
  }
}
async function handleLeadFollowUp(task) {
  const sequence = task.metadata?.sequence || 1;
  logger2.info(`[SalesOutreach] Processing follow-up #${sequence} for lead ${task.leadId}`);
  const leadDoc = await db4.collection("leads").doc(task.leadId).get();
  const leadData = leadDoc.exists ? leadDoc.data() : null;
  if (!leadData) {
    logger2.warn(`[SalesOutreach] Lead ${task.leadId} not found, skipping.`);
    await updateTaskStatus(db4, task.id, "COMPLETED");
    return;
  }
  if (leadData.outreachStatus === "REPLIED" || leadData.status === "lost") {
    logger2.info(`[SalesOutreach] Lead ${task.leadId} status is '${leadData.outreachStatus || leadData.status}', skipping follow-up.`);
    await updateTaskStatus(db4, task.id, "COMPLETED");
    return;
  }
  const toEmail = task.metadata?.email || leadData.email;
  if (!toEmail) {
    logger2.warn(`[SalesOutreach] No email for lead ${task.leadId}, skipping.`);
    await updateTaskStatus(db4, task.id, "COMPLETED");
    return;
  }
  const outreachResult = await generateSalesOutreachContent({
    ...leadData,
    ...task.metadata
  }, sequence);
  if (outreachResult.error) {
    throw new Error(`AI generation failed for sales follow-up #${sequence}`);
  }
  const emailData = outreachResult.email;
  const htmlBody = buildSalesFollowUpEmail(
    sequence,
    task.metadata?.businessName || leadData.businessName || "there",
    task.metadata?.contactName || leadData.contactName || "",
    emailData?.body || ""
  );
  const subject = emailData?.subject || task.metadata?.subject || `Follow-up: ${task.metadata?.businessName || "Your facility"}`;
  const sendSuccess = await sendEmail(toEmail, subject, htmlBody);
  if (sendSuccess) {
    await db4.collection("lead_activities").add({
      leadId: task.leadId,
      type: "FOLLOW_UP_SENT",
      description: `Sales follow-up #${sequence} sent to ${toEmail}`,
      createdAt: /* @__PURE__ */ new Date(),
      metadata: { sequence, email: toEmail }
    });
    await updateTaskStatus(db4, task.id, "COMPLETED");
    logger2.info(`[SalesOutreach] Follow-up #${sequence} sent to ${toEmail} for lead ${task.leadId}`);
  } else {
    throw new Error(`Failed to send sales follow-up #${sequence} to ${toEmail}`);
  }
}
function buildSalesFollowUpEmail(sequence, businessName, contactName, aiBody) {
  const greeting = contactName ? `Hi ${contactName},` : `Hello,`;
  const signoff = sequence >= 3 ? "Best regards" : "Best";
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #0c4a6e, #0369a1); padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Xiri Facility Solutions</h1>
            <p style="color: #bae6fd; margin: 4px 0 0; font-size: 13px;">Your Single-Source Facility Partner</p>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 15px;">${greeting}</p>
            <div style="font-size: 15px; line-height: 1.7;">${aiBody.replace(/\n/g, "<br/>")}</div>
            <div style="text-align: center; margin: 32px 0;">
                <a href="https://xiri.ai/contact?ref=outreach" style="display: inline-block; padding: 14px 32px; background: #0369a1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                    Schedule a Free Walkthrough
                </a>
            </div>
            <p style="font-size: 14px; color: #64748b;">Have questions? Simply reply to this email.</p>
            <p style="margin-top: 24px; font-size: 14px;">${signoff},<br/><strong>Xiri Facility Solutions</strong></p>
        </div>
    </div>`;
}

// src/triggers/onIncomingMessage.ts
var import_firestore3 = require("firebase-functions/v2/firestore");
var admin8 = __toESM(require("firebase-admin"));
var logger3 = __toESM(require("firebase-functions/logger"));

// src/agents/outreach.ts
var import_generative_ai5 = require("@google/generative-ai");
var admin7 = __toESM(require("firebase-admin"));
var API_KEY3 = process.env.GEMINI_API_KEY || "";
var genAI4 = new import_generative_ai5.GoogleGenerativeAI(API_KEY3);
var model3 = genAI4.getGenerativeModel({ model: "gemini-2.0-flash" });
var db5 = admin7.firestore();
var analyzeIncomingMessage = async (vendor, messageContent, previousContext) => {
  try {
    const templateDoc = await db5.collection("templates").doc("message_analysis_prompt").get();
    if (!templateDoc.exists) {
      throw new Error("Message analysis prompt not found in database");
    }
    const template = templateDoc.data();
    const prompt = template?.content.replace(/\{\{vendorName\}\}/g, vendor.companyName).replace(/\{\{messageContent\}\}/g, messageContent).replace(/\{\{previousContext\}\}/g, previousContext).replace(/\{\{vendorId\}\}/g, vendor.id);
    const result = await model3.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/^```json/gm, "").replace(/^```/gm, "").trim();
    const jsonContent = JSON.parse(text);
    return jsonContent;
  } catch (error11) {
    console.error("Error analyzing message:", error11);
    return { intent: "OTHER", reply: "Error analyzing message." };
  }
};

// src/triggers/onIncomingMessage.ts
if (!admin8.apps.length) {
  admin8.initializeApp();
}
var db6 = admin8.firestore();
var onIncomingMessage = (0, import_firestore3.onDocumentCreated)("vendor_activities/{activityId}", async (event) => {
  if (!event.data) return;
  const activity = event.data.data();
  const vendorId = activity.vendorId;
  if (activity.type !== "INBOUND_REPLY") return;
  logger3.info(`Processing inbound message from vendor ${vendorId}`);
  try {
    const vendorDoc = await db6.collection("vendors").doc(vendorId).get();
    if (!vendorDoc.exists) {
      logger3.error(`Vendor ${vendorId} not found`);
      return;
    }
    const vendor = vendorDoc.data();
    const lastOutreachSnapshot = await db6.collection("vendor_activities").where("vendorId", "==", vendorId).where("type", "==", "OUTREACH_SENT").orderBy("createdAt", "desc").limit(1).get();
    const previousContext = !lastOutreachSnapshot.empty ? lastOutreachSnapshot.docs[0].data().description : "Initial outreach sent.";
    const analysis = await analyzeIncomingMessage(vendor, activity.description, previousContext);
    logger3.info(`Analysis result for ${vendorId}: ${JSON.stringify(analysis)}`);
    let newStatus = vendor?.status;
    let actionDescription = "";
    if (analysis.intent === "INTERESTED") {
      newStatus = "NEGOTIATING";
      actionDescription = "Vendor expressed interest. Status updated to NEGOTIATING.";
    } else if (analysis.intent === "NOT_INTERESTED") {
      newStatus = "REJECTED";
      actionDescription = "Vendor not interested. Status updated to REJECTED.";
    } else if (analysis.intent === "QUESTION") {
      newStatus = "NEGOTIATING";
      actionDescription = "Vendor has a question.";
    } else {
      actionDescription = "AI could not determine clear intent.";
    }
    if (newStatus && newStatus !== vendor?.status) {
      await db6.collection("vendors").doc(vendorId).update({
        status: newStatus,
        statusUpdatedAt: /* @__PURE__ */ new Date()
      });
      await db6.collection("vendor_activities").add({
        vendorId,
        type: "STATUS_CHANGE",
        description: actionDescription,
        createdAt: /* @__PURE__ */ new Date(),
        metadata: {
          oldStatus: vendor?.status,
          newStatus,
          aiIntent: analysis.intent
        }
      });
    }
    await db6.collection("vendor_activities").add({
      vendorId,
      type: "AI_REPLY",
      description: analysis.reply,
      createdAt: /* @__PURE__ */ new Date(),
      // Slightly after the inbound
      metadata: {
        intent: analysis.intent,
        inReplyTo: event.params.activityId
      }
    });
  } catch (error11) {
    logger3.error("Error processing inbound message:", error11);
  }
});

// src/triggers/onDocumentUploaded.ts
var import_firestore4 = require("firebase-functions/v2/firestore");
var admin10 = __toESM(require("firebase-admin"));
var logger5 = __toESM(require("firebase-functions/logger"));

// src/agents/documentVerifier.ts
var import_generative_ai6 = require("@google/generative-ai");
var admin9 = __toESM(require("firebase-admin"));
var logger4 = __toESM(require("firebase-functions/logger"));
var https = __toESM(require("https"));
var genAI5 = new import_generative_ai6.GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
var db7 = admin9.firestore();
function downloadFileAsBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFileAsBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed with status ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}
async function verifyDocument(docType, vendorName, specialty) {
  const model4 = genAI5.getGenerativeModel({ model: "gemini-2.0-flash" });
  let simulatedOcrText = "";
  if (docType === "COI") {
    const today = /* @__PURE__ */ new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(today.getFullYear() + 1);
    simulatedOcrText = `
            CERTIFICATE OF LIABILITY INSURANCE
            PRODUCER: State Farm Insurance
            INSURED: ${vendorName}
            
            COVERAGES:
            COMMERCIAL GENERAL LIABILITY
            EACH OCCURRENCE: $2,000,000
            GENERAL AGGREGATE: $4,000,000
            
            WORKERS COMPENSATION
            STATUTORY LIMITS: YES
            E.L. EACH ACCIDENT: $1,000,000
            
            POLICY EFF: 01/01/2024
            POLICY EXP: ${nextYear.toLocaleDateString()}
        `;
  } else if (docType === "W9") {
    simulatedOcrText = `
            Form W-9
            Name: ${vendorName}
            Business Name: ${vendorName} LLC
            Federal Tax Classification: Limited Liability Company
            TIN: XX-XXX1234
            Signed: JS
            Date: 01/15/2024
        `;
  }
  try {
    const templateDoc = await db7.collection("templates").doc("document_verifier_prompt").get();
    if (!templateDoc.exists) {
      throw new Error("Document verifier prompt not found in database");
    }
    const template = templateDoc.data();
    const requirements = docType === "COI" ? "Must have General Liability > $1,000,000 and valid dates." : "Must be signed and have a TIN.";
    const prompt = template?.content.replace(/\{\{documentType\}\}/g, docType).replace(/\{\{vendorName\}\}/g, vendorName).replace(/\{\{specialty\}\}/g, specialty).replace(/\{\{requirements\}\}/g, requirements).replace(/\{\{ocrText\}\}/g, simulatedOcrText);
    const result = await model4.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    return JSON.parse(jsonMatch[0]);
  } catch (error11) {
    console.error("AI Verification Failed:", error11);
    return {
      valid: false,
      reasoning: "AI Verification Failed: " + error11,
      extracted: {}
    };
  }
}
async function verifyAcord25(fileUrl, vendorName, attestations) {
  const model4 = genAI5.getGenerativeModel({ model: "gemini-2.0-flash" });
  try {
    logger4.info(`Downloading ACORD 25 from: ${fileUrl}`);
    const buffer = await downloadFileAsBuffer(fileUrl);
    const isPdf = fileUrl.toLowerCase().includes(".pdf");
    const isJpg = fileUrl.toLowerCase().includes(".jpg") || fileUrl.toLowerCase().includes(".jpeg");
    const isPng = fileUrl.toLowerCase().includes(".png");
    const contentType = isPdf ? "application/pdf" : isJpg ? "image/jpeg" : isPng ? "image/png" : "application/pdf";
    const base64Data = buffer.toString("base64");
    const prompt = `You are an insurance compliance verification agent for Xiri Facility Solutions.

Analyze this ACORD 25 Certificate of Liability Insurance and extract the following data in JSON format.

**The vendor's name on file is: "${vendorName}"**

**The vendor attested to having the following coverage:**
- General Liability: ${attestations.hasGL ? "YES" : "NO"}
- Workers' Compensation: ${attestations.hasWC ? "YES" : "NO"}
- Auto Insurance: ${attestations.hasAuto ? "YES" : "NO"}
- Business Entity (LLC/Corp): ${attestations.hasEntity ? "YES" : "NO"}

**Minimum requirements to PASS:**
- General Liability: \u2265 $1,000,000 per occurrence AND \u2265 $2,000,000 aggregate
- Workers' Compensation: Must have active policy if attested
- Auto Insurance: Must have active policy if attested
- All policies must NOT be expired (check against today's date: ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]})
- Insured name should reasonably match vendor name on file

**Cross-reference the vendor's attestations against the actual document.**
If the vendor attested to having coverage but the document does NOT show it, flag it.
If limits are below minimums, flag it.
If any policy is expired, flag it.

Return ONLY valid JSON in this exact format:
{
    "valid": true/false,
    "reasoning": "Brief explanation of the verification result",
    "flags": ["list of specific issues found, empty array if none"],
    "extracted": {
        "insuredName": "Name as shown on certificate",
        "glPerOccurrence": 1000000,
        "glAggregate": 2000000,
        "wcActive": true/false,
        "wcPolicyNumber": "policy number or null",
        "autoActive": true/false,
        "expirationDates": [
            { "policy": "General Liability", "expires": "2025-01-15" },
            { "policy": "Workers Comp", "expires": "2025-06-30" }
        ],
        "certificateHolder": "Name if listed, or null"
    }
}`;
    const result = await model4.generateContent({
      contents: [{
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: contentType,
              data: base64Data
            }
          },
          { text: prompt }
        ]
      }]
    });
    const responseText = result.response.text();
    logger4.info(`Gemini ACORD 25 response length: ${responseText.length}`);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Gemini response");
    }
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.flags) {
      parsed.flags = [];
    }
    logger4.info(`ACORD 25 verification result: valid=${parsed.valid}, flags=${parsed.flags.length}`);
    return parsed;
  } catch (error11) {
    logger4.error("ACORD 25 verification failed:", error11);
    return {
      valid: false,
      reasoning: `AI verification failed: ${error11}`,
      extracted: {},
      flags: ["AI_PROCESSING_ERROR"]
    };
  }
}

// src/triggers/onDocumentUploaded.ts
var db8 = admin10.firestore();
var onDocumentUploaded = (0, import_firestore4.onDocumentUpdated)({
  document: "vendors/{vendorId}",
  secrets: ["GEMINI_API_KEY", "RESEND_API_KEY"]
}, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const vendorId = event.params.vendorId;
  if (!before || !after) return;
  const acord25Before = before.compliance?.acord25?.status;
  const acord25After = after.compliance?.acord25?.status;
  if (acord25After === "PENDING" && acord25Before !== "PENDING") {
    logger5.info(`Processing ACORD 25 for vendor ${vendorId}`);
    const fileUrl = after.compliance?.acord25?.url;
    if (!fileUrl) {
      logger5.error(`No ACORD 25 URL found for vendor ${vendorId}`);
      return;
    }
    const vendorName = after.businessName || after.companyName || "Vendor";
    const attestations = {
      hasGL: after.compliance?.generalLiability?.hasInsurance || false,
      hasWC: after.compliance?.workersComp?.hasInsurance || false,
      hasAuto: after.compliance?.autoInsurance?.hasInsurance || false,
      hasEntity: after.compliance?.hasBusinessEntity || false
    };
    try {
      const result = await verifyAcord25(fileUrl, vendorName, attestations);
      const status = result.valid ? "VERIFIED" : result.flags.length > 0 ? "FLAGGED" : "REJECTED";
      await db8.doc(`vendors/${vendorId}`).update({
        "compliance.acord25.status": status,
        "compliance.acord25.verifiedAt": admin10.firestore.FieldValue.serverTimestamp(),
        "compliance.acord25.aiAnalysis": {
          valid: result.valid,
          reasoning: result.reasoning,
          extracted: result.extracted
        },
        "compliance.acord25.extractedData": result.extracted,
        updatedAt: admin10.firestore.FieldValue.serverTimestamp()
      });
      await db8.collection("vendor_activities").add({
        vendorId,
        type: "AI_VERIFICATION",
        description: `AI ${status === "VERIFIED" ? "Verified" : "Flagged"} ACORD 25: ${result.reasoning}`,
        createdAt: admin10.firestore.FieldValue.serverTimestamp(),
        metadata: {
          docType: "ACORD_25",
          status,
          valid: result.valid,
          flags: result.flags,
          extracted: result.extracted
        }
      });
      logger5.info(`ACORD 25 verification complete for ${vendorId}: ${status}`);
      if (status === "FLAGGED") {
        await sendFlagNotification(vendorId, vendorName, result.flags, result.reasoning);
      }
    } catch (error11) {
      logger5.error(`ACORD 25 verification failed for ${vendorId}:`, error11);
      await db8.doc(`vendors/${vendorId}`).update({
        "compliance.acord25.status": "FLAGGED",
        "compliance.acord25.aiAnalysis": {
          valid: false,
          reasoning: `Verification error: ${error11}`,
          extracted: {}
        },
        updatedAt: admin10.firestore.FieldValue.serverTimestamp()
      });
    }
    return;
  }
  if (after.compliance?.coi?.status === "PENDING" && before.compliance?.coi?.status !== "PENDING") {
    logger5.info(`Processing COI for ${vendorId}`);
    await runLegacyVerification(vendorId, "COI", after);
  }
  if (after.compliance?.w9?.status === "PENDING" && before.compliance?.w9?.status !== "PENDING") {
    logger5.info(`Processing W9 for ${vendorId}`);
    await runLegacyVerification(vendorId, "W9", after);
  }
});
async function runLegacyVerification(vendorId, docType, vendorData) {
  try {
    const result = await verifyDocument(docType, vendorData.companyName || "Vendor", vendorData.specialty || "General");
    const fieldPath = docType === "COI" ? "compliance.coi" : "compliance.w9";
    await db8.doc(`vendors/${vendorId}`).update({
      [`${fieldPath}.status`]: result.valid ? "VERIFIED" : "REJECTED",
      [`${fieldPath}.aiAnalysis`]: {
        valid: result.valid,
        reasoning: result.reasoning,
        extracted: result.extracted
      },
      [`${fieldPath}.verifiedAt`]: admin10.firestore.FieldValue.serverTimestamp()
    });
    await db8.collection("vendor_activities").add({
      vendorId,
      type: "AI_VERIFICATION",
      description: `AI ${result.valid ? "Verified" : "Rejected"} ${docType}: ${result.reasoning}`,
      createdAt: admin10.firestore.FieldValue.serverTimestamp(),
      metadata: {
        docType,
        valid: result.valid,
        extracted: result.extracted
      }
    });
    if (result.valid) {
      const { sendTemplatedEmail: sendTemplatedEmail2 } = await Promise.resolve().then(() => (init_emailUtils(), emailUtils_exports));
      await sendTemplatedEmail2(vendorId, "doc_upload_notification", {
        documentType: docType === "COI" ? "Certificate of Insurance" : "W-9 Form"
      });
    }
  } catch (error11) {
    logger5.error(`Verification failed for ${docType}:`, error11);
  }
}
async function sendFlagNotification(vendorId, vendorName, flags, reasoning) {
  try {
    const { Resend: Resend3 } = await import("resend");
    const resend2 = new Resend3(process.env.RESEND_API_KEY);
    const flagList = flags.map((f) => `<li style="color: #b45309;">${f}</li>`).join("");
    const dashboardLink = `https://app.xiri.ai/supply/crm/${vendorId}`;
    await resend2.emails.send({
      from: "Xiri Compliance <compliance@xiri.ai>",
      to: "chris@xiri.ai",
      subject: `\u26A0\uFE0F ACORD 25 Flagged: ${vendorName}`,
      html: `
            <div style="font-family: sans-serif; line-height: 1.8; max-width: 600px;">
                <h2 style="color: #b45309;">\u26A0\uFE0F ACORD 25 Flagged for Review</h2>
                <p><strong>${vendorName}</strong>'s ACORD 25 has been flagged by AI verification.</p>
                
                <h3 style="margin-top: 16px;">Issues Found:</h3>
                <ul>${flagList}</ul>
                
                <p style="margin-top: 16px;"><strong>AI Summary:</strong> ${reasoning}</p>
                
                <div style="margin-top: 24px;">
                    <a href="${dashboardLink}" style="display: inline-block; padding: 12px 24px; background: #b45309; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Review in CRM \u2192
                    </a>
                </div>
                
                <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">
                    Vendor ID: ${vendorId}
                </p>
            </div>`
    });
    logger5.info(`Flag notification sent for vendor ${vendorId}`);
  } catch (error11) {
    logger5.error("Failed to send flag notification:", error11);
  }
}

// src/triggers/sendBookingConfirmation.ts
var import_firestore5 = require("firebase-functions/v2/firestore");
init_emailUtils();
var import_date_fns = require("date-fns");
var admin11 = __toESM(require("firebase-admin"));
var db9 = admin11.firestore();
var TIMEOUT_SECONDS = 300;
var sendBookingConfirmation = (0, import_firestore5.onDocumentWritten)({
  document: "leads/{leadId}",
  secrets: ["RESEND_API_KEY"],
  timeoutSeconds: TIMEOUT_SECONDS
}, async (event) => {
  if (!event.data) return;
  const before = event.data.before.data();
  const after = event.data.after.data();
  const statusChangedToNew = before?.status !== "new" && after?.status === "new";
  const timesChanged = JSON.stringify(before?.preferredAuditTimes) !== JSON.stringify(after?.preferredAuditTimes);
  const shouldSend = after?.status === "new" && (statusChangedToNew || timesChanged);
  if (!shouldSend) return;
  const { email, contactName, preferredAuditTimes, meetingType, meetingDuration, businessName } = after;
  if (!email || !preferredAuditTimes || preferredAuditTimes.length === 0) {
    console.log("Missing email or times for lead", event.params.leadId);
    return;
  }
  const startTimeStr = preferredAuditTimes[0];
  const startTime = new Date(startTimeStr);
  const duration = meetingDuration || 60;
  const endTime = (0, import_date_fns.addMinutes)(startTime, duration);
  const type = meetingType === "intro" ? "Intro Call" : "Internal Audit";
  const icsContent = generateICS({
    start: startTime,
    end: endTime,
    summary: `Xiri ${type}: ${businessName || "Facility Audit"}`,
    description: `Meeting with ${contactName || "Client"}.

Type: ${type}
Duration: ${duration} mins

Power to the Facilities!`,
    location: type === "intro" ? "Phone Call" : after.address || after.zipCode || "On Site",
    organizer: { name: "Xiri Facility Solutions", email: "onboarding@xiri.ai" }
  });
  const subject = `Confirmed: Your Xini ${type}`;
  const htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #0ea5e9;">You're booked!</h1>
            <p>Hi ${contactName || "there"},</p>
            <p>We've confirmed your <strong>${type}</strong> for:</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 18px; font-weight: bold;">
                    ${(0, import_date_fns.format)(startTime, "EEEE, MMMM do 'at' h:mm a")}
                </p>
                <p style="margin: 5px 0 0; color: #6b7280;">Duration: ${duration} mins</p>
            </div>
            <p>A calendar invitation has been attached to this email.</p>
            <p>Best,<br/>The Xiri Team</p>
        </div>
    `;
  const sendSuccess = await sendEmail(email, subject, htmlBody, [
    {
      filename: "invite.ics",
      content: icsContent
    }
  ]);
  await db9.collection("activity_logs").add({
    entityType: "lead",
    entityId: event.params.leadId,
    type: sendSuccess ? "EMAIL_SENT" : "EMAIL_FAILED",
    description: `Booking confirmation ${sendSuccess ? "sent" : "failed"}: ${subject}`,
    createdAt: admin11.firestore.FieldValue.serverTimestamp(),
    metadata: {
      to: email,
      subject,
      meetingType: type,
      meetingTime: startTimeStr,
      channel: "EMAIL"
    }
  });
});
function generateICS(event) {
  const formatDate = (date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Xiri//Facility Solutions//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${Date.now()}@xiri.ai
DTSTAMP:${formatDate(/* @__PURE__ */ new Date())}
DTSTART:${formatDate(event.start)}
DTEND:${formatDate(event.end)}
SUMMARY:${event.summary}
DESCRIPTION:${event.description.replace(/\n/g, "\\n")}
LOCATION:${event.location}
ORGANIZER;CN=${event.organizer.name}:mailto:${event.organizer.email}
STATUS:CONFIRMED
sequence:0
END:VEVENT
END:VCALENDAR`;
}

// src/triggers/enrichFromWebsite.ts
var import_https = require("firebase-functions/v2/https");
var import_firestore6 = require("firebase-admin/firestore");
var import_params2 = require("firebase-functions/params");
var GEMINI_API_KEY2 = (0, import_params2.defineSecret)("GEMINI_API_KEY");
var enrichFromWebsite = (0, import_https.onCall)({
  secrets: [GEMINI_API_KEY2],
  timeoutSeconds: 60,
  memory: "512MiB",
  cors: [
    "http://localhost:3001",
    "http://localhost:3000",
    "https://xiri.ai",
    "https://www.xiri.ai",
    "https://app.xiri.ai",
    "https://xiri-dashboard.vercel.app",
    "https://xiri-facility-solutions.web.app",
    "https://xiri-facility-solutions.firebaseapp.com"
  ]
}, async (request) => {
  if (!request.auth) {
    throw new import_https.HttpsError("unauthenticated", "User must be authenticated");
  }
  const { collection, documentId, website, previewOnly } = request.data;
  if (!website) {
    throw new import_https.HttpsError("invalid-argument", "Missing website URL");
  }
  if (!previewOnly && (!collection || !documentId)) {
    throw new import_https.HttpsError("invalid-argument", "Missing required fields");
  }
  if (!previewOnly && !["leads", "vendors"].includes(collection)) {
    throw new import_https.HttpsError("invalid-argument", "Invalid collection");
  }
  try {
    console.log(`Enriching ${collection}/${documentId} from ${website}`);
    const scrapedResult = await scrapeWebsite(website, GEMINI_API_KEY2.value());
    if (!scrapedResult.success) {
      throw new import_https.HttpsError("internal", `Scraping failed: ${scrapedResult.error}`);
    }
    const scrapedData = scrapedResult.data;
    let verifiedEmail;
    if (scrapedData.email) {
      const emailVerification = await verifyEmail(scrapedData.email);
      if (emailVerification.valid && emailVerification.deliverable && !isDisposableEmail(scrapedData.email) && !isRoleBasedEmail(scrapedData.email)) {
        verifiedEmail = scrapedData.email;
      } else {
        console.log(`Email ${scrapedData.email} failed verification:`, emailVerification.reason);
      }
    }
    let validatedPhone;
    if (scrapedData.phone) {
      const phoneValidation = validatePhone(scrapedData.phone);
      if (phoneValidation.valid) {
        validatedPhone = phoneValidation.formatted;
      } else {
        console.log(`Phone ${scrapedData.phone} failed validation:`, phoneValidation.reason);
      }
    }
    if (previewOnly) {
      return {
        success: true,
        enrichedFields: [
          ...verifiedEmail ? ["email"] : [],
          ...validatedPhone ? ["phone"] : [],
          ...scrapedData.address ? ["address"] : [],
          ...scrapedData.businessName ? ["businessName"] : [],
          ...scrapedData.socialMedia?.linkedin ? ["linkedin"] : [],
          ...scrapedData.socialMedia?.facebook ? ["facebook"] : [],
          ...scrapedData.socialMedia?.twitter ? ["twitter"] : []
        ],
        data: {
          email: verifiedEmail,
          phone: validatedPhone,
          address: scrapedData.address,
          businessName: scrapedData.businessName,
          socialMedia: scrapedData.socialMedia,
          confidence: scrapedData.confidence
        }
      };
    }
    const db23 = (0, import_firestore6.getFirestore)();
    const docRef = db23.collection(collection).doc(documentId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      throw new import_https.HttpsError("not-found", "Document not found");
    }
    const existingData = docSnap.data();
    const enrichedFields = [];
    const updateData = {
      updatedAt: import_firestore6.FieldValue.serverTimestamp()
    };
    if (verifiedEmail && !existingData.email) {
      updateData.email = verifiedEmail;
      enrichedFields.push("email");
    }
    if (validatedPhone && !existingData.phone) {
      updateData.phone = validatedPhone;
      enrichedFields.push("phone");
    }
    if (scrapedData.address && !existingData.address) {
      updateData.address = scrapedData.address;
      enrichedFields.push("address");
    }
    if (scrapedData.businessName && !existingData.businessName) {
      updateData.businessName = scrapedData.businessName;
      enrichedFields.push("businessName");
    }
    if (scrapedData.socialMedia) {
      const socialMedia = {};
      if (scrapedData.socialMedia.linkedin) {
        socialMedia.linkedin = scrapedData.socialMedia.linkedin;
        enrichedFields.push("linkedin");
      }
      if (scrapedData.socialMedia.facebook) {
        socialMedia.facebook = scrapedData.socialMedia.facebook;
        enrichedFields.push("facebook");
      }
      if (scrapedData.socialMedia.twitter) {
        socialMedia.twitter = scrapedData.socialMedia.twitter;
        enrichedFields.push("twitter");
      }
      if (Object.keys(socialMedia).length > 0) {
        updateData.socialMedia = socialMedia;
      }
    }
    updateData.enrichment = {
      lastEnriched: import_firestore6.FieldValue.serverTimestamp(),
      enrichedFields,
      enrichmentSource: "manual",
      scrapedWebsite: website,
      confidence: scrapedData.confidence
    };
    if (enrichedFields.length > 0) {
      await docRef.update(updateData);
      console.log(`Successfully enriched ${enrichedFields.length} fields for ${collection}/${documentId}`);
    } else {
      console.log(`No new fields to enrich for ${collection}/${documentId}`);
    }
    return {
      success: true,
      enrichedFields,
      data: {
        email: verifiedEmail,
        phone: validatedPhone,
        address: scrapedData.address,
        businessName: scrapedData.businessName,
        socialMedia: scrapedData.socialMedia,
        confidence: scrapedData.confidence
      }
    };
  } catch (error11) {
    console.error("Enrichment error:", error11);
    if (error11 instanceof import_https.HttpsError) {
      throw error11;
    }
    throw new import_https.HttpsError("internal", `Enrichment failed: ${error11.message}`);
  }
});

// src/triggers/onOnboardingComplete.ts
var import_firestore7 = require("firebase-functions/v2/firestore");
var admin12 = __toESM(require("firebase-admin"));
var logger6 = __toESM(require("firebase-functions/logger"));
var import_resend2 = require("resend");
if (!admin12.apps.length) {
  admin12.initializeApp();
}
var onOnboardingComplete = (0, import_firestore7.onDocumentUpdated)({
  document: "vendors/{vendorId}",
  secrets: ["RESEND_API_KEY"]
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  if (before.status === after.status) return;
  if (after.status !== "compliance_review") return;
  const vendorId = event.params.vendorId;
  const businessName = after.businessName || "Unknown Vendor";
  const email = after.email || "N/A";
  const phone = after.phone || "N/A";
  const track = after.onboardingTrack || "STANDARD";
  const lang = after.preferredLanguage || "en";
  logger6.info(`Vendor ${vendorId} (${businessName}) completed onboarding. Sending notification.`);
  const resend2 = new import_resend2.Resend(process.env.RESEND_API_KEY);
  const compliance = after.compliance || {};
  const complianceLines = [
    `Business Entity: ${compliance.hasBusinessEntity ? "\u2705 Yes" : "\u274C No"}`,
    `General Liability: ${compliance.generalLiability?.hasInsurance ? "\u2705 Yes" : "\u274C No"}`,
    `Workers Comp: ${compliance.workersComp?.hasInsurance ? "\u2705 Yes" : "\u274C No"}`,
    `Auto Insurance: ${compliance.autoInsurance?.hasInsurance ? "\u2705 Yes" : "\u274C No"}`,
    `W-9 Collected: ${compliance.w9Collected ? "\u2705 Yes" : "\u23F3 Pending"}`
  ].join("<br/>");
  const dashboardLink = `https://app.xiri.ai/supply/crm/${vendorId}`;
  const html = `
    <div style="font-family: sans-serif; line-height: 1.8; max-width: 600px;">
        <h2 style="color: #0c4a6e;">\u{1F3D7}\uFE0F Vendor Onboarding Complete</h2>
        <p><strong>${businessName}</strong> has completed the onboarding form and is ready for compliance review.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Email</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${email}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${phone}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Track</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${track === "FAST_TRACK" ? "\u26A1 Express Contract" : "\u{1F91D} Partner Network"}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Language</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${lang === "es" ? "\u{1F1EA}\u{1F1F8} Spanish" : "\u{1F1FA}\u{1F1F8} English"}</td></tr>
        </table>

        <h3 style="color: #0c4a6e; margin-top: 24px;">Compliance Self-Report</h3>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 14px;">
            ${complianceLines}
        </div>

        <div style="margin-top: 24px;">
            <a href="${dashboardLink}" style="display: inline-block; padding: 12px 24px; background: #0369a1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                Review in CRM \u2192
            </a>
        </div>

        <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">
            Vendor ID: ${vendorId}
        </p>
    </div>`;
  try {
    const { data, error: error11 } = await resend2.emails.send({
      from: "Xiri Facility Solutions <onboarding@xiri.ai>",
      to: "chris@xiri.ai",
      subject: `\u{1F3D7}\uFE0F Vendor Onboarded: ${businessName}`,
      html
    });
    if (error11) {
      logger6.error("Failed to send onboarding notification:", error11);
    } else {
      logger6.info(`Notification sent to chris@xiri.ai (Resend ID: ${data?.id})`);
    }
  } catch (err) {
    logger6.error("Error sending onboarding notification:", err);
  }
  if (email && email !== "N/A") {
    const isSpanish = lang === "es";
    const vendorHtml = isSpanish ? `
    <div style="font-family: sans-serif; line-height: 1.8; max-width: 600px; color: #1e293b;">
        <div style="background: #0c4a6e; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">\xA1Recibimos su solicitud!</h1>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p>Hola <strong>${businessName}</strong>,</p>
            <p>Gracias por completar su solicitud para unirse a la Red de Contratistas de Xiri. Hemos recibido su informaci\xF3n y nuestro equipo la revisar\xE1 en breve.</p>

            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h3 style="margin: 0 0 12px 0; color: #0c4a6e; font-size: 15px;">Lo que recibimos:</h3>
                <p style="margin: 4px 0; font-size: 14px;">\u{1F4E7} Email: ${email}</p>
                <p style="margin: 4px 0; font-size: 14px;">\u{1F4DE} Tel\xE9fono: ${phone}</p>
                <p style="margin: 4px 0; font-size: 14px;">\u{1F4CB} Modalidad: ${track === "FAST_TRACK" ? "\u26A1 Contrato Express" : "\u{1F91D} Red de Socios"}</p>
            </div>

            <h3 style="color: #0c4a6e; font-size: 15px;">Pr\xF3ximos Pasos:</h3>
            <ol style="font-size: 14px; padding-left: 20px;">
                <li>Nuestro equipo revisar\xE1 sus documentos e informaci\xF3n</li>
                <li>Recibir\xE1 una confirmaci\xF3n cuando su cuenta est\xE9 verificada</li>
                <li>Una vez aprobado, comenzar\xE1 a recibir oportunidades de trabajo</li>
            </ol>

            <p style="font-size: 14px; color: #64748b;">Si tiene alguna pregunta, simplemente responda a este correo.</p>

            <p style="margin-top: 24px;">Saludos cordiales,<br/><strong>Equipo Xiri Facility Solutions</strong></p>
        </div>
    </div>` : `
    <div style="font-family: sans-serif; line-height: 1.8; max-width: 600px; color: #1e293b;">
        <div style="background: #0c4a6e; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">We've received your application!</h1>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p>Hi <strong>${businessName}</strong>,</p>
            <p>Thank you for completing your application to join the Xiri Contractor Network. We've received your information and our team will review it shortly.</p>

            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h3 style="margin: 0 0 12px 0; color: #0c4a6e; font-size: 15px;">What we received:</h3>
                <p style="margin: 4px 0; font-size: 14px;">\u{1F4E7} Email: ${email}</p>
                <p style="margin: 4px 0; font-size: 14px;">\u{1F4DE} Phone: ${phone}</p>
                <p style="margin: 4px 0; font-size: 14px;">\u{1F4CB} Track: ${track === "FAST_TRACK" ? "\u26A1 Express Contract" : "\u{1F91D} Partner Network"}</p>
            </div>

            <h3 style="color: #0c4a6e; font-size: 15px;">What happens next:</h3>
            <ol style="font-size: 14px; padding-left: 20px;">
                <li>Our team will review your documents and information</li>
                <li>You'll receive a confirmation once your account is verified</li>
                <li>Once approved, you'll start receiving work opportunities</li>
            </ol>

            <p style="font-size: 14px; color: #64748b;">If you have any questions, just reply to this email.</p>

            <p style="margin-top: 24px;">Best regards,<br/><strong>Xiri Facility Solutions Team</strong></p>
        </div>
    </div>`;
    const vendorSubject = isSpanish ? `\u2705 Solicitud recibida \u2014 ${businessName}` : `\u2705 Application received \u2014 ${businessName}`;
    try {
      const { error: vendorError } = await resend2.emails.send({
        from: "Xiri Facility Solutions <onboarding@xiri.ai>",
        replyTo: "chris@xiri.ai",
        to: email,
        subject: vendorSubject,
        html: vendorHtml
      });
      if (vendorError) {
        logger6.error("Failed to send vendor confirmation:", vendorError);
      } else {
        logger6.info(`Vendor confirmation sent to ${email}`);
      }
    } catch (err) {
      logger6.error("Error sending vendor confirmation:", err);
    }
  }
  const db23 = admin12.firestore();
  const hasEntity = !!compliance.hasBusinessEntity;
  const hasGL = !!compliance.generalLiability?.hasInsurance;
  const hasWC = !!compliance.workersComp?.hasInsurance;
  const hasAuto = !!compliance.autoInsurance?.hasInsurance;
  const hasW9 = !!compliance.w9Collected;
  const attestationItems = [hasEntity, hasGL, hasWC, hasAuto, hasW9];
  const attestationScore = attestationItems.filter(Boolean).length * 10;
  const uploads = compliance.uploadedDocs || {};
  const hasAcord25 = !!compliance.acord25?.url;
  const legacyDocsCount = [uploads.coi, uploads.llc, uploads.w9].filter(Boolean).length;
  const docsUploadedScore = hasAcord25 ? 30 : Math.min(legacyDocsCount * 10, 30);
  const acord25Verified = compliance.acord25?.status === "VERIFIED";
  const docsVerifiedScore = acord25Verified ? 20 : 0;
  const totalScore = attestationScore + docsUploadedScore + docsVerifiedScore;
  const complianceUpdate = {
    complianceScore: totalScore,
    complianceBreakdown: {
      attestation: attestationScore,
      docsUploaded: docsUploadedScore,
      docsVerified: docsVerifiedScore
    },
    statusUpdatedAt: /* @__PURE__ */ new Date()
  };
  if (totalScore >= 80) {
    complianceUpdate.status = "onboarding_scheduled";
  }
  await db23.collection("vendors").doc(vendorId).update(complianceUpdate);
  logger6.info(`Vendor ${vendorId} compliance score: ${totalScore}/100 (attest=${attestationScore}, docs=${docsUploadedScore}, verified=${docsVerifiedScore})`);
  await db23.collection("vendor_activities").add({
    vendorId,
    type: "ONBOARDING_COMPLETE",
    description: `${businessName} completed onboarding form (${track}). Compliance score: ${totalScore}/100.`,
    createdAt: /* @__PURE__ */ new Date(),
    metadata: { track, email, phone, lang, complianceScore: totalScore }
  });
});

// src/triggers/dripScheduler.ts
var import_firestore8 = require("firebase-functions/v2/firestore");
var admin13 = __toESM(require("firebase-admin"));
var logger7 = __toESM(require("firebase-functions/logger"));
init_queueUtils();
if (!admin13.apps.length) {
  admin13.initializeApp();
}
var db10 = admin13.firestore();
var onAwaitingOnboarding = (0, import_firestore8.onDocumentUpdated)({
  document: "vendors/{vendorId}"
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  if (before.status === after.status) return;
  if (after.status !== "awaiting_onboarding") return;
  const vendorId = event.params.vendorId;
  const businessName = after.businessName || "Unknown";
  logger7.info(`Scheduling drip campaign for vendor ${vendorId} (${businessName})`);
  const now = /* @__PURE__ */ new Date();
  const followUps = [
    { dayOffset: 3, sequence: 1, subject: "Quick reminder \u2014 complete your XIRI profile" },
    { dayOffset: 7, sequence: 2, subject: "Just checking in \u2014 your XIRI application" },
    { dayOffset: 14, sequence: 3, subject: "Final follow-up \u2014 don't miss out on work opportunities" },
    { dayOffset: 21, sequence: 4, subject: "Last chance \u2014 XIRI partnership closing soon" }
  ];
  for (const fu of followUps) {
    const scheduledDate = new Date(now);
    scheduledDate.setDate(scheduledDate.getDate() + fu.dayOffset);
    scheduledDate.setHours(15, 0, 0, 0);
    await enqueueTask(db10, {
      vendorId,
      type: "FOLLOW_UP",
      scheduledAt: admin13.firestore.Timestamp.fromDate(scheduledDate),
      metadata: {
        sequence: fu.sequence,
        subject: fu.subject,
        businessName,
        email: after.email,
        preferredLanguage: after.preferredLanguage || "en"
      }
    });
  }
  for (const fu of followUps) {
    const scheduledDate = new Date(now);
    scheduledDate.setDate(scheduledDate.getDate() + fu.dayOffset);
    scheduledDate.setHours(15, 0, 0, 0);
    await db10.collection("vendor_activities").add({
      vendorId,
      type: "DRIP_SCHEDULED",
      description: `Follow-up #${fu.sequence} scheduled: "${fu.subject}"`,
      createdAt: /* @__PURE__ */ new Date(),
      scheduledFor: scheduledDate,
      metadata: { sequence: fu.sequence, dayOffset: fu.dayOffset, subject: fu.subject }
    });
  }
  logger7.info(`Drip campaign scheduled for ${vendorId}: 4 follow-ups at days 3, 7, 14, 21`);
});

// src/triggers/handleUnsubscribe.ts
var import_https2 = require("firebase-functions/v2/https");
var admin14 = __toESM(require("firebase-admin"));
var logger8 = __toESM(require("firebase-functions/logger"));
init_queueUtils();
if (!admin14.apps.length) {
  admin14.initializeApp();
}
var db11 = admin14.firestore();
var handleUnsubscribe = (0, import_https2.onRequest)({
  cors: true
}, async (req, res) => {
  const vendorId = req.query.vendorId;
  if (!vendorId) {
    res.status(400).send(renderPage(
      "Invalid Request",
      "Missing vendor identifier. If you clicked a link from an email, please try again.",
      false
    ));
    return;
  }
  try {
    const vendorDoc = await db11.collection("vendors").doc(vendorId).get();
    if (!vendorDoc.exists) {
      res.status(404).send(renderPage(
        "Not Found",
        "We couldn't find your record. You may have already been unsubscribed.",
        false
      ));
      return;
    }
    const vendor = vendorDoc.data();
    const businessName = vendor.businessName || "Vendor";
    if (vendor.status === "dismissed") {
      res.status(200).send(renderPage(
        "Already Unsubscribed",
        `${businessName} has already been removed from our outreach list. You won't receive any more emails.`,
        true
      ));
      return;
    }
    await db11.collection("vendors").doc(vendorId).update({
      status: "dismissed",
      statusUpdatedAt: /* @__PURE__ */ new Date(),
      dismissReason: "unsubscribed",
      unsubscribedAt: /* @__PURE__ */ new Date()
    });
    const cancelledCount = await cancelVendorTasks(db11, vendorId);
    await db11.collection("vendor_activities").add({
      vendorId,
      type: "STATUS_CHANGE",
      description: `${businessName} unsubscribed via email link. ${cancelledCount} pending tasks cancelled.`,
      createdAt: /* @__PURE__ */ new Date(),
      metadata: {
        from: vendor.status,
        to: "dismissed",
        trigger: "unsubscribe_link",
        cancelledTasks: cancelledCount
      }
    });
    logger8.info(`Vendor ${vendorId} (${businessName}) unsubscribed. ${cancelledCount} tasks cancelled.`);
    res.status(200).send(renderPage(
      "Unsubscribed Successfully",
      `${businessName} has been removed from our outreach list. You won't receive any more emails from Xiri Facility Solutions.<br/><br/>If this was a mistake, please contact us at <a href="mailto:chris@xiri.ai" style="color: #0369a1;">chris@xiri.ai</a>.`,
      true
    ));
  } catch (err) {
    logger8.error(`Error processing unsubscribe for ${vendorId}:`, err);
    res.status(500).send(renderPage(
      "Something Went Wrong",
      'We encountered an error processing your request. Please try again or contact us at <a href="mailto:chris@xiri.ai" style="color: #0369a1;">chris@xiri.ai</a>.',
      false
    ));
  }
});
function renderPage(title, message, success) {
  const icon = success ? "\u2705" : "\u26A0\uFE0F";
  const color = success ? "#059669" : "#dc2626";
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} \u2014 Xiri Facility Solutions</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f8fafc; }
        .card { background: white; border-radius: 16px; padding: 48px; max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .icon { font-size: 48px; margin-bottom: 16px; }
        h1 { color: ${color}; font-size: 24px; margin: 0 0 16px 0; }
        p { color: #475569; line-height: 1.6; font-size: 15px; margin: 0; }
        .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">${icon}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <div class="footer">Xiri Facility Solutions</div>
    </div>
</body>
</html>`;
}

// src/triggers/sendOnboardingInvite.ts
var import_firestore9 = require("firebase-functions/v2/firestore");
var admin15 = __toESM(require("firebase-admin"));
var logger9 = __toESM(require("firebase-functions/logger"));
init_emailUtils();
var import_date_fns2 = require("date-fns");
var import_date_fns_tz = require("date-fns-tz");
if (!admin15.apps.length) {
  admin15.initializeApp();
}
var db12 = admin15.firestore();
var ADMIN_EMAIL = "chris@xiri.ai";
var EASTERN_TZ = "America/New_York";
var sendOnboardingInvite = (0, import_firestore9.onDocumentUpdated)({
  document: "vendors/{vendorId}",
  secrets: ["RESEND_API_KEY"]
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  if (before.status === after.status) return;
  if (after.status !== "onboarding_scheduled") return;
  const callTime = after.onboardingCallTime;
  const vendorEmail = after.email;
  const businessName = after.businessName || "Vendor";
  const contactName = after.contactName || businessName;
  const vendorId = event.params.vendorId;
  if (!callTime) {
    logger9.warn(`Vendor ${vendorId} moved to onboarding_scheduled but no onboardingCallTime set.`);
    return;
  }
  if (!vendorEmail) {
    logger9.warn(`Vendor ${vendorId} has no email. Skipping invite.`);
    return;
  }
  logger9.info(`Sending onboarding invite for vendor ${vendorId} (${businessName}) at ${callTime}`);
  const startTime = new Date(callTime);
  const duration = 30;
  const endTime = (0, import_date_fns2.addMinutes)(startTime, duration);
  const icsContent = generateICS2({
    start: startTime,
    end: endTime,
    summary: `Xiri Onboarding Call: ${businessName}`,
    description: `Onboarding call with ${contactName} from ${businessName}.

We'll cover:
- Service capabilities & coverage areas
- Insurance & compliance verification
- Account setup & next steps

Power to the Facilities!`,
    location: "Phone Call",
    organizer: { name: "Xiri Facility Solutions", email: "onboarding@xiri.ai" },
    attendees: [
      { name: contactName, email: vendorEmail },
      { name: "Xiri Team", email: ADMIN_EMAIL }
    ]
  });
  const formattedTime = (0, import_date_fns_tz.formatInTimeZone)(startTime, EASTERN_TZ, "EEEE, MMMM do 'at' h:mm a zzz");
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0ea5e9;">Onboarding Call Confirmed!</h1>
        <p>Hi ${contactName},</p>
        <p>Your onboarding call with Xiri Facility Solutions has been scheduled:</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px; font-weight: bold;">
                ${formattedTime}
            </p>
            <p style="margin: 5px 0 0; color: #6b7280;">Duration: ${duration} minutes \u2022 Phone Call</p>
        </div>
        <p><strong>What to expect:</strong></p>
        <ul>
            <li>Quick review of your service capabilities</li>
            <li>Insurance & compliance verification</li>
            <li>Account setup and next steps</li>
        </ul>
        <p>A calendar invitation has been attached to this email.</p>
        <p>Best,<br/>The Xiri Team</p>
    </div>
    `;
  const subject = `Confirmed: Xiri Onboarding Call \u2014 ${formattedTime}`;
  const vendorSent = await sendEmail(vendorEmail, subject, htmlBody, [
    { filename: "onboarding-call.ics", content: icsContent }
  ]);
  const adminHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0ea5e9;">New Onboarding Call Booked</h1>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px; font-weight: bold;">${businessName}</p>
            <p style="margin: 5px 0 0; color: #6b7280;">${formattedTime} \u2022 ${duration} min</p>
            <p style="margin: 5px 0 0; color: #6b7280;">Contact: ${contactName} (${vendorEmail})</p>
        </div>
        <p><a href="https://app.xiri.ai/supply/crm/${vendorId}" style="color: #0ea5e9;">View in CRM \u2192</a></p>
    </div>
    `;
  await sendEmail(ADMIN_EMAIL, `Onboarding Call: ${businessName} \u2014 ${formattedTime}`, adminHtml, [
    { filename: "onboarding-call.ics", content: icsContent }
  ]);
  await db12.collection("vendor_activities").add({
    vendorId,
    type: "ONBOARDING_CALL_SCHEDULED",
    description: `Onboarding call scheduled for ${formattedTime}`,
    createdAt: /* @__PURE__ */ new Date(),
    metadata: {
      callTime,
      vendorEmail,
      adminEmail: ADMIN_EMAIL,
      emailSent: vendorSent
    }
  });
  logger9.info(`Onboarding invite sent for vendor ${vendorId}. Vendor: ${vendorSent ? "\u2705" : "\u274C"}`);
});
function generateICS2(event) {
  const formatDate = (date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  let attendeeLines = "";
  if (event.attendees) {
    attendeeLines = event.attendees.map((a) => `ATTENDEE;CN=${a.name};RSVP=TRUE:mailto:${a.email}`).join("\r\n");
  }
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Xiri//Facility Solutions//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:onboarding-${Date.now()}@xiri.ai
DTSTAMP:${formatDate(/* @__PURE__ */ new Date())}
DTSTART:${formatDate(event.start)}
DTEND:${formatDate(event.end)}
SUMMARY:${event.summary}
DESCRIPTION:${event.description.replace(/\n/g, "\\n")}
LOCATION:${event.location}
ORGANIZER;CN=${event.organizer.name}:mailto:${event.organizer.email}
${attendeeLines}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;
}

// src/triggers/sendQuoteEmail.ts
var import_https3 = require("firebase-functions/v2/https");
var admin16 = __toESM(require("firebase-admin"));
init_emailUtils();

// ../../node_modules/uuid/dist/esm/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// ../../node_modules/uuid/dist/esm/rng.js
var import_crypto = require("crypto");
var rnds8Pool = new Uint8Array(256);
var poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    (0, import_crypto.randomFillSync)(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

// ../../node_modules/uuid/dist/esm/native.js
var import_crypto2 = require("crypto");
var native_default = { randomUUID: import_crypto2.randomUUID };

// ../../node_modules/uuid/dist/esm/v4.js
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  options = options || {};
  const rnds = options.random ?? options.rng?.() ?? rng();
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
var v4_default = v4;

// src/triggers/sendQuoteEmail.ts
var db13 = admin16.firestore();
var sendQuoteEmail = (0, import_https3.onCall)({
  secrets: ["RESEND_API_KEY"],
  cors: [
    "http://localhost:3001",
    "http://localhost:3000",
    "https://xiri.ai",
    "https://www.xiri.ai",
    "https://app.xiri.ai",
    "https://xiri-dashboard.vercel.app",
    "https://xiri-dashboard-git-develop-xiri-facility-solutions.vercel.app",
    /https:\/\/xiri-dashboard-.*\.vercel\.app$/,
    "https://xiri-facility-solutions.web.app",
    "https://xiri-facility-solutions.firebaseapp.com"
  ]
}, async (request) => {
  if (!request.auth) {
    throw new import_https3.HttpsError("unauthenticated", "Must be authenticated");
  }
  const { quoteId, clientEmail, clientName } = request.data;
  if (!quoteId || !clientEmail) {
    throw new import_https3.HttpsError("invalid-argument", "Missing quoteId or clientEmail");
  }
  const quoteRef = db13.collection("quotes").doc(quoteId);
  const quoteSnap = await quoteRef.get();
  if (!quoteSnap.exists) {
    throw new import_https3.HttpsError("not-found", "Quote not found");
  }
  const quote = quoteSnap.data();
  const reviewToken = v4_default();
  await quoteRef.update({
    reviewToken,
    clientEmail,
    status: "sent",
    sentAt: admin16.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin16.firestore.FieldValue.serverTimestamp()
  });
  const reviewUrl = `https://xiri.ai/quote/review/${reviewToken}`;
  const formatCurrency = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const formatFrequency = (freq, daysOfWeek) => {
    if (freq === "custom_days" && daysOfWeek) {
      const days = daysOfWeek.map((on, i) => on ? DAY_NAMES[i] : null).filter(Boolean);
      const monFri = [false, true, true, true, true, true, false];
      if (JSON.stringify(daysOfWeek) === JSON.stringify(monFri)) return "Mon\u2013Fri";
      return days.join(", ") || "Custom";
    }
    const labels = { nightly: "Nightly", weekly: "Weekly", biweekly: "Bi-Weekly", monthly: "Monthly", quarterly: "Quarterly", custom_days: "Custom" };
    return labels[freq] || freq;
  };
  const lineItemCards = (quote.lineItems || []).map(
    (item) => `<div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${item.locationName}</div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="color: #6b7280; font-size: 14px;">${item.serviceType}</span>
                    <span style="color: #9ca3af; font-size: 13px;"> \xB7 ${formatFrequency(item.frequency, item.daysOfWeek)}</span>
                </div>
                <span style="font-weight: 700; color: #0369a1; font-size: 16px; white-space: nowrap;">${formatCurrency(item.clientRate)}/mo</span>
            </div>
        </div>`
  ).join("");
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; -webkit-text-size-adjust: 100%;">
        <div style="max-width: 560px; margin: 0 auto; padding: 24px 12px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%); border-radius: 12px 12px 0 0; padding: 24px;">
                <div style="display: flex; align-items: baseline; justify-content: center; gap: 10px;">
                    <span style="color: white; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">XIRI</span>
                    <span style="color: rgba(255,255,255,0.8); font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">FACILITY SOLUTIONS</span>
                </div>
            </div>

            <!-- Body -->
            <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <h2 style="color: #111827; margin: 0 0 8px; font-size: 20px;">Your Service Proposal</h2>
                <p style="color: #6b7280; margin: 0 0 20px; font-size: 14px; line-height: 1.5;">
                    Hi${clientName ? ` ${clientName}` : ""},<br/>
                    Thank you for considering XIRI Facility Solutions. Below is a summary of the proposed services for <strong>${quote.leadBusinessName}</strong>.
                </p>

                <!-- Service Cards -->
                <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
                    ${lineItemCards}
                </div>

                <!-- Total -->
                <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 28px;">
                    <p style="color: #6b7280; margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Total Monthly Investment</p>
                    <p style="color: #0369a1; margin: 4px 0 0; font-size: 28px; font-weight: 700;">${formatCurrency(quote.totalMonthlyRate)}<span style="font-size: 14px; font-weight: 400; color: #6b7280;">/month</span></p>
                    <p style="color: #6b7280; margin: 4px 0 0; font-size: 13px;">${quote.contractTenure}-month agreement \xB7 ${quote.paymentTerms}</p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin-bottom: 16px;">
                    <a href="${reviewUrl}" style="display: inline-block; background: #0369a1; color: white; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 16px;">Review & Respond</a>
                </div>
                <p style="text-align: center; color: #9ca3af; font-size: 12px; margin: 0;">
                    Click the button above to accept or request changes to this proposal.
                </p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 20px 0;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    XIRI Facility Solutions \xB7 Professional Facility Management<br/>
                    <a href="https://xiri.ai" style="color: #0369a1; text-decoration: none;">xiri.ai</a>
                </p>
            </div>
        </div>
    </body>
    </html>`;
  const sent = await sendEmail(
    clientEmail,
    `Service Proposal for ${quote.leadBusinessName} \u2014 XIRI Facility Solutions`,
    html,
    void 0,
    "Xiri Facility Solutions <quotes@xiri.ai>"
  );
  if (!sent) {
    throw new import_https3.HttpsError("internal", "Failed to send email");
  }
  await db13.collection("activity_logs").add({
    type: "QUOTE_SENT",
    quoteId,
    leadId: quote.leadId,
    clientEmail,
    sentBy: request.auth.uid,
    createdAt: admin16.firestore.FieldValue.serverTimestamp()
  });
  return { success: true, reviewToken };
});
var respondToQuote = (0, import_https3.onCall)({
  secrets: ["RESEND_API_KEY"],
  cors: [
    "http://localhost:3000",
    "https://xiri.ai",
    "https://www.xiri.ai"
  ]
}, async (request) => {
  const { reviewToken, action, notes } = request.data;
  if (!reviewToken || !action) {
    throw new import_https3.HttpsError("invalid-argument", "Missing reviewToken or action");
  }
  if (!["accept", "request_changes"].includes(action)) {
    throw new import_https3.HttpsError("invalid-argument", "Invalid action");
  }
  const quotesSnap = await db13.collection("quotes").where("reviewToken", "==", reviewToken).limit(1).get();
  if (quotesSnap.empty) {
    throw new import_https3.HttpsError("not-found", "Invalid or expired quote link");
  }
  const quoteDoc = quotesSnap.docs[0];
  const quote = quoteDoc.data();
  if (quote.status !== "sent") {
    throw new import_https3.HttpsError("failed-precondition", `This quote has already been ${quote.status}`);
  }
  const now = admin16.firestore.FieldValue.serverTimestamp();
  if (action === "accept") {
    const contractRef = await db13.collection("contracts").add({
      leadId: quote.leadId,
      quoteId: quoteDoc.id,
      clientBusinessName: quote.leadBusinessName,
      clientAddress: "",
      signerName: "",
      signerTitle: "",
      totalMonthlyRate: quote.totalMonthlyRate,
      contractTenure: quote.contractTenure,
      startDate: now,
      endDate: new Date(Date.now() + quote.contractTenure * 30 * 24 * 60 * 60 * 1e3),
      paymentTerms: quote.paymentTerms,
      exitClause: quote.exitClause || "30-day written notice",
      status: "active",
      createdBy: "client_accepted",
      createdAt: now,
      updatedAt: now
    });
    for (const item of quote.lineItems || []) {
      await db13.collection("work_orders").add({
        leadId: quote.leadId,
        contractId: contractRef.id,
        quoteLineItemId: item.id,
        locationId: item.locationId,
        locationName: item.locationName,
        serviceType: item.serviceType,
        scopeTemplateId: item.scopeTemplateId || null,
        tasks: [],
        vendorId: null,
        vendorRate: null,
        vendorHistory: [],
        schedule: {
          daysOfWeek: [false, true, true, true, true, true, false],
          startTime: "21:00",
          frequency: item.frequency
        },
        qrCodeSecret: v4_default(),
        clientRate: item.clientRate,
        margin: null,
        status: "pending_assignment",
        assignedFsmId: quote.assignedFsmId || null,
        assignedBy: null,
        notes: "",
        createdAt: now,
        updatedAt: now
      });
    }
    await quoteDoc.ref.update({
      status: "accepted",
      acceptedAt: now,
      clientResponseAt: now,
      clientResponseNotes: notes || null,
      updatedAt: now
    });
    await db13.collection("leads").doc(quote.leadId).update({
      status: "won",
      contractId: contractRef.id,
      wonAt: now
    });
    if (quote.clientEmail) {
      await sendEmail(
        quote.clientEmail,
        `Proposal Accepted \u2014 Welcome to XIRI Facility Solutions`,
        `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
                    <h2 style="color: #0369a1;">Thank you!</h2>
                    <p>Your service agreement for <strong>${quote.leadBusinessName}</strong> has been confirmed.</p>
                    <p>Your dedicated Facility Solutions Manager will be in touch shortly to coordinate getting started.</p>
                    <p style="color: #6b7280; font-size: 13px;">\u2014 XIRI Facility Solutions</p>
                </div>`
      );
    }
    await db13.collection("activity_logs").add({
      type: "QUOTE_ACCEPTED_BY_CLIENT",
      quoteId: quoteDoc.id,
      leadId: quote.leadId,
      contractId: contractRef.id,
      clientEmail: quote.clientEmail,
      createdAt: now
    });
    return { success: true, action: "accepted" };
  } else {
    await quoteDoc.ref.update({
      clientResponseAt: now,
      clientResponseNotes: notes || "Client requested changes",
      updatedAt: now
    });
    await db13.collection("activity_logs").add({
      type: "QUOTE_CHANGES_REQUESTED",
      quoteId: quoteDoc.id,
      leadId: quote.leadId,
      clientEmail: quote.clientEmail,
      notes: notes || "",
      createdAt: now
    });
    return { success: true, action: "changes_requested" };
  }
});

// src/triggers/processMailQueue.ts
var import_firestore10 = require("firebase-functions/v2/firestore");
var admin17 = __toESM(require("firebase-admin"));
init_emailUtils();
var db14 = admin17.firestore();
var processMailQueue = (0, import_firestore10.onDocumentCreated)({
  document: "mail_queue/{docId}",
  secrets: ["RESEND_API_KEY"]
}, async (event) => {
  const snap = event.data;
  if (!snap) {
    console.error("No data in mail_queue document");
    return;
  }
  const data = snap.data();
  const docRef = snap.ref;
  try {
    await docRef.update({ status: "processing", processedAt: admin17.firestore.FieldValue.serverTimestamp() });
    const { to, subject, templateType, templateData } = data;
    if (!to || !subject) {
      throw new Error("Missing 'to' or 'subject' in mail_queue document");
    }
    let html = "";
    switch (templateType) {
      case "client_invoice":
        html = buildClientInvoiceEmail(templateData);
        break;
      case "vendor_remittance":
        html = buildVendorRemittanceEmail(templateData);
        break;
      default:
        html = templateData?.html || `<p>${subject}</p>`;
        break;
    }
    const success = await sendEmail(
      to,
      subject,
      html,
      void 0,
      // attachments
      "Xiri Facility Solutions <billing@xiri.ai>"
    );
    if (success) {
      await docRef.update({ status: "sent", sentAt: admin17.firestore.FieldValue.serverTimestamp() });
      console.log(`\u2705 Mail sent: ${templateType} \u2192 ${to}`);
    } else {
      await docRef.update({ status: "failed", error: "Resend API returned failure" });
      console.error(`\u274C Mail failed: ${templateType} \u2192 ${to}`);
    }
  } catch (error11) {
    console.error("Error processing mail_queue:", error11);
    await docRef.update({
      status: "failed",
      error: error11.message || "Unknown error",
      failedAt: admin17.firestore.FieldValue.serverTimestamp()
    });
  }
});
function buildClientInvoiceEmail(data) {
  const { clientBusinessName, clientContactName, totalAmount, paymentLink, billingPeriod } = data || {};
  const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(totalAmount || 0);
  const periodText = billingPeriod ? `${billingPeriod.start} \u2014 ${billingPeriod.end}` : "Current Period";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f8;">
  <div style="max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0369a1, #0284c7); padding: 32px 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">XIRI</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Facility Solutions</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Hi ${clientContactName || "there"},
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Your invoice for <strong>${clientBusinessName || "your facility"}</strong> is ready.
      </p>

      <!-- Amount Box -->
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
        <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Amount Due</p>
        <p style="color: #0369a1; font-size: 32px; font-weight: 700; margin: 0;">${formattedAmount}</p>
        <p style="color: #94a3b8; font-size: 13px; margin: 8px 0 0;">Billing Period: ${periodText}</p>
      </div>

      ${paymentLink ? `
      <!-- CTA -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="${paymentLink}" style="display: inline-block; background: #0369a1; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">View Invoice & Pay</a>
      </div>
      ` : ""}

      <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 24px 0 0;">
        If you have any questions about this invoice, please reply to this email or contact your Facility Solutions Manager.
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #e5e7eb; padding: 16px 24px; background: #f9fafb;">
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
        Xiri Facility Solutions \u2022 <a href="https://xiri.ai" style="color: #0369a1; text-decoration: none;">xiri.ai</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
function buildVendorRemittanceEmail(data) {
  const { vendorName, totalAmount, billingPeriod, lineItems } = data || {};
  const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(totalAmount || 0);
  const periodText = billingPeriod ? `${billingPeriod.start} \u2014 ${billingPeriod.end}` : "Current Period";
  const lineItemsHtml = (lineItems || []).map(
    (li) => `<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #374151;">${li.serviceType || "\u2014"}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #6b7280;">${li.locationName || "\u2014"}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #374151; text-align: right; font-weight: 500;">$${(li.amount || 0).toLocaleString()}</td>
        </tr>`
  ).join("");
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f8;">
  <div style="max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0369a1, #0284c7); padding: 32px 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">XIRI</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Remittance Statement</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Hi ${vendorName || "Partner"},
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Here is your remittance statement for <strong>${periodText}</strong>. This details the services you provided and the payment owed to you.
      </p>

      <!-- Line Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0;">Service</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0;">Location</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHtml}
        </tbody>
      </table>

      <!-- Total -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
        <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px;">Total Owed to You</p>
        <p style="color: #16a34a; font-size: 28px; font-weight: 700; margin: 0;">${formattedAmount}</p>
      </div>

      <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 20px 0 0;">
        Payment will be processed according to your agreed terms. If you have any questions, please reply to this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #e5e7eb; padding: 16px 24px; background: #f9fafb;">
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
        Xiri Facility Solutions \u2022 <a href="https://xiri.ai" style="color: #0369a1; text-decoration: none;">xiri.ai</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// src/triggers/onVendorReady.ts
var import_firestore11 = require("firebase-functions/v2/firestore");
var admin18 = __toESM(require("firebase-admin"));
var logger10 = __toESM(require("firebase-functions/logger"));
var import_TaxCertificateService = __toESM(require_TaxCertificateService());
if (!admin18.apps.length) {
  admin18.initializeApp();
}
var STORAGE_PATH = "tax-certificates/st-120-1";
var onWorkOrderAssigned = (0, import_firestore11.onDocumentUpdated)({
  document: "work_orders/{workOrderId}"
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  const oldVendorId = before.vendorId || null;
  const newVendorId = after.vendorId || null;
  if (!newVendorId || oldVendorId === newVendorId) return;
  const workOrderId = event.params.workOrderId;
  logger10.info(`[ST-120.1] Vendor ${newVendorId} assigned to work order ${workOrderId}.`);
  const db23 = admin18.firestore();
  let vendorData;
  try {
    const vendorSnap = await db23.collection("vendors").doc(newVendorId).get();
    if (!vendorSnap.exists) {
      logger10.error(`[ST-120.1] Vendor ${newVendorId} not found.`);
      return;
    }
    vendorData = vendorSnap.data();
  } catch (err) {
    logger10.error(`[ST-120.1] Error loading vendor ${newVendorId}:`, err);
    return;
  }
  const salesTaxId = vendorData.compliance?.salesTaxId?.trim();
  if (!salesTaxId) {
    logger10.info(`[ST-120.1] Vendor ${newVendorId} has no salesTaxId \u2014 skipping certificate.`);
    await db23.collection("vendor_activities").add({
      vendorId: newVendorId,
      type: "TAX_CERTIFICATE_SKIPPED",
      description: `ST-120.1 not generated for WO ${workOrderId} \u2014 vendor has no Sales Tax ID on file.`,
      createdAt: /* @__PURE__ */ new Date(),
      metadata: { workOrderId }
    });
    return;
  }
  let leadData = {};
  if (after.leadId) {
    try {
      const leadSnap = await db23.collection("leads").doc(after.leadId).get();
      if (leadSnap.exists) {
        leadData = leadSnap.data();
      }
    } catch (err) {
      logger10.warn(`[ST-120.1] Could not load lead ${after.leadId}:`, err);
    }
  }
  let xiriData;
  try {
    const settingsSnap = await db23.collection("settings").doc("corporate").get();
    const settings = settingsSnap.data();
    if (!settings?.salesTaxId) {
      logger10.error("[ST-120.1] XIRI corporate settings missing or no salesTaxId configured.");
      return;
    }
    xiriData = {
      businessName: settings.businessName || "XIRI Facility Solutions LLC",
      address: settings.address || "",
      city: settings.city || "",
      state: settings.state || "NY",
      zip: settings.zip || "",
      salesTaxId: settings.salesTaxId,
      signatureImageBase64: settings.signatureImageBase64 || "",
      signerName: settings.signerName || "",
      signerTitle: settings.signerTitle || ""
    };
  } catch (err) {
    logger10.error("[ST-120.1] Error loading corporate settings:", err);
    return;
  }
  const vendorCertData = {
    vendorId: newVendorId,
    businessName: vendorData.businessName || "Unknown Vendor",
    address: vendorData.address || vendorData.streetAddress || "",
    city: vendorData.city,
    state: vendorData.state,
    zip: vendorData.zip,
    email: vendorData.email || "",
    salesTaxId
  };
  const ownerName = leadData.businessName || after.locationName || "Project Owner";
  const ownerAddress = leadData.address || "";
  const projectDataInput = {
    workOrderId,
    projectName: after.locationName || leadData.businessName || "Project",
    projectAddress: after.locationAddress || "",
    projectCity: after.locationCity,
    projectState: after.locationState,
    projectZip: after.locationZip,
    ownerName,
    ownerAddress
  };
  const result = await (0, import_TaxCertificateService.generateST1201)(vendorCertData, xiriData, projectDataInput);
  if (!result.success || !result.pdfBytes) {
    logger10.error(`[ST-120.1] Generation failed for WO ${workOrderId}: ${result.error}`);
    await db23.collection("vendor_activities").add({
      vendorId: newVendorId,
      type: "TAX_CERTIFICATE_ERROR",
      description: `ST-120.1 generation failed for WO ${workOrderId}: ${result.error}`,
      createdAt: /* @__PURE__ */ new Date(),
      metadata: { workOrderId }
    });
    return;
  }
  let pdfUrl;
  try {
    const bucket = admin18.storage().bucket();
    const fileName = `${STORAGE_PATH}/${workOrderId}_${newVendorId}_${result.issueDate}.pdf`;
    const file = bucket.file(fileName);
    await file.save(Buffer.from(result.pdfBytes), {
      metadata: {
        contentType: "application/pdf",
        metadata: {
          workOrderId,
          vendorId: newVendorId,
          issueDate: result.issueDate,
          expiryDate: result.expiryDate
        }
      }
    });
    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1e3)
    });
    pdfUrl = signedUrl;
  } catch (err) {
    logger10.error(`[ST-120.1] Storage upload failed for WO ${workOrderId}:`, err);
    return;
  }
  await db23.collection("work_orders").doc(workOrderId).update({
    st1201CertificateUrl: pdfUrl,
    st1201IssueDate: result.issueDate,
    st1201ExpiryDate: result.expiryDate,
    updatedAt: admin18.firestore.FieldValue.serverTimestamp()
  });
  if (vendorCertData.email) {
    const vendorName = vendorCertData.businessName;
    const projectName = projectDataInput.projectName;
    await db23.collection("mail_queue").add({
      to: vendorCertData.email,
      subject: `ST-120.1 Exempt Purchase Certificate \u2014 ${projectName}`,
      templateType: "st_120_1_certificate",
      templateData: {
        vendorName,
        purchaserName: xiriData.businessName,
        projectName,
        projectAddress: projectDataInput.projectAddress,
        issueDate: result.issueDate,
        expiryDate: result.expiryDate
      },
      attachments: [{
        filename: `ST-120.1_${projectName.replace(/\s+/g, "_")}.pdf`,
        path: pdfUrl
      }],
      status: "pending",
      createdAt: admin18.firestore.FieldValue.serverTimestamp()
    });
  }
  await db23.collection("vendor_activities").add({
    vendorId: newVendorId,
    type: "TAX_CERTIFICATE_ISSUED",
    description: `ST-120.1 generated for project "${projectDataInput.projectName}" (WO ${workOrderId}) and emailed to ${vendorCertData.email || "vendor"}.`,
    createdAt: /* @__PURE__ */ new Date(),
    metadata: {
      workOrderId,
      certificateType: "ST-120.1",
      issueDate: result.issueDate,
      expiryDate: result.expiryDate,
      projectName: projectDataInput.projectName,
      projectAddress: projectDataInput.projectAddress,
      pdfUrl
    }
  });
  logger10.info(`[ST-120.1] Certificate generated and emailed for WO ${workOrderId}, vendor ${newVendorId}.`);
});

// src/triggers/onLeadQualified.ts
var import_firestore12 = require("firebase-functions/v2/firestore");
var admin19 = __toESM(require("firebase-admin"));
var logger11 = __toESM(require("firebase-functions/logger"));
init_queueUtils();
if (!admin19.apps.length) {
  admin19.initializeApp();
}
var db15 = admin19.firestore();
var onLeadQualified = (0, import_firestore12.onDocumentUpdated)({
  document: "leads/{leadId}"
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  if (before.status === after.status) return;
  if (after.status !== "qualified") return;
  const leadId = event.params.leadId;
  const businessName = after.businessName || "Unknown";
  const contactEmail = after.email;
  if (!contactEmail || contactEmail.trim().length === 0) {
    logger11.warn(`[SalesOutreach] Lead ${leadId} (${businessName}) has no email \u2014 marking NEEDS_MANUAL.`);
    await db15.collection("leads").doc(leadId).update({
      outreachStatus: "NEEDS_MANUAL"
    });
    await db15.collection("lead_activities").add({
      leadId,
      type: "OUTREACH_NEEDS_MANUAL",
      description: `No email found for ${businessName}. Manual outreach required.`,
      createdAt: /* @__PURE__ */ new Date()
    });
    return;
  }
  logger11.info(`[SalesOutreach] Scheduling drip campaign for lead ${leadId} (${businessName})`);
  const now = /* @__PURE__ */ new Date();
  const steps = [
    { dayOffset: 0, sequence: 0, subject: "Simplify your facility management" },
    { dayOffset: 3, sequence: 1, subject: "How we save you 15+ hours/month" },
    { dayOffset: 7, sequence: 2, subject: "How practices like yours made the switch" },
    { dayOffset: 14, sequence: 3, subject: "Last check in \u2014 free walkthrough offer" }
  ];
  for (const step of steps) {
    const scheduledDate = new Date(now);
    scheduledDate.setDate(scheduledDate.getDate() + step.dayOffset);
    scheduledDate.setHours(14, 0, 0, 0);
    const sendAt = step.dayOffset === 0 ? now : scheduledDate;
    await enqueueTask(db15, {
      leadId,
      type: step.sequence === 0 ? "GENERATE" : "FOLLOW_UP",
      scheduledAt: admin19.firestore.Timestamp.fromDate(sendAt),
      metadata: {
        sequence: step.sequence,
        subject: step.subject,
        businessName,
        email: contactEmail,
        contactName: after.contactName || "",
        facilityType: after.facilityType || "",
        address: after.address || "",
        propertySourcing: after.propertySourcing || null
      }
    });
  }
  await db15.collection("leads").doc(leadId).update({
    outreachStatus: "PENDING"
  });
  await db15.collection("lead_activities").add({
    leadId,
    type: "DRIP_SCHEDULED",
    description: `Sales drip campaign scheduled: 4 emails over 14 days for ${businessName}.`,
    createdAt: /* @__PURE__ */ new Date(),
    metadata: { followUpCount: 4, schedule: "Day 0/3/7/14" }
  });
  logger11.info(`[SalesOutreach] Drip campaign scheduled for lead ${leadId}: 4 emails at days 0, 3, 7, 14`);
});

// src/triggers/commissionTriggers.ts
var import_firestore13 = require("firebase-functions/v2/firestore");
var admin20 = __toESM(require("firebase-admin"));
var logger12 = __toESM(require("firebase-functions/logger"));
if (!admin20.apps.length) {
  admin20.initializeApp();
}
var db16 = admin20.firestore();
var DEFAULTS = {
  mrrThreshold: 3e3,
  rateStandard: 0.05,
  ratePremium: 0.075,
  fsmUpsellRate: 0.05,
  clawbackMonths: 6,
  payoutSplit: [50, 25, 25]
};
async function getCommissionConfig() {
  const snap = await db16.collection("settings").doc("commissions").get();
  if (snap.exists) {
    const data = snap.data();
    return {
      mrrThreshold: data.mrrThreshold ?? DEFAULTS.mrrThreshold,
      rateStandard: data.rateStandard ?? DEFAULTS.rateStandard,
      ratePremium: data.ratePremium ?? DEFAULTS.ratePremium,
      fsmUpsellRate: data.fsmUpsellRate ?? DEFAULTS.fsmUpsellRate,
      clawbackMonths: data.clawbackMonths ?? DEFAULTS.clawbackMonths,
      payoutSplit: data.payoutSplit ?? DEFAULTS.payoutSplit
    };
  }
  return DEFAULTS;
}
var onQuoteAccepted = (0, import_firestore13.onDocumentUpdated)({
  document: "quotes/{quoteId}"
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  if (before.status === after.status) return;
  if (after.status !== "accepted") return;
  const quoteId = event.params.quoteId;
  const existingComm = await db16.collection("commissions").where("quoteId", "==", quoteId).limit(1).get();
  if (!existingComm.empty) {
    logger12.info(`[Commission] Commission already exists for quote ${quoteId} \u2014 skipping duplicate`);
    return;
  }
  const cfg = await getCommissionConfig();
  const leadId = after.leadId;
  const assignedTo = after.assignedTo || after.createdBy;
  const isUpsell = after.isUpsell === true;
  const mrr = after.totalMonthlyRate || 0;
  const acv = mrr * 12;
  let rate;
  let type;
  if (isUpsell) {
    rate = cfg.fsmUpsellRate;
    type = "FSM_UPSELL";
  } else {
    rate = mrr > cfg.mrrThreshold ? cfg.ratePremium : cfg.rateStandard;
    type = "SALES_NEW";
  }
  const totalCommission = acv * rate;
  const payoutSchedule = cfg.payoutSplit.map((pct, month) => ({
    month,
    amount: Math.round(totalCommission * pct / 100 * 100) / 100,
    // Round to cents
    percentage: pct,
    status: "PENDING",
    scheduledAt: null
    // Will be set when first invoice is paid
  }));
  const fsmPayoutSchedule = [{
    month: 0,
    amount: totalCommission,
    percentage: 100,
    status: "PENDING",
    scheduledAt: null
  }];
  const now = /* @__PURE__ */ new Date();
  const clawbackEnd = new Date(now);
  clawbackEnd.setMonth(clawbackEnd.getMonth() + cfg.clawbackMonths);
  const staffRole = isUpsell ? "fsm" : "sales";
  const commissionRef = await db16.collection("commissions").add({
    staffId: assignedTo,
    staffRole,
    quoteId,
    leadId,
    type,
    mrr,
    acv,
    rate,
    totalCommission,
    payoutSchedule: isUpsell ? fsmPayoutSchedule : payoutSchedule,
    clawbackWindowEnd: clawbackEnd,
    status: "PENDING",
    // Activates when first invoice is paid
    createdAt: now,
    updatedAt: now
  });
  await db16.collection("commission_ledger").add({
    commissionId: commissionRef.id,
    type: "PAYOUT_SCHEDULED",
    amount: totalCommission,
    staffId: assignedTo,
    description: `${type === "FSM_UPSELL" ? "Upsell" : "New deal"} commission: ${(rate * 100).toFixed(0)}% of $${acv.toLocaleString()} ACV = $${totalCommission.toLocaleString()}`,
    createdAt: now
  });
  await db16.collection("activity_logs").add({
    type: "COMMISSION_CREATED",
    quoteId,
    leadId,
    staffId: assignedTo,
    commissionId: commissionRef.id,
    totalCommission,
    rate,
    acv,
    mrr,
    commissionType: type,
    createdAt: admin20.firestore.FieldValue.serverTimestamp()
  });
  logger12.info(`[Commission] Created ${type} commission for staff ${assignedTo}: $${totalCommission} (${(rate * 100).toFixed(0)}% of $${acv} ACV) \u2014 quote ${quoteId}`);
});
var onInvoicePaid = (0, import_firestore13.onDocumentUpdated)({
  document: "invoices/{invoiceId}"
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  if (before.status === after.status) return;
  if (after.status !== "paid") return;
  const quoteId = after.quoteId;
  if (!quoteId) return;
  const commSnap = await db16.collection("commissions").where("quoteId", "==", quoteId).where("status", "==", "PENDING").get();
  if (commSnap.empty) return;
  const now = /* @__PURE__ */ new Date();
  for (const commDoc of commSnap.docs) {
    try {
      await db16.runTransaction(async (txn) => {
        const freshDoc = await txn.get(commDoc.ref);
        const freshData = freshDoc.data();
        if (!freshData || freshData.status !== "PENDING") {
          logger12.info(`[Commission] Commission ${commDoc.id} already activated (status: ${freshData?.status}) \u2014 skipping`);
          return;
        }
        const schedule2 = [...freshData.payoutSchedule];
        schedule2.forEach((entry, i) => {
          const payDate = new Date(now);
          payDate.setDate(payDate.getDate() + i * 30);
          entry.scheduledAt = payDate;
        });
        schedule2[0].status = "PAID";
        schedule2[0].paidAt = now;
        txn.update(commDoc.ref, {
          status: "ACTIVE",
          payoutSchedule: schedule2,
          updatedAt: now
        });
      });
      const commission = commDoc.data();
      const schedule = commission.payoutSchedule;
      await db16.collection("commission_ledger").add({
        commissionId: commDoc.id,
        type: "PAYOUT_PAID",
        amount: schedule[0].amount,
        staffId: commission.staffId,
        description: `Payout 1 of ${schedule.length}: $${schedule[0].amount.toFixed(2)} (${schedule[0].percentage}%) \u2014 triggered by invoice payment`,
        createdAt: now
      });
      logger12.info(`[Commission] Activated commission ${commDoc.id}: Payout 1 of $${schedule[0].amount} paid`);
    } catch (txnErr) {
      logger12.error(`[Commission] Transaction failed for commission ${commDoc.id}:`, txnErr.message);
    }
  }
});
var onWorkOrderHandoff = (0, import_firestore13.onDocumentUpdated)({
  document: "work_orders/{workOrderId}"
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  const hadVendor = before.vendorId && before.vendorId.length > 0;
  const hasVendor = after.vendorId && after.vendorId.length > 0;
  if (hadVendor || !hasVendor) return;
  const leadId = after.leadId;
  const fsmId = after.assignedFsmId || after.createdBy;
  if (!leadId) return;
  const leadDoc = await db16.collection("leads").doc(leadId).get();
  if (!leadDoc.exists) return;
  const leadData = leadDoc.data();
  if (leadData?.handedOffToFsm) return;
  await db16.collection("leads").doc(leadId).update({
    handedOffToFsm: fsmId,
    handoffDate: /* @__PURE__ */ new Date()
  });
  await db16.collection("activity_logs").add({
    type: "SALES_TO_FSM_HANDOFF",
    leadId,
    fsmId,
    workOrderId: event.params.workOrderId,
    description: `Account handed off from Sales to FSM (first work order assigned)`,
    createdAt: admin20.firestore.FieldValue.serverTimestamp()
  });
  logger12.info(`[Handoff] Lead ${leadId} handed off to FSM ${fsmId} via work order ${event.params.workOrderId}`);
  try {
    const fsmDoc = await db16.collection("users").doc(fsmId).get();
    const fsmEmail = fsmDoc.data()?.email || "chris@xiri.ai";
    const fsmName = fsmDoc.data()?.displayName || "FSM";
    const clientName = leadData?.businessName || leadData?.companyName || leadData?.name || "New Client";
    const clientEmail = leadData?.email || leadData?.contactEmail || "";
    const clientPhone = leadData?.phone || leadData?.contactPhone || "";
    const clientAddress = leadData?.address || leadData?.location || "";
    const services = after.serviceType || after.description || "Facility Maintenance";
    await db16.collection("mail_queue").add({
      to: fsmEmail,
      subject: `\u{1F4CB} New Client Assigned: ${clientName}`,
      templateType: "fsm_handoff",
      templateData: {
        html: `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f8;">
  <div style="max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #0369a1, #0284c7); padding: 32px 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">XIRI</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">New Client Assignment</p>
    </div>
    <div style="padding: 32px 24px;">
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">Hi ${fsmName},</p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">A new client has been assigned to you. Here are the details:</p>
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%; font-size: 14px; color: #374151;">
          <tr><td style="padding: 6px 0; color: #6b7280; width: 120px;">Business:</td><td style="padding: 6px 0; font-weight: 600;">${clientName}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Contact:</td><td style="padding: 6px 0;">${clientEmail}${clientPhone ? " \u2022 " + clientPhone : ""}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Address:</td><td style="padding: 6px 0;">${clientAddress || "See dashboard"}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Services:</td><td style="padding: 6px 0;">${services}</td></tr>
        </table>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="https://app.xiri.ai/sales/crm/${leadId}" style="display: inline-block; background: #0369a1; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">View Client Details \u2192</a>
      </div>
    </div>
    <div style="border-top: 1px solid #e5e7eb; padding: 16px 24px; background: #f9fafb;">
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">Xiri Facility Solutions \u2022 <a href="https://xiri.ai" style="color: #0369a1; text-decoration: none;">xiri.ai</a></p>
    </div>
  </div>
</body>
</html>`
      },
      status: "pending",
      createdAt: admin20.firestore.FieldValue.serverTimestamp()
    });
    logger12.info(`[Handoff] FSM notification email queued to ${fsmEmail} for client ${clientName}`);
  } catch (emailErr) {
    logger12.error(`[Handoff] Failed to send FSM email:`, emailErr.message);
  }
});
var onClientCancelled = (0, import_firestore13.onDocumentUpdated)({
  document: "leads/{leadId}"
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  if (before.status === after.status) return;
  if (after.status !== "churned") return;
  const leadId = event.params.leadId;
  const now = /* @__PURE__ */ new Date();
  const commSnap = await db16.collection("commissions").where("leadId", "==", leadId).where("status", "in", ["PENDING", "ACTIVE"]).get();
  if (commSnap.empty) return;
  for (const commDoc of commSnap.docs) {
    const commission = commDoc.data();
    const clawbackEnd = commission.clawbackWindowEnd?.toDate?.() || commission.clawbackWindowEnd;
    if (!clawbackEnd || now > new Date(clawbackEnd)) {
      logger12.info(`[Clawback] Commission ${commDoc.id} past clawback window \u2014 no action`);
      continue;
    }
    const schedule = [...commission.payoutSchedule];
    let cancelledAmount = 0;
    schedule.forEach((entry) => {
      if (entry.status === "PENDING") {
        entry.status = "CANCELLED";
        cancelledAmount += entry.amount;
      }
    });
    if (cancelledAmount === 0) continue;
    await commDoc.ref.update({
      status: "PARTIALLY_CANCELLED",
      payoutSchedule: schedule,
      updatedAt: now
    });
    await db16.collection("commission_ledger").add({
      commissionId: commDoc.id,
      type: "CLAWBACK",
      amount: -cancelledAmount,
      staffId: commission.staffId,
      description: `Client churned within clawback window. $${cancelledAmount.toFixed(2)} in unpaid payouts cancelled.`,
      createdAt: now
    });
    logger12.info(`[Clawback] Commission ${commDoc.id}: $${cancelledAmount} in unpaid payouts cancelled (client churn)`);
  }
});

// src/triggers/commissionScheduled.ts
var import_scheduler2 = require("firebase-functions/v2/scheduler");
var admin21 = __toESM(require("firebase-admin"));
var logger13 = __toESM(require("firebase-functions/logger"));
if (!admin21.apps.length) {
  admin21.initializeApp();
}
var db17 = admin21.firestore();
var NRR_TIERS = [
  { min: 1.1, rate: 0.02 },
  // > 110% NRR → 2% of portfolio ACV
  { min: 1, rate: 0.01 },
  // 100–110% → 1%
  { min: 0.9, rate: 5e-3 },
  // 90–100% → 0.5%
  { min: 0, rate: 0 }
  // < 90% → $0
];
var processCommissionPayouts = (0, import_scheduler2.onSchedule)({
  schedule: "0 9 * * *",
  // Daily at 9 AM UTC
  timeZone: "America/New_York"
}, async () => {
  const now = /* @__PURE__ */ new Date();
  logger13.info(`[CommissionPayouts] Processing scheduled payouts for ${now.toISOString()}`);
  const commSnap = await db17.collection("commissions").where("status", "==", "ACTIVE").get();
  let processed = 0;
  let paid = 0;
  for (const commDoc of commSnap.docs) {
    const commission = commDoc.data();
    const schedule = [...commission.payoutSchedule];
    let changed2 = false;
    for (const entry of schedule) {
      if (entry.status !== "PENDING") continue;
      const scheduledAt = entry.scheduledAt?.toDate?.() || new Date(entry.scheduledAt);
      if (scheduledAt > now) continue;
      const leadDoc = await db17.collection("leads").doc(commission.leadId).get();
      const leadData = leadDoc.data();
      if (leadData?.status === "churned" || leadData?.status === "lost") {
        entry.status = "CANCELLED";
        changed2 = true;
        logger13.info(`[CommissionPayouts] Skipping payout \u2014 client ${commission.leadId} is ${leadData?.status}`);
        continue;
      }
      entry.status = "PAID";
      entry.paidAt = now;
      changed2 = true;
      paid++;
      await db17.collection("commission_ledger").add({
        commissionId: commDoc.id,
        type: "PAYOUT_PAID",
        amount: entry.amount,
        staffId: commission.staffId,
        description: `Scheduled payout: $${entry.amount.toFixed(2)} (${entry.percentage}%)`,
        createdAt: now
      });
      logger13.info(`[CommissionPayouts] Paid $${entry.amount} to ${commission.staffId} (commission ${commDoc.id})`);
    }
    if (changed2) {
      const allDone = schedule.every((e) => e.status === "PAID" || e.status === "CANCELLED");
      const anyPaidExist = schedule.some((e) => e.status === "PAID");
      const anyCancelled = schedule.some((e) => e.status === "CANCELLED");
      let newStatus = commission.status;
      if (allDone && anyPaidExist && !anyCancelled) {
        newStatus = "COMPLETED";
      } else if (allDone && anyCancelled) {
        newStatus = "PARTIALLY_CANCELLED";
      }
      await commDoc.ref.update({
        payoutSchedule: schedule,
        status: newStatus,
        updatedAt: now
      });
      processed++;
    }
  }
  logger13.info(`[CommissionPayouts] Done: ${processed} commissions processed, ${paid} payouts made`);
});
var calculateNrr = (0, import_scheduler2.onSchedule)({
  schedule: "0 0 1 1,4,7,10 *",
  // Quarterly: 1st of Jan, Apr, Jul, Oct
  timeZone: "America/New_York"
}, async () => {
  const now = /* @__PURE__ */ new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const quarterMap = {
    0: `${currentYear - 1}-Q4`,
    // Jan → calc Q4 of prev year
    3: `${currentYear}-Q1`,
    // Apr → calc Q1
    6: `${currentYear}-Q2`,
    // Jul → calc Q2
    9: `${currentYear}-Q3`
    // Oct → calc Q3
  };
  const quarter = quarterMap[currentMonth] || `${currentYear}-Q${Math.ceil((currentMonth + 1) / 3)}`;
  logger13.info(`[NRR] Calculating Net Revenue Retention for ${quarter}`);
  const leadsSnap = await db17.collection("leads").where("handedOffToFsm", "!=", null).get();
  const fsmPortfolios = /* @__PURE__ */ new Map();
  for (const leadDoc of leadsSnap.docs) {
    const lead = leadDoc.data();
    const fsmId = lead.handedOffToFsm;
    if (!fsmId) continue;
    if (!fsmPortfolios.has(fsmId)) {
      fsmPortfolios.set(fsmId, {
        leadIds: [],
        startingMrr: 0,
        currentMrr: 0,
        upsells: 0,
        downgrades: 0,
        churn: 0
      });
    }
    const portfolio = fsmPortfolios.get(fsmId);
    portfolio.leadIds.push(leadDoc.id);
    const quotesSnap = await db17.collection("quotes").where("leadId", "==", leadDoc.id).where("status", "==", "accepted").get();
    let leadMrr = 0;
    for (const quoteDoc of quotesSnap.docs) {
      leadMrr += quoteDoc.data().totalMonthlyRate || 0;
    }
    if (lead.status === "churned") {
      portfolio.churn += leadMrr;
    } else {
      portfolio.currentMrr += leadMrr;
    }
    const upsellSnap = await db17.collection("quotes").where("leadId", "==", leadDoc.id).where("isUpsell", "==", true).where("status", "==", "accepted").get();
    for (const upsellDoc of upsellSnap.docs) {
      portfolio.upsells += upsellDoc.data().totalMonthlyRate || 0;
    }
  }
  for (const [fsmId, portfolio] of fsmPortfolios) {
    const startingMrr = portfolio.currentMrr + portfolio.churn - portfolio.upsells;
    if (startingMrr <= 0) continue;
    const nrr = (startingMrr + portfolio.upsells - portfolio.downgrades - portfolio.churn) / startingMrr;
    let bonusRate = 0;
    for (const tier of NRR_TIERS) {
      if (nrr >= tier.min) {
        bonusRate = tier.rate;
        break;
      }
    }
    const portfolioAcv = portfolio.currentMrr * 12;
    const bonusAmount = Math.round(portfolioAcv * bonusRate / 4 * 100) / 100;
    await db17.collection("nrr_snapshots").add({
      fsmId,
      quarter,
      startingMrr,
      endingMrr: portfolio.currentMrr,
      upsells: portfolio.upsells,
      downgrades: portfolio.downgrades,
      churn: portfolio.churn,
      nrr: Math.round(nrr * 1e4) / 100,
      // Store as percentage (e.g., 105.5)
      bonusRate,
      bonusAmount,
      calculatedAt: now
    });
    if (bonusAmount > 0) {
      const commRef = await db17.collection("commissions").add({
        staffId: fsmId,
        staffRole: "fsm",
        quoteId: "",
        // N/A for retention
        leadId: "",
        // N/A for retention (portfolio-level)
        type: "FSM_RETENTION",
        mrr: portfolio.currentMrr,
        acv: portfolioAcv,
        rate: bonusRate,
        totalCommission: bonusAmount,
        payoutSchedule: [{
          month: 0,
          amount: bonusAmount,
          percentage: 100,
          status: "PENDING",
          scheduledAt: now
          // Pay immediately
        }],
        clawbackWindowEnd: now,
        // No clawback for retention bonuses
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now
      });
      await db17.collection("commission_ledger").add({
        commissionId: commRef.id,
        type: "PAYOUT_SCHEDULED",
        amount: bonusAmount,
        staffId: fsmId,
        description: `${quarter} NRR retention bonus: ${(nrr * 100).toFixed(1)}% NRR \u2192 ${(bonusRate * 100).toFixed(1)}% rate \u2192 $${bonusAmount.toFixed(2)}`,
        createdAt: now
      });
    }
    logger13.info(`[NRR] FSM ${fsmId}: NRR=${(nrr * 100).toFixed(1)}%, portfolio=$${portfolio.currentMrr}/mo, bonus=$${bonusAmount}`);
  }
  logger13.info(`[NRR] Completed NRR calculation for ${quarter}: ${fsmPortfolios.size} FSMs processed`);
});

// src/triggers/onAuditSubmitted.ts
var import_firestore14 = require("firebase-functions/v2/firestore");
var admin22 = __toESM(require("firebase-admin"));
var logger14 = __toESM(require("firebase-functions/logger"));
if (!admin22.apps.length) {
  admin22.initializeApp();
}
var db18 = admin22.firestore();
var INTERNAL_NOTIFY_EMAIL = "chris@xiri.ai";
var onAuditSubmitted = (0, import_firestore14.onDocumentCreated)({
  document: "leads/{leadId}"
}, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  const leadId = event.params.leadId;
  if (data.source !== "audit_wizard") return;
  const businessName = data.businessName || data.companyName || "Your Facility";
  const contactName = data.contactName || data.name || "";
  const contactEmail = data.email || data.contactEmail;
  const address = data.address || data.location || "";
  if (!contactEmail) {
    logger14.warn(`[AuditSubmitted] Lead ${leadId} has no email \u2014 skipping confirmation`);
    return;
  }
  await db18.collection("mail_queue").add({
    to: contactEmail,
    subject: `We received your audit request \u2014 ${businessName}`,
    templateType: "audit_confirmation",
    templateData: {
      html: buildAuditConfirmationEmail(contactName, businessName)
    },
    status: "pending",
    createdAt: admin22.firestore.FieldValue.serverTimestamp()
  });
  await db18.collection("mail_queue").add({
    to: INTERNAL_NOTIFY_EMAIL,
    subject: `\u{1F514} New Audit Lead: ${businessName}`,
    templateType: "internal_notification",
    templateData: {
      html: buildInternalNotificationEmail(leadId, contactName, contactEmail, businessName, address, data)
    },
    status: "pending",
    createdAt: admin22.firestore.FieldValue.serverTimestamp()
  });
  await db18.collection("activity_logs").add({
    type: "AUDIT_SUBMITTED",
    leadId,
    email: contactEmail,
    businessName,
    description: `New audit lead from ${businessName} (${contactEmail})`,
    createdAt: admin22.firestore.FieldValue.serverTimestamp()
  });
  logger14.info(`[AuditSubmitted] Confirmation + internal alert sent for lead ${leadId} (${businessName})`);
});
function buildAuditConfirmationEmail(contactName, businessName) {
  const greeting = contactName ? `Hi ${contactName}` : "Hello";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f8;">
  <div style="max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0369a1, #0284c7); padding: 32px 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">XIRI</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Facility Solutions</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        ${greeting},
      </p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        Thank you for requesting a facility audit for <strong>${businessName}</strong>. We've received your information and a member of our team will reach out within <strong>24 hours</strong> to schedule your complimentary assessment.
      </p>

      <!-- What's Next -->
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="color: #0369a1; font-size: 14px; font-weight: 600; margin: 0 0 12px;">What happens next?</p>
        <ol style="color: #374151; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 18px;">
          <li>A Facility Solutions Manager will contact you</li>
          <li>We'll schedule a walkthrough of your facility</li>
          <li>You'll receive a custom maintenance plan & quote</li>
        </ol>
      </div>

      <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 24px 0 0;">
        Questions in the meantime? Reply to this email \u2014 we're happy to help.
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #e5e7eb; padding: 16px 24px; background: #f9fafb;">
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
        Xiri Facility Solutions \u2022 <a href="https://xiri.ai" style="color: #0369a1; text-decoration: none;">xiri.ai</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
function buildInternalNotificationEmail(leadId, contactName, contactEmail, businessName, address, data) {
  const facilityType = data.facilityType || data.propertyType || "Not specified";
  const sqft = data.squareFootage || data.sqft || "Not specified";
  const services = data.services?.join(", ") || data.selectedServices?.join(", ") || "Not specified";
  return `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f8;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.1);">
    <h2 style="margin: 0 0 16px; color: #111827;">\u{1F514} New Audit Lead</h2>
    
    <table style="width: 100%; font-size: 14px; color: #374151;">
      <tr><td style="padding: 6px 0; color: #6b7280;">Business:</td><td style="padding: 6px 0; font-weight: 600;">${businessName}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Contact:</td><td style="padding: 6px 0;">${contactName || "N/A"} \u2014 ${contactEmail}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Address:</td><td style="padding: 6px 0;">${address || "N/A"}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Facility Type:</td><td style="padding: 6px 0;">${facilityType}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Sq Ft:</td><td style="padding: 6px 0;">${sqft}</td></tr>
      <tr><td style="padding: 6px 0; color: #6b7280;">Services:</td><td style="padding: 6px 0;">${services}</td></tr>
    </table>

    <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      <a href="https://app.xiri.ai/sales/crm/${leadId}" style="display: inline-block; background: #0369a1; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">View in Dashboard \u2192</a>
    </div>
  </div>
</body>
</html>`;
}

// src/triggers/onAuditFailed.ts
var import_firestore15 = require("firebase-functions/v2/firestore");
var admin23 = __toESM(require("firebase-admin"));
var logger15 = __toESM(require("firebase-functions/logger"));
if (!admin23.apps.length) {
  admin23.initializeApp();
}
var db19 = admin23.firestore();
var FAIL_THRESHOLD = 70;
var SUSPENSION_THRESHOLD = 3;
var INTERNAL_NOTIFY_EMAIL2 = "chris@xiri.ai";
var onAuditFailed = (0, import_firestore15.onDocumentCreated)({
  document: "audits/{auditId}"
}, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  const auditId = event.params.auditId;
  const overallScore = data.overallScore ?? data.score ?? 100;
  if (overallScore >= FAIL_THRESHOLD) return;
  const workOrderId = data.workOrderId;
  const vendorId = data.vendorId;
  const locationName = data.locationName || data.location || "Unknown Location";
  const clientName = data.clientName || data.businessName || "";
  logger15.info(`[AuditFailed] Audit ${auditId} scored ${overallScore}% (threshold: ${FAIL_THRESHOLD}%)`);
  if (workOrderId) {
    await db19.collection("work_orders").doc(workOrderId).update({
      status: "needs_remediation",
      failedAuditId: auditId,
      failedAuditScore: overallScore,
      updatedAt: admin23.firestore.FieldValue.serverTimestamp()
    });
  }
  let remediationId = null;
  if (workOrderId) {
    const woDoc = await db19.collection("work_orders").doc(workOrderId).get();
    const woData = woDoc.exists ? woDoc.data() : null;
    const remRef = await db19.collection("work_orders").add({
      type: "remediation",
      originalWorkOrderId: workOrderId,
      auditId,
      leadId: woData?.leadId || data.leadId || null,
      vendorId: vendorId || null,
      assignedFsmId: woData?.assignedFsmId || null,
      locationName,
      description: `Remediation required: Audit scored ${overallScore}% at ${locationName}. Issues: ${data.failureNotes || data.notes || "See audit report."}`,
      status: "pending",
      priority: "high",
      createdAt: admin23.firestore.FieldValue.serverTimestamp()
    });
    remediationId = remRef.id;
  }
  let vendorFailCount = 0;
  let vendorName = "Unknown Vendor";
  let vendorSuspended = false;
  if (vendorId) {
    const vendorRef = db19.collection("vendors").doc(vendorId);
    const vendorDoc = await vendorRef.get();
    if (vendorDoc.exists) {
      const vendorData = vendorDoc.data();
      vendorName = vendorData.businessName || vendorData.name || vendorName;
      vendorFailCount = (vendorData.failedAuditCount || 0) + 1;
      const updateData = {
        failedAuditCount: vendorFailCount,
        lastFailedAuditId: auditId,
        lastFailedAuditDate: admin23.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin23.firestore.FieldValue.serverTimestamp()
      };
      if (vendorFailCount >= SUSPENSION_THRESHOLD) {
        updateData.status = "suspended";
        updateData.suspensionReason = `Auto-suspended after ${vendorFailCount} failed audits`;
        vendorSuspended = true;
      }
      await vendorRef.update(updateData);
    }
  }
  let fsmEmail = INTERNAL_NOTIFY_EMAIL2;
  if (workOrderId) {
    const woDoc = await db19.collection("work_orders").doc(workOrderId).get();
    const fsmId = woDoc.data()?.assignedFsmId;
    if (fsmId) {
      const fsmDoc = await db19.collection("users").doc(fsmId).get();
      fsmEmail = fsmDoc.data()?.email || INTERNAL_NOTIFY_EMAIL2;
    }
  }
  await db19.collection("mail_queue").add({
    to: fsmEmail,
    subject: `\u26A0\uFE0F Audit Failed: ${locationName} \u2014 ${overallScore}%`,
    templateType: "audit_failed",
    templateData: {
      html: buildAuditFailedEmail({
        locationName,
        clientName,
        overallScore,
        vendorName,
        failureNotes: data.failureNotes || data.notes || "See audit details in dashboard.",
        remediationId,
        auditId
      })
    },
    status: "pending",
    createdAt: admin23.firestore.FieldValue.serverTimestamp()
  });
  if (vendorSuspended) {
    await db19.collection("mail_queue").add({
      to: INTERNAL_NOTIFY_EMAIL2,
      subject: `\u{1F6AB} Vendor Suspended: ${vendorName} (${vendorFailCount} failed audits)`,
      templateType: "vendor_suspended",
      templateData: {
        html: `
                <div style="font-family: -apple-system, sans-serif; padding: 24px;">
                    <h2 style="color: #dc2626;">\u{1F6AB} Vendor Auto-Suspended</h2>
                    <p><strong>${vendorName}</strong> has been automatically suspended after <strong>${vendorFailCount}</strong> failed audits.</p>
                    <p>Last failure: ${locationName} \u2014 Score: ${overallScore}%</p>
                    <p>Action required: Review vendor and decide whether to reinstate or terminate.</p>
                    <a href="https://app.xiri.ai/supply/crm/${vendorId}" style="display: inline-block; background: #dc2626; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 12px;">View Vendor \u2192</a>
                </div>`
      },
      status: "pending",
      createdAt: admin23.firestore.FieldValue.serverTimestamp()
    });
  }
  await db19.collection("activity_logs").add({
    type: "AUDIT_FAILED",
    auditId,
    workOrderId: workOrderId || null,
    vendorId: vendorId || null,
    remediationWorkOrderId: remediationId,
    overallScore,
    vendorFailCount,
    vendorSuspended,
    description: `Audit failed at ${locationName} (${overallScore}%). Vendor: ${vendorName}. ${vendorSuspended ? "VENDOR AUTO-SUSPENDED." : ""}`,
    createdAt: admin23.firestore.FieldValue.serverTimestamp()
  });
  logger15.info(`[AuditFailed] Escalation complete: audit ${auditId}, score ${overallScore}%, vendor ${vendorName} (failures: ${vendorFailCount})${vendorSuspended ? " \u2014 SUSPENDED" : ""}`);
});
function buildAuditFailedEmail(data) {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f8;">
  <div style="max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #dc2626, #ef4444); padding: 32px 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">\u26A0\uFE0F Audit Failed</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">${data.locationName}</p>
    </div>

    <div style="padding: 32px 24px;">
      <!-- Score -->
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
        <p style="color: #991b1b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px;">Overall Score</p>
        <p style="color: #dc2626; font-size: 36px; font-weight: 700; margin: 0;">${data.overallScore}%</p>
      </div>

      <table style="width: 100%; font-size: 14px; color: #374151; margin-bottom: 20px;">
        <tr><td style="padding: 6px 0; color: #6b7280;">Client:</td><td style="padding: 6px 0; font-weight: 500;">${data.clientName || "N/A"}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Vendor:</td><td style="padding: 6px 0; font-weight: 500;">${data.vendorName}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Issues:</td><td style="padding: 6px 0;">${data.failureNotes}</td></tr>
      </table>

      <p style="color: #374151; font-size: 14px; line-height: 1.6;">
        A <strong>remediation work order</strong> has been auto-created. Please review and assign a follow-up.
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="https://app.xiri.ai/operations/audits" style="display: inline-block; background: #0369a1; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">View in Dashboard \u2192</a>
      </div>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding: 16px 24px; background: #f9fafb;">
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
        Xiri Facility Solutions \u2022 <a href="https://xiri.ai" style="color: #0369a1; text-decoration: none;">xiri.ai</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// src/triggers/generateMonthlyInvoices.ts
var import_scheduler3 = require("firebase-functions/v2/scheduler");
var admin24 = __toESM(require("firebase-admin"));
var logger16 = __toESM(require("firebase-functions/logger"));
if (!admin24.apps.length) {
  admin24.initializeApp();
}
var db20 = admin24.firestore();
var generateMonthlyInvoices = (0, import_scheduler3.onSchedule)({
  schedule: "0 6 1 * *",
  // 6 AM on 1st of every month
  timeZone: "America/New_York"
}, async () => {
  logger16.info("[MonthlyInvoices] Starting monthly invoice generation...");
  const now = /* @__PURE__ */ new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
  const periodLabel = periodStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const contractsSnap = await db20.collection("contracts").where("status", "==", "active").get();
  if (contractsSnap.empty) {
    logger16.info("[MonthlyInvoices] No active contracts found. Done.");
    return;
  }
  let invoicesCreated = 0;
  let invoicesSkipped = 0;
  const isRecurring = (freq) => !["one_time", "quarterly"].includes(freq);
  for (const contractDoc of contractsSnap.docs) {
    const contract = contractDoc.data();
    const contractId = contractDoc.id;
    const leadId = contract.leadId;
    const clientName = contract.clientBusinessName || contract.clientName || contract.businessName || "Client";
    const clientEmail = contract.contactEmail || contract.clientEmail || "";
    const contractLineItems = contract.lineItems || [];
    let workOrdersQuery = db20.collection("work_orders").where("status", "==", "completed");
    if (contract.leadId) {
      workOrdersQuery = workOrdersQuery.where("leadId", "==", contract.leadId);
    }
    const woSnap = await workOrdersQuery.get();
    const periodWOs = woSnap.docs.filter((doc) => {
      const woData = doc.data();
      const completedAt = woData.completedAt?.toDate?.() || woData.completedAt;
      if (!completedAt) return false;
      const d = new Date(completedAt);
      return d >= periodStart && d <= periodEnd;
    });
    const completedLineItemIds = new Set(
      periodWOs.map((doc) => doc.data().quoteLineItemId).filter(Boolean)
    );
    let invoiceLineItems = [];
    if (contractLineItems.length > 0) {
      const recurringItems = contractLineItems.filter((li) => isRecurring(li.frequency)).map((li) => ({
        lineItemId: li.id,
        locationName: li.locationName || "Service Location",
        serviceType: li.serviceType || "Facility Maintenance",
        description: li.description || "",
        rate: li.clientRate || 0,
        billingType: "recurring",
        frequency: li.frequency
      }));
      const oneTimeItems = contractLineItems.filter((li) => !isRecurring(li.frequency) && completedLineItemIds.has(li.id)).map((li) => ({
        lineItemId: li.id,
        locationName: li.locationName || "Service Location",
        serviceType: li.serviceType || "Facility Maintenance",
        description: li.description || "",
        rate: li.clientRate || 0,
        billingType: "one_time",
        frequency: li.frequency
      }));
      invoiceLineItems = [...recurringItems, ...oneTimeItems];
    } else {
      invoiceLineItems = periodWOs.map((woDoc) => {
        const wo = woDoc.data();
        return {
          workOrderId: woDoc.id,
          locationName: wo.locationName || wo.location || "Service Location",
          serviceType: wo.serviceType || wo.type || "Facility Maintenance",
          description: wo.description || "",
          rate: wo.rate || wo.amount || 0,
          billingType: "legacy"
        };
      });
    }
    if (invoiceLineItems.length === 0) {
      invoicesSkipped++;
      continue;
    }
    const totalAmount = invoiceLineItems.reduce((sum, li) => sum + li.rate, 0);
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 30);
    const invoiceRef = await db20.collection("invoices").add({
      contractId,
      leadId: leadId || null,
      clientName,
      clientEmail,
      lineItems: invoiceLineItems,
      totalAmount,
      billingPeriod: {
        start: periodStart.toISOString().split("T")[0],
        end: periodEnd.toISOString().split("T")[0],
        label: periodLabel
      },
      workOrderCount: periodWOs.length,
      recurringItemCount: invoiceLineItems.filter((i) => i.billingType === "recurring").length,
      oneTimeItemCount: invoiceLineItems.filter((i) => i.billingType === "one_time").length,
      status: "draft",
      dueDate,
      createdAt: admin24.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin24.firestore.FieldValue.serverTimestamp()
    });
    await db20.collection("activity_logs").add({
      type: "INVOICE_AUTO_GENERATED",
      invoiceId: invoiceRef.id,
      contractId,
      leadId: leadId || null,
      clientName,
      totalAmount,
      billingPeriod: periodLabel,
      workOrderCount: periodWOs.length,
      description: `Auto-generated draft invoice for ${clientName}: $${totalAmount.toLocaleString()} (${periodLabel}, ${invoiceLineItems.length} items)`,
      createdAt: admin24.firestore.FieldValue.serverTimestamp()
    });
    invoicesCreated++;
    logger16.info(`[MonthlyInvoices] Created invoice ${invoiceRef.id} for ${clientName}: $${totalAmount} (${invoiceLineItems.length} items: ${invoiceLineItems.filter((i) => i.billingType === "recurring").length} recurring, ${invoiceLineItems.filter((i) => i.billingType === "one_time").length} one-time)`);
  }
  logger16.info(`[MonthlyInvoices] Complete: ${invoicesCreated} invoices created, ${invoicesSkipped} contracts skipped`);
});

// src/triggers/resendWebhook.ts
var import_https4 = require("firebase-functions/v2/https");
var admin25 = __toESM(require("firebase-admin"));
var import_v2 = require("firebase-functions/v2");
var db21 = admin25.firestore();
var resendWebhook = (0, import_https4.onRequest)({
  cors: true,
  timeoutSeconds: 30,
  memory: "256MiB"
}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  try {
    const event = req.body;
    const eventType = event?.type;
    const emailId = event?.data?.email_id;
    if (!eventType || !emailId) {
      import_v2.logger.warn("Resend webhook: missing type or email_id", { body: JSON.stringify(event).substring(0, 500) });
      res.status(400).json({ error: "Missing type or email_id" });
      return;
    }
    import_v2.logger.info(`Resend webhook: ${eventType} for email ${emailId}`);
    const statusMap = {
      "email.delivered": {
        deliveryStatus: "delivered",
        activityType: "EMAIL_DELIVERED",
        description: "Email successfully delivered to inbox."
      },
      "email.opened": {
        deliveryStatus: "opened",
        activityType: "EMAIL_OPENED",
        description: "Recipient opened the email."
      },
      "email.clicked": {
        deliveryStatus: "clicked",
        activityType: "EMAIL_CLICKED",
        description: "Recipient clicked a link in the email."
      },
      "email.bounced": {
        deliveryStatus: "bounced",
        activityType: "EMAIL_BOUNCED",
        description: `Email bounced: ${event?.data?.bounce_type || "unknown"} \u2014 ${event?.data?.error_message || "no details"}.`
      },
      "email.complained": {
        deliveryStatus: "spam",
        activityType: "EMAIL_COMPLAINED",
        description: "Recipient marked email as spam."
      }
    };
    const mapping = statusMap[eventType];
    if (!mapping) {
      import_v2.logger.info(`Resend webhook: unhandled event type ${eventType}`);
      res.status(200).json({ ok: true, skipped: true });
      return;
    }
    let vendorId = null;
    const tags = event?.data?.tags;
    if (tags) {
      if (typeof tags === "object" && !Array.isArray(tags) && tags.vendorId) {
        vendorId = tags.vendorId;
      } else if (Array.isArray(tags)) {
        const vendorTag = tags.find((t) => t.name === "vendorId");
        if (vendorTag?.value) vendorId = vendorTag.value;
      }
      if (vendorId) {
        import_v2.logger.info(`Resend webhook: resolved vendorId=${vendorId} from tag`);
      }
    }
    if (!vendorId) {
      const activitiesSnapshot = await db21.collection("vendor_activities").where("metadata.resendId", "==", emailId).limit(1).get();
      if (!activitiesSnapshot.empty) {
        vendorId = activitiesSnapshot.docs[0].data().vendorId;
        import_v2.logger.info(`Resend webhook: resolved vendorId=${vendorId} from activity lookup`);
      }
    }
    if (!vendorId) {
      import_v2.logger.warn(`Resend webhook: could not resolve vendorId for emailId ${emailId}`);
      res.status(200).json({ ok: true, notFound: true });
      return;
    }
    await db21.collection("vendor_activities").add({
      vendorId,
      type: mapping.activityType,
      description: mapping.description,
      createdAt: /* @__PURE__ */ new Date(),
      metadata: {
        resendId: emailId,
        deliveryStatus: mapping.deliveryStatus,
        rawEvent: eventType,
        to: event?.data?.to?.[0] || void 0
      }
    });
    if (vendorId) {
      const engagementUpdate = {
        "emailEngagement.lastEvent": mapping.deliveryStatus,
        "emailEngagement.lastEventAt": /* @__PURE__ */ new Date()
      };
      if (eventType === "email.opened") {
        engagementUpdate["emailEngagement.openCount"] = admin25.firestore.FieldValue.increment(1);
      } else if (eventType === "email.clicked") {
        engagementUpdate["emailEngagement.clickCount"] = admin25.firestore.FieldValue.increment(1);
      }
      if (eventType === "email.bounced") {
        engagementUpdate["outreachStatus"] = "FAILED";
        engagementUpdate["outreachMeta.bounced"] = true;
        engagementUpdate["outreachMeta.bounceType"] = event?.data?.bounce_type || "unknown";
        engagementUpdate["outreachMeta.bounceError"] = event?.data?.error_message || "Email bounced";
      }
      engagementUpdate["updatedAt"] = /* @__PURE__ */ new Date();
      await db21.collection("vendors").doc(vendorId).update(engagementUpdate);
      import_v2.logger.info(`Vendor ${vendorId}: emailEngagement updated (${mapping.deliveryStatus})`);
    }
    try {
      let templateId = null;
      if (tags) {
        if (typeof tags === "object" && !Array.isArray(tags) && tags.templateId) {
          templateId = tags.templateId;
        } else if (Array.isArray(tags)) {
          const templateTag = tags.find((t) => t.name === "templateId");
          if (templateTag?.value) templateId = templateTag.value;
        }
      }
      if (!templateId) {
        const sentActivity = await db21.collection("vendor_activities").where("metadata.resendId", "==", emailId).limit(1).get();
        if (!sentActivity.empty) {
          templateId = sentActivity.docs[0].data().metadata?.templateId || null;
        }
      }
      if (templateId) {
        const statsField = mapping.deliveryStatus;
        await db21.collection("templates").doc(templateId).update({
          [`stats.${statsField}`]: admin25.firestore.FieldValue.increment(1),
          "stats.lastUpdated": /* @__PURE__ */ new Date()
        });
        import_v2.logger.info(`Template ${templateId}: stats.${statsField} incremented`);
      }
    } catch (statsErr) {
      import_v2.logger.warn("Template stats update failed:", statsErr);
    }
    import_v2.logger.info(`Resend webhook: processed ${eventType} for vendor ${vendorId}`);
    res.status(200).json({ ok: true, processed: eventType });
  } catch (error11) {
    import_v2.logger.error("Resend webhook error:", error11);
    res.status(500).json({ error: "Internal error" });
  }
});

// src/triggers/onLeadUpdated.ts
var import_firestore16 = require("firebase-functions/v2/firestore");
var import_v22 = require("firebase-functions/v2");
var changed = (before, after, field) => after[field] && before[field] !== after[field];
var onLeadUpdated = (0, import_firestore16.onDocumentUpdated)("leads/{leadId}", async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  const leadId = event.params.leadId;
  const nameChanged = changed(before, after, "businessName");
  const emailChanged = changed(before, after, "email");
  const contactChanged = changed(before, after, "contactName");
  if (!nameChanged && !emailChanged && !contactChanged) return;
  import_v22.logger.info(`[Cascade:Lead] ${leadId} \u2014 name:${nameChanged} email:${emailChanged} contact:${contactChanged}`);
  const batch = db.batch();
  let count = 0;
  if (nameChanged) {
    const snap = await db.collection("quotes").where("leadId", "==", leadId).get();
    for (const d of snap.docs) {
      batch.update(d.ref, { leadBusinessName: after.businessName });
      count++;
    }
  }
  if (nameChanged) {
    const snap = await db.collection("contracts").where("leadId", "==", leadId).get();
    for (const d of snap.docs) {
      batch.update(d.ref, { clientBusinessName: after.businessName });
      count++;
    }
  }
  if (nameChanged) {
    const snap = await db.collection("work_orders").where("leadId", "==", leadId).get();
    for (const d of snap.docs) {
      batch.update(d.ref, { businessName: after.businessName, companyName: after.businessName });
      count++;
    }
  }
  {
    const patch = {};
    if (nameChanged) patch.clientBusinessName = after.businessName;
    if (emailChanged) patch.clientEmail = after.email;
    if (contactChanged) patch.clientContactName = after.contactName;
    if (Object.keys(patch).length > 0) {
      const snap = await db.collection("invoices").where("leadId", "==", leadId).get();
      for (const d of snap.docs) {
        batch.update(d.ref, patch);
        count++;
      }
    }
  }
  if (nameChanged) {
    const snap = await db.collection("site_visits").where("leadId", "==", leadId).get();
    for (const d of snap.docs) {
      batch.update(d.ref, { clientBusinessName: after.businessName });
      count++;
    }
  }
  if (count > 0) {
    await batch.commit();
    import_v22.logger.info(`[Cascade:Lead] Updated ${count} docs for "${after.businessName}"`);
  }
});
var onVendorUpdated = (0, import_firestore16.onDocumentUpdated)("vendors/{vendorId}", async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  const vendorId = event.params.vendorId;
  const nameChanged = changed(before, after, "businessName");
  const emailChanged = changed(before, after, "email");
  if (!nameChanged && !emailChanged) return;
  import_v22.logger.info(`[Cascade:Vendor] ${vendorId} \u2014 name:${nameChanged} email:${emailChanged}`);
  const batch = db.batch();
  let count = 0;
  {
    const patch = {};
    if (nameChanged) patch.vendorName = after.businessName;
    if (emailChanged) patch.vendorEmail = after.email;
    if (Object.keys(patch).length > 0) {
      const snap = await db.collection("vendor_remittances").where("vendorId", "==", vendorId).get();
      for (const d of snap.docs) {
        batch.update(d.ref, patch);
        count++;
      }
    }
  }
  if (nameChanged) {
    const snap = await db.collection("work_orders").where("assignedVendorId", "==", vendorId).get();
    for (const d of snap.docs) {
      const data = d.data();
      if (data.vendorHistory && Array.isArray(data.vendorHistory)) {
        const updated = data.vendorHistory.map(
          (entry) => entry.vendorId === vendorId ? { ...entry, vendorName: after.businessName } : entry
        );
        batch.update(d.ref, { vendorHistory: updated });
        count++;
      }
    }
  }
  if (nameChanged) {
    const snap = await db.collection("check_ins").where("vendorId", "==", vendorId).get();
    for (const d of snap.docs) {
      batch.update(d.ref, { vendorName: after.businessName });
      count++;
    }
  }
  if (count > 0) {
    await batch.commit();
    import_v22.logger.info(`[Cascade:Vendor] Updated ${count} docs for "${after.businessName}"`);
  }
});
var onStaffUpdated = (0, import_firestore16.onDocumentUpdated)("users/{userId}", async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  const userId = event.params.userId;
  const nameChanged = changed(before, after, "displayName");
  if (!nameChanged) return;
  const newName = after.displayName;
  const roles = after.roles || [];
  import_v22.logger.info(`[Cascade:Staff] ${userId} displayName \u2192 "${newName}" (roles: ${roles.join(",")})`);
  const batch = db.batch();
  let count = 0;
  if (roles.includes("fsm") || roles.includes("admin")) {
    const quotesSnap = await db.collection("quotes").where("assignedFsmId", "==", userId).get();
    for (const d of quotesSnap.docs) {
      batch.update(d.ref, { assignedFsmName: newName });
      count++;
    }
    const svSnap = await db.collection("site_visits").where("fsmId", "==", userId).get();
    for (const d of svSnap.docs) {
      batch.update(d.ref, { fsmName: newName });
      count++;
    }
  }
  if (roles.includes("night_manager") || roles.includes("night_mgr") || roles.includes("admin")) {
    const ciSnap = await db.collection("check_ins").where("nightManagerId", "==", userId).get();
    for (const d of ciSnap.docs) {
      batch.update(d.ref, { nightManagerName: newName });
      count++;
    }
    const woSnap = await db.collection("work_orders").where("assignedNightManagerId", "==", userId).get();
    for (const d of woSnap.docs) {
      batch.update(d.ref, { assignedNightManagerName: newName });
      count++;
    }
  }
  if (count > 0) {
    await batch.commit();
    import_v22.logger.info(`[Cascade:Staff] Updated ${count} docs for "${newName}"`);
  }
});

// src/triggers/aiTemplateOptimizer.ts
var import_scheduler4 = require("firebase-functions/v2/scheduler");
var import_https5 = require("firebase-functions/v2/https");
var admin26 = __toESM(require("firebase-admin"));
var logger19 = __toESM(require("firebase-functions/logger"));
if (!admin26.apps.length) {
  admin26.initializeApp();
}
var db22 = admin26.firestore();
var weeklyTemplateOptimizer = (0, import_scheduler4.onSchedule)({
  schedule: "every monday 09:00",
  timeZone: "America/New_York",
  secrets: ["GEMINI_API_KEY"],
  memory: "512MiB"
}, async () => {
  logger19.info("Running weekly template optimization check...");
  await optimizeUnderperformingTemplates();
});
var optimizeTemplate = (0, import_https5.onCall)({
  secrets: ["GEMINI_API_KEY"],
  memory: "512MiB"
}, async (request) => {
  if (!request.auth) {
    throw new import_https5.HttpsError("unauthenticated", "Must be logged in");
  }
  const templateId = request.data?.templateId;
  if (templateId) {
    const result = await optimizeSingleTemplate(templateId);
    return result;
  } else {
    const results = await optimizeUnderperformingTemplates();
    return { optimized: results };
  }
});
var MIN_SENDS_FOR_ANALYSIS = 10;
var LOW_OPEN_RATE_THRESHOLD = 0.3;
async function optimizeUnderperformingTemplates() {
  const templatesSnap = await db22.collection("templates").where("category", "==", "vendor").get();
  const optimized = [];
  for (const doc of templatesSnap.docs) {
    const template = doc.data();
    const stats = template.stats;
    if (!stats || stats.sent < MIN_SENDS_FOR_ANALYSIS) continue;
    const openRate = stats.sent > 0 ? stats.opened / stats.sent : 0;
    if (openRate < LOW_OPEN_RATE_THRESHOLD) {
      logger19.info(`Template ${doc.id}: ${(openRate * 100).toFixed(1)}% open rate \u2014 optimizing`);
      await optimizeSingleTemplate(doc.id);
      optimized.push(doc.id);
    }
  }
  if (optimized.length === 0) {
    logger19.info("No underperforming templates found.");
  }
  return optimized;
}
async function optimizeSingleTemplate(templateId) {
  const templateDoc = await db22.collection("templates").doc(templateId).get();
  if (!templateDoc.exists) {
    throw new import_https5.HttpsError("not-found", `Template ${templateId} not found`);
  }
  const template = templateDoc.data();
  const stats = template.stats || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
  const openRate = stats.sent > 0 ? (stats.opened / stats.sent * 100).toFixed(1) : "N/A";
  const clickRate = stats.opened > 0 ? (stats.clicked / stats.opened * 100).toFixed(1) : "N/A";
  const bounceRate = stats.sent > 0 ? (stats.bounced / stats.sent * 100).toFixed(1) : "N/A";
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new import_https5.HttpsError("failed-precondition", "GEMINI_API_KEY not set");
  }
  const prompt = `You are an email marketing expert specializing in B2B contractor outreach for facility management companies.

## Current Template Performance
- Template: "${template.name}" (${templateId})
- Sent: ${stats.sent} | Delivered: ${stats.delivered} | Opened: ${stats.opened} | Clicked: ${stats.clicked}
- Open Rate: ${openRate}% | Click Rate: ${clickRate}% | Bounce Rate: ${bounceRate}%

## Current Subject Line
"${template.subject}"

## Current Email Body
${template.body}

## Context
This email targets independent contractors (janitorial, HVAC, cleaning, etc.) to join a facility management network. The CTA is to click a link and complete an onboarding profile. These are small business owners or independent operators \u2014 keep tone professional but blue-collar-friendly.

## Available Merge Variables
{{vendorName}}, {{contactName}}, {{city}}, {{state}}, {{services}}, {{specialty}}, {{onboardingUrl}}

## Instructions
Based on the performance data, suggest improvements. Return your response as JSON:
{
  "analysis": "Brief analysis of why this template may be underperforming",
  "suggestions": [
    {
      "subject": "Improved subject line option 1",
      "body": "Improved email body option 1 (keep merge variables, keep it concise)",
      "rationale": "Why this version should perform better"
    },
    {
      "subject": "Improved subject line option 2",
      "body": "Improved email body option 2",
      "rationale": "Why this version should perform better"
    }
  ],
  "shortUrlTest": {
    "recommendation": "Whether to test short vs long onboarding URL display",
    "shortVariant": "Suggested short CTA text and link format if applicable"
  }
}

Return ONLY valid JSON, no markdown fences.`;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2e3
          }
        })
      }
    );
    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      logger19.error("No response from Gemini for template optimization");
      throw new import_https5.HttpsError("internal", "Gemini returned empty response");
    }
    const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const suggestions = JSON.parse(cleanText);
    await db22.collection("templates").doc(templateId).update({
      aiSuggestions: admin26.firestore.FieldValue.arrayUnion({
        ...suggestions,
        generatedAt: /* @__PURE__ */ new Date(),
        performanceSnapshot: stats
      }),
      lastOptimizedAt: /* @__PURE__ */ new Date()
    });
    logger19.info(`Template ${templateId}: AI suggestions stored (${suggestions.suggestions?.length || 0} variants)`);
    return {
      templateId,
      analysis: suggestions.analysis,
      suggestionsCount: suggestions.suggestions?.length || 0,
      shortUrlTest: suggestions.shortUrlTest
    };
  } catch (err) {
    logger19.error(`AI optimization failed for ${templateId}:`, err);
    throw new import_https5.HttpsError("internal", `AI optimization failed: ${err}`);
  }
}

// src/index.ts
var import_auth = require("firebase-admin/auth");
var DASHBOARD_CORS = [
  "http://localhost:3001",
  "http://localhost:3000",
  "https://xiri.ai",
  "https://www.xiri.ai",
  "https://app.xiri.ai",
  "https://xiri-dashboard.vercel.app",
  "https://xiri-dashboard-git-develop-xiri-facility-solutions.vercel.app",
  /https:\/\/xiri-dashboard-.*\.vercel\.app$/,
  "https://xiri-facility-solutions.web.app",
  "https://xiri-facility-solutions.firebaseapp.com"
];
var adminUpdateAuthUser = (0, import_https6.onCall)({
  cors: DASHBOARD_CORS
}, async (request) => {
  if (!request.auth) throw new import_https6.HttpsError("unauthenticated", "Must be logged in");
  const callerDoc = await db.collection("users").doc(request.auth.uid).get();
  const callerRoles = callerDoc.data()?.roles || [];
  if (!callerRoles.includes("admin")) throw new import_https6.HttpsError("permission-denied", "Admin only");
  const { uid, email, password, displayName } = request.data;
  if (!uid) throw new import_https6.HttpsError("invalid-argument", "uid is required");
  const updatePayload = {};
  if (email) updatePayload.email = email;
  if (password) updatePayload.password = password;
  if (displayName) updatePayload.displayName = displayName;
  if (Object.keys(updatePayload).length === 0) {
    throw new import_https6.HttpsError("invalid-argument", "Nothing to update");
  }
  try {
    await (0, import_auth.getAuth)().updateUser(uid, updatePayload);
    return { success: true, message: `Auth updated for ${uid}` };
  } catch (error11) {
    console.error("adminUpdateAuthUser error:", error11);
    throw new import_https6.HttpsError("internal", error11.message || "Failed to update Auth user");
  }
});
var changeMyPassword = (0, import_https6.onCall)({
  cors: DASHBOARD_CORS
}, async (request) => {
  if (!request.auth) throw new import_https6.HttpsError("unauthenticated", "Must be logged in");
  const { newPassword } = request.data;
  if (!newPassword || newPassword.length < 6) {
    throw new import_https6.HttpsError("invalid-argument", "Password must be at least 6 characters");
  }
  try {
    await (0, import_auth.getAuth)().updateUser(request.auth.uid, { password: newPassword });
    return { success: true, message: "Password updated" };
  } catch (error11) {
    console.error("changeMyPassword error:", error11);
    throw new import_https6.HttpsError("internal", error11.message || "Failed to change password");
  }
});
var generateLeads = (0, import_https6.onCall)({
  secrets: ["SERPER_API_KEY", "GEMINI_API_KEY"],
  cors: [
    "http://localhost:3001",
    // Dashboard Dev
    "http://localhost:3000",
    // Public Site Dev
    "https://xiri.ai",
    // Public Site Production
    "https://www.xiri.ai",
    // Public Site WWW
    "https://app.xiri.ai",
    // Dashboard Production
    "https://xiri-dashboard.vercel.app",
    // Dashboard Vercel
    "https://xiri-dashboard-git-develop-xiri-facility-solutions.vercel.app",
    // Vercel develop branch
    /https:\/\/xiri-dashboard-.*\.vercel\.app$/,
    // All Vercel preview deployments
    "https://xiri-facility-solutions.web.app",
    // Firebase Hosting
    "https://xiri-facility-solutions.firebaseapp.com"
  ],
  timeoutSeconds: 540
}, async (request) => {
  const data = request.data || {};
  const query = data.query;
  const location = data.location;
  const hasActiveContract = data.hasActiveContract || false;
  const previewOnly = data.previewOnly || false;
  const provider = data.provider || "google_maps";
  const dcaCategory = data.dcaCategory;
  if (provider === "google_maps" && !query || !location) {
    throw new import_https6.HttpsError("invalid-argument", "Missing required fields in request.");
  }
  try {
    console.log(`Analyzing leads for query: ${query}, location: ${location}, provider: ${provider}, category: ${dcaCategory}${previewOnly ? " (PREVIEW MODE)" : ""}`);
    const rawVendors = await searchVendors(query, location, provider, dcaCategory);
    console.log(`Sourced ${rawVendors.length} vendors from ${provider}.`);
    const result = await analyzeVendorLeads(rawVendors, query, hasActiveContract, previewOnly);
    return {
      message: "Lead generation process completed.",
      sourced: rawVendors.length,
      analysis: result,
      // Include vendor data in response for preview mode
      vendors: previewOnly ? result.vendors : void 0
    };
  } catch (error11) {
    console.error("Error in generateLeads:", error11);
    throw new import_https6.HttpsError("internal", error11.message || "An internal error occurred.");
  }
});
var clearPipeline = (0, import_https6.onCall)({
  cors: [
    "http://localhost:3001",
    "http://localhost:3000",
    "https://xiri.ai",
    "https://www.xiri.ai",
    "https://app.xiri.ai",
    "https://xiri-dashboard.vercel.app"
  ]
}, async (request) => {
  try {
    const snapshot = await db.collection("vendors").get();
    if (snapshot.empty) {
      return { message: "Pipeline already empty." };
    }
    let count = 0;
    const chunks = [];
    let currentBatch = db.batch();
    snapshot.docs.forEach((doc, index) => {
      currentBatch.delete(doc.ref);
      count++;
      if (count % 400 === 0) {
        chunks.push(currentBatch.commit());
        currentBatch = db.batch();
      }
    });
    chunks.push(currentBatch.commit());
    await Promise.all(chunks);
    return { message: `Cleared ${count} vendors from pipeline.` };
  } catch (error11) {
    throw new import_https6.HttpsError("internal", error11.message);
  }
});
var runRecruiterAgent = (0, import_https6.onRequest)({ secrets: ["GEMINI_API_KEY"] }, async (req, res) => {
  const rawVendors = req.body.vendors || [
    { name: "ABC Cleaning", services: "We do medical office cleaning and terminal cleaning." },
    { name: "Joe's Pizza", services: "Best pizza in town" },
    { name: "Elite HVAC", services: "Commercial HVAC systems" }
  ];
  const result = await analyzeVendorLeads(rawVendors, "Commercial Cleaning");
  res.json(result);
});
var testSendEmail = (0, import_https6.onCall)({
  secrets: ["RESEND_API_KEY", "GEMINI_API_KEY"],
  cors: [
    "http://localhost:3001",
    "http://localhost:3000",
    "https://xiri.ai",
    "https://www.xiri.ai",
    "https://app.xiri.ai",
    "https://xiri-dashboard.vercel.app"
  ]
}, async (request) => {
  const { sendTemplatedEmail: sendTemplatedEmail2 } = await Promise.resolve().then(() => (init_emailUtils(), emailUtils_exports));
  const { vendorId, templateId } = request.data;
  if (!vendorId || !templateId) {
    throw new import_https6.HttpsError("invalid-argument", "Missing vendorId or templateId");
  }
  try {
    await sendTemplatedEmail2(vendorId, templateId);
    return { success: true, message: `Email sent to vendor ${vendorId}` };
  } catch (error11) {
    console.error("Error sending test email:", error11);
    throw new import_https6.HttpsError("internal", error11.message || "Failed to send email");
  }
});
var sourceProperties = (0, import_https6.onCall)({
  cors: [
    "http://localhost:3001",
    "http://localhost:3000",
    "https://xiri.ai",
    "https://www.xiri.ai",
    "https://app.xiri.ai",
    "https://xiri-dashboard.vercel.app",
    /https:\/\/xiri-dashboard-.*\.vercel\.app$/,
    "https://xiri-facility-solutions.web.app",
    "https://xiri-facility-solutions.firebaseapp.com"
  ],
  timeoutSeconds: 120
}, async (request) => {
  const data = request.data || {};
  const query = data.query;
  const location = data.location;
  const providerName = data.provider || "mock";
  if (!query || !location) {
    throw new import_https6.HttpsError("invalid-argument", "Missing 'query' or 'location' in request.");
  }
  try {
    console.log(`[sourceProperties] query="${query}", location="${location}", provider=${providerName}`);
    const properties = await searchProperties(query, location, providerName);
    return {
      message: "Property sourcing completed.",
      sourced: properties.length,
      properties
    };
  } catch (error11) {
    console.error("[sourceProperties] Error:", error11);
    throw new import_https6.HttpsError("internal", error11.message || "Failed to source properties.");
  }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  adminUpdateAuthUser,
  calculateNrr,
  changeMyPassword,
  clearPipeline,
  enrichFromWebsite,
  generateLeads,
  generateMonthlyInvoices,
  handleUnsubscribe,
  onAuditFailed,
  onAuditSubmitted,
  onAwaitingOnboarding,
  onClientCancelled,
  onDocumentUploaded,
  onIncomingMessage,
  onInvoicePaid,
  onLeadQualified,
  onLeadUpdated,
  onOnboardingComplete,
  onQuoteAccepted,
  onStaffUpdated,
  onVendorApproved,
  onVendorCreated,
  onVendorUpdated,
  onWorkOrderAssigned,
  onWorkOrderHandoff,
  optimizeTemplate,
  processCommissionPayouts,
  processMailQueue,
  processOutreachQueue,
  resendWebhook,
  respondToQuote,
  runRecruiterAgent,
  sendBookingConfirmation,
  sendOnboardingInvite,
  sendQuoteEmail,
  sourceProperties,
  testSendEmail,
  weeklyTemplateOptimizer
});
//# sourceMappingURL=index.js.map