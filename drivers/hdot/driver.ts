import Homey, {Device} from 'homey';
import bonjour from 'bonjour';

module.exports = class MyDriver extends Homey.Driver {

  async onInit() {
    this.log('MyDriver has been initialized');

    const hdotEffectIsSetTo = this.homey.flow.getConditionCard('hdot-effect-is-set-to');
    hdotEffectIsSetTo.registerArgumentAutocompleteListener('effect' , this.effectsAutocompleteListener.bind(this));
    hdotEffectIsSetTo.registerRunListener(async (args, state) => {
      const device: Device = args.device;
      const effectId = args.effect.id;

      const value = await device.getCapabilityValue('hdot_effects_capability');
      return value === effectId;
    });

    const hdotSetEffectTo = this.homey.flow.getActionCard('hdot-set-effect-to');
    hdotSetEffectTo.registerArgumentAutocompleteListener('effect' , this.effectsAutocompleteListener.bind(this));
    hdotSetEffectTo.registerRunListener(this.onFlowActionSetEffectTo.bind(this));
  }

  async onPairListDevices() {
    const test = bonjour();

    const services: any[] = [];

    test.find({ type: 'hdashboards' }, (service) => {
      services.push({
        name: service.name,
        data: {
          id: service.txt.build,
        },
        store: {
          host: service.host,
        },
      });
    });

    // wait 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return services;
  }

    async onFlowActionSetEffectTo (args: any) {
      const device: Device = args.device;
      const effectId = args.effect.id;

      await device.triggerCapabilityListener('hdot_effects_capability', effectId);
    }

  async effectsAutocompleteListener (query: string, args: any) {
      const device: Device = args.device;
      const options = await device.getCapabilityOptions('hdot_effects_capability');

      const results = options.values.map((option: any) => {
        return {
          id: option.id,
          name: option.title.en,
        };
      });

      return results.filter((result: any) => result.name.toLowerCase().includes(query.toLowerCase()));
    };

};
