#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MaitriInfrastructureStack } from '../lib/maitri-infrastructure-stack';
import { MaitriLambdaStack } from '../lib/maitri-lambda-stack';

const app = new cdk.App();

const infraStack = new MaitriInfrastructureStack(app, 'MaitriInfrastructureStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-south-1', // Mumbai region for India
  },
  description: 'AWS infrastructure for Maitri AI Voice Assistant',
});

new MaitriLambdaStack(app, 'MaitriLambdaStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-south-1',
  },
  description: 'Lambda functions for Maitri AI Voice Assistant',
  voiceBucket: infraStack.voiceBucket,
});

app.synth();
