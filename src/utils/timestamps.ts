import { serverTimestamp, FieldValue } from 'firebase/firestore';

/**
 * Returns metadata fields for a newly created Firestore document.
 * Both `createdAt` and `updatedAt` are set to the server timestamp.
 */
export function buildCreateMetadata(): { createdAt: FieldValue; updatedAt: FieldValue } {
  return {
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Returns metadata fields for an updated Firestore document.
 * Only `updatedAt` is set; `createdAt` must never be modified after creation.
 */
export function buildUpdateMetadata(): { updatedAt: FieldValue } {
  return {
    updatedAt: serverTimestamp(),
  };
}
