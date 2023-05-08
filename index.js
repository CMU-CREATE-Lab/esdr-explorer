import {MapOverlay} from "./mapsplode/mapOverlay.js"
import {ETP} from "./mapsplode/embeddedTilePlotter.js"
import {ESDR, TiledDataEvaluator} from "./mapsplode/esdrFeeds.js"
import * as grapher from "./mapsplode/monolithicGrapher.js"


let gMap // google map instance
let esdr = new ESDR() // interface to ESDR data
let explorer = {
  statusInfo: {
    numFeedsReceived: 0,
    numSearchResults: 0,
  },
  results: [],
  plots: new Map(),
  showFilters: true,
  showResults: true,
  showSettings: true,
  showExperimentalSettings: false,
  showSparklines: false,
  colorMapDots: false,
  feedMarkerColorizers: new Map(),
  plotAreaHeightPercent: 40,
  minPlotAreaHeightPercent: 20,
  maxPlotAreaHeightPercent: 80,
  plotHeight: 5,
  minPlotHeight: 2,
  maxPlotHeight: 20,
  lineStyle: {
    "styles": [
      // {
      //   "type": "bar",
      //   "stripPosition": "center",
      //   "stripWidthSecs": 30,
      //   "rangedColors": "rgba(210,210,210,.8); 10;rgba(185,185,185,.8); 20;rgba(160,160,160,.8); 30;rgba(135,135,135,.8); 40;rgba(110,110,110,.8); 50;rgba(110,110,110,.8);60;rgba(85,85,85,.8);70;rgba(70,70,70,.8);80;rgba(50,50,50,.8)"
      // },
      {
        "type": "line",
        "lineWidth": 1,
        "show": true,
        "color": "rgba(60,60,60, .8)"
      },
      {
        "type": "circle",
        "radius": 1,
        "lineWidth": 1,
        "show": true,
        "color": "#000000",
        "fill": false
      },
    ],
    "highlight": {
      "lineWidth": 2,
      "styles": [{
          "show": true,
          "type": "lollipop",
          "color": "green",
          "radius": 0,
          "lineWidth": 1,
          "fill": false
        },
        {
          "type": "circle",
          "radius": 3,
          "lineWidth": 0.5,
          "show": true,
          "color": "#ff0000",
          "fill": true
        },
        {
          "show": true,
          "type": "value",
          "fillColor": "#000000",
          "marginWidth": 10,
          "font": "9pt Helvetica,Arial,Verdana,sans-serif",
          "verticalOffset": 7
        }
      ]
    }
  },

}

function initMap() {
  // parse the url hash part
  parseUrlParams()
  // execute params
  // if (explorer.showResults)
  //   showSearchResults()

  // // FIXME: showSearchFilters() with a small delay, otherwise the margin computation gets confused. maybe this could be done with less hackery?
  // if (explorer.showFilters)
  //   setTimeout(explorer.showSearchFilters, 300)

  // if (explorer.showSettings)
  //   setTimeout(explorer.showSearchSettings, 600)

  let mapdiv = document.getElementById('googlemap');
  gMap = new google.maps.Map(
    document.getElementById('googlemap'),
    {
      zoom: parseInt(explorer.zoom) || 5,
      center: explorer.center || new google.maps.LatLng(40.4406, -79.9959),

      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,

      mapTypeControlOptions: {
        position: google.maps.ControlPosition.TOP_RIGHT,
      },

      styles: [
        {
          "featureType": "poi",
          "elementType": "labels.text",
          "stylers": [{
            "visibility": "off"
          }]
        },
        {
          "featureType": "road",
          "elementType": "labels.icon",
          "stylers": [{
            "visibility": "off"
          }]
        }, 
        {
          "featureType": "road",
          "elementType": "geometry.stroke",
          "stylers": [{
            "visibility": "off"
          }]
        }, 
        {
          "featureType": "road.highway",
          "elementType": "geometry.fill",
          "stylers": [{
            "color": "#bbbbbb"
          }]
        }, 
        {
          "featureType": "road"
        }, 
        {
          "featureType": "road",
          "elementType": "labels.text.fill",
          "stylers": [{
            "color": "#888888"
          }]
        }, {
          "featureType": "administrative",
          "elementType": "labels.text.fill",
          "stylers": [{
            "color": "#606060"
          }]
        },
        {
          "featureType": "administrative.locality",
          "elementType": "labels.icon",
          "stylers": [{
            "visibility": "off"
          }]
        },
        {
          "featureType": "road",
          "elementType": "geometry",
          "stylers": [{
              "lightness": 100
            },
            {
              "visibility": "simplified"
            }
          ]
        },
        {
          "featureType": "water",
          "elementType": "geometry",
          "stylers": [{
              "visibility": "on"
            },
            {
              "color": "#C6E2FF"
            }
          ]
        },
        {
          "featureType": "poi",
          "elementType": "geometry.fill",
          "stylers": [{
            "color": "#C5E3BF"
          }]
        },
        {
          "featureType": "road",
          "elementType": "geometry.fill",
          "stylers": [{
            "color": "#D1D1B8"
          }]
        }
      ],
    }
  );

  explorer.mapOverlay = new MapOverlay(gMap, mapdiv)


  google.maps.event.addListener(gMap, 'bounds_changed', function() {
    // console.log(`bounds_changed event to ${map.getBounds()}`);


    if (explorer.deferredMapBoundsUpdateTimer)
      clearTimeout(explorer.deferredMapBoundsUpdateTimer)

    explorer.deferredMapBoundsUpdateTimer = setTimeout(explorer.deferredMapBoundsUpdateCallback, 500, gMap)

  })

  google.maps.event.addListener(gMap, 'mousemove', function(event) {
    let geo = {lat: event.latLng.lat(), lng: event.latLng.lng()}
    let feedIds = explorer.mapOverlay.highlightMarkersAtGeo(geo, true)
    // let feedIds = explorer.mapOverlay.highlightMarkersAtPixel(event.pixel, true)
    this.setOptions({
      draggableCursor: (feedIds.length > 0 ? 'default' :  null)
    });

    explorer.highlightPlotsForFeeds(feedIds)

  })

  google.maps.event.addListener(gMap, 'click', function(event) {
    if (!explorer.mapOverlay.markers)
      return

    let geo = {lat: event.latLng.lat(), lng: event.latLng.lng()}

    explorer.mapOverlay.highlightMarkersAtGeo(geo, true)


    let div = document.createElement("div")
    // div.setAttribute("class", "search-result-channel-block")

    let highlightedFeedIds = Array.from(explorer.mapOverlay.markers.highlightedFeeds).sort()

    for (let feedId of highlightedFeedIds) {
      let feed = esdr.feeds.get(feedId)
      let feedDiv = searchResultsDivForFeed(feedId)
      if (feed && feed.channelBounds && feed.channelBounds.channels)
      {
        let channelDivs = []
        for (let channelName in feed.channelBounds.channels) {
          let chdiv = searchResultsDivForChannel(feedId, channelName, "infoWindow")
          channelDivs.push(chdiv)
        }

        for (let chdiv of channelDivs) {
          feedDiv.appendChild(chdiv)
        }
      }
      div.appendChild(feedDiv)

    }

    if (this.infoWindow)
      this.infoWindow.close()

    if (highlightedFeedIds.length > 0) {
      let eventGeoCoords = explorer.mapOverlay.viewPixelToGeoCoords(event.pixel)
      this.infoWindow = new google.maps.InfoWindow({
        content: div,
        position: eventGeoCoords,
      })
      this.infoWindow.open(gMap)
    }
  })

  let bounds = gMap.getBounds()
  explorer.mapBounds = bounds
  esdr.updateQuery({mapBounds: bounds})

  // inform mapOverlay of selected items
  for (let channelId of esdr.selectedChannelIds) {
    let feedId = parseInt(channelId.slice(0, channelId.indexOf(".")))
    explorer.mapOverlay.selectFeed(feedId, true)
  }


  // install search response events
  // onchange is when user presses enter
  let searchInput = document.getElementById("sensorSearchField")
  searchInput.addEventListener("change", event => {
    let searchText = event.target.value
    // console.log(searchText)
    esdr.updateQuery({text: searchText})

    // if a delayed update was pending, cancel it
    if (explorer.searchUpdateTimer) {
      clearTimeout(explorer.searchUpdateTimer)
      explorer.searchUpdateTimer = undefined
    }

    updateUrlHash()
  })
  // oninput happens every time a character is entered, so let's add a delay
  searchInput.addEventListener("input", event => {
    let searchText = event.target.value

    if (explorer.searchUpdateTimer) {
      clearTimeout(explorer.searchUpdateTimer)
    }

    explorer.searchUpdateTimer = setTimeout(timestamp => {
      esdr.updateQuery({text: searchText})

      updateUrlHash()

      explorer.searchUpdateTimer = undefined
    }, 500)

  })

  let recentOnlyCheckbox = document.getElementById("recentOnlyCheckbox")
  recentOnlyCheckbox.addEventListener("change", event => {
    let checked = event.target.checked
    esdr.updateQuery({recentOnly: checked})

    updateUrlHash()
  })
  let mapOnlyCheckbox = document.getElementById("mapOnlyCheckbox")
  mapOnlyCheckbox.addEventListener("change", event => {
    let checked = event.target.checked
    esdr.updateQuery({mapOnly: checked})

    updateUrlHash()
  })

  // install search results callback
  esdr.searchCallback = (searchResults, isAppendUpdate) => processNewSearchResults(searchResults, isAppendUpdate)
  // start loading feed data
  esdr.loadFeeds(explorer.esdrFeedsReceived)

  esdr.channelDataUpdateCallback = (feedId, channelName) => {
    let channelId = `${feedId}.${channelName}`
    // console.log(`channelDataUpdateCallback(${channelId}`)
    // no need to do fit with autoscaling enabled
    // let plotNumber = explorer.plots.get(channelId)
    // if (plotNumber)
    //   explorer.fitPlotYAxisToData(plotNumber)
  }


  // install scroll listener
  let searchResultsList = document.getElementById("searchResultsList")
  searchResultsList.addEventListener('scroll', () => {
    appendSearchResultsListIfNeeded()
  })
}

