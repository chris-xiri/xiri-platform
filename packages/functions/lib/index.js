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

// src/utils/queueUtils.ts
var queueUtils_exports = {};
__export(queueUtils_exports, {
  cancelVendorTasks: () => cancelVendorTasks,
  enqueueTask: () => enqueueTask,
  fetchPendingTasks: () => fetchPendingTasks,
  updateTaskStatus: () => updateTaskStatus
});
async function enqueueTask(db11, task) {
  return db11.collection(COLLECTION).add({
    ...task,
    status: "PENDING",
    retryCount: 0,
    createdAt: /* @__PURE__ */ new Date()
  });
}
async function fetchPendingTasks(db11) {
  const now = admin2.firestore.Timestamp.now();
  const snapshot = await db11.collection(COLLECTION).where("status", "in", ["PENDING", "RETRY"]).where("scheduledAt", "<=", now).limit(10).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
async function updateTaskStatus(db11, taskId, status, updates = {}) {
  await db11.collection(COLLECTION).doc(taskId).update({
    status,
    ...updates
  });
}
async function cancelVendorTasks(db11, vendorId) {
  const snapshot = await db11.collection(COLLECTION).where("vendorId", "==", vendorId).where("status", "in", ["PENDING", "RETRY"]).get();
  const batch = db11.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { status: "CANCELLED", cancelledAt: /* @__PURE__ */ new Date() });
  });
  await batch.commit();
  return snapshot.size;
}
var admin2, COLLECTION;
var init_queueUtils = __esm({
  "src/utils/queueUtils.ts"() {
    "use strict";
    admin2 = __toESM(require("firebase-admin"));
    COLLECTION = "outreach_queue";
  }
});

