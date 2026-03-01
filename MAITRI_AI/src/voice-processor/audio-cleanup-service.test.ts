/**
 * Unit Tests for Audio Cleanup Service
 * 
 * Tests the scheduled cleanup of expired voice files from S3.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3Client } from '@aws-sdk/client-s3';

// Mock AWS SDK clients
const mockS3Send = vi.fn();

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({
    send: mockS3Send,
  })),
  ListObjectsV2Command: vi.fn((input) => ({ input, name: 'ListObjectsV2Command' })),
  DeleteObjectsCommand: vi.fn((input) => ({ input, name: 'DeleteObjectsCommand' })),
}));

import { cleanupExpiredFiles } from './audio-cleanup-service';

describe('Audio Cleanup Service', () => {
  let mockS3Client: S3Client;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VOICE_BUCKET_NAME = 'test-bucket';
    mockS3Client = new S3Client({});
  });

  it('should delete expired input files older than 24 hours', async () => {
    const now = Date.now();
    const expiredDate = new Date(now - 25 * 60 * 60 * 1000); // 25 hours ago
    const recentDate = new Date(now - 1 * 60 * 60 * 1000); // 1 hour ago

    mockS3Send.mockImplementation((command: any) => {
      if (command.name === 'ListObjectsV2Command') {
        if (command.input.Prefix === 'input/') {
          return Promise.resolve({
            Contents: [
              { Key: 'input/2024/01/01/user1/expired.ogg', LastModified: expiredDate },
              { Key: 'input/2024/01/02/user1/recent.ogg', LastModified: recentDate },
            ],
          });
        }
        return Promise.resolve({ Contents: [] });
      }
      if (command.name === 'DeleteObjectsCommand') {
        return Promise.resolve({
          Deleted: [{ Key: 'input/2024/01/01/user1/expired.ogg' }],
        });
      }
      return Promise.resolve({});
    });

    const result = await cleanupExpiredFiles(mockS3Client);

    expect(result.inputFilesDeleted).toBe(1);
    expect(result.totalFilesDeleted).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('should delete expired output files older than 48 hours', async () => {
    const now = Date.now();
    const expiredDate = new Date(now - 49 * 60 * 60 * 1000); // 49 hours ago
    const recentDate = new Date(now - 24 * 60 * 60 * 1000); // 24 hours ago

    mockS3Send.mockImplementation((command: any) => {
      if (command.name === 'ListObjectsV2Command') {
        if (command.input.Prefix === 'output/') {
          return Promise.resolve({
            Contents: [
              { Key: 'output/2024/01/01/user1/expired.ogg', LastModified: expiredDate },
              { Key: 'output/2024/01/02/user1/recent.ogg', LastModified: recentDate },
            ],
          });
        }
        return Promise.resolve({ Contents: [] });
      }
      if (command.name === 'DeleteObjectsCommand') {
        return Promise.resolve({
          Deleted: [{ Key: 'output/2024/01/01/user1/expired.ogg' }],
        });
      }
      return Promise.resolve({});
    });

    const result = await cleanupExpiredFiles(mockS3Client);

    expect(result.outputFilesDeleted).toBe(1);
    expect(result.totalFilesDeleted).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('should not delete files within retention period', async () => {
    const now = Date.now();
    const recentInputDate = new Date(now - 12 * 60 * 60 * 1000); // 12 hours ago
    const recentOutputDate = new Date(now - 36 * 60 * 60 * 1000); // 36 hours ago

    mockS3Send.mockImplementation((command: any) => {
      if (command.name === 'ListObjectsV2Command') {
        if (command.input.Prefix === 'input/') {
          return Promise.resolve({
            Contents: [
              { Key: 'input/2024/01/02/user1/recent.ogg', LastModified: recentInputDate },
            ],
          });
        }
        if (command.input.Prefix === 'output/') {
          return Promise.resolve({
            Contents: [
              { Key: 'output/2024/01/02/user1/recent.ogg', LastModified: recentOutputDate },
            ],
          });
        }
        return Promise.resolve({ Contents: [] });
      }
      return Promise.resolve({});
    });

    const result = await cleanupExpiredFiles(mockS3Client);

    expect(result.inputFilesDeleted).toBe(0);
    expect(result.outputFilesDeleted).toBe(0);
    expect(result.totalFilesDeleted).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle empty bucket gracefully', async () => {
    mockS3Send.mockResolvedValue({ Contents: [] });

    const result = await cleanupExpiredFiles(mockS3Client);

    expect(result.inputFilesDeleted).toBe(0);
    expect(result.outputFilesDeleted).toBe(0);
    expect(result.totalFilesDeleted).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should capture errors during cleanup', async () => {
    mockS3Send.mockRejectedValue(new Error('S3 access denied'));

    const result = await cleanupExpiredFiles(mockS3Client);

    expect(result.totalFilesDeleted).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('S3 access denied');
  });

  it('should delete both input and output files in single run', async () => {
    const now = Date.now();
    const expiredInputDate = new Date(now - 25 * 60 * 60 * 1000); // 25 hours ago
    const expiredOutputDate = new Date(now - 50 * 60 * 60 * 1000); // 50 hours ago

    mockS3Send.mockImplementation((command: any) => {
      if (command.name === 'ListObjectsV2Command') {
        if (command.input.Prefix === 'input/') {
          return Promise.resolve({
            Contents: [
              { Key: 'input/expired.ogg', LastModified: expiredInputDate },
            ],
          });
        }
        if (command.input.Prefix === 'output/') {
          return Promise.resolve({
            Contents: [
              { Key: 'output/expired.ogg', LastModified: expiredOutputDate },
            ],
          });
        }
        return Promise.resolve({ Contents: [] });
      }
      if (command.name === 'DeleteObjectsCommand') {
        return Promise.resolve({
          Deleted: command.input.Delete.Objects,
        });
      }
      return Promise.resolve({});
    });

    const result = await cleanupExpiredFiles(mockS3Client);

    expect(result.inputFilesDeleted).toBe(1);
    expect(result.outputFilesDeleted).toBe(1);
    expect(result.totalFilesDeleted).toBe(2);
    expect(result.errors).toHaveLength(0);
  });
});