explorer.doSensorSearch = function() {
  let searchInput = document.getElementById("sensorSearchField")
  let searchText = searchInput.value
  // console.log(searchText)
  esdr.updateQuery({text: searchText})

  // if a delayed update was pending, cancel it
  if (explorer.searchUpdateTimer) {
    clearTimeout(explorer.searchUpdateTimer)
    explorer.searchUpdateTimer = undefined
  }

  updateUrlHash()
}

explorer.deferredMapBoundsUpdateCallback = function(map) {
  // console.log("deferredMapBoundsUpdateCallback")
  explorer.deferredMapBoundsUpdateTimer = undefined

  let mapBounds = gMap.getBounds()

  // need this elaborate comparison because simple equality tests dont work to determine if the bounds actually changed:(
  // if the bounds didn't really change, then we can just do nothing
  if (ESDR.areMapBoundsEqual(explorer.prevMapBounds, mapBounds))
  if (explorer.prevMapBounds && (mapBounds.getSouthWest().lng() == explorer.prevMapBounds.getSouthWest().lng()) && (mapBounds.getNorthEast().lng() == explorer.prevMapBounds.getNorthEast().lng()) && (mapBounds.getSouthWest().lat() == explorer.prevMapBounds.getSouthWest().lat()) && (mapBounds.getNorthEast().lat() == explorer.prevMapBounds.getNorthEast().lat())) {
    return
  }

  // console.log(`bounds_changed ${mapBounds}`)

  explorer.prevMapBounds = mapBounds

  // console.log(`deferredMapBoundsUpdateCallback for real ${mapBounds}`)

  // update the persistent states for map bounds
  let center = map.getCenter()
  explorer.center = center
  let zoom = map.getZoom()
  explorer.zoom = zoom
  explorer.mapBounds = mapBounds
  esdr.updateQuery({mapBounds: mapBounds})

  updateUrlHash()
}


function parseUrlParams() {
  let browserParams = new URLSearchParams(window.location.hash.slice(1))

  // selected channels for plotting
  if (browserParams.has("channels")) {
    // TODO: add support for pipe separator old-style URLs?
    let channelIds = browserParams.get("channels").split(",").filter((word) => word.length > 0)
    for (let channelId of channelIds) {
      // select channel and add plot
      esdr.selectChannelWithId(channelId, true)
      // let feedId = parseInt(channelId.slice(0, channelId.indexOf(".")))
      // let channelName = channelId.slice(channelId.indexOf(".")+1)
      // explorer.addPlot(feedId, channelName)
    }
    explorer.updateDataDownloadLinks()
  }

  // grapher time limits and cursor
  if (browserParams.has("time")) {
    let times = browserParams.get("time").split(",")
    let startTime = parseFloat(times[0])
    if (isFinite(startTime))
      explorer.startTime = startTime
    let endTime = parseFloat(times[1])
    if (isFinite(endTime))
      explorer.endTime = endTime
  }
  if (browserParams.has("plotAreaHeight")) {
    let height = parseFloat(browserParams.get("plotAreaHeight"))
    if (isFinite(height)) {
      explorer.setPlotAreaHeight(height)
    }
  }

  if (browserParams.has("plotHeight")) {
    let height = parseFloat(browserParams.get("plotHeight"))
    if (isFinite(height)) {
      explorer.plotHeight = Math.min(Math.max(height, explorer.minPlotHeight), explorer.maxPlotHeight)
      explorer.setPlotsToHeight(explorer.plotHeight*explorer.plotBaseSize())
    }
  }

  if (browserParams.has("cursor")) {
    let cursorTime = parseFloat(browserParams.get("cursor"))
    if (isFinite(cursorTime))
      explorer.cursorTime = cursorTime
  }

  // map params
  if (browserParams.has("zoom")) {
    explorer.zoom = parseFloat(browserParams.get("zoom"))
  }

  if (browserParams.has("center")) {
    let latlon = browserParams.get("center").split(",")
    explorer.center = new google.maps.LatLng(latlon[0], latlon[1])
  }

  // search
  if (browserParams.has("search")) {
    let searchText = browserParams.get("search")
    let searchInput = document.getElementById("sensorSearchField")
    searchInput.value = searchText
    esdr.updateQuery({text: searchText})
  }
  if (browserParams.has("recentOnly")) {
    let recentOnly = browserParams.get("recentOnly") == "true"
    let recentOnlyCheckbox = document.getElementById("recentOnlyCheckbox")
    recentOnlyCheckbox.checked = recentOnly
    esdr.updateQuery({recentOnly: recentOnly})
  }
  if (browserParams.has("mapOnly")) {
    let mapOnly = browserParams.get("mapOnly") == "true"
    let mapOnlyCheckbox = document.getElementById("mapOnlyCheckbox")
    mapOnlyCheckbox.checked = mapOnly
    esdr.updateQuery({mapOnly: mapOnly})
  }

  // new params for display state
  if (browserParams.has("showFilters")) {
    explorer.showFilters = browserParams.get("showFilters") == "true"
  }
  if (browserParams.has("showSettings")) {
    explorer.showSettings = browserParams.get("showSettings") == "true"
  }
  if (browserParams.has("showExperimentalSettings")) {
    explorer.showExperimentalSettings = browserParams.get("showExperimentalSettings") == "true"
    explorer.showExperimentalSettingsUI()
  }
  if (browserParams.has("showResults")) {
    explorer.showResults = browserParams.get("showResults") == "true"
  }

  // on-map sparklines
  if (browserParams.has("showSparklines")) {
    explorer.showSparklines = browserParams.get("showSparklines") == "true"
    let sparklinesCheckbox = document.getElementById("showSparklinesCheckbox")
    sparklinesCheckbox.checked = explorer.showSparklines
  }
  // on-map sparklines
  if (browserParams.has("colorMapDots")) {
    explorer.colorMapDots = browserParams.get("colorMapDots") == "true"
    let checkbox = document.getElementById("colorMapDotsCheckbox")
    checkbox.checked = explorer.colorMapDots
  }


}

function createUrlParams() {
  let browserParams = new URLSearchParams()

  if (esdr.selectedChannelIds.length > 0) {
    browserParams.set("channels", esdr.selectedChannelIds.join(','))
  }
  if (explorer.startTime || explorer.endTime) {
    browserParams.set("time", [explorer.startTime.toFixed(3), explorer.endTime.toFixed(3)].join(','))
  }
  if (explorer.cursorTime) {
    browserParams.set("cursor", explorer.cursorTime.toFixed(3))
  }
  if (explorer.plotHeight) {
    browserParams.set("plotHeight", explorer.plotHeight.toFixed(3))
  }
  if (explorer.plotAreaHeightPercent) {
    browserParams.set("plotAreaHeight", explorer.plotAreaHeightPercent.toFixed(3))
  }

  if (explorer.showSparklines) {
    browserParams.set("showSparklines", "true")
  }

  // explicitly set both showFilters and showResults because the default is to show
  if (explorer.showFilters) {
    browserParams.set("showFilters", explorer.showFilters ? "true" : "false")
  }
  if (explorer.showSettings) {
    browserParams.set("showSettings", explorer.showSettings ? "true" : "false")
  }
  if (explorer.showExperimentalSettings) {
    browserParams.set("showExperimentalSettings", explorer.showExperimentalSettings ? "true" : "false")
  }
  if (explorer.showResults) {
    browserParams.set("showResults", explorer.showResults ? "true" : "false")
  }
  if (explorer.showSparklines) {
    browserParams.set("showSparklines", explorer.showSparklines ? "true" : "false")
  }
    if (explorer.colorGraphs) {
    browserParams.set("colorGraphs", explorer.colorGraphs ? "true" : "false")
  }

  if (explorer.center) {
    browserParams.set("center", `${explorer.center.lat()},${explorer.center.lng()}`)
  }
  if (explorer.zoom) {
    browserParams.set("zoom", `${explorer.zoom}`)
  }
  if (esdr.searchQuery.recentOnly) {
    browserParams.set("recentOnly", `${esdr.searchQuery.recentOnly}`)
  }
  if (esdr.searchQuery.mapOnly) {
    browserParams.set("mapOnly", `${esdr.searchQuery.mapOnly}`)
  }

  if (esdr.searchQuery.text) {
    browserParams.set("search", esdr.searchQuery.text)
  }

  return browserParams
}

