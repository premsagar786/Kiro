import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface MaitriLambdaStackProps extendck {
  public readonly audioCleanupFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: MaitriLambdaStackProps) {
    super(scope, id, props);

    // ========================================
    // Audio Cleanup Lambda Function
    // ========================================
    this.audioCleanupFunction = new lambda.Function(this, 'AudioCleanupFunction', {
      functionName: 'maitri-audio-cleanup',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/audio-cleanup'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        VOICE_BUCKET_NAME: props.voiceBucket.bucketName,
      },
      description: 'Scheduled Lambda to delete expired voice files from S3',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant S3 permissions to list and delete objects
    props.voiceBucket.grantRead(this.audioCleanupFunction);
    props.voiceBucket.grantDelete(this.audioCleanupFunction);

    // ========================================
    // EventBridge Rule for Scheduled Cleanup
    // ========================================
    // Run cleanup every hour
    const cleanupRule = new events.Rule(this, 'AudioCleanupScheduleRule', {
      ruleName: 'maitri-audio-cleanup-schedule',
      description: 'Triggers audio cleanup Lambda every hour',
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      enabled: true,
    });

    // Add Lambda as target
    cleanupRule.addTarget(new targets.LambdaFunction(this.audioCleanupFunction, {
      retryAttempts: 2,
    }));

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'AudioCleanupFunctionArn', {
      value: this.audioCleanupFunction.functionArn,
      description: 'ARN of the audio cleanup Lambda function',
      exportName: 'MaitriAudioCleanupFunctionArn',
    });

    new cdk.CfnOutput(this, 'AudioCleanupScheduleRuleName', {
      value: cleanupRule.ruleName,
      description: 'Name of the EventBridge rule for audio cleanup',
      exportName: 'MaitriAudioCleanupScheduleRuleName',
    });

    // ========================================
    // Stack Tags
    // ========================================
    cdk.Tags.of(this).add('Project', 'MaitriAI');
    cdk.Tags.of(this).add('Component', 'AudioCleanup');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
