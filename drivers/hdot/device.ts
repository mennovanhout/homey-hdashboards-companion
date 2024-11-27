import Homey from 'homey';
import { Connection } from '@2colors/esphome-native-api';

module.exports = class MyDevice extends Homey.Device {

  nameToKey: { [key: string]: number } = {};
  keyToName: { [key: number]: string } = {};

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('HDot has been initialized');

    // Crete client
    const client = new Connection({
      host: this.getStore()['host'],
      port: 6053,
    });

    // Connect
    await client.connect();

    // On authorized
    client.on('authorized', async () => {
      this.log('authorized');

      const entities = await client.listEntitiesService();

      entities.forEach((entity) => {
        if (entity.entity.name === 'LED Ring') {
          // @ts-ignore
          const effects = entity.entity.effectsList;

          const options = {
            values: effects.map((effect: string) => {
              return {
                id: effect,
                title: {
                  en: effect
                }
              };
            }),
          };

          this.setCapabilityOptions('hdot_effects_capability', options);
        }

        this.nameToKey[entity.entity.name] = entity.entity.key;
        this.keyToName[entity.entity.key] = entity.entity.name;
      });

      // Subscribe to states
      // @ts-ignore
      client.subscribeStatesService();
    });

    client.on('error', (error) => this.log(error));

    client.on('message.LightStateResponse', (state) => {
      if (state.effect != this.getCapabilityValue('hdot_effects_capability')) {
        this.homey.flow.getDeviceTriggerCard('hdot-the-effect-changed').trigger(this, {
          effect: state.effect
        });
      }

      this.setCapabilityValue('onoff', state.state);
      this.setCapabilityValue('dim', state.brightness);
      this.setCapabilityValue('light_hue', this.rgbToHue(state));
      this.setCapabilityValue('light_saturation', this.calculateSaturation(state.red, state.green, state.blue));
      this.setCapabilityValue('hdot_effects_capability', state.effect);
    });

    client.on('message.BinarySensorStateResponse', (state) => {
      const name = this.keyToName[state.key];

      if (name === 'Button') {
        this.setCapabilityValue('hdot_button_capability', state.state);

        if (state.state) {
          this.homey.flow.getDeviceTriggerCard('hdot-button-pressed').trigger(this);
        }
      }

      if (name === 'Clockwise') {
        this.setCapabilityValue('hdot_clockwise_capability', state.state);

        if (state.state) {
          this.homey.flow.getDeviceTriggerCard('hdot-rotate-clockwise').trigger(this);
        }
      }

      if (name === 'Anti Clockwise') {
        this.setCapabilityValue('hdot_anti_clockwise_capability', state.state);

        if (state.state) {
          this.homey.flow.getDeviceTriggerCard('hdot-rotate-anti-clockwise').trigger(this);
        }
      }
    });

    // Homey listeners

    // On off
    this.registerCapabilityListener('onoff', async (value) => {
      if (!client.connected || !client.authorized) {
        return;
      }

      client.lightCommandService({
        key: this.nameToKey['LED Ring'],
        state: value,
      });
    });

    // Dim
    this.registerCapabilityListener('dim', async (value) => {
      if (!client.connected || !client.authorized) {
        return;
      }

      client.lightCommandService({
        key: this.nameToKey['LED Ring'],
        brightness: value,
      });
    });

    // Effect
    this.registerCapabilityListener('hdot_effects_capability', async (value) => {
      if (!client.connected || !client.authorized) {
        return;
      }

      await this.homey.flow.getDeviceTriggerCard('hdot-the-effect-changed').trigger(this, {
        effect: value
      });

      client.lightCommandService({
        key: this.nameToKey['LED Ring'],
        effect: value,
      });
    });

    // Light hue
    this.registerCapabilityListener('light_hue', async (value) => {
      if (!client.connected || !client.authorized) {
        return;
      }

        const rgb = this.hueToRgb(value);

      client.lightCommandService({
        key: this.nameToKey['LED Ring'],
        red: rgb.red,
        green: rgb.green,
        blue: rgb.blue,
      });
    });

    // Light saturation
    this.registerCapabilityListener('light_saturation', async (value) => {
      if (!client.connected || !client.authorized) {
        return;
      }

      const rgb = this.hueToRgb(this.getCapabilityValue('light_hue'));

      let [h, s, v] = this.rgbToHsv(rgb.red, rgb.green, rgb.blue);
      s = value;
      let [newRed, newGreen, newBlue] = this.hsvToRgb(h!, s!, v!);

      client.lightCommandService({
        key: this.nameToKey['LED Ring'],
        red: newRed,
        green: newGreen,
        blue: newBlue,
      });
    });
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('MyDevice has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log('MyDevice settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('MyDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('MyDevice has been deleted');
  }

  rgbToHue(data: any) {
    // Extract the RGB values
    const { red, green, blue } = data;

    // Ensure RGB values are between 0 and 1
    if (red < 0 || red > 1 || green < 0 || green > 1 || blue < 0 || blue > 1) {
      throw new Error("RGB values must be between 0 and 1");
    }

    // Find the max and min RGB values
    const cMax = Math.max(red, green, blue);
    const cMin = Math.min(red, green, blue);
    const delta = cMax - cMin;

    let hue = 0; // Default hue

    if (delta === 0) {
      hue = 0; // Gray color
    } else if (cMax === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (cMax === green) {
      hue = 60 * (((blue - red) / delta) + 2);
    } else if (cMax === blue) {
      hue = 60 * (((red - green) / delta) + 4);
    }

    // Ensure hue is positive and within 0-360 degrees
    hue = (hue < 0) ? hue + 360 : hue;

    return hue / 360;
  }

  hueToRgb(hue: number) {
    // Ensure hue is between 0 and 1
    if (hue < 0 || hue > 1) {
      throw new Error("Hue must be between 0 and 1");
    }

    // Convert hue from [0, 1] to [0, 360] degrees
    const scaledHue = hue * 360;

    // Calculate intermediate RGB values based on the hue
    const c = 1; // Chroma for pure hue
    const x = c * (1 - Math.abs((scaledHue / 60) % 2 - 1)); // Match color intensity
    const m = 0; // Offset for colors (since we normalize to [0, 1])

    let red = 0, green = 0, blue = 0;

    if (scaledHue >= 0 && scaledHue < 60) {
      red = c; green = x; blue = 0;
    } else if (scaledHue >= 60 && scaledHue < 120) {
      red = x; green = c; blue = 0;
    } else if (scaledHue >= 120 && scaledHue < 180) {
      red = 0; green = c; blue = x;
    } else if (scaledHue >= 180 && scaledHue < 240) {
      red = 0; green = x; blue = c;
    } else if (scaledHue >= 240 && scaledHue < 300) {
      red = x; green = 0; blue = c;
    } else if (scaledHue >= 300 && scaledHue < 360) {
      red = c; green = 0; blue = x;
    }

    // Add the offset and ensure values are between 0 and 1
    red = red + m;
    green = green + m;
    blue = blue + m;

    return { red, green, blue };
  }

  rgbToHsv(r: number, g: number, b: number) {
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;

    let d = max - min;
    s = max === 0 ? 0 : d / max;

    if (max === min) {
      h = 0; // achromatic
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h! /= 6;
    }

    return [h, s, v];
  }

  hsvToRgb(h: number, s: number, v: number) {
    let r, g, b;

    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);

    switch (i % 6) {
      case 0: r = v, g = t, b = p; break;
      case 1: r = q, g = v, b = p; break;
      case 2: r = p, g = v, b = t; break;
      case 3: r = p, g = q, b = v; break;
      case 4: r = t, g = p, b = v; break;
      case 5: r = v, g = p, b = q; break;
    }

    return [r, g, b];
  }

  calculateSaturation(red: number, green: number, blue: number) {
    // Find max and min of RGB values
    let max = Math.max(red, green, blue);
    let min = Math.min(red, green, blue);

    // Calculate saturation
    return max === 0 ? 0 : (max - min) / max;
  }

};
