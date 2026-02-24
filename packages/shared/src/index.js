"use strict";
// --- SHARED DOMAIN TYPES ---
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEligibleForST120 = exports.calculateTax = exports.getTaxRate = void 0;
// --- TAX RATE UTILITIES ---
var taxRates_1 = require("./taxRates");
Object.defineProperty(exports, "getTaxRate", { enumerable: true, get: function () { return taxRates_1.getTaxRate; } });
Object.defineProperty(exports, "calculateTax", { enumerable: true, get: function () { return taxRates_1.calculateTax; } });
Object.defineProperty(exports, "isEligibleForST120", { enumerable: true, get: function () { return taxRates_1.isEligibleForST120; } });