function updateUrlHash() {
  let params = createUrlParams()
  // as URLSearchParams escapes commas, finally replace the escaped commas with human readable commas again
  window.location.hash = `#${params.toString().replace(/%2C/gi,',')}`
}

explorer.hashChangeListener = function() {
  // TODO: implement event handling on hash changes
  // - does hash change when we set it via updateUrlHash()?
  // - need to refactor initialization to use the proper methods for setting up the UI based on initial hash and later changes the same way
  console.log("URL hash changed!")
}

window.addEventListener('hashchange', () => explorer.hashChangeListener)


explorer.showExperimentalSettingsUI = function() {
  let settingsGroup = document.getElementById("settingsContent")
  Array.from(document.querySelectorAll(".advanced-setting")).forEach(el => {
    el.remove()
    settingsGroup.appendChild(el)
  })
}


function adjustSidebarTopPadding(adjustment) {
  return
  // TODO: not needed for inline searchbox (only when its floaty)
  let searchBlock = document.getElementById("searchBlock")
  let searchStyle = window.getComputedStyle(searchBlock)
  let sidebar = document.getElementById("searchSidebar")

  sidebar.style.paddingTop = `calc(${searchBlock.offsetHeight}px + ${searchStyle.marginTop} + ${searchStyle.marginBottom} + (${adjustment}))`

}




function showSearchResults() {
  let sidebar = document.getElementById("searchSidebar")
  if (!sidebar.style.width || sidebar.style.marginLeft !== "0px") {
    explorer.toggleSidebar()
  }
}

explorer.toggleSidebar = function() {
  let searchBlock = document.getElementById("searchBlock")
  let searchStyle = window.getComputedStyle(searchBlock)
  let sidebar = document.getElementById("searchSidebar")
  let mainBlock = document.getElementById("main")

  if (!sidebar.style.width || sidebar.style.marginLeft !== "0px") {
    // set the widths to show sidebar
    let blockWidth = searchBlock.scrollWidth + 'px'
    let margin = `${searchStyle.marginLeft} + ${searchStyle.marginRight}`
    let width = `${margin} + ${blockWidth}`
    sidebar.style.width = `calc(${width})`
    sidebar.style.left = `0px`
    sidebar.style.marginLeft = `0px`
    mainBlock.style.marginLeft = `calc(${width})`
    explorer.showResults = true
    document.getElementById("showSearchResultsButton").classList.add("active-searchbar-button")
  }
  else {
    sidebar.style.marginLeft = `calc(0px - (${sidebar.style.width}))`
    // sidebar.style.width = "0px"
    mainBlock.style.marginLeft = "0px"
    explorer.showResults = false
    document.getElementById("showSearchResultsButton").classList.remove("active-searchbar-button")
  }

  // make sure top padding exludes search box
  adjustSidebarTopPadding('0px')

  updateUrlHash()
}

explorer.showSearchFilters = function() {
  let filtersBlock = document.getElementById("filtersBlock")
  if (!filtersBlock.style.height || filtersBlock.style.height === "0px") {
    explorer.toggleFilters()
  }
}

explorer.toggleFilters = function() {
  let filtersBlock = document.getElementById("filtersBlock")
  let adjustment = 0
  if (!filtersBlock.style.height || filtersBlock.style.height === "0px") {
    adjustment = `${filtersBlock.scrollHeight}px`
    filtersBlock.style.height = filtersBlock.scrollHeight + 'px'
    explorer.showFilters = true
    document.getElementById("showDataFiltersButton").classList.add("active-searchbar-button")
  }
  else {
    adjustment = `-${filtersBlock.scrollHeight}px`
    filtersBlock.style.height = "0px"
    explorer.showFilters = false
    document.getElementById("showDataFiltersButton").classList.remove("active-searchbar-button")
  }

  adjustSidebarTopPadding(adjustment)

  updateUrlHash()

}

explorer.showSearchSettings = function() {
  let groupBlock = document.getElementById("settingsBlock")
  if (!groupBlock.style.height || groupBlock.style.height === "0px") {
    explorer.toggleSettings()
  }
}

explorer.toggleSettings = function() {
  let groupBlock = document.getElementById("settingsBlock")
  let adjustment = 0
  if (!groupBlock.style.height || groupBlock.style.height === "0px") {
    adjustment = `${groupBlock.scrollHeight}px`
    groupBlock.style.height = groupBlock.scrollHeight + 'px'
    explorer.showSettings = true
    document.getElementById("showSettingsButton").classList.add("active-searchbar-button")
  }
  else {
    adjustment = `-${groupBlock.scrollHeight}px`
    groupBlock.style.height = "0px"
    explorer.showSettings = false
    document.getElementById("showSettingsButton").classList.remove("active-searchbar-button")
  }

  adjustSidebarTopPadding(adjustment)

  updateUrlHash()

}

explorer.toggleDataDownloads = function() {

  let downloadToolbarBlock = document.getElementById("plotsDownloadToolbar")

  let transitionTime = 300

  let transitionTargetHeight = 0
  let transitionStartHeight = 0

  let maxHeight = 2


  if (!downloadToolbarBlock.style.height || (downloadToolbarBlock.style.height === "0px") || (downloadToolbarBlock.style.height === "0em")) {
    transitionTargetHeight = maxHeight
    transitionStartHeight = 0
    explorer.showDataDownloads = true
    document.getElementById("showDataDownloadsButton").classList.add("active-toolbar-button")


  }
  else {
    transitionTargetHeight = 0
    transitionStartHeight = maxHeight
    explorer.showDataDownloads = false
    document.getElementById("showDataDownloadsButton").classList.remove("active-toolbar-button")
  }

  let startTime = performance.now()

  let transitionAnimation = function(time) {
    let timeRange = explorer.grapher.getTimeRange()
    let u = Math.min((time - startTime)/transitionTime, 1.0)
    let height = transitionStartHeight*(1.0-u) + transitionTargetHeight*(u)

    downloadToolbarBlock.style.height = height + "em"

    explorer.updateDataDownloadLinks()
    // set time range as we're changing size, which would normally keep magnification constant
    explorer.grapher.setTimeRange(timeRange)

    if (time - startTime < transitionTime)
      window.requestAnimationFrame(transitionAnimation)
  }

  window.requestAnimationFrame(transitionAnimation)

  updateUrlHash()

}

explorer.updateProgressText = function(text) {
  let progressBlock = document.getElementById("progressBlock")
  let progressText = document.getElementById("searchProgressText")
  let shouldClose = !text && progressText.textContent
  let shouldOpen = !progressText.textContent && text
  progressText.textContent = text

  let adjustment = 0
  let progressStyle = window.getComputedStyle(progressBlock)
  if (shouldOpen)
  {
    adjustment = `calc(${progressBlock.scrollHeight}px - ${progressStyle.paddingTop})`
    progressBlock.style.height = adjustment
  }
  else if (shouldClose)
  {
    adjustment = `calc(-${progressBlock.scrollHeight}px + ${progressStyle.paddingTop})`
    progressBlock.style.height = "0px"
  }

  adjustSidebarTopPadding(adjustment)

}

explorer.updateStatusInfo = function() {
  let infoText = ""
  if (explorer.statusInfo.numFeedsTotal === undefined) {
    infoText = "Loading feeds…"
  } 
  else if (explorer.statusInfo.numFeedsReceived < explorer.statusInfo.numFeedsTotal) {
    let percentComplete = 100.0*explorer.statusInfo.numFeedsReceived/explorer.statusInfo.numFeedsTotal
    infoText = `${explorer.statusInfo.numSearchResults} matches in ${explorer.statusInfo.numFeedsReceived} feeds (${percentComplete.toFixed(1)}% loaded).`
  }
  else {
    infoText = `${explorer.statusInfo.numSearchResults} matches in ${explorer.statusInfo.numFeedsReceived} feeds.`
  }

  explorer.updateProgressText(infoText)
}

explorer.updateEsdrLoadProgress = function(numFeedsReceived, numFeedsTotal) {

  explorer.statusInfo.numFeedsReceived = numFeedsReceived
  explorer.statusInfo.numFeedsTotal = numFeedsTotal

  explorer.updateStatusInfo()
}

explorer.esdrFeedsReceived = function(feedIds, progress) {
  explorer.updateEsdrLoadProgress(progress.current, progress.total)

  // set with all feeds rejected to start with
  explorer.mapOverlay.setDataSource(esdr, {rejectedFeeds: new Set(feedIds)})

  // update plot labels
  let feedSet = new Set(feedIds)
  for (let [channelId, {plotId: plotId}] of explorer.plots) {
    let feedId = parseInt(channelId.slice(0, channelId.indexOf(".")))
    if (feedSet.has(feedId)) {
      let label = document.getElementById(`plotLabel-${plotId}`)
      if (label) {
        let channelName = channelId.slice(channelId.indexOf(".")+1)
        label.textContent = esdr.feeds.get(feedId).channelLabels.get(channelName)
      }
    }
  }

}

