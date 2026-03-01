/**
 * Reminder Service Lambda Handler
 * 
 * Manages reminder creation, storage, scheduling, and delivery.
 * Integrates with EventBridge for scheduled reminders.
 * 
 * Validates: Requirements 10.1-10.6
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { KMSClient } from '@aws-sdk/client-kms';
import { ReminderService, ReminderServiceConfig } from './reminder-service';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const eventBridgeClient = new EventBridgeClient({ region: process.env.AWS_REGION });
const kmsClient = new KMSClient({ region: process.env.AWS_REGION });

const config: ReminderServiceConfig = {
  remindersTableName: process.env.REMINDERS_TABLE_NAME || 'MaitriReminders',
  kmsKeyId: process.env.KMS_KEY_ID || '',
  eventBusName: 'default',
  maxFutureYears: 1,
};

const reminderService = new ReminderService(config, docClient, eventBridgeClient, kmsClient);

export interface CreateReminderEvent {
  action: 'create';
  userId: string;
  phoneNumber: string;
  reminderText: string;
  scheduledTime: number;
  languageCode: string;
}

export interface CancelReminderEvent {
  action: 'cancel';
  reminderId: string;
  userId: string;
}

export interface ListRemindersEvent {
  action: 'list';
  userId: string;
}

export interface DeliverReminderEvent {
  action: 'deliver';
  reminderId: string;
}

export type ReminderEvent = CreateReminderEvent | CancelReminderEvent | ListRemindersEvent | DeliverReminderEvent;

export const handler = async (event: ReminderEvent): Promise<any> => {
  try {
    switch (event.action) {
      case 'create':
        return await reminderService.createReminder({
          userId: event.userId,
          phoneNumber: event.phoneNumber,
          reminderText: event.reminderText,
          scheduledTime: event.scheduledTime,
          languageCode: event.languageCode,
        });

      case 'cancel':
        return await reminderService.cancelReminder(event.reminderId, event.userId);

      case 'list':
        return await reminderService.listReminders(event.userId);

      case 'deliver':
        return await reminderService.deliverReminder(event.reminderId);

      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('Reminder service error:', error);
    throw error;
  }
};
