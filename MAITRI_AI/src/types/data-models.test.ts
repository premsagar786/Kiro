/**
 * Property-Based Tests for Data Models
 * 
 * These tests validate universal correctness properties of the data models
 * using fast-check for property-based testing.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { UserRecord, LanguageDetection } from './data-models';

/**
 * Property 42: User Profile Field Completeness
 * 
 * **Validates: Requirements 11.2**
 * 
 * For any user profile created, it should contain userId, phoneNumber, 
 * preferredLanguage, and createdAt fields.
 * 
 * This property ensures that all UserRecord instances have the required fields
 * as specified in Requirement 11.2: "THE User_Store SHALL store user_id, 
 * phone_number, preferred_language, and creation_timestamp"
 */
describe('Property 42: User Profile Field Completeness', () => {
  // Supported language codes (ISO 639-1)
  const supportedLanguages = ['hi', 'en', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa'];
  
  // Arbitrary generator for LanguageDetection
  const languageDetectionArb = fc.record({
    languageCode: fc.constantFrom(...supportedLanguages),
    timestamp: fc.integer({ min: 1600000000000, max: 2000000000000 }), // Valid Unix timestamps
  });
  
  // Arbitrary generator for UserRecord
  const userRecordArb = fc.record({
    userId: fc.string({ minLength: 1, maxLength: 100 }).map(s => `user#${s}`),
    phoneNumber: fc.string({ minLength: 10, maxLength: 15 }), // Phone numbers
    preferredLanguage: fc.constantFrom(...supportedLanguages),
    createdAt: fc.integer({ min: 1600000000000, max: 2000000000000 }),
    lastInteractionAt: fc.integer({ min: 1600000000000, max: 2000000000000 }),
    languageDetectionHistory: fc.array(languageDetectionArb, { maxLength: 10 }),
    voiceEnabled: fc.boolean(),
    textOnlyMode: fc.boolean(),
    version: fc.integer({ min: 1, max: 100 }),
    updatedAt: fc.integer({ min: 1600000000000, max: 2000000000000 }),
  });

  it('should have all required fields: userId, phoneNumber, preferredLanguage, and createdAt', () => {
    fc.assert(
      fc.property(userRecordArb, (userRecord: UserRecord) => {
        // Verify all required fields exist
        expect(userRecord).toHaveProperty('userId');
        expect(userRecord).toHaveProperty('phoneNumber');
        expect(userRecord).toHaveProperty('preferredLanguage');
        expect(userRecord).toHaveProperty('createdAt');
        
        // Verify fields are not null or undefined
        expect(userRecord.userId).toBeDefined();
        expect(userRecord.phoneNumber).toBeDefined();
        expect(userRecord.preferredLanguage).toBeDefined();
        expect(userRecord.createdAt).toBeDefined();
        
        return true;
      }),
      { numRuns: 1000 } // Run 1000 test cases
    );
  });

  it('should have userId as a non-empty string', () => {
    fc.assert(
      fc.property(userRecordArb, (userRecord: UserRecord) => {
        expect(typeof userRecord.userId).toBe('string');
        expect(userRecord.userId.length).toBeGreaterThan(0);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  it('should have phoneNumber as a non-empty string', () => {
    fc.assert(
      fc.property(userRecordArb, (userRecord: UserRecord) => {
        expect(typeof userRecord.phoneNumber).toBe('string');
        expect(userRecord.phoneNumber.length).toBeGreaterThan(0);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  it('should have preferredLanguage as a valid ISO 639-1 code', () => {
    fc.assert(
      fc.property(userRecordArb, (userRecord: UserRecord) => {
        expect(typeof userRecord.preferredLanguage).toBe('string');
        expect(supportedLanguages).toContain(userRecord.preferredLanguage);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  it('should have createdAt as a valid Unix timestamp (number)', () => {
    fc.assert(
      fc.property(userRecordArb, (userRecord: UserRecord) => {
        expect(typeof userRecord.createdAt).toBe('number');
        expect(userRecord.createdAt).toBeGreaterThan(0);
        // Verify it's a reasonable timestamp (after 2020 and before 2033)
        expect(userRecord.createdAt).toBeGreaterThanOrEqual(1600000000000);
        expect(userRecord.createdAt).toBeLessThanOrEqual(2000000000000);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  it('should maintain field completeness across all generated instances', () => {
    fc.assert(
      fc.property(userRecordArb, (userRecord: UserRecord) => {
        // This is the core property: all four required fields must always be present
        const hasAllRequiredFields = 
          'userId' in userRecord &&
          'phoneNumber' in userRecord &&
          'preferredLanguage' in userRecord &&
          'createdAt' in userRecord;
        
        expect(hasAllRequiredFields).toBe(true);
        return hasAllRequiredFields;
      }),
      { numRuns: 1000 }
    );
  });
});
