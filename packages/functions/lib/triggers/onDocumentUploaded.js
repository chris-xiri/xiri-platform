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
exports.onDocumentUploaded = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const documentVerifier_1 = require("../agents/documentVerifier");
const db = admin.firestore();
exports.onDocumentUploaded = (0, firestore_1.onDocumentUpdated)({
    document: "vendors/{vendorId}",
    secrets: ["GEMINI_API_KEY"]
}, async (event) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    const vendorId = event.params.vendorId;
    if (!before || !after)
        return;
    // Check COI
    if (((_d = (_c = after.compliance) === null || _c === void 0 ? void 0 : _c.coi) === null || _d === void 0 ? void 0 : _d.status) === 'PENDING' && ((_f = (_e = before.compliance) === null || _e === void 0 ? void 0 : _e.coi) === null || _f === void 0 ? void 0 : _f.status) !== 'PENDING') {
        console.log(`Processing COI for ${vendorId}`);
        await runVerification(vendorId, 'COI', after);
    }
    // Check W9
    if (((_h = (_g = after.compliance) === null || _g === void 0 ? void 0 : _g.w9) === null || _h === void 0 ? void 0 : _h.status) === 'PENDING' && ((_k = (_j = before.compliance) === null || _j === void 0 ? void 0 : _j.w9) === null || _k === void 0 ? void 0 : _k.status) !== 'PENDING') {
        console.log(`Processing W9 for ${vendorId}`);
        await runVerification(vendorId, 'W9', after);
    }
});
async function runVerification(vendorId, docType, vendorData) {
    try {
        const result = await (0, documentVerifier_1.verifyDocument)(docType, vendorData.companyName || "Vendor", vendorData.specialty || "General");
        // Update Vendor
        const fieldPath = docType === 'COI' ? 'compliance.coi' : 'compliance.w9';
        await db.doc(`vendors/${vendorId}`).update({
            [`${fieldPath}.status`]: result.valid ? 'VERIFIED' : 'REJECTED',
            [`${fieldPath}.aiAnalysis`]: {
                valid: result.valid,
                reasoning: result.reasoning,
                extracted: result.extracted
            },
            [`${fieldPath}.verifiedAt`]: admin.firestore.FieldValue.serverTimestamp()
        });
        // Log Activity
        await db.collection('vendor_activities').add({
            vendorId: vendorId,
            type: 'AI_VERIFICATION', // New type
            description: `AI ${result.valid ? 'Verified' : 'Rejected'} ${docType}: ${result.reasoning}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            metadata: {
                docType,
                valid: result.valid,
                extracted: result.extracted
            }
        });
        // Send email notification
        if (result.valid) {
            const { sendTemplatedEmail } = await Promise.resolve().then(() => __importStar(require('../utils/emailUtils')));
            await sendTemplatedEmail(vendorId, 'doc_upload_notification', {
                documentType: docType === 'COI' ? 'Certificate of Insurance' : 'W-9 Form'
            });
        }
    }
    catch (error) {
        console.error(`Verification failed for ${docType}:`, error);
    }
}
//# sourceMappingURL=onDocumentUploaded.js.map