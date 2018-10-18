import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';

import defaultConfig from '../../app/configurations/config.default';
import * as utils from '../../app/util/planParamUtil';
import { setCustomizedSettings } from '../../app/store/localStorage';

const from = 'Kera, Espoo::60.217992,24.75494';
const to = 'Leppävaara, Espoo::60.219235,24.81329';
const defaultProps = [
  {
    from,
    to,
  },
  { location: { query: {} } },
];

describe('planParamUtil', () => {
  afterEach(() => {
    global.localStorage.clear();
  });

  describe('preparePlanParams', () => {
    it('should return mode defaults from config if modes are missing from both the current URI and localStorage', () => {
      const config = {
        modeToOTP: {
          bus: 'bus',
          walk: 'walk',
        },
        streetModes: {
          walk: {
            availableForSelection: true,
            defaultValue: true,
            icon: 'walk',
          },
        },
        transportModes: {
          bus: {
            availableForSelection: true,
            defaultValue: true,
          },
        },
      };
      const params = utils.preparePlanParams(config)(...defaultProps);
      const { modes } = params;
      expect(modes).to.equal('BUS,WALK');
    });

    it('should use the optimize mode from query', () => {
      const params = utils.preparePlanParams(defaultConfig)(
        {
          from,
          to,
        },
        {
          location: {
            query: {
              optimize: 'GREENWAYS',
            },
          },
        },
      );
      const { optimize } = params;

      expect(optimize).to.equal('GREENWAYS');
    });

    it('should use the preferred routes from query', () => {
      const params = utils.preparePlanParams(defaultConfig)(
        {
          from,
          to,
        },
        {
          location: {
            query: {
              preferredRoutes: 'HSL__1052',
            },
          },
        },
      );
      const { preferred } = params;
      expect(preferred).to.deep.equal({ routes: 'HSL__1052' });
    });

    it('should use the unpreferred routes from query', () => {
      const params = utils.preparePlanParams(defaultConfig)(
        {
          from,
          to,
        },
        {
          location: {
            query: {
              unpreferredRoutes: 'HSL__7480',
            },
          },
        },
      );
      const { unpreferred } = params;
      expect(unpreferred).to.deep.equal({ routes: 'HSL__7480' });
    });

    it('should use the preferred routes from localStorage', () => {
      setCustomizedSettings({ preferredRoutes: 'HSL__1052' });
      const params = utils.preparePlanParams(defaultConfig)(...defaultProps);
      const { preferred } = params;
      expect(preferred).to.deep.equal({ routes: 'HSL__1052' });
    });

    it('should use the preferred routes from localStorage', () => {
      setCustomizedSettings({ unpreferredRoutes: 'HSL__7480' });
      const params = utils.preparePlanParams(defaultConfig)(...defaultProps);
      const { unpreferred } = params;
      expect(unpreferred).to.deep.equal({ routes: 'HSL__7480' });
    });

    it('should use bikeSpeed from query', () => {
      const params = utils.preparePlanParams(defaultConfig)(
        {
          from,
          to,
        },
        { location: { query: { bikeSpeed: 20 } } },
      );
      const { bikeSpeed } = params;
      expect(bikeSpeed).to.equal(20);
    });

    it('should use bikeSpeed from localStorage', () => {
      setCustomizedSettings({ bikeSpeed: 20 });
      const params = utils.preparePlanParams(defaultConfig)(...defaultProps);
      const { bikeSpeed } = params;
      expect(bikeSpeed).to.equal(20);
    });

    it('should replace the old ticketTypes separator "_" with ":" in query', () => {
      const params = utils.preparePlanParams(defaultConfig)(
        {
          from,
          to,
        },
        {
          location: { query: { ticketTypes: 'HSL_esp' } },
        },
      );
      const { ticketTypes } = params;
      expect(ticketTypes).to.equal('HSL:esp');
    });

    it('should replace the old ticketTypes separator "_" with ":" in localStorage', () => {
      setCustomizedSettings({ ticketTypes: 'HSL_esp' });
      const params = utils.preparePlanParams(defaultConfig)(
        {
          from,
          to,
        },
        {
          location: { query: {} },
        },
      );
      const { ticketTypes } = params;
      expect(ticketTypes).to.equal('HSL:esp');
    });

    it('should return null if no ticketTypes are found from query or localStorage', () => {
      const params = utils.preparePlanParams(defaultConfig)(
        {
          from,
          to,
        },
        {
          location: { query: {} },
        },
      );
      const { ticketTypes } = params;
      expect(ticketTypes).to.equal(null);
    });

    it('should use ticketTypes from localStorage if no ticketTypes are found from query', () => {
      setCustomizedSettings({ ticketTypes: 'HSL:esp' });
      const params = utils.preparePlanParams(defaultConfig)(
        {
          from,
          to,
        },
        {
          location: { query: {} },
        },
      );
      const { ticketTypes } = params;
      expect(ticketTypes).to.equal('HSL:esp');
    });

    it('should return null if ticketTypes is "none" in query', () => {
      const params = utils.preparePlanParams(defaultConfig)(
        {
          from,
          to,
        },
        {
          location: { query: { ticketTypes: 'none' } },
        },
      );
      const { ticketTypes } = params;
      expect(ticketTypes).to.equal(null);
    });

    it('should return null if ticketTypes is missing from query and "none" in localStorage', () => {
      setCustomizedSettings({ ticketTypes: 'none' });
      const params = utils.preparePlanParams(defaultConfig)(
        {
          from,
          to,
        },
        {
          location: { query: {} },
        },
      );
      const { ticketTypes } = params;
      expect(ticketTypes).to.equal(null);
    });

    it('should return null if ticketTypes is "none" in both query and localStorage', () => {
      setCustomizedSettings({ ticketTypes: 'none' });
      const params = utils.preparePlanParams(defaultConfig)(
        {
          from,
          to,
        },
        {
          location: { query: { ticketTypes: 'none' } },
        },
      );
      const { ticketTypes } = params;
      expect(ticketTypes).to.equal(null);
    });

    it('should return null if ticketTypes is undefined in query', () => {
      const params = utils.preparePlanParams(defaultConfig)(
        {
          from,
          to,
        },
        {
          location: { query: { ticketTypes: undefined } },
        },
      );
      const { ticketTypes } = params;
      expect(ticketTypes).to.equal(null);
    });

    it('should return null if ticketTypes is missing from query and undefined in localStorage', () => {
      setCustomizedSettings({ ticketTypes: undefined });
      const params = utils.preparePlanParams(defaultConfig)(
        {
          from,
          to,
        },
        {
          location: { query: {} },
        },
      );
      const { ticketTypes } = params;
      expect(ticketTypes).to.equal(null);
    });

    it('should return null if ticketTypes is undefined in both query and localStorage', () => {
      setCustomizedSettings({ ticketTypes: undefined });
      const params = utils.preparePlanParams(defaultConfig)(
        {
          from,
          to,
        },
        {
          location: { query: { ticketTypes: undefined } },
        },
      );
      const { ticketTypes } = params;
      expect(ticketTypes).to.equal(null);
    });
  });

  describe('getDefaultSettings', () => {
    it('should include a modes array', () => {
      const defaultSettings = utils.getDefaultSettings(defaultConfig);
      expect(Array.isArray(defaultSettings.modes)).to.equal(true);
    });
  });
});