function processNewSearchResults(newResults, isAppendUpdate) {
  // this function receives a list of search results in the {feedId: , channelNames:} format
  // if isAppendUpdate is true, this is an incremental search result, and results can be appended
  // otherwise clear search results list
  // console.log(`processNewSearchResults(${newResults.length}, ${isAppendUpdate})`)

  let searchResultsList = document.getElementById("searchResultsList")

  // remove previous results on full update
  if (!isAppendUpdate) {
    clearSearchResultsList()
    explorer.results = []
  }

  explorer.results = explorer.results.concat(newResults)


  // update map markers
  let resultFeedIds = explorer.results.map(result => result.feedId)
  explorer.mapOverlay.filterMarkers(resultFeedIds)

  explorer.statusInfo.numSearchResults = explorer.results.length

  explorer.updateStatusInfo()
  // update search results list
  appendSearchResultsListIfNeeded(newResults)
}

function clearSearchResultsList() {
  let searchResultsList = document.getElementById("searchResultsList")
  while (searchResultsList.childElementCount) {
    searchResultsList.removeChild(searchResultsList.lastChild)
  }

}

function appendSearchResultsListBy(results) {
  // this function just adds more entries to the search results

  let feedDivs = []
  for (let result of results) {
    let feedId = result.feedId
    let feed = esdr.feeds.get(feedId)
    let channelNames = result.channels
    let feedDiv = searchResultsDivForFeed(feedId)
    if (channelNames)
    {
      let channelDivs = []
      for (let channelName of channelNames) {
        let chdiv = searchResultsDivForChannel(feedId, channelName, "searchResults")
        channelDivs.push(chdiv)
      }

      for (let chdiv of channelDivs) {
        feedDiv.appendChild(chdiv)
      }
    }
    feedDivs.push(feedDiv)

  }

  let searchResultsList = document.getElementById("searchResultsList")

  for (let div of feedDivs)
  {
    searchResultsList.appendChild(div)
  }
}

function appendSearchResultsListIfNeeded() {
  let searchTotal = explorer.results.length

  let results = explorer.results.slice(searchResultsList.children.length)

  // if we have items to be added
  if (results.length > 0)
  {
    let shouldAppend = false
    if (searchResultsList.children.length > 0)
    {
      // if the last item is less than 100px from the bottom, append some more
      let itemBottom = searchResultsList.children[searchResultsList.children.length-1].getBoundingClientRect().bottom;
      let containerBottom = searchResultsList.getBoundingClientRect().bottom;
      shouldAppend = itemBottom - containerBottom < 100
    }
    else
    {
      shouldAppend = true
    }

    if (shouldAppend)
    {
      // add at least 10, at most 100 based on the length of the list already
      // cap to the number of actually available results
      let addCount = Math.min(results.length, Math.min(100, Math.max(10, Math.floor(searchResultsList.children.length*0.5))))
      appendSearchResultsListBy(results.slice(0, addCount))
      // call this function again until div is full enough
      appendSearchResultsListIfNeeded()
    }
    // console.log(`${itemBottom} of ${containerBottom}`)
  }


}


function searchResultsDivForFeed(feedId) {
  let feed = esdr.feeds.get(feedId)
  let label = esdr.labelForFeed(feedId)

  let div = document.createElement("div")
  div.setAttribute("id", `feed-${feedId}`)
  div.setAttribute("class", "search-result-feed-block")

  if (feed.latlng) {
    label += `\n(N ${feed.latlng.lat.toFixed(6)}, E ${feed.latlng.lng.toFixed(6)})`
  }

  let labelElement = document.createElement("label")
  labelElement.setAttribute("id", `label-${feedId}`)
  labelElement.innerText = label

  div.appendChild(labelElement)

  return div
}


function getChannelIdFromElementId(elementId) {
  let hyphenLoc = elementId.indexOf("-")
  let channelId = elementId.slice(hyphenLoc+1)
  return channelId
}


function searchResultsDivForChannel(feedId, channelName, elementIdPrefix) {
  let label = esdr.labelForChannel(feedId, channelName)
  let channelId = `${feedId}.${channelName}`
  let selected = esdr.isChannelSelected(channelId)

  let div = document.createElement("div")
  div.setAttribute("class", "search-result-channel-block")
  div.addEventListener("mouseover", event => {
    explorer.mapOverlay.highlightMarkers([feedId], true)
  })

  let checkbox = document.createElement("input")
  checkbox.setAttribute("type", "checkbox")
  checkbox.setAttribute("id", `${elementIdPrefix}-${channelId}`)
  checkbox.setAttribute("name", `checkbox-${channelId}`)
  checkbox.setAttribute("title", "Plot Channel")
  if (selected) {
    checkbox.checked = true
  }
  checkbox.onclick = function(event) {
    let checked = this.checked
    let channelId = getChannelIdFromElementId(this.getAttribute("id"))

    explorer.interactiveSelectChannelWithId(channelId, checked)
  }
  div.appendChild(checkbox)


  let labelElement = document.createElement("label")
  labelElement.setAttribute("for", `${elementIdPrefix}-${channelId}`)
  labelElement.setAttribute("id", `label-${channelId}`)
  labelElement.innerText = label

  div.appendChild(labelElement)

  return div
}

explorer.colorizeFeedOnMap = function(feedId, channelName) {
  let colorizer = new TiledDataEvaluator(esdr.dataSourceForChannel(feedId, channelName))

  explorer.mapOverlay.setColorizerForFeed(feedId, channelName, colorizer)

  explorer.feedMarkerColorizers.set(feedId, colorizer)

}

explorer.interactiveSelectChannelWithId = function(channelId, isSelected) {

  let feedId = parseInt(channelId.slice(0, channelId.indexOf(".")))
  let channelName = channelId.slice(channelId.indexOf(".")+1)

  esdr.selectChannelWithId(channelId, isSelected)
  explorer.mapOverlay.selectFeed(feedId, isSelected, true)

  if (isSelected) {
    explorer.addPlot(feedId, channelName)
    if (explorer.showSparklines)
      explorer.mapOverlay.addSparklinePlot(feedId, channelName)
    if (explorer.colorMapDots) {
      explorer.colorizeFeedOnMap(feedId, channelName)
      window.requestAnimationFrame(explorer.mapDotsAnimationFrameHandler)
    }

  }
  else {
    explorer.removePlot(feedId, channelName)
    explorer.mapOverlay.removeSparklinePlot(feedId, channelName)
  }

  let resultsCheckbox = document.getElementById(`searchResults-${channelId}`)
  if (resultsCheckbox)
    resultsCheckbox.checked = isSelected
  let infoCheckbox = document.getElementById(`searchResults-${channelId}`)
  if (infoCheckbox)
    infoCheckbox.checked = isSelected

  explorer.updateDataDownloadLinks()

  updateUrlHash()
}