// src/utils/emailUtils.ts
var emailUtils_exports = {};
__export(emailUtils_exports, {
  generatePersonalizedEmail: () => generatePersonalizedEmail,
  getTemplate: () => getTemplate,
  replaceVariables: () => replaceVariables,
  sendEmail: () => sendEmail,
  sendTemplatedEmail: () => sendTemplatedEmail
});
async function getTemplate(templateId) {
  try {
    const doc = await db4.collection("templates").doc(templateId).get();
    if (!doc.exists) {
      console.error(`Template ${templateId} not found`);
      return null;
    }
    return doc.data();
  } catch (error6) {
    console.error("Error fetching template:", error6);
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
    const model3 = genAI3.getGenerativeModel({ model: "gemini-2.0-flash" });
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
    const result = await model3.generateContent({
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
  } catch (error6) {
    console.error("Error generating email:", error6);
    return null;
  }
}
function extractZipFromAddress(address) {
  if (!address) return null;
  const zipMatch = address.match(/\b\d{5}\b/);
  return zipMatch ? zipMatch[0] : null;
}
async function sendTemplatedEmail(vendorId, templateId, customVariables) {
  try {
    const vendorDoc = await db4.collection("vendors").doc(vendorId).get();
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
    } catch (error6) {
      console.error("\u274C Resend API error:", error6);
      await db4.collection("vendor_activities").add({
        vendorId,
        type: "EMAIL_FAILED",
        description: `Failed to send email: ${email.subject}`,
        createdAt: admin5.firestore.FieldValue.serverTimestamp(),
        metadata: {
          templateId,
          subject: email.subject,
          to: vendor?.email || "unknown",
          error: String(error6)
        }
      });
      return;
    }
    await db4.collection("vendor_activities").add({
      vendorId,
      type: "EMAIL_SENT",
      description: `Email sent: ${email.subject}`,
      createdAt: admin5.firestore.FieldValue.serverTimestamp(),
      metadata: {
        templateId,
        subject: email.subject,
        body: email.body,
        to: vendor?.email || "unknown",
        resendId
        // NEW: Track Resend email ID
      }
    });
  } catch (error6) {
    console.error("Error sending email:", error6);
  }
}
async function sendEmail(to, subject, html, attachments) {
  try {
    const { data, error: error6 } = await resend.emails.send({
      from: "Xiri Facility Solutions <onboarding@xiri.ai>",
      replyTo: "chris@xiri.ai",
      to,
      subject,
      html,
      attachments
    });
    if (error6) {
      console.error("\u274C Resend API error:", error6);
      return false;
    }
    console.log(`\u2705 Email sent to ${to}: ${subject} (ID: ${data?.id})`);
    return true;
  } catch (err) {
    console.error("Error sending raw email:", err);
    return false;
  }
}
var admin5, import_generative_ai4, import_resend, db4, genAI3, resend;
var init_emailUtils = __esm({
  "src/utils/emailUtils.ts"() {
    "use strict";
    admin5 = __toESM(require("firebase-admin"));
    import_generative_ai4 = require("@google/generative-ai");
    import_resend = require("resend");
    db4 = admin5.firestore();
    genAI3 = new import_generative_ai4.GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    resend = new import_resend.Resend(process.env.RESEND_API_KEY || "re_dummy_key");
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  clearPipeline: () => clearPipeline,
  enrichFromWebsite: () => enrichFromWebsite,
  generateLeads: () => generateLeads,
  handleUnsubscribe: () => handleUnsubscribe,
  onAwaitingOnboarding: () => onAwaitingOnboarding,
  onDocumentUploaded: () => onDocumentUploaded,
  onIncomingMessage: () => onIncomingMessage,
  onOnboardingComplete: () => onOnboardingComplete,
  onVendorApproved: () => onVendorApproved,
  onVendorCreated: () => onVendorCreated,
  processOutreachQueue: () => processOutreachQueue,
  runRecruiterAgent: () => runRecruiterAgent,
  sendBookingConfirmation: () => sendBookingConfirmation,
  testSendEmail: () => testSendEmail
});
module.exports = __toCommonJS(index_exports);
var import_https3 = require("firebase-functions/v2/https");

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
} catch (error6) {
  console.log("Firestore settings usage note:", error6);
}

// src/agents/recruiter.ts
var import_generative_ai = require("@google/generative-ai");
var API_KEY = process.env.GEMINI_API_KEY || "";
var genAI = new import_generative_ai.GoogleGenerativeAI(API_KEY);
var model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
var analyzeVendorLeads = async (rawVendors, jobQuery, hasActiveContract = false, previewOnly = false) => {
  console.log("!!! RECRUITER AGENT UPDATED - V3 (Deduplication) !!!");
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
    try {
      const dismissedSnapshot = await db.collection("dismissed_vendors").get();
      if (!dismissedSnapshot.empty) {
        dismissedNames = new Set(
          dismissedSnapshot.docs.map((doc) => (doc.data().businessName || "").toLowerCase().trim())
        );
        console.log(`Loaded ${dismissedNames.size} dismissed vendor names for tagging.`);
      }
    } catch (dismissErr) {
      console.warn("Could not check dismissed_vendors:", dismissErr.message);
    }
    const vendorsToProcess = [];
    const duplicateUpdates = [];
    console.log(`Checking ${rawVendors.length} vendors for duplicates...`);
    for (const vendor of rawVendors) {
      const bName = vendor.name || vendor.companyName || vendor.title;
      if (!bName) {
        vendorsToProcess.push(vendor);
        continue;
      }
      const existingSnapshot = await db.collection("vendors").where("businessName", "==", bName).limit(1).get();
      if (!existingSnapshot.empty) {
        const docId = existingSnapshot.docs[0].id;
        console.log(`Found existing vendor: ${bName} (${docId}). Updating timestamp.`);
        duplicateUpdates.push(
          db.collection("vendors").doc(docId).update({
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
      console.log("All vendors were duplicates or dismissed. Sourcing complete.");
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
      if (item.isQualified) {
        qualified++;
        const originalVendor = vendorsToAnalyze[item.index];
        if (!originalVendor) {
          console.warn(`Analysis returned index ${item.index} but we only have ${vendorsToAnalyze.length} vendors.`);
          continue;
        }
        const bName = originalVendor.name || originalVendor.companyName || originalVendor.title || "Unknown Vendor";
        const vendorRef = db.collection("vendors").doc();
        const newVendor = {
          id: vendorRef.id,
          businessName: bName,
          capabilities: item.specialty ? [item.specialty] : [],
          address: originalVendor.location || item.address || "Unknown",
          city: item.city || void 0,
          state: item.state || void 0,
          zip: item.zip || void 0,
          country: item.country || "USA",
          phone: originalVendor.phone || item.phone || void 0,
          email: originalVendor.email || item.email || void 0,
          website: originalVendor.website || item.website || void 0,
          // businessType: item.businessType || "Unknown", // Removing as it's not in shared Vendor? Wait, checking shared
          fitScore: item.fitScore,
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
      const newVendor = {
        id: vendorRef.id,
        businessName: bName,
        capabilities: [],
        address: originalVendor.location || originalVendor.address || "Unknown",
        phone: originalVendor.phone || void 0,
        email: originalVendor.email || void 0,
        website: originalVendor.website || void 0,
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
var import_axios = __toESM(require("axios"));
var searchVendors = async (query, location) => {
  const apiKey = process.env.SERPER_API_KEY || "02ece77ffd27d2929e3e79604cb27e1dfaa40fe7";
  if (!apiKey) {
    console.warn("SERPER_API_KEY is not set. Returning mock data.");
    return getMockVendors(query, location);
  }
  const fullQuery = `${query} in ${location}`;
  console.log(`Searching for: ${fullQuery} using Serper (places)...`);
  try {
    const response = await import_axios.default.post(
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
    const filteredVendors = rawVendors.filter((v) => v.rating === void 0 || v.rating >= 3.5);
    console.log(`Filtered ${rawVendors.length} -> ${filteredVendors.length} vendors (Rating >= 3.5 or N/A).`);
    return filteredVendors;
  } catch (error6) {
    console.error("Error searching vendors:", error6.message);
    throw new Error(`Failed to source vendors: ${error6.message}`);
  }
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

// src/triggers/onVendorApproved.ts
var import_firestore = require("firebase-functions/v2/firestore");
var import_firestore2 = require("firebase-functions/v2/firestore");
var import_params = require("firebase-functions/params");
var admin3 = __toESM(require("firebase-admin"));
var logger = __toESM(require("firebase-functions/logger"));

// src/utils/websiteScraper.ts
var cheerio = __toESM(require("cheerio"));
var import_generative_ai2 = require("@google/generative-ai");
async function scrapeWebsite(url, geminiApiKey) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; XiriBot/1.0; +https://xiri.ai/bot)"
      },
      signal: AbortSignal.timeout(1e4)
      // 10 second timeout
    });
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const structuredData = extractStructuredData($);
    const patternData = extractFromPatterns($, html);
    let contactPageData = {};
    if (!structuredData.email || !structuredData.phone) {
      const contactUrl = findContactPage($, url);
      if (contactUrl) {
        contactPageData = await scrapeContactPage(contactUrl);
      }
    }
    const combinedData = {
      email: structuredData.email || patternData.email || contactPageData.email,
      phone: structuredData.phone || patternData.phone || contactPageData.phone,
      address: structuredData.address || patternData.address || contactPageData.address,
      businessName: structuredData.businessName || patternData.businessName,
      socialMedia: {
        linkedin: patternData.socialMedia?.linkedin,
        facebook: patternData.socialMedia?.facebook,
        twitter: patternData.socialMedia?.twitter
      },
      confidence: determineConfidence(structuredData, patternData, contactPageData),
      source: "web-scraper"
    };
    if (!combinedData.email || !combinedData.phone) {
      const aiData = await extractWithAI(html, geminiApiKey);
      combinedData.email = combinedData.email || aiData.email;
      combinedData.phone = combinedData.phone || aiData.phone;
      combinedData.address = combinedData.address || aiData.address;
    }
    if (combinedData.email) {
      combinedData.email = validateEmail(combinedData.email);
    }
    if (combinedData.phone) {
      combinedData.phone = formatPhone(combinedData.phone);
    }
    return { success: true, data: combinedData };
  } catch (error6) {
    return { success: false, error: error6.message };
  }
}
function extractStructuredData($) {
  const data = {};
  data.email = $('meta[property="og:email"]').attr("content") || $('meta[name="contact:email"]').attr("content");
  data.phone = $('meta[property="og:phone_number"]').attr("content") || $('meta[name="contact:phone"]').attr("content");
  $('script[type="application/ld+json"]').each((_, elem) => {
    try {
      const json = JSON.parse($(elem).html() || "{}");
      if (json["@type"] === "Organization" || json["@type"] === "LocalBusiness") {
        data.email = data.email || json.email;
        data.phone = data.phone || json.telephone;
        data.businessName = data.businessName || json.name;
        if (json.address) {
          data.address = typeof json.address === "string" ? json.address : `${json.address.streetAddress}, ${json.address.addressLocality}, ${json.address.addressRegion} ${json.address.postalCode}`;
        }
      }
    } catch (e) {
    }
  });
  data.businessName = data.businessName || $('meta[property="og:site_name"]').attr("content") || $("title").text().split("|")[0].trim() || $("h1").first().text().trim();
  return data;
}
function extractFromPatterns($, html) {
  const data = {
    socialMedia: {}
  };
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = html.match(emailRegex) || [];
  const validEmails = emails.filter(
    (email) => !email.match(/^(info|admin|noreply|no-reply|support|hello|contact)@/i) && !email.includes("example.com") && !email.includes("domain.com")
  );
  data.email = validEmails[0];
  const phoneRegex = /(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phones = html.match(phoneRegex) || [];
  data.phone = phones[0];
  $('a[href*="linkedin.com"]').each((_, elem) => {
    const href = $(elem).attr("href");
    if (href && href.includes("/company/")) {
      data.socialMedia.linkedin = href;
    }
  });
  $('a[href*="facebook.com"]').each((_, elem) => {
    const href = $(elem).attr("href");
    if (href) {
      data.socialMedia.facebook = href;
    }
  });
  $('a[href*="twitter.com"], a[href*="x.com"]').each((_, elem) => {
    const href = $(elem).attr("href");
    if (href) {
      data.socialMedia.twitter = href;
    }
  });
  return data;
}
function findContactPage($, baseUrl) {
  const contactKeywords = ["contact", "about", "location", "reach-us", "get-in-touch"];
  let contactUrl = null;
  $("a").each((_, elem) => {
    const href = $(elem).attr("href");
    const text = $(elem).text().toLowerCase();
    if (href && contactKeywords.some(
      (keyword) => href.toLowerCase().includes(keyword) || text.includes(keyword)
    )) {
      contactUrl = new URL(href, baseUrl).href;
      return false;
    }
  });
  return contactUrl;
}
async function scrapeContactPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; XiriBot/1.0; +https://xiri.ai/bot)"
      },
      signal: AbortSignal.timeout(1e4)
    });
    if (!response.ok) return {};
    const html = await response.text();
    const $ = cheerio.load(html);
    return extractFromPatterns($, html);
  } catch (error6) {
    return {};
  }
}
async function extractWithAI(html, geminiApiKey) {
  try {
    const genAI5 = new import_generative_ai2.GoogleGenerativeAI(geminiApiKey);
    const model3 = genAI5.getGenerativeModel({ model: "gemini-1.5-flash" });
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").substring(0, 1e4);
    const prompt = `Extract business contact information from this website content. Return ONLY a JSON object with these fields (use null if not found):
{
  "email": "primary business email (not info@, admin@, noreply@)",
  "phone": "primary phone number in format (xxx) xxx-xxxx",
  "address": "full physical address if available",
  "businessName": "official business name"
}

Website content:
${text}`;
    const result = await model3.generateContent(prompt);
    const response = result.response.text();
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return {
        email: data.email !== "null" ? data.email : void 0,
        phone: data.phone !== "null" ? data.phone : void 0,
        address: data.address !== "null" ? data.address : void 0,
        businessName: data.businessName !== "null" ? data.businessName : void 0
      };
    }
    return {};
  } catch (error6) {
    console.error("AI extraction error:", error6);
    return {};
  }
}
function determineConfidence(structured, pattern, contact) {
  if (structured.email || structured.phone) return "high";
  if (contact.email || contact.phone) return "medium";
  if (pattern.email || pattern.phone) return "low";
  return "low";
}
function validateEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return void 0;
  if (email.match(/^(info|admin|noreply|no-reply|support|hello|contact|webmaster)@/i)) {
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
  } catch (error6) {
    return { valid: true, deliverable: false, reason: "Domain not found" };
  }
}
async function resolveMX(domain) {
  const dns = await import("dns");
  const { promisify } = await import("util");
  const resolveMx = promisify(dns.resolveMx);
  try {
    return await resolveMx(domain);
  } catch (error6) {
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
if (!admin3.apps.length) {
  admin3.initializeApp();
}
var db2 = admin3.firestore();
var GEMINI_API_KEY = (0, import_params.defineSecret)("GEMINI_API_KEY");
console.log("Loading onVendorApproved trigger...");
var onVendorApproved = (0, import_firestore.onDocumentUpdated)({
  document: "vendors/{vendorId}",
  secrets: [GEMINI_API_KEY]
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
  secrets: [GEMINI_API_KEY]
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
    await db2.collection("vendor_activities").add({
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
      await db2.collection("vendors").doc(vendorId).update({
        outreachStatus: "ENRICHING",
        statusUpdatedAt: /* @__PURE__ */ new Date()
      });
      await db2.collection("vendor_activities").add({
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
        const updateData = { updatedAt: admin3.firestore.FieldValue.serverTimestamp() };
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
        updateData.enrichment = {
          lastEnriched: admin3.firestore.FieldValue.serverTimestamp(),
          enrichedFields,
          enrichmentSource: "auto_onboarding",
          scrapedWebsite: vendorWebsite,
          confidence: scrapedData.confidence
        };
        if (enrichedFields.length > 0) {
          await db2.collection("vendors").doc(vendorId).update(updateData);
        }
        await db2.collection("vendor_activities").add({
          vendorId,
          type: "ENRICHMENT",
          description: enrichedFields.length > 0 ? `Enriched ${enrichedFields.length} field(s): ${enrichedFields.join(", ")}` : "No new fields found from website.",
          createdAt: /* @__PURE__ */ new Date(),
          metadata: { enrichedFields, confidence: scrapedData.confidence }
        });
        if (foundEmail) {
          logger.info(`Found email ${foundEmail} for vendor ${vendorId}. Proceeding to outreach.`);
          const updatedDoc = await db2.collection("vendors").doc(vendorId).get();
          await setOutreachPending(vendorId, updatedDoc.data() || vendorData);
        } else {
          await markNeedsContact(vendorId, "No email found after enrichment");
        }
      } catch (enrichError) {
        logger.error(`Enrichment error for ${vendorId}:`, enrichError);
        await markNeedsContact(vendorId, `Enrichment error: ${enrichError.message}`);
      }
      return;
    }
    logger.info(`Vendor ${vendorId} has no email and no website. Marking NEEDS_CONTACT.`);
    await markNeedsContact(vendorId, "No email or website available");
  } catch (error6) {
    logger.error("Error in enrich pipeline:", error6);
  }
}
async function setOutreachPending(vendorId, vendorData) {
  await db2.collection("vendors").doc(vendorId).update({
    outreachStatus: "PENDING",
    statusUpdatedAt: /* @__PURE__ */ new Date()
  });
  const { enqueueTask: enqueueTask2 } = await Promise.resolve().then(() => (init_queueUtils(), queueUtils_exports));
  await enqueueTask2(db2, {
    vendorId,
    type: "GENERATE",
    scheduledAt: /* @__PURE__ */ new Date(),
    metadata: {
      status: vendorData.status,
      hasActiveContract: vendorData.hasActiveContract,
      phone: vendorData.phone,
      companyName: vendorData.businessName,
      specialty: vendorData.specialty || vendorData.capabilities?.[0]
    }
  });
  logger.info(`Outreach GENERATE task enqueued for vendor ${vendorId}`);
}
async function markNeedsContact(vendorId, reason) {
  await db2.collection("vendors").doc(vendorId).update({
    outreachStatus: "NEEDS_CONTACT",
    statusUpdatedAt: /* @__PURE__ */ new Date()
  });
  await db2.collection("vendor_activities").add({
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

// src/utils/timeUtils.ts
var START_HOUR = 9;
var END_HOUR = 17;
function getNextBusinessSlot(urgency) {
  const now = /* @__PURE__ */ new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const isWeekend = day === 0 || day === 6;
  const isBusinessHours = !isWeekend && hour >= START_HOUR && hour < END_HOUR;
  if (urgency === "URGENT" && isBusinessHours) {
    return new Date(now.getTime() + 10 * 6e4);
  }
  let nextDate = new Date(now);
  if (day === 5) {
    nextDate.setDate(now.getDate() + 3);
  } else if (day === 6) {
    nextDate.setDate(now.getDate() + 2);
  } else {
    nextDate.setDate(now.getDate() + 1);
  }
  nextDate.setHours(urgency === "URGENT" ? START_HOUR : START_HOUR + 1, 0, 0, 0);
  return nextDate;
}

// src/agents/outreach.ts
var import_generative_ai3 = require("@google/generative-ai");
var admin4 = __toESM(require("firebase-admin"));
var API_KEY2 = process.env.GEMINI_API_KEY || "";
var genAI2 = new import_generative_ai3.GoogleGenerativeAI(API_KEY2);
var model2 = genAI2.getGenerativeModel({ model: "gemini-2.0-flash" });
var db3 = admin4.firestore();
var generateOutreachContent = async (vendor, preferredChannel) => {
  const isUrgent = vendor.hasActiveContract;
  const channel = preferredChannel;
  try {
    const templateDoc = await db3.collection("templates").doc("outreach_generation_prompt").get();
    if (!templateDoc.exists) {
      throw new Error("Outreach generation prompt not found in database");
    }
    const template = templateDoc.data();
    const campaignContext = isUrgent ? "URGENT JOB OPPORTUNITY (We have a contract ready)" : "Building Supply Network (Partnership Opportunity)";
    const prompt = template?.content.replace(/\{\{vendorName\}\}/g, vendor.companyName).replace(/\{\{specialty\}\}/g, vendor.specialty || "Services").replace(/\{\{campaignContext\}\}/g, campaignContext);
    const result = await model2.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/^```json/gm, "").replace(/^```/gm, "").trim();
    const jsonContent = JSON.parse(text);
    return {
      channel,
      sms: jsonContent.sms,
      email: jsonContent.email,
      generatedAt: /* @__PURE__ */ new Date()
    };
  } catch (error6) {
    console.error("Error generating outreach content:", error6);
    return {
      channel,
      sms: "Error generating SMS.",
      email: { subject: "Error", body: "Error generating content. Please draft manually." },
      error: true
    };
  }
};
var analyzeIncomingMessage = async (vendor, messageContent, previousContext) => {
  try {
    const templateDoc = await db3.collection("templates").doc("message_analysis_prompt").get();
    if (!templateDoc.exists) {
      throw new Error("Message analysis prompt not found in database");
    }
    const template = templateDoc.data();
    const prompt = template?.content.replace(/\{\{vendorName\}\}/g, vendor.companyName).replace(/\{\{messageContent\}\}/g, messageContent).replace(/\{\{previousContext\}\}/g, previousContext).replace(/\{\{vendorId\}\}/g, vendor.id);
    const result = await model2.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/^```json/gm, "").replace(/^```/gm, "").trim();
    const jsonContent = JSON.parse(text);
    return jsonContent;
  } catch (error6) {
    console.error("Error analyzing message:", error6);
    return { intent: "OTHER", reply: "Error analyzing message." };
  }
};

// src/triggers/outreachWorker.ts
init_emailUtils();
if (!admin6.apps.length) {
  admin6.initializeApp();
}
var db5 = admin6.firestore();
var processOutreachQueue = (0, import_scheduler.onSchedule)({
  schedule: "every 1 minutes",
  secrets: ["RESEND_API_KEY", "GEMINI_API_KEY"]
}, async (event) => {
  logger2.info("Processing outreach queue...");
  try {
    const tasks = await fetchPendingTasks(db5);
    if (tasks.length === 0) {
      logger2.info("No pending tasks found.");
      return;
    }
    logger2.info(`Found ${tasks.length} tasks to process.`);
    for (const task of tasks) {
      try {
        if (task.type === "GENERATE") {
          await handleGenerate(task);
        } else if (task.type === "SEND") {
          await handleSend(task);
        } else if (task.type === "FOLLOW_UP") {
          await handleFollowUp(task);
        }
      } catch (err) {
        logger2.error(`Error processing task ${task.id}:`, err);
        const newRetryCount = (task.retryCount || 0) + 1;
        const status = newRetryCount > 5 ? "FAILED" : "RETRY";
        const nextAttempt = /* @__PURE__ */ new Date();
        nextAttempt.setMinutes(nextAttempt.getMinutes() + Math.pow(2, newRetryCount));
        await updateTaskStatus(db5, task.id, status, {
          retryCount: newRetryCount,
          scheduledAt: admin6.firestore.Timestamp.fromDate(nextAttempt),
          error: String(err)
        });
      }
    }
  } catch (error6) {
    logger2.error("Fatal error in queue processor:", error6);
  }
});
async function handleGenerate(task) {
  logger2.info(`Generating content for task ${task.id}`);
  const vendorData = task.metadata;
  const outreachResult = await generateOutreachContent(vendorData, vendorData.phone ? "SMS" : "EMAIL");
  if (outreachResult.error) {
    throw new Error("AI Generation Failed: " + (outreachResult.sms || "Unknown Error"));
  }
  await db5.collection("vendor_activities").add({
    vendorId: task.vendorId,
    type: "OUTREACH_QUEUED",
    // Using same type for UI compatibility
    description: `Outreach drafts generated (waiting to send).`,
    createdAt: /* @__PURE__ */ new Date(),
    metadata: {
      sms: outreachResult.sms,
      email: outreachResult.email,
      preferredChannel: outreachResult.channel,
      campaignUrgency: vendorData.hasActiveContract ? "URGENT" : "SUPPLY"
    }
  });
  const scheduledTime = getNextBusinessSlot(vendorData.hasActiveContract ? "URGENT" : "SUPPLY");
  await enqueueTask(db5, {
    vendorId: task.vendorId,
    type: "SEND",
    scheduledAt: admin6.firestore.Timestamp.fromDate(scheduledTime),
    metadata: {
      // Pass the generated content along
      sms: outreachResult.sms,
      email: outreachResult.email,
      channel: outreachResult.channel
    }
  });
  await updateTaskStatus(db5, task.id, "COMPLETED");
  logger2.info(`Task ${task.id} completed. Send scheduled for ${scheduledTime.toISOString()}`);
}
async function handleSend(task) {
  logger2.info(`Executing SEND for task ${task.id}`);
  const vendorDoc = await db5.collection("vendors").doc(task.vendorId).get();
  const vendor = vendorDoc.exists ? vendorDoc.data() : null;
  const vendorEmail = vendor?.email || task.metadata?.email?.to;
  let sendSuccess = false;
  if (task.metadata.channel === "EMAIL" && vendorEmail) {
    const emailData = task.metadata.email;
    const htmlBody = `<div style="font-family: sans-serif; line-height: 1.6;">${(emailData?.body || "").replace(/\n/g, "<br/>")}</div>`;
    sendSuccess = await sendEmail(
      vendorEmail,
      emailData?.subject || "Xiri Facility Solutions \u2014 Partnership Opportunity",
      htmlBody
    );
    if (!sendSuccess) {
      logger2.error(`Failed to send email to ${vendorEmail} for task ${task.id}`);
      throw new Error(`Resend email failed for vendor ${task.vendorId}`);
    }
  } else if (task.metadata.channel === "SMS") {
    logger2.info(`SMS send deferred for task ${task.id} (Twilio not yet integrated)`);
    sendSuccess = true;
  } else {
    logger2.warn(`No valid channel/email for task ${task.id}. Channel: ${task.metadata.channel}, Email: ${vendorEmail}`);
    sendSuccess = false;
  }
  await db5.collection("vendor_activities").add({
    vendorId: task.vendorId,
    type: sendSuccess ? "OUTREACH_SENT" : "OUTREACH_FAILED",
    description: sendSuccess ? `Automated ${task.metadata.channel} sent to ${vendorEmail || "vendor"}.` : `Failed to send ${task.metadata.channel} to vendor.`,
    createdAt: /* @__PURE__ */ new Date(),
    metadata: {
      channel: task.metadata.channel,
      to: vendorEmail || "unknown",
      content: task.metadata.channel === "SMS" ? task.metadata.sms : task.metadata.email?.subject
    }
  });
  await updateTaskStatus(db5, task.id, sendSuccess ? "COMPLETED" : "FAILED");
  if (sendSuccess) {
    await db5.collection("vendors").doc(task.vendorId).update({
      status: "awaiting_onboarding",
      outreachStatus: "SENT",
      outreachChannel: task.metadata.channel,
      outreachSentAt: /* @__PURE__ */ new Date(),
      statusUpdatedAt: /* @__PURE__ */ new Date()
    });
    await db5.collection("vendor_activities").add({
      vendorId: task.vendorId,
      type: "STATUS_CHANGE",
      description: `Pipeline advanced: qualified \u2192 awaiting_onboarding (outreach ${task.metadata.channel} delivered)`,
      createdAt: /* @__PURE__ */ new Date(),
      metadata: { from: "qualified", to: "awaiting_onboarding", trigger: "outreach_sent" }
    });
  } else {
    await db5.collection("vendors").doc(task.vendorId).update({
      outreachStatus: "PENDING",
      outreachChannel: task.metadata.channel,
      outreachTime: /* @__PURE__ */ new Date()
    });
  }
}
async function handleFollowUp(task) {
  logger2.info(`Processing FOLLOW_UP task ${task.id} (sequence ${task.metadata?.sequence})`);
  const vendorDoc = await db5.collection("vendors").doc(task.vendorId).get();
  const vendor = vendorDoc.exists ? vendorDoc.data() : null;
  if (!vendor) {
    logger2.warn(`Vendor ${task.vendorId} not found, marking task completed.`);
    await updateTaskStatus(db5, task.id, "COMPLETED");
    return;
  }
  if (vendor.status !== "awaiting_onboarding") {
    logger2.info(`Vendor ${task.vendorId} is now '${vendor.status}', skipping follow-up.`);
    await updateTaskStatus(db5, task.id, "COMPLETED");
    return;
  }
  const vendorEmail = vendor.email || task.metadata?.email;
  if (!vendorEmail) {
    logger2.warn(`No email for vendor ${task.vendorId}, skipping follow-up.`);
    await updateTaskStatus(db5, task.id, "COMPLETED");
    return;
  }
  const sequence = task.metadata?.sequence || 1;
  const businessName = task.metadata?.businessName || vendor.businessName || "there";
  const isSpanish = (task.metadata?.preferredLanguage || vendor.preferredLanguage) === "es";
  const unsubscribeUrl = `https://us-central1-xiri-facility-solutions.cloudfunctions.net/handleUnsubscribe?vendorId=${task.vendorId}`;
  const onboardingUrl = `https://xiri.ai/contractor?vid=${task.vendorId}`;
  const subject = task.metadata?.subject || `Follow-up: Complete your Xiri profile`;
  const html = buildFollowUpEmail(sequence, businessName, onboardingUrl, unsubscribeUrl, isSpanish);
  const sendSuccess = await sendEmail(vendorEmail, subject, html);
  if (sendSuccess) {
    await db5.collection("vendor_activities").add({
      vendorId: task.vendorId,
      type: "FOLLOW_UP_SENT",
      description: `Follow-up #${sequence} sent to ${vendorEmail}`,
      createdAt: /* @__PURE__ */ new Date(),
      metadata: { sequence, email: vendorEmail, channel: "EMAIL" }
    });
    await updateTaskStatus(db5, task.id, "COMPLETED");
    logger2.info(`Follow-up #${sequence} sent to ${vendorEmail} for vendor ${task.vendorId}`);
  } else {
    throw new Error(`Failed to send follow-up #${sequence} to ${vendorEmail}`);
  }
}
function buildFollowUpEmail(sequence, businessName, onboardingUrl, unsubscribeUrl, isSpanish) {
  const msgs = {
    1: {
      en: {
        body: `We noticed you haven't completed your Xiri profile yet. Completing your profile is the first step to receiving work opportunities from our network of medical and commercial facilities.`,
        cta: "Complete My Profile"
      },
      es: {
        body: `Notamos que a\xFAn no ha completado su perfil de Xiri. Completar su perfil es el primer paso para recibir oportunidades de trabajo de nuestra red de instalaciones m\xE9dicas y comerciales.`,
        cta: "Completar Mi Perfil"
      }
    },
    2: {
      en: {
        body: `Just checking in \u2014 we'd love to have you on board. Our contractor network is growing and there are active opportunities in your area. It only takes a few minutes to complete your profile.`,
        cta: "Finish My Application"
      },
      es: {
        body: `Solo quer\xEDamos saber c\xF3mo est\xE1 \u2014 nos encantar\xEDa contar con usted. Nuestra red de contratistas est\xE1 creciendo y hay oportunidades activas en su \xE1rea.`,
        cta: "Finalizar Mi Solicitud"
      }
    },
    3: {
      en: {
        body: `This is our final follow-up. We don't want you to miss out on work opportunities with Xiri. If you're still interested, please complete your profile. Otherwise, we'll remove you from our outreach list.`,
        cta: "Complete Profile Now"
      },
      es: {
        body: `Este es nuestro \xFAltimo seguimiento. No queremos que pierda las oportunidades de trabajo con Xiri. Si a\xFAn est\xE1 interesado, complete su perfil.`,
        cta: "Completar Perfil Ahora"
      }
    }
  };
  const msg = msgs[sequence]?.[isSpanish ? "es" : "en"] || msgs[1].en;
  const greeting = isSpanish ? `Hola ${businessName},` : `Hi ${businessName},`;
  const reply = isSpanish ? "\xBFPreguntas? Simplemente responda a este correo." : "Questions? Just reply to this email.";
  const unsub = isSpanish ? "Cancelar suscripci\xF3n" : "Unsubscribe from future emails";
  const signoff = isSpanish ? "Saludos cordiales" : "Best regards";
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: #0c4a6e; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Xiri Facility Solutions</h1>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 15px;">${greeting}</p>
            <p style="font-size: 15px; line-height: 1.7;">${msg.body}</p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="${onboardingUrl}" style="display: inline-block; padding: 14px 32px; background: #0369a1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                    ${msg.cta}
                </a>
            </div>
            <p style="font-size: 14px; color: #64748b;">${reply}</p>
            <p style="margin-top: 24px; font-size: 14px;">${signoff},<br/><strong>Xiri Facility Solutions Team</strong></p>
        </div>
        <div style="text-align: center; margin-top: 16px;">
            <a href="${unsubscribeUrl}" style="font-size: 11px; color: #94a3b8; text-decoration: underline;">${unsub}</a>
        </div>
    </div>`;
}

// src/triggers/onIncomingMessage.ts
var import_firestore3 = require("firebase-functions/v2/firestore");
var admin7 = __toESM(require("firebase-admin"));
var logger3 = __toESM(require("firebase-functions/logger"));
if (!admin7.apps.length) {
  admin7.initializeApp();
}
var db6 = admin7.firestore();
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
  } catch (error6) {
    logger3.error("Error processing inbound message:", error6);
  }
});

// src/triggers/onDocumentUploaded.ts
var import_firestore4 = require("firebase-functions/v2/firestore");
var admin9 = __toESM(require("firebase-admin"));

// src/agents/documentVerifier.ts
var import_generative_ai5 = require("@google/generative-ai");
var admin8 = __toESM(require("firebase-admin"));
var genAI4 = new import_generative_ai5.GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
var db7 = admin8.firestore();
async function verifyDocument(docType, vendorName, specialty) {
  const model3 = genAI4.getGenerativeModel({ model: "gemini-2.0-flash" });
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
            DAMAGE TO RENTED PREMISES: $100,000
            MED EXP: $5,000
            PERSONAL & ADV INJURY: $2,000,000
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
            Address: 123 Main St
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
    const result = await model3.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    return JSON.parse(jsonMatch[0]);
  } catch (error6) {
    console.error("AI Verification Failed:", error6);
    return {
      valid: false,
      reasoning: "AI Verification Failed: " + error6,
      extracted: {}
    };
  }
}

// src/triggers/onDocumentUploaded.ts
var db8 = admin9.firestore();
var onDocumentUploaded = (0, import_firestore4.onDocumentUpdated)({
  document: "vendors/{vendorId}",
  secrets: ["GEMINI_API_KEY"]
}, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const vendorId = event.params.vendorId;
  if (!before || !after) return;
  if (after.compliance?.coi?.status === "PENDING" && before.compliance?.coi?.status !== "PENDING") {
    console.log(`Processing COI for ${vendorId}`);
    await runVerification(vendorId, "COI", after);
  }
  if (after.compliance?.w9?.status === "PENDING" && before.compliance?.w9?.status !== "PENDING") {
    console.log(`Processing W9 for ${vendorId}`);
    await runVerification(vendorId, "W9", after);
  }
});
async function runVerification(vendorId, docType, vendorData) {
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
      [`${fieldPath}.verifiedAt`]: admin9.firestore.FieldValue.serverTimestamp()
    });
    await db8.collection("vendor_activities").add({
      vendorId,
      type: "AI_VERIFICATION",
      // New type
      description: `AI ${result.valid ? "Verified" : "Rejected"} ${docType}: ${result.reasoning}`,
      createdAt: admin9.firestore.FieldValue.serverTimestamp(),
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
  } catch (error6) {
    console.error(`Verification failed for ${docType}:`, error6);
  }
}

// src/triggers/sendBookingConfirmation.ts
var import_firestore5 = require("firebase-functions/v2/firestore");
init_emailUtils();
var import_date_fns = require("date-fns");
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
  await sendEmail(email, subject, htmlBody, [
    {
      filename: "invite.ics",
      content: icsContent
    }
  ]);
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
    const db11 = (0, import_firestore6.getFirestore)();
    const docRef = db11.collection(collection).doc(documentId);
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
  } catch (error6) {
    console.error("Enrichment error:", error6);
    if (error6 instanceof import_https.HttpsError) {
      throw error6;
    }
    throw new import_https.HttpsError("internal", `Enrichment failed: ${error6.message}`);
  }
});

// src/triggers/onOnboardingComplete.ts
var import_firestore7 = require("firebase-functions/v2/firestore");
var admin10 = __toESM(require("firebase-admin"));
var logger4 = __toESM(require("firebase-functions/logger"));
var import_resend2 = require("resend");
if (!admin10.apps.length) {
  admin10.initializeApp();
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
  logger4.info(`Vendor ${vendorId} (${businessName}) completed onboarding. Sending notification.`);
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
    const { data, error: error6 } = await resend2.emails.send({
      from: "Xiri Facility Solutions <onboarding@xiri.ai>",
      to: "chris@xiri.ai",
      subject: `\u{1F3D7}\uFE0F Vendor Onboarded: ${businessName}`,
      html
    });
    if (error6) {
      logger4.error("Failed to send onboarding notification:", error6);
    } else {
      logger4.info(`Notification sent to chris@xiri.ai (Resend ID: ${data?.id})`);
    }
  } catch (err) {
    logger4.error("Error sending onboarding notification:", err);
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
        logger4.error("Failed to send vendor confirmation:", vendorError);
      } else {
        logger4.info(`Vendor confirmation sent to ${email}`);
      }
    } catch (err) {
      logger4.error("Error sending vendor confirmation:", err);
    }
  }
  const db11 = admin10.firestore();
  const hasEntity = !!compliance.hasBusinessEntity;
  const hasGL = !!compliance.generalLiability?.hasInsurance;
  const hasWC = !!compliance.workersComp?.hasInsurance;
  const hasAuto = !!compliance.autoInsurance?.hasInsurance;
  const hasW9 = !!compliance.w9Collected;
  const attestationItems = [hasEntity, hasGL, hasWC, hasAuto, hasW9];
  const attestationScore = attestationItems.filter(Boolean).length * 10;
  const uploads = compliance.uploadedDocs || {};
  const docsCount = [uploads.coi, uploads.llc, uploads.w9].filter(Boolean).length;
  const docsUploadedScore = docsCount * 10;
  const docsVerifiedScore = 0;
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
    complianceUpdate.status = "pending_verification";
  }
  await db11.collection("vendors").doc(vendorId).update(complianceUpdate);
  logger4.info(`Vendor ${vendorId} compliance score: ${totalScore}/100 (attest=${attestationScore}, docs=${docsUploadedScore}, verified=${docsVerifiedScore})`);
  await db11.collection("vendor_activities").add({
    vendorId,
    type: "ONBOARDING_COMPLETE",
    description: `${businessName} completed onboarding form (${track}). Compliance score: ${totalScore}/100.`,
    createdAt: /* @__PURE__ */ new Date(),
    metadata: { track, email, phone, lang, complianceScore: totalScore }
  });
});

// src/triggers/dripScheduler.ts
var import_firestore8 = require("firebase-functions/v2/firestore");
var admin11 = __toESM(require("firebase-admin"));
var logger5 = __toESM(require("firebase-functions/logger"));
init_queueUtils();
if (!admin11.apps.length) {
  admin11.initializeApp();
}
var db9 = admin11.firestore();
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
  logger5.info(`Scheduling drip campaign for vendor ${vendorId} (${businessName})`);
  const now = /* @__PURE__ */ new Date();
  const followUps = [
    { dayOffset: 3, sequence: 1, subject: "Quick reminder \u2014 complete your Xiri profile" },
    { dayOffset: 7, sequence: 2, subject: "Just checking in \u2014 your Xiri application" },
    { dayOffset: 14, sequence: 3, subject: "Final follow-up \u2014 don't miss out on work opportunities" }
  ];
  for (const fu of followUps) {
    const scheduledDate = new Date(now);
    scheduledDate.setDate(scheduledDate.getDate() + fu.dayOffset);
    scheduledDate.setHours(15, 0, 0, 0);
    await enqueueTask(db9, {
      vendorId,
      type: "FOLLOW_UP",
      scheduledAt: admin11.firestore.Timestamp.fromDate(scheduledDate),
      metadata: {
        sequence: fu.sequence,
        subject: fu.subject,
        businessName,
        email: after.email,
        preferredLanguage: after.preferredLanguage || "en"
      }
    });
  }
  await db9.collection("vendor_activities").add({
    vendorId,
    type: "DRIP_SCHEDULED",
    description: `Drip campaign scheduled: 3 follow-ups over 14 days for ${businessName}.`,
    createdAt: /* @__PURE__ */ new Date(),
    metadata: { followUpCount: 3, schedule: "3d/7d/14d" }
  });
  logger5.info(`Drip campaign scheduled for ${vendorId}: 3 follow-ups at days 3, 7, 14`);
});

// src/triggers/handleUnsubscribe.ts
var import_https2 = require("firebase-functions/v2/https");
var admin12 = __toESM(require("firebase-admin"));
var logger6 = __toESM(require("firebase-functions/logger"));
init_queueUtils();
if (!admin12.apps.length) {
  admin12.initializeApp();
}
var db10 = admin12.firestore();
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
    const vendorDoc = await db10.collection("vendors").doc(vendorId).get();
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
    await db10.collection("vendors").doc(vendorId).update({
      status: "dismissed",
      statusUpdatedAt: /* @__PURE__ */ new Date(),
      dismissReason: "unsubscribed",
      unsubscribedAt: /* @__PURE__ */ new Date()
    });
    const cancelledCount = await cancelVendorTasks(db10, vendorId);
    await db10.collection("vendor_activities").add({
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
    logger6.info(`Vendor ${vendorId} (${businessName}) unsubscribed. ${cancelledCount} tasks cancelled.`);
    res.status(200).send(renderPage(
      "Unsubscribed Successfully",
      `${businessName} has been removed from our outreach list. You won't receive any more emails from Xiri Facility Solutions.<br/><br/>If this was a mistake, please contact us at <a href="mailto:chris@xiri.ai" style="color: #0369a1;">chris@xiri.ai</a>.`,
      true
    ));
  } catch (err) {
    logger6.error(`Error processing unsubscribe for ${vendorId}:`, err);
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

// src/index.ts
var generateLeads = (0, import_https3.onCall)({
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
  if (!query || !location) {
    throw new import_https3.HttpsError("invalid-argument", "Missing 'query' or 'location' in request.");
  }
  try {
    console.log(`Analyzing leads for query: ${query}, location: ${location}${previewOnly ? " (PREVIEW MODE)" : ""}`);
    const rawVendors = await searchVendors(query, location);
    console.log(`Sourced ${rawVendors.length} vendors.`);
    const result = await analyzeVendorLeads(rawVendors, query, hasActiveContract, previewOnly);
    return {
      message: "Lead generation process completed.",
      sourced: rawVendors.length,
      analysis: result,
      // Include vendor data in response for preview mode
      vendors: previewOnly ? result.vendors : void 0
    };
  } catch (error6) {
    console.error("Error in generateLeads:", error6);
    throw new import_https3.HttpsError("internal", error6.message || "An internal error occurred.");
  }
});
var clearPipeline = (0, import_https3.onCall)({
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
  } catch (error6) {
    throw new import_https3.HttpsError("internal", error6.message);
  }
});
var runRecruiterAgent = (0, import_https3.onRequest)({ secrets: ["GEMINI_API_KEY"] }, async (req, res) => {
  const rawVendors = req.body.vendors || [
    { name: "ABC Cleaning", services: "We do medical office cleaning and terminal cleaning." },
    { name: "Joe's Pizza", services: "Best pizza in town" },
    { name: "Elite HVAC", services: "Commercial HVAC systems" }
  ];
  const result = await analyzeVendorLeads(rawVendors, "Commercial Cleaning");
  res.json(result);
});
var testSendEmail = (0, import_https3.onCall)({
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
    throw new import_https3.HttpsError("invalid-argument", "Missing vendorId or templateId");
  }
  try {
    await sendTemplatedEmail2(vendorId, templateId);
    return { success: true, message: `Email sent to vendor ${vendorId}` };
  } catch (error6) {
    console.error("Error sending test email:", error6);
    throw new import_https3.HttpsError("internal", error6.message || "Failed to send email");
  }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  clearPipeline,
  enrichFromWebsite,
  generateLeads,
  handleUnsubscribe,
  onAwaitingOnboarding,
  onDocumentUploaded,
  onIncomingMessage,
  onOnboardingComplete,
  onVendorApproved,
  onVendorCreated,
  processOutreachQueue,
  runRecruiterAgent,
  sendBookingConfirmation,
  testSendEmail
});
//# sourceMappingURL=index.js.map