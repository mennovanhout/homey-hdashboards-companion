import Homey from 'homey';
import axios from 'axios';

interface ColorMemory {
  [key: string]: string | null;
}

class HDashboardsCompanionApp extends Homey.App {

  openDashboards: string[] = [];

  setOptionCard: Homey.FlowCardAction|undefined;
  sendNotificationCard: Homey.FlowCardAction|undefined;
  sendImageNotificationCard: Homey.FlowCardAction|undefined;
  sendPersistentNotificationCard: Homey.FlowCardAction|undefined;
  sendImagePersistentNotificationCard: Homey.FlowCardAction|undefined;
  setCardBackgroundColor: Homey.FlowCardAction|undefined;
  resetCardBackgroundColor: Homey.FlowCardAction|undefined;
  openDashboardForUser: Homey.FlowCardAction|undefined;
  openDashboardForUserTag: Homey.FlowCardAction|undefined;
  refreshDashboardForUser: Homey.FlowCardAction|undefined;
  dashboardIsOpenForUser: Homey.FlowCardCondition|undefined;
  dashboardHasOpened: Homey.FlowCardTrigger|undefined;
  anyDashboardHasOpened: Homey.FlowCardTrigger|undefined;
  aDashboardCardIsPressed: Homey.FlowCardTrigger|undefined;
  colorMemory: ColorMemory = {};

  async onInit() {
    this.setOptionCard = this.homey.flow.getActionCard('hd-set-option-to');
    this.setOptionCard.registerRunListener(this.sendOptionUpdateToHDashboards.bind(this));

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

    this.openDashboardForUserTag = this.homey.flow.getActionCard('open-dashboard-for-user-tag');
    this.openDashboardForUserTag.registerArgumentAutocompleteListener('dashboard', this.dashboardAutocompleteListener.bind(this));
    this.openDashboardForUserTag.registerRunListener(async (args, state) => {
      args.user = {
        id: args.droptoken,
        description: args.droptoken,
        name: 'Unknown',
      };

      this.sendOpenDashboardCommand(args, state);
    });

    this.refreshDashboardForUser = this.homey.flow.getActionCard('refresh-dashboard-for-user');
    this.refreshDashboardForUser.registerArgumentAutocompleteListener('user', this.userAutocompleteListener.bind(this));
    this.refreshDashboardForUser.registerRunListener(this.sendRefreshDashboardCommand.bind(this));

    this.dashboardIsOpenForUser = this.homey.flow.getConditionCard('dashboard-is-open-for-user');
    this.dashboardIsOpenForUser.registerArgumentAutocompleteListener('user', this.userAutocompleteListener.bind(this));
    this.dashboardIsOpenForUser.registerArgumentAutocompleteListener('dashboard', this.dashboardAutocompleteListener.bind(this));
    this.dashboardIsOpenForUser.registerRunListener(async (args, state) => {
      this.homey.api.realtime('hdashboards:is-dashboard-open', {
        dashboard: args.dashboard.id,
        user: args.user.id,
      });

      // wait 3 seconds
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check if is open
      if (this.openDashboards.includes(args.dashboard.id)) {
        // remove all dashboard id's from array
        this.openDashboards = this.openDashboards.filter((dashboard) => {
          return dashboard !== args.dashboard.id;
        });

        return true;
      }

      return false;
    });

    this.dashboardHasOpened = this.homey.flow.getTriggerCard('hdashboards-opened');
    this.dashboardHasOpened.registerArgumentAutocompleteListener('user', this.userAutocompleteListener.bind(this));
    this.dashboardHasOpened.registerArgumentAutocompleteListener('dashboard', this.dashboardAutocompleteListener.bind(this));
    this.dashboardHasOpened.registerRunListener(async (args, state) => {
      return args.dashboard.id === state.dashboard && (args.user.id === 'everyone' || args.user.id === state.user);
    });

    this.anyDashboardHasOpened = this.homey.flow.getTriggerCard('any-dashboard-is-opened');
    this.anyDashboardHasOpened.registerRunListener(async (args, state) => {
      return true;
    });

    this.aDashboardCardIsPressed = this.homey.flow.getTriggerCard('a-dashboard-card-with-identifier-is-pressed');
    this.aDashboardCardIsPressed.registerRunListener(async (args, state) => {
      return args.identifier === state.identifier;
    });

    // Start listening for webhook
    const id = Homey.env.WEBHOOK_ID;
    const secret = Homey.env.WEBHOOK_SECRET;

    const myWebhook = await this.homey.cloud.createWebhook(id, secret, {});
    myWebhook.on('message', async (message: any) => {
      if (message.body.event === 'hdashboards:clear-cache') {
        this.colorMemory = {};
      }

      if (message.body.event === 'hdashboards:opened-dashboard') {
        await this.anyDashboardHasOpened!.trigger({
          'opened-by-user': message.body.data.user,
          'dashboard-name': message.body.data.dashboardName,
        }, message.body.data);

        await this.dashboardHasOpened!.trigger({
          'opened-by-user': message.body.data.user,
        }, message.body.data);
      }

      if (message.body.event === 'hdashboards:has-dashboard-open') {
        this.openDashboards.push(message.body.data.dashboard);
      }

      if (message.body.event === 'hdashboards:on-tap') {
        await this.aDashboardCardIsPressed!.trigger({
          user: message.body.data.user,
          pincode: message.body.data.pincode ?? 'false',
        }, message.body.data);
      }
    });

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
          id: result.email,
        };
      });

      results.unshift({
        name: 'Anyone/Everyone',
        description: 'All users / Any user',
        id: 'everyone',
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

    // trim
    args.identifier = args.identifier.trim().toLowerCase();

    // Get colors
    const colors = this.homey.settings.get('colors') ?? {};

    // Update
    colors[args.identifier] = args.backgroundColor;

    // Save
    this.homey.settings.set('colors', colors);

    // Send over socket
    this.homey.api.realtime('hdashboards:card-color', args);

    return true;
  }

  private async sendOptionUpdateToHDashboards(args: any, stats: any) {
    // Get options
    const options = this.homey.settings.get('options') ?? {};

    args.identifier = args.identifier.trim().toLowerCase();

    // Update
    if (!options[args.identifier]) {
      options[args.identifier] = {};
    }
    options[args.identifier][args.option] = args.value;

    // Save
    this.homey.settings.set('options', options);

    // Send over socket
    this.homey.api.realtime('hdashboards:card-settings', args);

    return true;
  }

}

module.exports = HDashboardsCompanionApp;
