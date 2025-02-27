import connectToStores from 'fluxible-addons-react/connectToStores';
import PropTypes from 'prop-types';
import React from 'react';
import { intlShape } from 'react-intl';
import { ReactRelayContext } from 'react-relay';
import GridLayer from 'react-leaflet/es/GridLayer';
import SphericalMercator from '@mapbox/sphericalmercator';
import lodashFilter from 'lodash/filter';
import isEqual from 'lodash/isEqual';
import Popup from 'react-leaflet/es/Popup';
import { withLeaflet } from 'react-leaflet/es/context';
import { matchShape, routerShape } from 'found';
import { mapLayerShape } from '../../../store/MapLayerStore';
import MarkerSelectPopup from './MarkerSelectPopup';
import LocationPopup from '../popups/LocationPopup';
import TileContainer from './TileContainer';
import { isFeatureLayerEnabled } from '../../../util/mapLayerUtils';
import RealTimeInformationStore from '../../../store/RealTimeInformationStore';
import { addAnalyticsEvent } from '../../../util/analyticsUtils';
import { getClientBreakpoint } from '../../../util/withBreakpoint';
import {
  PREFIX_BIKESTATIONS,
  PREFIX_STOPS,
  PREFIX_TERMINALS,
  PREFIX_CARPARK,
  PREFIX_BIKEPARK,
} from '../../../util/path';
import SelectVehicleContainer from './SelectVehicleContainer';

const initialState = {
  selectableTargets: undefined,
  coords: undefined,
  showSpinner: true,
};

// TODO eslint doesn't know that TileLayerContainer is a react component,
//      because it doesn't inherit it directly. This will force the detection
/** @extends React.Component */
class TileLayerContainer extends GridLayer {
  static propTypes = {
    tileSize: PropTypes.number.isRequired,
    zoomOffset: PropTypes.number.isRequired,
    locationPopup: PropTypes.string, // all, none, reversegeocoding, origindestination
    onSelectLocation: PropTypes.func,
    mergeStops: PropTypes.bool,
    mapLayers: mapLayerShape.isRequired,
    leaflet: PropTypes.shape({
      map: PropTypes.shape({
        addLayer: PropTypes.func.isRequired,
        addEventParent: PropTypes.func.isRequired,
        closePopup: PropTypes.func.isRequired,
        removeEventParent: PropTypes.func.isRequired,
        _popup: PropTypes.shape({
          isOpen: PropTypes.func,
        }),
      }).isRequired,
    }).isRequired,
    relayEnvironment: PropTypes.object.isRequired,
    hilightedStops: PropTypes.arrayOf(PropTypes.string),
    stopsToShow: PropTypes.arrayOf(PropTypes.string),
    vehicles: PropTypes.object,
  };

  static contextTypes = {
    getStore: PropTypes.func.isRequired,
    intl: intlShape.isRequired,
    config: PropTypes.object.isRequired,
    match: matchShape.isRequired,
    router: routerShape.isRequired,
  };

  PopupOptions = {
    offset: [0, 0],
    autoPanPaddingTopLeft: [5, 125],
    className: 'popup',
    ref: 'popup',
    onClose: () => this.setState({ ...initialState }),
    autoPan: false,
    onOpen: () => this.sendAnalytics(),
    relayEnvironment: PropTypes.object.isRequired,
  };

  merc = new SphericalMercator({
    size: this.props.tileSize || 256,
  });

  constructor(props, context) {
    super(props, context);
    // Required as it is not passed upwards through the whole inherittance chain
    this.context = context;
    this.state = {
      ...initialState,
    };
    this.leafletElement.createTile = this.createTile;
  }

  componentDidMount() {
    super.componentDidMount();
    this.context.getStore('TimeStore').addChangeListener(this.onTimeChange);
    this.props.leaflet.map.addEventParent(this.leafletElement);
    this.leafletElement.on('click contextmenu', this.onClick);
  }

  componentDidUpdate(prevProps) {
    if (this.context.popupContainer != null) {
      this.context.popupContainer.openPopup();
    }
    if (!isEqual(prevProps.mapLayers, this.props.mapLayers)) {
      this.leafletElement.redraw();
    }
    if (!isEqual(prevProps.hilightedStops, this.props.hilightedStops)) {
      this.leafletElement.redraw();
    }
  }

