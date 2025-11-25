import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AlertsService } from '../modules/alerts/alerts.service';
import { NotificationsService } from '../modules/notifications/notifications.service';

@Injectable()
export class AlertCheckerWorker {
  private readonly logger = new Logger(AlertCheckerWorker.name);

  constructor(
    private alertsService: AlertsService,
    private notificationsService: NotificationsService,
  ) {}

  // Run every minute
  @Cron('*/1 * * * *')
  async checkAlerts() {
    this.logger.debug('Checking active alerts...');

    try {
      const activeAlerts = await this.alertsService.getActiveAlerts();
      this.logger.debug(`Found ${activeAlerts.length} active alerts`);

      for (const alert of activeAlerts) {
        try {
          const triggered = await this.alertsService.checkAlert(alert);

          if (triggered) {
            this.logger.log(
              `Alert triggered: ${alert.name} for user ${alert.userId}`,
            );

            // Send notification
            await this.sendAlertNotification(alert);
          }
        } catch (error) {
          this.logger.error(
            `Error checking alert ${alert._id}: ${error.message}`,
          );
        }
      }

      this.logger.debug('Alert checking completed');
    } catch (error) {
      this.logger.error(`Alert checking error: ${error.message}`);
    }
  }

  private async sendAlertNotification(alert: any) {
    try {
      const symbolName = alert.symbolId?.name || '종목';
      const message = `[주식 알림] ${symbolName}\n${alert.name}\n조건이 충족되었습니다.`;

      await this.notificationsService.sendNotification(
        alert.userId.toString(),
        message,
        alert.notificationChannels || ['sms'],
      );

      this.logger.log(`Notification sent for alert ${alert._id}`);
    } catch (error) {
      this.logger.error(
        `Error sending notification for alert ${alert._id}: ${error.message}`,
      );
    }
  }

  // Manual trigger method
  async checkNow() {
    await this.checkAlerts();
  }
}


