import Homey from 'homey';
import axios from 'axios';

interface ColorMemory {
  [key: string]: string | null;
}

class HDashboardsCompanionApp extends Homey.App {

  sendNotificationCard: Homey.FlowCardAction|undefined;
  sendImageNotificationCard: Homey.FlowCardAction|undefined;
  sendPersistentNotificationCard: Homey.FlowCardAction|undefined;
  sendImagePersistentNotificationCard: Homey.FlowCardAction|undefined;
  setCardBackgroundColor: Homey.FlowCardAction|undefined;
  resetCardBackgroundColor: Homey.FlowCardAction|undefined;
  openDashboardForUser: Homey.FlowCardAction|undefined;
  refreshDashboardForUser: Homey.FlowCardAction|undefined;
  colorMemory: ColorMemory = {};

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

    this.openDashboardForUser = this.homey.flow.getActionCard('open-dashboard-for-user');
    this.openDashboardForUser.registerArgumentAutocompleteListener('user', this.userAutocompleteListener.bind(this));
    this.openDashboardForUser.registerArgumentAutocompleteListener('dashboard', this.dashboardAutocompleteListener.bind(this));
    this.openDashboardForUser.registerRunListener(this.sendOpenDashboardCommand.bind(this));

    this.openDashboardForUser = this.homey.flow.getActionCard('refresh-dashboard-for-user');
    this.openDashboardForUser.registerArgumentAutocompleteListener('user', this.userAutocompleteListener.bind(this));
    this.openDashboardForUser.registerRunListener(this.sendRefreshDashboardCommand.bind(this));

    this.log('HDashboards companion app has been initialized');
  }

  private sendRefreshDashboardCommand(query: string, args: any) {
    const key = this.homey.settings.get('key');

    if (key === undefined || key === null || key === '') {
      throw new Error('Please enter a key in app settings');
    }

    this.homey.api.realtime('hdashboards:refresh-dashboard', query);
  }

  private sendOpenDashboardCommand(query: string, args: any) {
    const key = this.homey.settings.get('key');

    if (key === undefined || key === null || key === '') {
      throw new Error('Please enter a key in app settings');
    }

    this.homey.api.realtime('hdashboards:open-dashboard', query);
  }

  private async userAutocompleteListener(query: string, args: any) {
    const key = this.homey.settings.get('key');

    if (key === undefined || key === null || key === '') {
      throw new Error('Please enter a key in app settings');
    }

    try {
      const data = await axios.get('https://hdashboards.app/companion-api/users', {
        headers: {
          'x-api-key': key,
        },
      });

      const results = data.data.map((result: any) => {
        return {
          name: `${result.first_name} ${result.last_name}`,
          description: result.email,
          id: result.id,
        };
      });

      return results.filter((result: any) => {
        return result.name.toLowerCase().includes(query.toLowerCase());
      });
    } catch (error) {
      // @ts-ignore
      throw new Error(error.message);
    }
  }

  private async dashboardAutocompleteListener(query: string, args: any) {
    const key = this.homey.settings.get('key');

    if (key === undefined || key === null || key === '') {
      throw new Error('Please enter a key in app settings');
    }

    try {
      const data = await axios.get('https://hdashboards.app/companion-api/dashboards', {
        headers: {
          'x-api-key': key,
        },
      });

      const results = data.data.map((result: any) => {
        return {
          name: result.name,
          id: result.uuid,
        };
      });

      return results.filter((result: any) => {
        return result.name.toLowerCase().includes(query.toLowerCase());
      });
    } catch (error) {
      // @ts-ignore
      throw new Error(error.message);
    }
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

    // Check if the color is the same as the previous one
    if (this.colorMemory[args.identifier] === args.backgroundColor) {
      return true;
    }

    // Save color
    this.colorMemory[args.identifier] = args.backgroundColor;

    // Send over socket
    this.homey.api.realtime('hdashboards:card-color', args);

    // get key
    const key = this.homey.settings.get('key');

    if (key === undefined || key === null || key === '') {
      throw new Error('Please enter a key in app settings');
    }

    // Send to cloud
    try {
      await axios.post('https://hdashboards.app/companion-api/card/background-color', {
        key,
        identifier: args.identifier,
        backgroundColor: args.backgroundColor,
      });
    } catch (error) {
      // @ts-ignore
      throw new Error(error.message);
    }
    return true;
  }

}

module.exports = HDashboardsCompanionApp;
