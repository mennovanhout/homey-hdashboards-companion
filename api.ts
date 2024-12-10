module.exports = {
    async getColors({ homey, query }: { homey: any; query: any }) {
        return JSON.stringify(homey.settings.get('colors') || {});
    },

    async getOptions({ homey, query }: { homey: any; query: any }) {
        return JSON.stringify(homey.settings.get('options') || {});
    },
};
