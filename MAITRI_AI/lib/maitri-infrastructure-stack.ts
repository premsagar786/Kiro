import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';

export class MaitriInfrastructureStack extends cdk.Stack {
  public readonly encryptionKey: kms.Key;
  public readonly voiceBucket: s3.Bucket;
  public readonly usersTable: dynamodb.Table;
  public readonly faqTable: dynamodb.Table;
  public readonly remindersTable: dynamodb.Table;
  public readonly whatsappSecret: secretsmanager.Secret;
  public readonly governmentApiSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // KMS Encryption Key with Automatic Rotation
    // ========================================
    this.encryptionKey = new kms.Key(this, 'MaitriEncryptionKey', {
      description: 'KMS key for encrypting Maitri AI data at rest',
      enableKeyRotation: true, // Automatic annual rotation
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Retain key on stack deletion for security
      alias: 'maitri-ai-encryption-key',
    });

    // Output the key ARN
    new cdk.CfnOutput(this, 'EncryptionKeyArn', {
      value: this.encryptionKey.keyArn,
      description: 'ARN of the KMS encryption key',
      exportName: 'MaitriEncryptionKeyArn',
    });

    // ========================================
    // S3 Bucket for Voice Files
    // ========================================
    this.voiceBucket = new s3.Bucket(this, 'MaitriVoiceFilesBucket', {
      bucketName: `maitri-voice-files-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Retain bucket on stack deletion
      autoDeleteObjects: false,
      
      // CORS configuration for WhatsApp webhook URLs
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ['*'], // Restrict in production to WhatsApp domains
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],

      // Lifecycle policies
      lifecycleRules: [
        {
          id: 'DeleteInputVoiceFilesAfter24Hours',
          enabled: true,
          prefix: 'input/',
          expiration: cdk.Duration.hours(24),
        },
        {
          id: 'DeleteOutputVoiceFilesAfter48Hours',
          enabled: true,
          prefix: 'output/',
          expiration: cdk.Duration.hours(48),
        },
      ],
    });

    // Output the bucket name
    new cdk.CfnOutput(this, 'VoiceBucketName', {
      value: this.voiceBucket.bucketName,
      description: 'Name of the S3 bucket for voice files',
      exportName: 'MaitriVoiceBucketName',
    });

    // ========================================
    // DynamoDB Table: Users
    // ========================================
    this.usersTable = new dynamodb.Table(this, 'MaitriUsersTable', {
      tableName: 'MaitriUsers',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Auto-scaling
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Retain user data
      
      // Stream for change data capture (optional for future use)
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI: PhoneNumberIndex for lookup by phone number
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'PhoneNumberIndex',
      partitionKey: {
        name: 'phoneNumber',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Output the table name
    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      description: 'Name of the Users DynamoDB table',
      exportName: 'MaitriUsersTableName',
    });

    // ========================================
    // DynamoDB Table: FAQ
    // ========================================
    this.faqTable = new dynamodb.Table(this, 'MaitriFAQTable', {
      tableName: 'MaitriFAQ',
      partitionKey: {
        name: 'faqId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'languageCode',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI: CategoryIndex for querying by category
    this.faqTable.addGlobalSecondaryIndex({
      indexName: 'CategoryIndex',
      partitionKey: {
        name: 'category',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'accessCount',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Output the table name
    new cdk.CfnOutput(this, 'FAQTableName', {
      value: this.faqTable.tableName,
      description: 'Name of the FAQ DynamoDB table',
      exportName: 'MaitriFAQTableName',
    });

    // ========================================
    // DynamoDB Table: Reminders
    // ========================================
    this.remindersTable = new dynamodb.Table(this, 'MaitriRemindersTable', {
      tableName: 'MaitriReminders',
      partitionKey: {
        name: 'reminderId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.encryptionKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      
      // TTL for automatic cleanup (7 days after scheduled time)
      timeToLiveAttribute: 'ttl',
    });

    // GSI: UserRemindersIndex for listing user's reminders
    this.remindersTable.addGlobalSecondaryIndex({
      indexName: 'UserRemindersIndex',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'scheduledTime',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Output the table name
    new cdk.CfnOutput(this, 'RemindersTableName', {
      value: this.remindersTable.tableName,
      description: 'Name of the Reminders DynamoDB table',
      exportName: 'MaitriRemindersTableName',
    });

    // ========================================
    // Secrets Manager: WhatsApp API Credentials
    // ========================================
    this.whatsappSecret = new secretsmanager.Secret(this, 'MaitriWhatsAppSecret', {
      secretName: 'maitri/whatsapp/api-credentials',
      description: 'WhatsApp Business API credentials for Maitri AI',
      encryptionKey: this.encryptionKey,
      
      // Template for secret value (to be filled manually or via CLI)
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          apiKey: 'PLACEHOLDER',
          webhookVerifyToken: 'PLACEHOLDER',
          phoneNumberId: 'PLACEHOLDER',
          businessAccountId: 'PLACEHOLDER',
        }),
        generateStringKey: 'generatedPassword',
      },
    });

    // Configure automatic rotation (90 days)
    // Note: Rotation Lambda needs to be implemented separately
    // this.whatsappSecret.addRotationSchedule('RotationSchedule', {
    //   automaticallyAfter: cdk.Duration.days(90),
    // });

    // Output the secret ARN
    new cdk.CfnOutput(this, 'WhatsAppSecretArn', {
      value: this.whatsappSecret.secretArn,
      description: 'ARN of the WhatsApp API credentials secret',
      exportName: 'MaitriWhatsAppSecretArn',
    });

    // ========================================
    // Secrets Manager: Government API Credentials
    // ========================================
    this.governmentApiSecret = new secretsmanager.Secret(this, 'MaitriGovernmentApiSecret', {
      secretName: 'maitri/government-apis/credentials',
      description: 'Government API credentials for Maitri AI',
      encryptionKey: this.encryptionKey,
      
      // Template for secret value
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          pmKisanApi: {
            apiKey: 'PLACEHOLDER',
            baseUrl: 'https://api.gov.in/pmkisan',
          },
          ayushmanBharatApi: {
            apiKey: 'PLACEHOLDER',
            baseUrl: 'https://api.gov.in/ayushman',
          },
          digitalIndiaApi: {
            apiKey: 'PLACEHOLDER',
            baseUrl: 'https://api.gov.in/digitalindia',
          },
        }),
        generateStringKey: 'generatedPassword',
      },
    });

    // Output the secret ARN
    new cdk.CfnOutput(this, 'GovernmentApiSecretArn', {
      value: this.governmentApiSecret.secretArn,
      description: 'ARN of the Government API credentials secret',
      exportName: 'MaitriGovernmentApiSecretArn',
    });

    // ========================================
    // CloudWatch Log Groups
    // ========================================
    const logGroups = [
      'whatsapp-webhook-handler',
      'request-orchestrator',
      'voice-processor',
      'language-detector',
      'ai-engine',
      'rag-system',
      'faq-engine',
      'reminder-service',
      'pwa-backend',
    ];

    logGroups.forEach((logGroupName) => {
      new logs.LogGroup(this, `${logGroupName}LogGroup`, {
        logGroupName: `/aws/lambda/${logGroupName}`,
        retention: logs.RetentionDays.ONE_MONTH, // 30-day retention
        encryptionKey: this.encryptionKey,
        removalPolicy: cdk.RemovalPolicy.DESTROY, // Clean up logs on stack deletion
      });
    });

    // ========================================
    // IAM Role for Lambda Functions (Base Role)
    // ========================================
    // This is a base role that can be extended by specific Lambda functions
    const lambdaBaseRole = new iam.Role(this, 'MaitriLambdaBaseRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Base IAM role for Maitri AI Lambda functions',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant KMS permissions
    this.encryptionKey.grantEncryptDecrypt(lambdaBaseRole);

    // Output the role ARN
    new cdk.CfnOutput(this, 'LambdaBaseRoleArn', {
      value: lambdaBaseRole.roleArn,
      description: 'ARN of the base IAM role for Lambda functions',
      exportName: 'MaitriLambdaBaseRoleArn',
    });

    // ========================================
    // Stack Tags
    // ========================================
    cdk.Tags.of(this).add('Project', 'MaitriAI');
    cdk.Tags.of(this).add('Environment', 'Production');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
