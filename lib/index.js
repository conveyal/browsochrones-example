/** the main entry point for the Browsochrones example */

import React, { Component } from 'react'
import { Marker, TileLayer, Map as LeafletMap, GeoJson } from 'react-leaflet'
import { Browser } from 'leaflet'
import { render } from 'react-dom'
import fetch from 'isomorphic-fetch'
import uuid from 'uuid'
import Browsochrones from 'browsochrones'
import TransitiveLayer from './transitive-layer'

const BOSTON = [42.358056, -71.063611]
const BOSTON_COMMON = [42.355, -71.065556]
const LIFE_ALIVE = [42.366639, -71.105435]
const WORKER_VERSION = 'v1.5.0'
const TRANSPORT_NETWORK_ID = '523c1aa4d0104e4eaeb1b6dab4e14e80'
const SCENARIO = {
  id: '0',
  modifications: []
}

const BASE_URL = 'api/enqueue/single'

export default class BrowsochronesExample extends Component {
  /** This stores the data used to draw the map */
  state = {
    transitive: null,
    isochrone: null,
    key: null,
    origin: BOSTON_COMMON,
    destination: LIFE_ALIVE,
    staticRequest: {
      jobId: uuid.v4(),
      transportNetworkId: TRANSPORT_NETWORK_ID,
      request: {
        date: '2016-09-27',
        fromTime: 25200,
        toTime: 32400,
        accessModes: 'WALK',
        directModes: 'WALK',
        egressModes: 'WALK',
        transitModes: 'WALK,TRANSIT',
        walkSpeed: 1.3888888888888888,
        bikeSpeed: 4.166666666666667,
        carSpeed: 20,
        streetTime: 90,
        maxWalkTime: 20,
        maxBikeTime: 20,
        maxCarTime: 45,
        minBikeTime: 10,
        minCarTime: 10,
        suboptimalMinutes: 5,
        reachabilityThreshold: 0,
        bikeSafe: 1,
        bikeSlope: 1,
        bikeTime: 1,
        maxRides: 8,
        bikeTrafficStress: 4,
        boardingAssumption: 'RANDOM',
        monteCarloDraws: 220,
        scenario: SCENARIO
      }
    }
  }

  /** The browsochrones instance used to create isochrones */
  browsochrones = new Browsochrones()

  /** This fetches the stop trees and query metadata */
  fetchMetadata = () => {
    let { staticRequest } = this.state

    // TODO handle 202

    Promise.all([
      fetch(`${BASE_URL}`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'static-metadata',
          graphId: TRANSPORT_NETWORK_ID,
          workerVersion: WORKER_VERSION,
          request: staticRequest
        })
      }).then(res => res.json()),
      fetch(`${BASE_URL}`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'static-stop-trees',
          graphId: TRANSPORT_NETWORK_ID,
          workerVersion: WORKER_VERSION,
          request: staticRequest
        })
      }).then(res => res.arrayBuffer())
    ])
    .then(([metadata, stopTrees]) => {
      this.browsochrones.setQuery(metadata)
      this.browsochrones.setStopTrees(stopTrees)
      this.browsochrones.setTransitiveNetwork(metadata.transitiveData)
    })
  }

  moveOrigin = (e) => {
    let origin = e.target.getLatLng()
    let { x, y } = this.browsochrones.latLonToOriginPoint(origin)
    let { staticRequest } = this.state

    return fetch(BASE_URL, {
      method: 'POST',
      body: JSON.stringify({
        type: 'static',
        request: staticRequest,
        workerVersion: WORKER_VERSION,
        graphId: TRANSPORT_NETWORK_ID,
        x,
        y
      })
    }).then(res => res.arrayBuffer())
    .then(async (buff) => {
      await this.browsochrones.setOrigin(buff, { x, y })
      await this.browsochrones.generateSurface(60) // 60 minutes
      let isochrone = await this.browsochrones.getIsochrone(60)
      this.setState({...this.state, isochrone, key: uuid.v4(), origin})
    })
  }

  moveDestination = async (e) => {
    let origin = e.target.getLatLng()
    let { x, y } = this.browsochrones.latLonToOriginPoint(origin)

    let { transitive } = await this.browsochrones.generateDestinationData({ x, y })

    this.setState({ ...this.state, transitive, key: uuid.v4() })
  }

  componentDidMount () {
    this.fetchMetadata()
  }

  /** This function renders the map */
  render () {
    let { transitive, isochrone, key, origin, destination } = this.state
    return <div>
      <LeafletMap center={BOSTON} zoom={13} detectRetina>
        <TileLayer
          url={`https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}${Browser.retina ? '@2x' : ''}.png`}
          attribution='&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

        { isochrone && <GeoJson
          style={{ fill: '#dfe', fillOpacity: 0.5 }}
          data={isochrone}
          key={`iso-${key}`}
          />}

        { transitive && <TransitiveLayer data={transitive} key={`transitive-${key}`} /> }

        <Marker
          position={origin}
          draggable
          onDragend={this.moveOrigin}
          />
        <Marker
          position={destination}
          draggable
          onDragend={this.moveDestination}
          />
      </LeafletMap>
    </div>
  }
}

render(<BrowsochronesExample />, document.getElementById('root'))
