React             = require 'react'
Relay             = require 'react-relay'
queries           = require '../../queries'
StopCardContainer = require '../stop-cards/stop-card-container'
StopCardList      = require '../stop-cards/stop-card-list'
config            = require '../../config'

STOP_COUNT = 5
DEPARTURES_COUNT = 5

class FavouriteStopCardListContainer extends React.Component

  proptypes: {
    stops: React.PropTypes.any.isRequired
  }

  getStopCards: =>
    stopCards = []
    for stop in @props.stops.stops
      console.log stop
      stopCards.push <StopCardContainer key={stop.gtfsId} stop={{stop:stop}} departures=DEPARTURES_COUNT />
    stopCards

  render: =>
    <StopCardList addStops=false>
    	{@getStopCards()}
    </StopCardList>

module.exports = Relay.createContainer(FavouriteStopCardListContainer,
  fragments: queries.FavouriteStopListContainerFragments
  initialVariables:
    ids: null
)