function initPlots() {
  let now = Date.now() / 1000;
  let aWeekAgo = now - 7 * 24 * 60 * 60;

  // initialize the timeline if the times haven't been set yet
  explorer.startTime = explorer.startTime || aWeekAgo
  explorer.endTime = explorer.endTime || now
  explorer.cursorTime = explorer.cursorTime || now

  // 

  explorer.grapher = new grapher.GLGrapher(document.getElementById("plotGraphs"))

  explorer.grapher.setTimeRange(explorer.startTime, explorer.endTime)
  // TODO: no cursor in GLGrapher 
  // explorer.grapher.setCursorTime(cursorTime);

  let plotDateScrubber = document.getElementById("plotsDateScrubber")
  plotDateScrubber.addEventListener("mouseup", event => {
    event.target.value = "0"
    explorer.stopScrubbing()
    // FIXME: this is a hack for Firefox, which sends an input even after mouseup, thus preventing the slider to be properly reset in this callback
    // also add timeout to clear the flag so that we can subsequently click on slider again to make things move
    explorer.hasDateMoveScrubberMouseUpJustHappened = true
    if (explorer.dateMoveScrubberMouseUpTimer)
      clearTimeout(explorer.dateMoveScrubberMouseUpTimer)
    explorer.dateMoveScrubberMouseUpTimer = setTimeout(
      timestamp => explorer.hasDateMoveScrubberMouseUpJustHappened = false, 
      100
    )
  })
  plotDateScrubber.addEventListener("mouseDown", event => {
    explorer.hasDateMoveScrubberMouseUpJustHappened = false
  })
  plotDateScrubber.addEventListener("input", event => {
    if (explorer.hasDateMoveScrubberMouseUpJustHappened) {
      explorer.hasDateMoveScrubberMouseUpJustHappened = false
      event.target.value = "0"      
    } 
    else {
      explorer.scrubTimelineDateWithSpeed(event.target.valueAsNumber)
    }
  })
  let plotZoomScrubber = document.getElementById("plotsZoomScrubber")
  plotZoomScrubber.addEventListener("mouseup", event => {
    event.target.value = "0"
    explorer.stopScrubbing()
    // FIXME: this is a hack for Firefox, which sends an input even after mouseup, thus preventing the slider to be properly reset in this callback
    // also add timeout to clear the flag so that we can subsequently click on slider again to make things move
    explorer.hasDateZoomScrubberMouseUpJustHappened = true
    if (explorer.dateZoomScrubberMouseUpTimer)
      clearTimeout(explorer.dateZoomScrubberMouseUpTimer)
    explorer.dateZoomScrubberMouseUpTimer = setTimeout(
      timestamp => explorer.hasDateZoomScrubberMouseUpJustHappened = false, 
      100
    )
  })
  plotZoomScrubber.addEventListener("mouseDown", event => {
    explorer.hasDateZoomScrubberMouseUpJustHappened = false
  })
  plotZoomScrubber.addEventListener("input", event => {
    if (explorer.hasDateZoomScrubberMouseUpJustHappened) {
      explorer.hasDateZoomScrubberMouseUpJustHappened = false
      event.target.value = "0"      
    } 
    explorer.scrubTimelineZoomWithSpeed(event.target.valueAsNumber)
  })


  explorer.grapher.addDateAxisRangeChangeListener((timeRange) => {
    // update these values immediately, but do deffered update to update url hash, etc
    explorer.startTime = timeRange.min
    explorer.endTime = timeRange.max

    if (explorer.showSparklines) {
      window.requestAnimationFrame(explorer.sparklineAnimationFrameHandler)
    }

    if (explorer.colorMapDots) {
      window.requestAnimationFrame(explorer.mapDotsAnimationFrameHandler)
    }

    // do a deferred update
    if (explorer.deferredTimelineUpdateTimer)
      clearTimeout(explorer.deferredTimelineUpdateTimer)

    explorer.deferredTimelineUpdateTimer = setTimeout(explorer.deferredTimelineUpdateCallback, 300)
  })

  explorer.grapher.addDateAxisCursorChangeListener((cursor) => {
    // console.log("dateAxisCursorChangeListener", cursor)
    explorer.cursorTime = cursor

    // do a deferred update
    if (explorer.deferredTimelineUpdateTimer)
      clearTimeout(explorer.deferredTimelineUpdateTimer)

    explorer.cursorTime = cursor
    if (explorer.colorMapDots) {
      window.requestAnimationFrame(explorer.mapDotsAnimationFrameHandler)
    }

    explorer.deferredTimelineUpdateTimer = setTimeout(explorer.deferredTimelineUpdateCallback, 300)
  })


  // setup datasource before adding sparklines, so that dataSource is in place
  explorer.mapOverlay.setDataSource(esdr, {})



  let plotExtensionDiv = document.createElement("div")
  plotExtensionDiv.setAttribute("class", "plot-extension")
  plotExtensionDiv.setAttribute("id", "plotCornerExtension")
  plotExtensionDiv.style.padding = "0px"
  plotExtensionDiv.style.boxSizing = "border-box"
  // plotExtensionDiv.style.padding = "0.0em 0.25em"
  plotExtensionDiv.style.width = "0px"
  plotExtensionDiv.style.flexGrow = "0"
  plotExtensionDiv.style.flexShrink = "0"
  plotExtensionDiv.style.display = "inline-flex"
  plotExtensionDiv.style.alignItems = "stretch"

  let plotExtPaddingDiv = document.createElement("div")
  plotExtPaddingDiv.style.padding = "0.0em 0.25em"
  plotExtensionDiv.style.display = "inline-flex"
  plotExtensionDiv.style.alignItems = "center"


  let timezoneDatalist = explorer.addTimezoneSelectorTo(document.getElementById("timezoneButton"))
  // let timezoneDatalist = explorer.addTimezoneSelectorTo(plotExtPaddingDiv)

  plotExtensionDiv.appendChild(plotExtPaddingDiv)

  explorer.grapher.addDateAxisExtensionDiv(plotExtensionDiv)

  // timezones support
  let timezones = moment.tz.names()

  // let timezoneDatalist = document.getElementById("timezoneDatalist")
  if (timezoneDatalist) {
    timezones.forEach(tz => {
      let opt = document.createElement("option")
      opt.value = tz
      opt.label = tz
      timezoneDatalist.appendChild(opt)
    })
  }

  // add selected plots to plot manager
  for (let channelId of esdr.selectedChannelIds) {
    let feedId = parseInt(channelId.slice(0, channelId.indexOf(".")))
    let channelName = channelId.slice(channelId.indexOf(".")+1)
    explorer.addPlot(feedId, channelName)

    if (explorer.colorMapDots)
      explorer.colorizeFeedOnMap(feedId, channelName)

  }

  if (explorer.showSparklines) {
    explorer.addAllSparklines()
  }

  if (explorer.colorMapDots) {
    window.requestAnimationFrame(explorer.mapDotsAnimationFrameHandler)
  }

}


explorer.addTimezoneSelectorTo = function(containerElement) {
  
  let label = document.createElement("label")
  label.setAttribute("for", "timezoneSelectorInput")
  label.style.fontSize = "small"
  label.textContent = "Download Time Format:"
  let br = document.createElement("br")

  let tzSelector = document.createElement("select")
  tzSelector.setAttribute("name", "timezoneInput")
  tzSelector.setAttribute("id", "timezoneSelectorInput")
  tzSelector.setAttribute("autocomplete", "off")
  // tzSelector.style.flexShrink = 0
  // tzSelector.style.minWidth = "5em"
  tzSelector.style.width = "auto"
  tzSelector.addEventListener("change", event => explorer.downloadTimezoneChanged(event))

  let currentOption = document.createElement("option")
  currentOption.value = "Current Browser Timezone"
  currentOption.label = "Current Browser Timezone"
  let utcOption = document.createElement("option")
  utcOption.value = "UTC"
  utcOption.label = "UTC"
  let epochOption = document.createElement("option")
  epochOption.value = "UNIX Epoch Timestamp"
  epochOption.label = "UNIX Epoch Timestamp"
  tzSelector.appendChild(currentOption)
  tzSelector.appendChild(utcOption)
  tzSelector.appendChild(epochOption)

  containerElement.appendChild(label)
  containerElement.appendChild(br)
  containerElement.appendChild(tzSelector)

  return tzSelector
}

explorer.addTimezoneComboBoxTo = function(containerElement) {
  
  let plotExtensionLabel = document.createElement("label")
  plotExtensionLabel.setAttribute("for", "timezoneSelectorInput")
  plotExtensionLabel.style.fontSize = "small"
  plotExtensionLabel.textContent = "Download Time Format:"

  let plotExtensionInput = document.createElement("input")
  plotExtensionInput.setAttribute("type", "text")
  plotExtensionInput.setAttribute("name", "timezoneInput")
  plotExtensionInput.setAttribute("id", "timezoneSelectorInput")
  plotExtensionInput.setAttribute("list", "timezoneDatalist")
  plotExtensionInput.setAttribute("placeholder", "Current Browser Timezone")
  plotExtensionInput.setAttribute("autocomplete", "off")
  plotExtensionInput.addEventListener("change", event => explorer.downloadTimezoneChanged(event))

  let timezoneDatalist = document.createElement("datalist")
  timezoneDatalist.setAttribute("id", "timezoneDatalist")
  let currentOption = document.createElement("option")
  currentOption.setAttribute("value", "Current Browser Timezone")
  let utcOption = document.createElement("option")
  utcOption.setAttribute("value", "UTC")
  let epochOption = document.createElement("option")
  epochOption.setAttribute("value", "UNIX Epoch Timestamp")
  timezoneDatalist.appendChild(currentOption)
  timezoneDatalist.appendChild(utcOption)
  timezoneDatalist.appendChild(epochOption)

  containerElement.appendChild(plotExtensionLabel)
  containerElement.appendChild(plotExtensionInput)
  containerElement.appendChild(timezoneDatalist)

  return timezoneDatalist
}

explorer.addAllSparklines = function() {
   for (let channelId of esdr.selectedChannelIds) {
    let feedId = parseInt(channelId.slice(0, channelId.indexOf(".")))
    let channelName = channelId.slice(channelId.indexOf(".")+1)

    let plot = explorer.mapOverlay.addSparklinePlot(feedId, channelName)
    plot.setPlotRange(explorer.grapher.getTimeRange())
  }

  window.requestAnimationFrame(explorer.sparklineAnimationFrameHandler)

}


explorer.removeAllSparklines = function() {
   for (let channelId of esdr.selectedChannelIds) {
    let feedId = parseInt(channelId.slice(0, channelId.indexOf(".")))
    let channelName = channelId.slice(channelId.indexOf(".")+1)

    explorer.mapOverlay.removeSparklinePlot(feedId, channelName)
  }

}


explorer.toggleSparklines = function(event) {
  if (!event) {
    explorer.showSparklines = !explorer.showSparklines
  }
  else
    explorer.showSparklines = event.target.checked

  if (explorer.showSparklines) {
    explorer.addAllSparklines()
  }
  else {
    explorer.removeAllSparklines()
  }
}

