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
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer = __importStar(require("nodemailer"));
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });
async function testEmail() {
    const rcp = "clungz@gmail.com";
    console.log(`Sending test email to ${rcp}...`);
    console.log(`Using User: ${process.env.SMTP_USER}`);
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false, // upgrade later with STARTTLS
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
    try {
        const info = await transporter.sendMail({
            from: '"Xiri Recruit" <ic-recruiter@xiri.ai>',
            to: rcp,
            subject: "Test Email from Xiri Agent",
            text: "This is a test email from your local Xiri development environment.",
            html: "<b>This is a test email</b> from your local Xiri development environment.",
        });
        console.log("Message sent: %s", info.messageId);
    }
    catch (error) {
        console.error("Error sending email:", error);
    }
}
testEmail();
//# sourceMappingURL=test-email.js.map