# Maitri AI Voice Assistant - Infrastructure

This directory contains the AWS CDK infrastructure code for the Maitri AI Voice Assistant system.

## Overview

The infrastructure includes:

- **KMS Encryption Key**: Customer-managed key with automatic annual rotation for encrypting data at rest
- **S3 Bucket**: Storage for voice files with lifecycle policies (24h for input, 48h for output)
- **DynamoDB Tables**:
  - Users: User profiles and preferences with PhoneNumberIndex GSI
  - FAQ: Frequently asked questions with CategoryIndex GSI
  - Reminders: User reminders with UserRemindersIndex GSI and TTL
- **Secrets Manager**: Secure storage for WhatsApp and Government API credentials
- **CloudWatch Log Groups**: Centralized logging with 30-day retention for all Lambda functions

## Prerequisites

- Node.js 20.x or later
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed globally: `npm install -g aws-cdk`

## Installation

1. Install dependencies:
```bash
npm install
```

2. Bootstrap CDK (first time only):
```bash
cdk bootstrap
```

## Deployment

1. Build the TypeScript code:
```bash
npm run build
```

2. Synthesize the CloudFormation template:
```bash
npm run synth
```

3. Deploy the stack:
```bash
npm run deploy
```

## Configuration

### Secrets Setup

After deployment, you need to update the placeholder values in Secrets Manager:

1. **WhatsApp API Credentials** (`maitri/whatsapp/api-credentials`):
```bash
aws secretsmanager update-secret \
  --secret-id maitri/whatsapp/api-credentials \
  --secret-string '{
    "apiKey": "YOUR_WHATSAPP_API_KEY",
    "webhookVerifyToken": "YOUR_WEBHOOK_VERIFY_TOKEN",
    "phoneNumberId": "YOUR_PHONE_NUMBER_ID",
    "businessAccountId": "YOUR_BUSINESS_ACCOUNT_ID"
  }'
```

2. **Government API Credentials** (`maitri/government-apis/credentials`):
```bash
aws secretsmanager update-secret \
  --secret-id maitri/government-apis/credentials \
  --secret-string '{
    "pmKisanApi": {
      "apiKey": "YOUR_PM_KISAN_API_KEY",
      "baseUrl": "https://api.gov.in/pmkisan"
    },
    "ayushmanBharatApi": {
      "apiKey": "YOUR_AYUSHMAN_BHARAT_API_KEY",
      "baseUrl": "https://api.gov.in/ayushman"
    },
    "digitalIndiaApi": {
      "apiKey": "YOUR_DIGITAL_INDIA_API_KEY",
      "baseUrl": "https://api.gov.in/digitalindia"
    }
  }'
```

## Stack Outputs

After deployment, the following outputs are available:

- `EncryptionKeyArn`: ARN of the KMS encryption key
- `VoiceBucketName`: Name of the S3 bucket for voice files
- `UsersTableName`: Name of the Users DynamoDB table
- `FAQTableName`: Name of the FAQ DynamoDB table
- `RemindersTableName`: Name of the Reminders DynamoDB table
- `WhatsAppSecretArn`: ARN of the WhatsApp credentials secret
- `GovernmentApiSecretArn`: ARN of the Government API credentials secret
- `LambdaBaseRoleArn`: ARN of the base IAM role for Lambda functions

## Security Features

- **Encryption at Rest**: All data encrypted using customer-managed KMS key
- **Encryption in Transit**: HTTPS/TLS enforced for all communications
- **Automatic Key Rotation**: KMS key rotates automatically every year
- **Point-in-Time Recovery**: Enabled for all DynamoDB tables
- **Block Public Access**: S3 bucket blocks all public access
- **Least Privilege**: IAM roles follow principle of least privilege

## Lifecycle Policies

- **Input Voice Files**: Automatically deleted after 24 hours
- **Output Voice Files**: Automatically deleted after 48 hours
- **Reminders**: Automatically deleted 7 days after scheduled time (TTL)
- **CloudWatch Logs**: Retained for 30 days

## Cost Optimization

- **DynamoDB**: On-demand billing mode for automatic scaling
- **S3**: Lifecycle policies to minimize storage costs
- **CloudWatch Logs**: 30-day retention to balance observability and cost

## Cleanup

To delete the stack and all resources:

```bash
cdk destroy
```

**Note**: Resources with `RETAIN` removal policy (KMS key, DynamoDB tables, S3 bucket) will not be deleted and must be removed manually if needed.

## Requirements Mapping

This infrastructure satisfies the following requirements:

- **13.1**: IAM roles with least privilege principle
- **13.3**: API keys and secrets stored in AWS Secrets Manager
- **14.1**: Data encrypted at rest using AWS KMS
- **14.2**: Data encrypted in transit using TLS
- **16.5**: CloudWatch log groups with 30-day retention

## Next Steps

After deploying the infrastructure:

1. Update secrets with actual API credentials
2. Implement Lambda functions for core services
3. Set up API Gateway for WhatsApp webhook and PWA backend
4. Configure EventBridge for reminder scheduling
5. Deploy the Progressive Web Application