  componentWillUnmount() {
    this.context.getStore('TimeStore').removeChangeListener(this.onTimeChange);
    this.leafletElement.off('click contextmenu', this.onClick);
  }

  onTimeChange = e => {
    let activeTiles;

    if (e.currentTime) {
      /* eslint-disable no-underscore-dangle */
      activeTiles = lodashFilter(
        this.leafletElement._tiles,
        tile => tile.active,
      );
      /* eslint-enable no-underscore-dangle */
      activeTiles.forEach(
        tile =>
          tile.el.layers &&
          tile.el.layers.forEach(layer => {
            if (layer.onTimeChange) {
              layer.onTimeChange();
            }
          }),
      );
    }
  };

  onClick = e => {
    /* eslint-disable no-underscore-dangle */
    Object.keys(this.leafletElement._tiles)
      .filter(key => this.leafletElement._tiles[key].active)
      .filter(key => this.leafletElement._keyToBounds(key).contains(e.latlng))
      .forEach(key =>
        this.leafletElement._tiles[key].el.onMapClick(
          e,
          this.merc.px(
            [e.latlng.lng, e.latlng.lat],
            Number(key.split(':')[2]) + this.props.zoomOffset,
          ),
        ),
      );
    /* eslint-enable no-underscore-dangle */
  };

  createTile = (tileCoords, done) => {
    const tile = new TileContainer(
      tileCoords,
      done,
      this.props,
      this.context.config,
      this.props.mergeStops,
      this.props.relayEnvironment,
      this.props.hilightedStops,
      this.props.vehicles,
      this.props.stopsToShow,
    );
    tile.onSelectableTargetClicked = (
      selectableTargets,
      coords,
      forceOpen = false,
    ) => {
      const {
        leaflet: { map },
        mapLayers,
      } = this.props;
      const { coords: prevCoords } = this.state;
      const popup = map._popup; // eslint-disable-line no-underscore-dangle
      // navigate to citybike stop page if single stop is clicked
      if (
        selectableTargets.length === 1 &&
        selectableTargets[0].layer === 'citybike'
      ) {
        this.context.router.push(
          `/${PREFIX_BIKESTATIONS}/${encodeURIComponent(
            selectableTargets[0].feature.properties.id,
          )}`,
        );
        return;
      }
      // ... Or to stop page
      if (
        selectableTargets.length === 1 &&
        selectableTargets[0].layer === 'stop'
      ) {
        const prefix = selectableTargets[0].feature.properties.stops
          ? PREFIX_TERMINALS
          : PREFIX_STOPS;
        this.context.router.push(
          `/${prefix}/${encodeURIComponent(
            selectableTargets[0].feature.properties.gtfsId,
          )}`,
        );
        return;
      }
      if (
        selectableTargets.length === 1 &&
        selectableTargets[0].layer === 'parkAndRide' &&
        (selectableTargets[0].feature.properties.facility ||
          selectableTargets[0].feature.properties.facilities.length === 1)
      ) {
        const carParkId =
          selectableTargets[0].feature.properties?.facility?.carParkId ||
          selectableTargets[0].feature.properties?.facilities[0]?.carParkId;
        if (carParkId) {
          this.context.router.push(
            `/${PREFIX_CARPARK}/${encodeURIComponent(carParkId)}`,
          );
          return;
        }
      }
      if (
        selectableTargets.length === 1 &&
        selectableTargets[0].layer === 'parkAndRideForBikes' &&
        selectableTargets[0].feature.properties.facility
      ) {
        this.context.router.push(
          `/${PREFIX_BIKEPARK}/${encodeURIComponent(
            selectableTargets[0].feature.properties.facility.bikeParkId,
          )}`,
        );
        return;
      }
      if (
        popup &&
        popup.isOpen() &&
        (!forceOpen || (coords && coords.equals(prevCoords)))
      ) {
        map.closePopup();
        return;
      }

      this.setState({
        selectableTargets: selectableTargets.filter(
          target =>
            target.layer === 'realTimeVehicle' ||
            isFeatureLayerEnabled(target.feature, target.layer, mapLayers),
        ),
        coords,
      });
    };

    return tile.el;
  };

  selectRow = option => this.setState({ selectableTargets: [option] });