explorer.addAllMapDots = function() {
   for (let channelId of esdr.selectedChannelIds) {
    let feedId = parseInt(channelId.slice(0, channelId.indexOf(".")))
    let channelName = channelId.slice(channelId.indexOf(".")+1)

    explorer.colorizeFeedOnMap(feedId, channelName)
  }

  window.requestAnimationFrame(explorer.mapDotsAnimationFrameHandler)

}


explorer.removeAllMapDots = function() {
   for (let channelId of esdr.selectedChannelIds) {
    let feedId = parseInt(channelId.slice(0, channelId.indexOf(".")))
    let channelName = channelId.slice(channelId.indexOf(".")+1)

    explorer.mapOverlay.setColorizerForFeed(feedId, channelName, undefined)

    explorer.feedMarkerColorizers.delete(feedId)
  }

  window.requestAnimationFrame(explorer.mapDotsAnimationFrameHandler)
}


explorer.toggleColorMapDots = function(event) {
  if (!event) {
    explorer.colorMapDots = !explorer.colorMapDots
  }
  else
    explorer.colorMapDots = event.target.checked

  if (explorer.colorMapDots) {
    explorer.addAllMapDots()
  }
  else {
    explorer.removeAllMapDots()
  }
}

explorer.toggleColorGraphs = function (event) {
  if (!event) {
    explorer.colorGraphs = !explorer.colorGraphs
  }
  else
    explorer.colorGraphs = event.target.checked

  for (let [channelId, {plot: plot, feedId: feedId, channelName: channelName}] of explorer.plots) {
    if (!explorer.colorGraphs) {
      plot.setColorMap(undefined, undefined)
    }
    else {
      let {texture: colorMapTexture, range: colorMapRange} = ESDR.sparklineColorMap(feedId, channelName)
      plot.setColorMap(colorMapTexture, colorMapRange)
    }
  }
  explorer.grapher.requestRedraw()
}

explorer.recreatePlots = function() {
  // remove all plots, make a copy of list first
  let plots = new Map(explorer.plots)

  for (let [channelId, {feedId: feedId, channelName: channelName}] of plots) {
    explorer.removePlot(feedId, channelName)
  }

  for (let [channelId, {feedId: feedId, channelName: channelName}] of plots) {
    explorer.addPlot(feedId, channelName)
  }
}

explorer.toggleBarGraphs = function (event) {
  if (!event) {
    explorer.barGraphs = !explorer.barGraphs
  }
  else
    explorer.barGraphs = event.target.checked

  if (explorer.barGraphs) {
      explorer.lineGraphs = false
      explorer.pointGraphs = false
      document.getElementById("lineGraphsCheckbox").checked = false
      document.getElementById("pointGraphsCheckbox").checked = false
  }

  explorer.recreatePlots()
}

explorer.togglePointGraphs = function (event) {
  if (!event) {
    explorer.pointGraphs = !explorer.pointGraphs
  }
  else
    explorer.pointGraphs = event.target.checked

  if (explorer.pointGraphs) {
      explorer.lineGraphs = false
      explorer.barGraphs = false
      document.getElementById("lineGraphsCheckbox").checked = false
      document.getElementById("barGraphsCheckbox").checked = false
  }

  explorer.recreatePlots()
}

explorer.toggleLineGraphs = function (event) {
  if (!event) {
    explorer.lineGraphs = !explorer.lineGraphs
  }
  else
    explorer.lineGraphs = event.target.checked

  if (explorer.lineGraphs) {
      explorer.barGraphs = false
      explorer.pointGraphs = false
      document.getElementById("barGraphsCheckbox").checked = false
      document.getElementById("pointGraphsCheckbox").checked = false
  }

  explorer.recreatePlots()
}

explorer.sparklineAnimationFrameHandler = function(timestamp) {
  explorer.mapOverlay.updateSparklineTimeRange(explorer.grapher.getTimeRange())
  explorer.mapOverlay.requestDraw()
}

explorer.mapDotsAnimationFrameHandler = function(timestamp) {
  explorer.feedMarkerColorizers.forEach(colorizer => {
    colorizer.setCurrentRange({min: explorer.startTime, max: explorer.endTime})
    colorizer.setCurrentTime(explorer.cursorTime)
  })

  // requestDraw is triggered automatically inside MapOverlay
  // explorer.mapOverlay.requestDraw()
}


explorer.scrubTimelineDate = function(timestamp) {
  let oldTimestamp = explorer.scrubTimestamp
  explorer.scrubTimestamp = timestamp

  if (oldTimestamp) {
    let dt = timestamp - oldTimestamp
    let currentRange = explorer.grapher.getTimeRange()
    let dateDiff = currentRange.max - currentRange.min
    let dateScrub = dateDiff*dt/1000.0*explorer.scrubSpeed/100.0
    explorer.grapher.setTimeRange(currentRange.min + dateScrub, currentRange.max + dateScrub)
  }

  if (explorer.scrubSpeed != 0)
    window.requestAnimationFrame(explorer.scrubTimelineDate)
}
explorer.scrubTimelineDateWithSpeed = function(speed) {
  // if speed was zero, this is a new scrub, so reset timestamp
  if (explorer.scrubSpeed == 0)
    explorer.scrubTimestamp = undefined
  explorer.scrubSpeed = speed
  window.requestAnimationFrame(explorer.scrubTimelineDate)
}

explorer.scrubTimelineZoom = function(timestamp) {
  let oldTimestamp = explorer.scrubTimestamp
  explorer.scrubTimestamp = timestamp

  if (oldTimestamp) {
    let dt = timestamp - oldTimestamp
    let currentRange = explorer.grapher.getTimeRange()
    let dateDiff = currentRange.max - currentRange.min
    let dateScrub = dateDiff*dt/1000.0*explorer.scrubSpeed/100.0
    let targetSize = dateDiff - 2*dateScrub
    explorer.zoomTimelineToSize(targetSize)
  }

  if (explorer.scrubSpeed != 0)
    window.requestAnimationFrame(explorer.scrubTimelineZoom)
}

explorer.scrubTimelineZoomWithSpeed = function(speed) {
  // if speed was zero, this is a new scrub, so reset timestamp
  if (explorer.scrubSpeed == 0)
    explorer.scrubTimestamp = undefined
  explorer.scrubSpeed = speed
  window.requestAnimationFrame(explorer.scrubTimelineZoom)
}
explorer.stopScrubbing = function() {
  explorer.scrubSpeed = 0
}


explorer.getTimeZone = function() {
  let tzElement = document.getElementById("timezoneSelectorInput")
  if (!tzElement) {
    console.warn("timezoneSelectorInput element not found for updating download links")
    return
  }

  let tz = tzElement.value

  if (tz.length == 0) {
    tz = tzElement.getAttribute("placeholder")
  }

  // get current timezone from browser
  if (tz == "Current Browser Timezone") {
    tz = moment.tz.guess(true)
  }
  else if (tz == "UNIX Epoch Timestamp") {
    tz = ""
  }

  return tz
}

explorer.updateDataDownloadLinks = function() {

  let tz = explorer.getTimeZone()

  // if we don't have a timerange to work with, don't even bother
  if (!explorer.startTime || !explorer.endTime) {
    return
  }

  // individual download buttons are set, as well as download all
  let channelIds = []
  for (let [channelId, {plotId: plotId}] of explorer.plots) {
    channelIds.push(channelId)
  }

  let allJsonLink = esdr.getMultiExportLink(channelIds, explorer.startTime, explorer.endTime, "json", tz.length > 0 ? tz : undefined)
  document.getElementById("downloadAllJsonButton").setAttribute("href", allJsonLink)
  let allCsvLink = esdr.getMultiExportLink(channelIds, explorer.startTime, explorer.endTime, "csv", tz.length > 0 ? tz : undefined)
  document.getElementById("downloadAllCsvButton").setAttribute("href", allCsvLink)

}

explorer.downloadTimezoneChanged = function(event) {
  explorer.updateDataDownloadLinks()
}


function animateNormalizedParameter(dt, start, now) {
  let u = Math.min(Math.max((now - start)/dt, 0.0), 1.0)
  return u
}

explorer.zoomTimelineToSize = function(zoomTargetSize) {
  let currentRange = explorer.grapher.getTimeRange()
  let cursor = explorer.grapher.getTimeCursor()

  let zoomCenter = ((cursor >= currentRange.min) && (cursor <= currentRange.max)) ? cursor : 0.5*(currentRange.max + currentRange.min)

  let rangeDiff = currentRange.max - currentRange.min
  let loDiff = zoomCenter - currentRange.min
  let hiDiff = currentRange.max - zoomCenter
  let zoomScale = zoomTargetSize/rangeDiff
  explorer.grapher.setTimeRange(zoomCenter - loDiff*zoomScale, zoomCenter + hiDiff*zoomScale)

}

