import * as admin from 'firebase-admin';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as nodemailer from 'nodemailer';
import { Twilio } from 'twilio';
import { Vendor } from '../utils/types';
import { GoogleGenerativeAI } from "@google/generative-ai";

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// AI for personalized content
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCSmKaZsBUm4SIrxouk3tAmhHZUY0jClUw";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Main entry point for the Outreach Agent.
 * Triggered when a vendor is APPROVED.
 */
export const performOutreach = async (vendorId: string) => {
    console.log(`Starting outreach agent for vendor ${vendorId}...`);

    const vendorRef = db.collection('vendors').doc(vendorId);
    const doc = await vendorRef.get();

    if (!doc.exists) {
        console.error("Vendor not found");
        return;
    }

    const vendor = doc.data() as Vendor;

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

    let channel: 'EMAIL' | 'SMS' | 'NONE' = 'NONE';

    if (vendor.email) {
        channel = 'EMAIL';
    } else if (vendor.phone) {
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
        } else {
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

    } catch (error: any) {
        console.error("Outreach failed:", error);
        await vendorRef.update({ outreachStatus: 'FAILED', outreachChannel: channel });
    }
};

/**
 * Scrapes the vendor's website for an email address.
 */
async function scrapeEmailFromWebsite(url: string): Promise<string | undefined> {
    try {
        // Ensure protocol
        if (!url.startsWith('http')) url = 'https://' + url;

        const response = await axios.get(url, { timeout: 10000 });
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

        if (match) return match[0];

    } catch (e: any) {
        console.warn(`Failed to scrape ${url}: ${e.message}`);
    }
    return undefined;
}

/**
 * Generates Email Content using Gemini with Best Practices
 */
export async function generateEmailContent(vendor: Vendor): Promise<{ subject: string, body: string }> {
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
export async function generateSMSContent(vendor: Vendor): Promise<string> {
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
     3. CTA: "Reply YES to join the preferred list."`
        }
    
    Constraint: Max 160 chars.
    
    Return just the text content.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
}

/**
 * Sends Email using Nodemailer (or Mock)
 */
async function sendEmailOutreach(vendor: Vendor) {
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
    } else {
        console.warn("MOCK EMAIL SENT:");
        console.warn(`To: ${vendor.email}`);
        console.warn(`Subject: ${content.subject}`);
        console.warn(`Body: ${content.body}`);
    }
}

/**
 * Sends SMS using Twilio (or Mock)
 */
async function sendSMSOutreach(vendor: Vendor) {
    console.log(`Preparing SMS for ${vendor.companyName} (${vendor.phone})...`);

    const messageBody = await generateSMSContent(vendor);

    // Sending Logic
    if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
        const client = new Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
        await client.messages.create({
            body: messageBody,
            from: process.env.TWILIO_FROM || '+15555555555',
            to: vendor.phone! // Validated existence before calling
        });
    } else {
        console.warn("MOCK SMS SENT:");
        console.warn(`To: ${vendor.phone}`);
        console.warn(`Body: ${messageBody}`);
    }
}
