import Homey from 'homey';

class HDashboardsCompanionApp extends Homey.App {

  sendNotificationCard: Homey.FlowCardAction|undefined;
  sendPersistentNotificationCard: Homey.FlowCardAction|undefined;

  async onInit() {
    this.sendNotificationCard = this.homey.flow.getActionCard('send-notification-to-hdashboards');
    this.sendNotificationCard.registerRunListener(this.sendNotificationToHDashboards.bind(this));

    this.sendPersistentNotificationCard = this.homey.flow.getActionCard('send-persistent-notification-to-hdashboards');
    this.sendPersistentNotificationCard.registerRunListener(this.sendPersistentNotificationToHDashboards.bind(this));

    this.log('HDashboards companion app has been initialized');
  }

  private sendNotificationToHDashboards(args: any, stats: any) {
    this.homey.api.realtime('hdashboards:notification', args);
  }

  private sendPersistentNotificationToHDashboards(args: any, stats: any) {
    this.homey.api.realtime('hdashboards:persistent-notification', args);
  }

}

module.exports = HDashboardsCompanionApp;