explorer.zoomTimelineByFactor = function(zoomScale) {
  let currentRange = explorer.grapher.getTimeRange()
  let cursor = explorer.grapher.getTimeCursor()

  let zoomCenter = ((cursor >= currentRange.min) && (cursor <= currentRange.max)) ? cursor : 0.5*(currentRange.max + currentRange.min)

  let rangeDiff = currentRange.max - currentRange.min
  let loDiff = zoomCenter - currentRange.min
  let hiDiff = currentRange.max - zoomCenter
  explorer.grapher.setTimeRange(zoomCenter - loDiff*zoomScale, zoomCenter + hiDiff*zoomScale)

}


explorer.zoomTimelineByFactorAnimated = function(zoomScale) {
  let srcRange = explorer.grapher.getTimeRange()
  // let cursor = dateAxis.getCursorPosition()

  // let zoomCenter = ((cursor >= currentRange.min) && (cursor <= currentRange.max)) ? cursor : 0.5*(currentRange.max + currentRange.min)

  let rangeDiff = srcRange.max - srcRange.min

  if (explorer.timelineZoomAnimationDstRangeSize) {
    explorer.timelineZoomAnimationSrcRangeSize = rangeDiff
    rangeDiff = explorer.timelineZoomAnimationDstRangeSize
  }
  else
    explorer.timelineZoomAnimationSrcRangeSize = rangeDiff

  explorer.timelineZoomAnimationDstRangeSize = rangeDiff*zoomScale

  if (explorer.timelineZoomAnimationRequest) {
    window.cancelAnimationFrame(explorer.timelineZoomAnimationRequest)
  }

  let startTime = performance.now()
  let transitionTime = 300

  let animationFun = function(timestamp) {
    let u = animateNormalizedParameter(transitionTime, startTime, timestamp)
    let currentRange = explorer.grapher.getTimeRange()
    let currentRangeSize = currentRange.max - currentRange.min
    // FIXME: no cursor in GlGrapher
    let cursor = explorer.grapher.getTimeCursor()
    let newRangeSize = explorer.timelineZoomAnimationSrcRangeSize*(1.0-u) + explorer.timelineZoomAnimationDstRangeSize*u

    let zoomCenter = ((cursor >= currentRange.min) && (cursor <= currentRange.max)) ? cursor : 0.5*(currentRange.max + currentRange.min)

    let loDiff = (zoomCenter - currentRange.min)/currentRangeSize
    let hiDiff = (currentRange.max - zoomCenter)/currentRangeSize
    explorer.grapher.setTimeRange(zoomCenter - loDiff*newRangeSize, zoomCenter + hiDiff*newRangeSize)

    if (u < 1.0) {
      explorer.timelineZoomAnimationRequest = window.requestAnimationFrame(animationFun)
    }
    else {
      explorer.timelineZoomAnimationSrcRangeSize = undefined
      explorer.timelineZoomAnimationDstRangeSize = undefined
      explorer.timelineZoomAnimationRequest = undefined
    }
  }

  explorer.timelineZoomAnimationRequest = window.requestAnimationFrame(animationFun)


}

explorer.moveTimelineByFactor = function(moveFactor) {
  let currentRange = explorer.grapher.getTimeRange()

  let rangeDiff = currentRange.max - currentRange.min
  explorer.grapher.setTimeRange(currentRange.min - rangeDiff*moveFactor, currentRange.max - rangeDiff*moveFactor)

}

explorer.moveTimelineByFactorAnimated = function(moveFactor) {
  let srcRange = explorer.grapher.getTimeRange()

  let srcRangeMin = srcRange.min
  let srcRangeSize = srcRange.max - srcRange.min


  if (explorer.timelineMoveAnimationDstRangeStart) {
    explorer.timelineMoveAnimationSrcRangeStart = srcRangeMin
    srcRangeMin = explorer.timelineMoveAnimationDstRangeStart
  }
  else
    explorer.timelineMoveAnimationSrcRangeStart = srcRangeMin

  explorer.timelineMoveAnimationDstRangeStart = srcRangeMin + srcRangeSize*moveFactor

  if (explorer.timelineMoveAnimationRequest) {
    window.cancelAnimationFrame(explorer.timelineMoveAnimationRequest)
  }

  let startTime = performance.now()
  let transitionTime = 300

  let animationFun = function(timestamp) {
    let u = animateNormalizedParameter(transitionTime, startTime, timestamp)
    let currentRange = explorer.grapher.getTimeRange()
    let currentRangeSize = currentRange.max - currentRange.min

    let newRangeMin = explorer.timelineMoveAnimationSrcRangeStart*(1.0-u) + explorer.timelineMoveAnimationDstRangeStart*u

    explorer.grapher.setTimeRange(newRangeMin, newRangeMin + currentRangeSize)

    if (u < 1.0) {
      explorer.timelineMoveAnimationRequest = window.requestAnimationFrame(animationFun)
    }
    else {
      explorer.timelineMoveAnimationSrcRangeStart = undefined
      explorer.timelineMoveAnimationDstRangeStart = undefined
      explorer.timelineMoveAnimationRequest = undefined
    }
  }

  explorer.timelineMoveAnimationRequest = window.requestAnimationFrame(animationFun)

}

explorer.moveTimelineTo = function(timestamp, positionInView) {
  let currentRange = explorer.grapher.getTimeRange()

  let rangeDiff = currentRange.max - currentRange.min
  let loDiff = rangeDiff*(positionInView)
  let hiDiff = rangeDiff*(1.0-positionInView)
  explorer.grapher.setTimeRange(timestamp - loDiff, timestamp + hiDiff)

}


explorer.deferredTimelineUpdateCallback = function() {
  // console.log(`deferredTimelineUpdateCallback(${startTime}, ${endTime}, ${cursorTime})`)

  explorer.deferredTimelineUpdateTimer = undefined
  updateUrlHash()
  explorer.updateDataDownloadLinks();
}


