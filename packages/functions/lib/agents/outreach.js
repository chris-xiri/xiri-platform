"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performOutreach = void 0;
exports.generateEmailContent = generateEmailContent;
exports.generateSMSContent = generateSMSContent;
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const nodemailer = __importStar(require("nodemailer"));
const twilio_1 = require("twilio");
const generative_ai_1 = require("@google/generative-ai");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// AI for personalized content
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCSmKaZsBUm4SIrxouk3tAmhHZUY0jClUw";
const genAI = new generative_ai_1.GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
/**
 * Main entry point for the Outreach Agent.
 * Triggered when a vendor is APPROVED.
 */
const performOutreach = async (vendorId) => {
    console.log(`Starting outreach agent for vendor ${vendorId}...`);
    const vendorRef = db.collection('vendors').doc(vendorId);
    const doc = await vendorRef.get();
    if (!doc.exists) {
        console.error("Vendor not found");
        return;
    }
    const vendor = doc.data();
    if (vendor.outreachStatus === 'SENT') {
        console.log("Outreach already sent. Skipping.");
        return;
    }
    // 1. Enrich Contact Info (Find Email)
    let email = vendor.email;
    if (!email && vendor.website) {
        console.log(`No email found. Scraping website: ${vendor.website}`);
        email = await scrapeEmailFromWebsite(vendor.website);
        if (email) {
            console.log(`Found email: ${email}`);
            await vendorRef.update({ email });
            vendor.email = email;
        }
    }
    // 2. Decide Channel
    // Priority: Email > SMS (if mobile)
    // We'll use AI to decide the best "Tone" and "Content"
    let channel = 'NONE';
    if (vendor.email) {
        channel = 'EMAIL';
    }
    else if (vendor.phone) {
        channel = 'SMS'; // Assuming we can SMS any phone for now (or Twilio will fail gracefully)
    }
    if (channel === 'NONE') {
        console.log("No contact method available. Marking as FAILED.");
        await vendorRef.update({ outreachStatus: 'FAILED', outreachChannel: 'NONE' });
        return;
    }
    // 3. Generate Content & Send
    try {
        if (channel === 'EMAIL') {
            await sendEmailOutreach(vendor);
        }
        else {
            await sendSMSOutreach(vendor);
        }
        // 4. Update Status
        await vendorRef.update({
            outreachStatus: 'SENT',
            outreachChannel: channel,
            outreachTime: new Date(),
            status: 'CONTACTED'
        });
        console.log(`Outreach sent via ${channel} successfully.`);
    }
    catch (error) {
        console.error("Outreach failed:", error);
        await vendorRef.update({ outreachStatus: 'FAILED', outreachChannel: channel });
    }
};
exports.performOutreach = performOutreach;
/**
 * Scrapes the vendor's website for an email address.
 */
async function scrapeEmailFromWebsite(url) {
    try {
        // Ensure protocol
        if (!url.startsWith('http'))
            url = 'https://' + url;
        const response = await axios_1.default.get(url, { timeout: 10000 });
        const html = response.data;
        const $ = cheerio.load(html);
        // 1. Look for mailto links
        const mailto = $('a[href^="mailto:"]').first().attr('href');
        if (mailto) {
            return mailto.replace('mailto:', '').split('?')[0];
        }
        // 2. Regex search in body
        // Basic regex for email
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
        const bodyText = $('body').text();
        const match = bodyText.match(emailRegex);
        if (match)
            return match[0];
    }
    catch (e) {
        console.warn(`Failed to scrape ${url}: ${e.message}`);
    }
    return undefined;
}
/**
 * Generates Email Content using Gemini with Best Practices
 */
async function generateEmailContent(vendor) {
    const contextType = vendor.hasActiveContract ? "Active Contract" : "Building Supply";
    // DIFFERENT STRATEGIES
    const strategyActive = `
    - **Mental Model**: "Uber Driver Notification". Direct, Urgent.
    - **Hook**: "Project ready now in [Location]."
    - **Value**: "We have the budget/contract secured."
    - **CTA**: "Can you start [Timeframe]?"
    `;
    const strategySupply = `
    - **Mental Model**: "VIP List Invitation" / "Preferred Vendor Status".
    - **Hook**: "We are expanding our network in [Location] for upcoming contracts."
    - **Value**: "Get preferred access to jobs without sales effort."
    - **CTA**: "Open to a brief intro to be on our shortlist?"
    `;
    const prompt = `
    You are "Sarah", a Vendor Relations Manager at Xiri Facility Solutions.
    Write a cold outreach email to "${vendor.companyName}" (Specialty: ${vendor.specialty}, Location: ${vendor.location}).
    
    **Scenario**: ${contextType}

    ### Strategy (${contextType}):
    ${vendor.hasActiveContract ? strategyActive : strategySupply}
    
    ### The Core Value (Always):
    - "Xiri handles sales, admin, and ensures on-time payment."
    - "Maximizes your billable hours / revenue efficiency."

    ### Formatting:
    - Max 100 words.
    - 1 sentence per paragraph.
    - Tone: Professional, Opportunity-driven.
    
    Return JSON: { "subject": "...", "body": "..." }
    `;
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
}
/**
 * Generates SMS Content using Gemini with Best Practices
 */
async function generateSMSContent(vendor) {
    const isUrgent = vendor.hasActiveContract;
    const prompt = `
    You are "Sarah" from Xiri. Write a SMS to "${vendor.companyName}".
    
    Context: ${isUrgent ? "Active Project Available" : "Building Vendor Network"};
    
    ### Objectives:
    ${isUrgent ?
        `1. Hook: "Contract available now in [Location]".
     2. Value: "Budget secured, fast pay".
     3. CTA: "Reply YES if available."`
        :
            `1. Hook: "Sourcing top [Specialty] vendors in [Location]".
     2. Value: "We fill your schedule with zero sales effort".
     3. CTA: "Reply YES to join the preferred list."`}
    
    Constraint: Max 160 chars.
    
    Return just the text content.
    `;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
}
/**
 * Sends Email using Nodemailer (or Mock)
 */
async function sendEmailOutreach(vendor) {
    console.log(`Preparing EMAIL for ${vendor.companyName} (${vendor.email})...`);
    const content = await generateEmailContent(vendor);
    // Sending Logic
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        await transporter.sendMail({
            from: '"Sarah from Xiri" <ic-recruiter@xiri.ai>',
            to: vendor.email,
            subject: content.subject,
            text: content.body, // or html
        });
    }
    else {
        console.warn("MOCK EMAIL SENT:");
        console.warn(`To: ${vendor.email}`);
        console.warn(`Subject: ${content.subject}`);
        console.warn(`Body: ${content.body}`);
    }
}
/**
 * Sends SMS using Twilio (or Mock)
 */
async function sendSMSOutreach(vendor) {
    console.log(`Preparing SMS for ${vendor.companyName} (${vendor.phone})...`);
    const messageBody = await generateSMSContent(vendor);
    // Sending Logic
    if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
        const client = new twilio_1.Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
        await client.messages.create({
            body: messageBody,
            from: process.env.TWILIO_FROM || '+15555555555',
            to: vendor.phone // Validated existence before calling
        });
    }
    else {
        console.warn("MOCK SMS SENT:");
        console.warn(`To: ${vendor.phone}`);
        console.warn(`Body: ${messageBody}`);
    }
}
//# sourceMappingURL=outreach.js.map