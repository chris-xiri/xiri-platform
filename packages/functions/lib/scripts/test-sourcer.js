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
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// Load environment variables from the .env file in the functions package
dotenv.config({ path: path.join(__dirname, '../../.env') });
const sourcer_1 = require("../agents/sourcer");
async function testSourcer() {
    const query = "Commercial Cleaning";
    const location = "Williston Park, NY";
    console.log(`Testing Serper integration for: "${query}" in "${location}"...`);
    console.log(`API Key present: ${!!process.env.SERPER_API_KEY}`);
    try {
        const vendors = await (0, sourcer_1.searchVendors)(query, location);
        console.log("\n--- Sourcing Results ---");
        console.log(`Found ${vendors.length} vendors.`);
        vendors.forEach((v, i) => {
            console.log(`\n[${i + 1}] ${v.name}`);
            console.log(`    Address: ${v.location}`);
            console.log(`    Source: ${v.source}`);
            if (v.phone)
                console.log(`    Phone: ${v.phone}`);
            if (v.website)
                console.log(`    Website: ${v.website}`);
        });
    }
    catch (error) {
        console.error("Error during sourcing:", error);
    }
}
testSourcer();
//# sourceMappingURL=test-sourcer.js.map