explorer.addPlot = function(feedId, channelName) {
  let channelId = `${feedId}.${channelName}`

  if (explorer.plots.has(channelId)) {
    console.warn(`plot for ${channelId} already exists at number ${explorer.plots.get(channelId).plotId}.`)
    return
  }

  let feed = esdr.feeds.get(feedId)

  // new plot number is next highest from current plots
  let plotId = Array.from(explorer.plots.values()).reduce((acc, val) => Math.max(acc,val.plotId), 0) + 1

  let channelLabel = feed ? feed.channelLabels.get(channelName) : channelId
  let plotName = `plot-${plotId}`
  let plotContainerName = `plotContainer-${plotId}`


  let labelBlock = document.createElement("div")
  labelBlock.setAttribute("id", `plotLabelBlock-${plotId}`)
  labelBlock.style.padding = "0.1em"
  labelBlock.style.display = "flex"
  labelBlock.style.alignItems = "center"
  // labelBlock.style.position = "absolute"
  // labelBlock.style.top = "0px"
  // labelBlock.style.left = "0px"
  labelBlock.style.backgroundColor = "rgba(255,255,255,0.8)"
  // labelBlock.style.height = "100%"
  // labelBlock.style.width = "100%"
  labelBlock.style.width = "max-content"
  labelBlock.style.fontFamily = "sans-serif"
  // labelBlock.style.fontSize = "smaller"
  // labelBlock.style.zIndex = "2"
// labelBlock.textContent = channelLabel
  labelBlock.addEventListener("mouseover", event => {
    explorer.mapOverlay.highlightMarkers([feedId], true)
  })
  labelBlock.addEventListener("mouseout", event => {
    explorer.mapOverlay.highlightMarkers([], true)
  })


  let labelClose = document.createElement("img")
  labelClose.setAttribute("class", "button-icon")
  labelClose.setAttribute("src", "mapsplode/cross.svg")
  labelClose.style.marginLeft = "0.25em"
  labelClose.style.marginRight = "0.25em"
  labelClose.addEventListener("click", () => explorer.interactiveSelectChannelWithId(channelId, false))

  let labelName = document.createElement("div")
  labelName.setAttribute("id", `plotLabel-${plotId}`)
  labelName.style.whiteSpace = "nowrap"

  labelName.textContent = channelLabel

  labelBlock.appendChild(labelClose)
  labelBlock.appendChild(labelName)



  let extensionsBlock = document.createElement("div")
  extensionsBlock.setAttribute("id", `plot-extension-${plotId}`)
  extensionsBlock.setAttribute("class", "plot-extension")
  // extensionsBlock.style.width = document.getElementById("plotCornerExtension").style.width
  // extensionsBlock.textContent = "here be downloads"

  let extensionsBox = document.createElement("div")
  extensionsBox.setAttribute("class", "plot-extension-box")
  extensionsBox.style.alignItems = "center"
  extensionsBox.style.height = "100%"

  {
    let spacer = document.createElement("div")
    spacer.style.flexGrow = 1
    spacer.style.width = "0px"
    extensionsBox.appendChild(spacer)
  }

  {
    let csvButtonGroup = document.createElement("a")
    csvButtonGroup.setAttribute("id", `plotlink_csv-${plotId}`)
    csvButtonGroup.setAttribute("class", "plots-shadow-group")
    csvButtonGroup.setAttribute("href", "")
    csvButtonGroup.style.flexGrow = 0

    let csvDownloadButton = document.createElement("div")
    csvDownloadButton.setAttribute("class", "plots-toolbar-button plots-toolbar-group-left")
    csvDownloadButton.class = "plots-toolbar-button"
    csvDownloadButton.style.paddingRight = "0px"

    let csvDownloadIcon = document.createElement("img")
    csvDownloadIcon.setAttribute("class", "button-icon")
    csvDownloadIcon.src = "mapsplode/download.svg"

    let csvDownloadButton1 = document.createElement("div")
    csvDownloadButton1.setAttribute("class", "plots-toolbar-button plots-toolbar-group-right")
    csvDownloadButton1.textContent = "CSV"

    csvDownloadButton.appendChild(csvDownloadIcon)
    csvButtonGroup.appendChild(csvDownloadButton)
    csvButtonGroup.appendChild(csvDownloadButton1)
    extensionsBox.appendChild(csvButtonGroup)
  }

  {
    let spacer = document.createElement("div")
    spacer.style.flexGrow = 1
    spacer.style.width = "0px"
    extensionsBox.appendChild(spacer)
  }

  {
    let jsonButtonGroup = document.createElement("a")
    jsonButtonGroup.setAttribute("id", `plotlink_json-${plotId}`)
    jsonButtonGroup.setAttribute("class", "plots-shadow-group")
    jsonButtonGroup.setAttribute("href", "")
    jsonButtonGroup.style.flexGrow = 0

    let jsonDownloadButton = document.createElement("div")
    jsonDownloadButton.setAttribute("class", "plots-toolbar-button plots-toolbar-group-left")
    jsonDownloadButton.class = "plots-toolbar-button"
    jsonDownloadButton.style.paddingRight = "0px"

    let jsonDownloadIcon = document.createElement("img")
    jsonDownloadIcon.setAttribute("class", "button-icon")
    jsonDownloadIcon.src = "mapsplode/download.svg"

    let jsonDownloadButton1 = document.createElement("div")
    jsonDownloadButton1.setAttribute("class", "plots-toolbar-button plots-toolbar-group-right")
    jsonDownloadButton1.textContent = "JSON"

    jsonDownloadButton.appendChild(jsonDownloadIcon)
    jsonButtonGroup.appendChild(jsonDownloadButton)
    jsonButtonGroup.appendChild(jsonDownloadButton1)
    extensionsBox.appendChild(jsonButtonGroup)
  }

  {
    let spacer = document.createElement("div")
    spacer.style.flexGrow = 1
    spacer.style.width = "0px"
    extensionsBox.appendChild(spacer)
  }

  extensionsBlock.appendChild(extensionsBox)

  let {texture: colorMapTexture, range: colorMapRange} = ESDR.sparklineColorMap(feedId, channelName)

  if (!explorer.colorGraphs) {
    colorMapRange = undefined
    colorMapTexture = undefined
  }

  let dataSource = esdr.dataSourceForChannel(feedId, channelName)

  let plot = new ETP(dataSource, colorMapTexture, colorMapRange)

  if (explorer.barGraphs) {
    plot.drawBars = true
    plot.drawPoints = false
    plot.drawLines = false
    plot.drawOverlappingBars = false
  } 
  else if (explorer.lineGraphs) {
    plot.drawBars = false
    plot.drawPoints = false
    plot.drawLines = true
    plot.lineWidth = 1.0
  }
  else if (explorer.pointGraphs) {
    plot.drawBars = false
    plot.drawPoints = true
    plot.drawLines = false
    plot.pointSize = 3.0
  }

  explorer.grapher.addPlot(plotId, plot, labelBlock, extensionsBlock)


  explorer.plots.set(channelId, {plotId: plotId, plot: plot, feedId: feedId, channelName: channelName})


  explorer.setPlotToHeight(plotId, explorer.plotHeight*explorer.plotBaseSize())



  // TODO: data point listener only gets mouse events

}

explorer.removePlot = function(feedId, channelName) {
  let channelId = `${feedId}.${channelName}`
  let plotId = explorer.plots.get(channelId).plotId

  // if it didn't exist in the first place, don't bother
  if (!explorer.plots.has(channelId))
    return

  explorer.grapher.removePlot(plotId)

  explorer.plots.delete(channelId)

}

explorer.highlightPlotsForFeeds = function(feedIds) {
  let feedIdsSet = new Set(feedIds)
  for (let [channelId, {plotId: plotId}] of explorer.plots) {
    let plotFeedId = parseInt(channelId.slice(0, channelId.indexOf(".")))
    let labelElement = document.getElementById(`plotLabelBlock-${plotId}`)
    if (feedIdsSet.has(plotFeedId)) {
      labelElement.style.backgroundColor = "hsla(210,100%,90%,0.8)"
    }
    else {
      labelElement.style.backgroundColor = "hsla(0,0%,100%,0.8)"
    }
  }
}


explorer.setPlotAreaHeight = function(heightPercent) {
  explorer.plotAreaHeightPercent = Math.min(Math.max(heightPercent, explorer.minPlotAreaHeightPercent), explorer.maxPlotAreaHeightPercent)

  let plotArea = document.getElementById("plots")
  let mapArea = document.getElementById("googlemap")

  plotArea.style.height = `${explorer.plotAreaHeightPercent}%`
  mapArea.style.height = `${100-explorer.plotAreaHeightPercent}%`

  let decreaseButton = document.getElementById("decreasePlotAreaHeightButton")
  let increaseButton = document.getElementById("increasePlotAreaHeightButton")

  increaseButton.disabled = (explorer.plotAreaHeightPercent >= explorer.maxPlotAreaHeightPercent)
  decreaseButton.disabled = (explorer.plotAreaHeightPercent <= explorer.minPlotAreaHeightPercent)

}

explorer.increasePlotAreaHeight = function() {
  explorer.setPlotAreaHeight(explorer.plotAreaHeightPercent+20)
}

explorer.decreasePlotAreaHeight = function() {
  explorer.setPlotAreaHeight(explorer.plotAreaHeightPercent-20)
}

explorer.setPlotToHeight = function(plotId, height) {
  explorer.grapher.setPlotHeight(plotId, height)
}

explorer.setPlotsToHeight = function(height) {
  for (let [channelId, {plotId: plotId}] of explorer.plots) {
    explorer.grapher.setPlotHeight(plotId, height)
  }
}

explorer.plotBaseSize = function() {
  let plotsContainerElement = document.getElementById("plotGraphs")
  let lineSize = parseFloat(getComputedStyle(plotsContainerElement).fontSize);
  return lineSize
}

explorer.increasePlotHeight = function() {

  let lineSize = explorer.plotBaseSize();

  let decreaseButton = document.getElementById("decreasePlotHeightButton")
  let increaseButton = document.getElementById("increasePlotHeightButton")
  if (explorer.plotHeight == 2) {
    explorer.plotHeight = 5
    decreaseButton.disabled = false
    explorer.setPlotsToHeight(lineSize*5)
  }
  else if (explorer.plotHeight == 5) {
    explorer.plotHeight = 8
    explorer.setPlotsToHeight(lineSize*8)
  }
  else if (explorer.plotHeight == 8) {
    explorer.plotHeight = 12
    explorer.setPlotsToHeight(lineSize*12)
  }
  else if (explorer.plotHeight == 12) {
    explorer.plotHeight = 20
    explorer.setPlotsToHeight(lineSize*20)
    increaseButton.disabled = true
  }

  increaseButton.disabled = (explorer.plotHeight >= explorer.maxPlotHeight)
  decreaseButton.disabled = (explorer.plotHeight <= explorer.minPlotHeight)

  updateUrlHash()
}

explorer.decreasePlotHeight = function() {

  let lineSize = explorer.plotBaseSize();

  let decreaseButton = document.getElementById("decreasePlotHeightButton")
  let increaseButton = document.getElementById("increasePlotHeightButton")
  if (explorer.plotHeight == 20) {
    explorer.plotHeight = 12
    increaseButton.disabled = false
    explorer.setPlotsToHeight(lineSize*explorer.plotHeight)
  }
  else if (explorer.plotHeight == 12) {
    explorer.plotHeight = 8
    explorer.setPlotsToHeight(lineSize*explorer.plotHeight)
  }
  else if (explorer.plotHeight == 8) {
    explorer.plotHeight = 5
    explorer.setPlotsToHeight(lineSize*explorer.plotHeight)
  }
  else if (explorer.plotHeight == 5) {
    explorer.plotHeight = 2
    explorer.setPlotsToHeight(lineSize*explorer.plotHeight)
    decreaseButton.disabled = true
  }

  increaseButton.disabled = (explorer.plotHeight >= explorer.maxPlotHeight)
  decreaseButton.disabled = (explorer.plotHeight <= explorer.minPlotHeight)

  updateUrlHash()
}

// set explorer to be an object on the window, so it can be accessed from onevent handlers in the html
window.explorer = explorer

// call initMap() as we fully loaded maps api to be able to extend the overlays in mapOverlay.js
initMap()
initPlots()