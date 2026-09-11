"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCreateMetadata = buildCreateMetadata;
exports.buildUpdateMetadata = buildUpdateMetadata;
const firestore_1 = require("firebase/firestore");
/**
 * Returns metadata fields for a newly created Firestore document.
 * Both `createdAt` and `updatedAt` are set to the server timestamp.
 */
function buildCreateMetadata() {
    return {
        createdAt: (0, firestore_1.serverTimestamp)(),
        updatedAt: (0, firestore_1.serverTimestamp)(),
    };
}
/**
 * Returns metadata fields for an updated Firestore document.
 * Only `updatedAt` is set; `createdAt` must never be modified after creation.
 */
function buildUpdateMetadata() {
    return {
        updatedAt: (0, firestore_1.serverTimestamp)(),
    };
}
//# sourceMappingURL=timestamps.js.map