  /**
   * Send an analytics event on opening popup
   */
  sendAnalytics() {
    let name = null;
    let type = null;
    if (this.state.selectableTargets.length === 0) {
      return;
      // event for clicking somewhere else on the map will be handled in LocationPopup
    }
    if (this.state.selectableTargets.length === 1) {
      const target = this.state.selectableTargets[0];
      const { properties } = target.feature;
      name = target.layer;
      switch (name) {
        case 'stop':
          ({ type } = properties);
          if (properties.stops) {
            type += '_TERMINAL';
          }
          break;
        default:
          break;
      }
    } else {
      name = 'multiple';
    }
    const pathPrefixMatch = window.location.pathname.match(/^\/([a-z]{2,})\//);
    const context =
      pathPrefixMatch && pathPrefixMatch[1] !== this.context.config.indexPath
        ? pathPrefixMatch[1]
        : 'index';
    addAnalyticsEvent({
      action: 'SelectMapPoint',
      category: 'Map',
      name,
      type,
      source: context,
    });
  }

  render() {
    let popup = null;
    let latlng = this.state.coords;
    let contents;
    const breakpoint = getClientBreakpoint(); // DT-3470
    let showPopup = true; // DT-3470

    if (typeof this.state.selectableTargets !== 'undefined') {
      if (this.state.selectableTargets.length === 1) {
        let id;
        if (
          this.state.selectableTargets[0].layer === 'parkAndRide' &&
          this.state.selectableTargets[0].feature.properties.facilityIds
        ) {
          id = this.state.selectableTargets[0].feature.properties.facilityIds;
          contents = (
            <MarkerSelectPopup
              selectRow={this.selectRow}
              options={this.state.selectableTargets}
              colors={this.context.config.colors}
            />
          );
        } else if (
          this.state.selectableTargets[0].layer === 'realTimeVehicle'
        ) {
          const { vehicle } = this.state.selectableTargets[0].feature;
          const realTimeInfoVehicle = this.props.vehicles[vehicle.id];
          if (realTimeInfoVehicle) {
            latlng = {
              lat: realTimeInfoVehicle.lat,
              lng: realTimeInfoVehicle.long,
            };
          }
          this.PopupOptions.className = 'vehicle-popup';

          contents = <SelectVehicleContainer vehicle={vehicle} />;
        }
        popup = (
          <Popup
            {...this.PopupOptions}
            key={id}
            position={latlng}
            className={`${this.PopupOptions.className} ${
              this.PopupOptions.className === 'vehicle-popup'
                ? 'single-popup'
                : 'choice-popup'
            }`}
          >
            {contents}
          </Popup>
        );
      } else if (this.state.selectableTargets.length > 1) {
        if (
          !this.context.config.map.showStopMarkerPopupOnMobile &&
          breakpoint === 'small'
        ) {
          // DT-3470
          showPopup = false;
        }
        popup = (
          <Popup
            key={this.state.coords.toString()}
            {...this.PopupOptions}
            position={this.state.coords}
            maxWidth="300px"
            className={`${this.PopupOptions.className} choice-popup`}
          >
            <MarkerSelectPopup
              selectRow={this.selectRow}
              options={this.state.selectableTargets}
              colors={this.context.config.colors}
            />
          </Popup>
        );
      } else if (this.state.selectableTargets.length === 0) {
        if (
          !this.context.config.map.showStopMarkerPopupOnMobile &&
          breakpoint === 'small'
        ) {
          // DT-3470
          showPopup = false;
        }
        popup = this.props.locationPopup !== 'none' && (
          <Popup
            key={this.state.coords.toString()}
            {...this.PopupOptions}
            maxHeight={220}
            maxWidth="auto"
            position={this.state.coords}
            className={`${this.PopupOptions.className} ${
              this.props.locationPopup === 'all'
                ? 'single-popup'
                : 'narrow-popup'
            }`}
          >
            <LocationPopup
              lat={this.state.coords.lat}
              lon={this.state.coords.lng}
              onSelectLocation={this.props.onSelectLocation}
              locationPopup={this.props.locationPopup}
            />
          </Popup>
        );
      }
    }

    return showPopup ? popup : null;
  }
}

const connectedComponent = withLeaflet(
  connectToStores(
    props => (
      <ReactRelayContext.Consumer>
        {({ environment }) => (
          <TileLayerContainer {...props} relayEnvironment={environment} />
        )}
      </ReactRelayContext.Consumer>
    ),
    [RealTimeInformationStore],
    context => ({
      vehicles: context.getStore(RealTimeInformationStore).vehicles,
    }),
  ),
);

export { connectedComponent as default, TileLayerContainer as Component };
