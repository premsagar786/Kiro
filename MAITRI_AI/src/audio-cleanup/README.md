# Audio Cleanup Service

## Overview

The Audio Cleanup Service is a scheduled Lambda function that periodically deletes expired voice files from S3 to comply with data retention policies.

## Requirements

- **Requirement 2.5**: Delete voice notes from S3 within 24 hours of processing
- **Requirement 14.4**: Do not store voice notes beyond 24 hours (data privacy)

## Retention Policies

- **Input files** (user voice notes): Deleted after 24 hours
- **Output files** (generated audio responses): Deleted after 48 hours

## Architecture

### Components

1. **audio-cleanup-service.ts**: Core cleanup logic
   - Lists objects in S3 with `input/` and `output/` prefixes
   - Filters files older than retention period
   - Deletes expired files in batches
   - Returns cleanup statistics

2. **index.ts**: Lambda handler
   - Entry point for EventBridge scheduled events
   - Invokes cleanup service
   - Logs results to CloudWatch

3. **EventBridge Rule**: Triggers Lambda every hour
   - Schedule: `rate(1 hour)`
   - Ensures timely cleanup of expired files

### S3 Bucket Structure

```
maitri-voice-files/
├── input/
│   └── {year}/{month}/{day}/
│       └── {userId}/
│           └── {messageId}.{format}
└── output/
    └── {year}/{month}/{day}/
        └── {userId}/
            └── {messageId}.ogg
```

## Deployment

The Lambda function is deployed via CDK in `lib/maitri-lambda-stack.ts`:

```typescript
const cleanupFunction = new lambda.Function(this, 'AudioCleanupFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('dist/audio-cleanup'),
  timeout: Duration.minutes(5),
  memorySize: 256,
});
```

### Environment Variables

- `VOICE_BUCKET_NAME`: Name of the S3 bucket containing voice files

### IAM Permissions

The Lambda function requires:
- `s3:ListBucket` on the voice bucket
- `s3:GetObject` on the voice bucket
- `s3:DeleteObject` on the voice bucket

## Monitoring

### CloudWatch Logs

The function logs:
- Number of input files deleted
- Number of output files deleted
- Total files deleted
- Any errors encountered

### CloudWatch Metrics

Custom metrics published:
- `AudioCleanup/InputFilesDeleted`
- `AudioCleanup/OutputFilesDeleted`
- `AudioCleanup/TotalFilesDeleted`
- `AudioCleanup/Errors`

### Alarms

Recommended CloudWatch alarms:
- High error rate (> 5% of cleanup runs)
- No files deleted for 24 hours (may indicate issue)
- Lambda function failures

## Redundancy with S3 Lifecycle Policies

Note: The S3 bucket also has lifecycle policies configured to automatically delete files:
- Input files after 24 hours
- Output files after 48 hours

This Lambda function provides:
1. **Monitoring**: Detailed logs and metrics on cleanup operations
2. **Manual control**: Ability to trigger cleanup on-demand
3. **Validation**: Ensures lifecycle policies are working correctly
4. **Alerting**: Can trigger alarms if cleanup fails

## Testing

Run unit tests:
```bash
npm test src/voice-processor/audio-cleanup-service.test.ts
```

## Manual Invocation

To manually trigger cleanup:

```bash
aws lambda invoke \
  --function-name maitri-audio-cleanup \
  --region ap-south-1 \
  response.json
```

## Troubleshooting

### No files being deleted

1. Check if files exist in the bucket:
   ```bash
   aws s3 ls s3://maitri-voice-files/input/ --recursive
   ```

2. Verify file ages:
   ```bash
   aws s3api list-objects-v2 \
     --bucket maitri-voice-files \
     --prefix input/ \
     --query 'Contents[*].[Key,LastModified]'
   ```

3. Check Lambda logs:
   ```bash
   aws logs tail /aws/lambda/maitri-audio-cleanup --follow
   ```

### Permission errors

Verify the Lambda execution role has required S3 permissions:
```bash
aws iam get-role-policy \
  --role-name maitri-audio-cleanup-role \
  --policy-name S3AccessPolicy
```

## Future Enhancements

- Add metrics for storage space reclaimed
- Implement dry-run mode for testing
- Add support for archiving files to Glacier before deletion
- Implement notification on large cleanup operations
