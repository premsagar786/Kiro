import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

/**
 * Audio Cleanup Service
 * 
 * Scheduled Lambda function that deletes expired voice files from S3.
 * - Input files: deleted after 24 hours
 * - Output files: deleted after 48 hours
 * 
 * Note: S3 lifecycle policies handle automatic deletion, but this service
 * provides additional monitoring, logging, and manual cleanup capabilities.
 * 
 * Requirements: 2.5, 14.4
 */

const BUCKET_NAME = process.env.VOICE_BUCKET_NAME || '';
const INPUT_PREFIX = 'input/';
const OUTPUT_PREFIX = 'output/';
const INPUT_EXPIRY_HOURS = 24;
const OUTPUT_EXPIRY_HOURS = 48;

export interface CleanupResult {
  inputFilesDeleted: number;
  outputFilesDeleted: number;
  totalFilesDeleted: number;
  errors: string[];
}

/**
 * Main cleanup function that deletes expired voice files
 */
export async function cleanupExpiredFiles(s3Client?: S3Client): Promise<CleanupResult> {
  const client = s3Client || new S3Client({});
  
  const result: CleanupResult = {
    inputFilesDeleted: 0,
    outputFilesDeleted: 0,
    totalFilesDeleted: 0,
    errors: [],
  };

  try {
    // Clean up input files (24 hours)
    const inputDeleted = await cleanupFilesInPrefix(client, INPUT_PREFIX, INPUT_EXPIRY_HOURS);
    result.inputFilesDeleted = inputDeleted;

    // Clean up output files (48 hours)
    const outputDeleted = await cleanupFilesInPrefix(client, OUTPUT_PREFIX, OUTPUT_EXPIRY_HOURS);
    result.outputFilesDeleted = outputDeleted;

    result.totalFilesDeleted = result.inputFilesDeleted + result.outputFilesDeleted;

    console.log('Cleanup completed:', JSON.stringify(result));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    console.error('Cleanup error:', errorMessage);
  }

  return result;
}

/**
 * Clean up files in a specific S3 prefix that are older than the expiry hours
 */
async function cleanupFilesInPrefix(s3Client: S3Client, prefix: string, expiryHours: number): Promise<number> {
  const now = Date.now();
  const expiryMs = expiryHours * 60 * 60 * 1000;
  let deletedCount = 0;

  try {
    let continuationToken: string | undefined;

    do {
      // List objects in the prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const listResponse = await s3Client.send(listCommand);

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        break;
      }

      // Filter expired files
      const expiredFiles = listResponse.Contents.filter((obj) => {
        if (!obj.LastModified) return false;
        const fileAge = now - obj.LastModified.getTime();
        return fileAge > expiryMs;
      });

      // Delete expired files in batches
      if (expiredFiles.length > 0) {
        const objectsToDelete = expiredFiles
          .filter((obj) => obj.Key)
          .map((obj) => ({ Key: obj.Key! }));

        if (objectsToDelete.length > 0) {
          const deleteCommand = new DeleteObjectsCommand({
            Bucket: BUCKET_NAME,
            Delete: {
              Objects: objectsToDelete,
              Quiet: true,
            },
          });

          const deleteResponse = await s3Client.send(deleteCommand);
          const deleted = deleteResponse.Deleted?.length || 0;
          deletedCount += deleted;

          console.log(`Deleted ${deleted} expired files from ${prefix}`);
        }
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error cleaning up ${prefix}:`, errorMessage);
    throw error;
  }

  return deletedCount;
}

/**
 * Lambda handler for scheduled cleanup
 */
export async function handler(): Promise<CleanupResult> {
  console.log('Starting audio file cleanup...');
  
  if (!BUCKET_NAME) {
    throw new Error('VOICE_BUCKET_NAME environment variable is not set');
  }

  const result = await cleanupExpiredFiles();
  
  console.log('Cleanup summary:', {
    inputFilesDeleted: result.inputFilesDeleted,
    outputFilesDeleted: result.outputFilesDeleted,
    totalFilesDeleted: result.totalFilesDeleted,
    hasErrors: result.errors.length > 0,
  });

  return result;
}
