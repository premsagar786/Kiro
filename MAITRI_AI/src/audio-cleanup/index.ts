/**
 * Audio Cleanup Lambda Handler
 * 
 * Scheduled Lambda function that runs periodically to clean up expired voice files.
 * This Lambda is triggered by EventBridge on a schedule (e.g., every hour).
 * 
 * Requirements: 2.5, 14.4
 */

import { handler as cleanupHandler } from '../voice-processor/audio-cleanup-service';

export { cleanupHandler as handler };
