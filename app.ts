import Homey from 'homey';
import axios from 'axios';

class HDashboardsCompanionApp extends Homey.App {

  sendNotificationCard: Homey.FlowCardAction|undefined;
  sendImageNotificationCard: Homey.FlowCardAction|undefined;
  sendPersistentNotificationCard: Homey.FlowCardAction|undefined;
  sendImagePersistentNotificationCard: Homey.FlowCardAction|undefined;
  setCardBackgroundColor: Homey.FlowCardAction|undefined;
  resetCardBackgroundColor: Homey.FlowCardAction|undefined;

  async onInit() {
    this.sendNotificationCard = this.homey.flow.getActionCard('send-notification-to-hdashboards');
    this.sendNotificationCard.registerRunListener(this.sendNotificationToHDashboards.bind(this));

    this.sendImageNotificationCard = this.homey.flow.getActionCard('send-notification-to-hdashboards-with-image');
    this.sendImageNotificationCard.registerRunListener(this.sendNotificationToHDashboards.bind(this));

    this.sendPersistentNotificationCard = this.homey.flow.getActionCard('send-persistent-notification-to-hdashboards');
    this.sendPersistentNotificationCard.registerRunListener(this.sendPersistentNotificationToHDashboards.bind(this));

    this.sendImagePersistentNotificationCard = this.homey.flow.getActionCard('send-persistent-notification-to-hdashboards-with-image');
    this.sendImagePersistentNotificationCard.registerRunListener(this.sendPersistentNotificationToHDashboards.bind(this));

    this.setCardBackgroundColor = this.homey.flow.getActionCard('set-card-background-color');
    this.setCardBackgroundColor.registerRunListener(this.sendSetCardBackgroundColorToHDashboards.bind(this));

    this.resetCardBackgroundColor = this.homey.flow.getActionCard('reset-card-background-color');
    this.resetCardBackgroundColor.registerRunListener(this.sendSetCardBackgroundColorToHDashboards.bind(this));

    this.log('HDashboards companion app has been initialized');
  }

  private sendNotificationToHDashboards(args: any, stats: any) {
    if (args.droptoken) {
      args.image = args.droptoken.cloudUrl;
    }

    delete args.droptoken;

    this.homey.api.realtime('hdashboards:notification', args);
  }

  private sendPersistentNotificationToHDashboards(args: any, stats: any) {
    if (args.droptoken) {
      args.image = args.droptoken.cloudUrl;
    }

    delete args.droptoken;

    this.homey.api.realtime('hdashboards:persistent-notification', args);
  }

  private async sendSetCardBackgroundColorToHDashboards(args: any, stats: any) {
    if (!args.backgroundColor) {
      args.backgroundColor = null;
    }

    // Send over socket
    this.homey.api.realtime('hdashboards:card-color', args);

    const homeyProId = await this.homey.cloud.getHomeyId();

    // Send to cloud
    try {
      await axios.post('https://hdashboards.app/companion-api/card/background-color', {
        homey_pro_id: homeyProId,
        identifier: args.identifier,
        backgroundColor: args.backgroundColor,
      });
    } catch (error) {
      // @ts-ignore
      throw new Error(error.message);
      return false;
    }
    return true;
  }

}

module.exports = HDashboardsCompanionApp;
