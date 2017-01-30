'use strict';

/*global L */

var map = L.map('map').setView([0, 0], 2);

L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

var markers = L.geoJson(null, {
    pointToLayer: createClusterIcon
}).addTo(map);

// this example assumes the original point has property CATEGORY_NAME
var CATEGORY_NAME = 'featureclass';

/**
 * Accumulator function that get executed by supercluster.
 * @param pointProperties - mandatory: received by supercluster
 * @param neighborProperties - mandatory: received by supercluster
 * 
 * other parameters such as propertyName have to be supplied in accumulatorFunctionArguments
 */
function accumulatorFunction(propertyName, pointProperties, neighborProperties) {
    var retval = {
        categories: {}
    };
    var pointCategory = typeof pointProperties[propertyName] === 'undefined' ? null : pointProperties[propertyName];
    var neighborCategory = typeof neighborProperties[propertyName] === 'undefined' ? null : neighborProperties[propertyName];
    pointCategory = pointCategory === '' ? 'no-category' : pointCategory;
    neighborCategory = neighborCategory === '' ? 'no-category' : neighborCategory;

    var updatedCount = 0;
    if (pointCategory !== null && neighborCategory !== null) {
        if (pointCategory === neighborCategory) {
            retval.categories[pointCategory] = 2;
        } else {
            retval.categories[pointCategory] = 1;
            retval.categories[neighborCategory] = 1;
        }
    } else if (pointCategory !== null && neighborCategory === null) {
        updatedCount = neighborProperties.categories.hasOwnProperty(pointCategory) ? (neighborProperties.categories[pointCategory] + 1) : 1;
        // console.log('UC ' + pointCategory, updatedCount);
        retval.categories = Object.assign({}, neighborProperties.categories, {
            [pointCategory]: updatedCount
        });
    } else if (pointCategory === null && neighborCategory !== null) {
        updatedCount = pointProperties.categories.hasOwnProperty(neighborCategory) ? pointProperties.categories[neighborCategory] + 1 : 1;
        // console.log('CU ' + neighborCategory, updatedCount);
        retval.categories = Object.assign({}, pointProperties.categories, {
            [neighborCategory]: updatedCount
        });
    } else {
        //First merge
        retval.categories = Object.assign({}, neighborProperties.categories, pointProperties.categories);
        //Then sum common properties
        for (var c of Object.keys(retval.categories)) {
            if (neighborProperties.categories.hasOwnProperty(c) && !pointProperties.categories.hasOwnProperty(c)) {
                retval.categories[c] = neighborProperties.categories[c];
            } else if (pointProperties.categories.hasOwnProperty(c) && !neighborProperties.categories.hasOwnProperty(c)) {
                retval.categories[c] = pointProperties.categories[c];
            } else if (pointProperties.categories.hasOwnProperty(c) && neighborProperties.categories.hasOwnProperty(c)) {
                retval.categories[c] = pointProperties.categories[c] + neighborProperties.categories[c];
            }

        }

    }
    return retval;
}

//See worker.js
var worker = getSuperclusterWorker();

worker.onerror = function(e) {
    console.error('Worker error', e);
};

var ready = false;

worker.onmessage = function(e) {
    if (e.data.ready) {
        ready = true;
        update();
    } else {
        markers.clearLayers();
        markers.addData(e.data);
    }
};

/**
 * - superclusterOptions: options for the supercluster (mandatory)
 * - accumulatorFunction: function([optional_arguments], pointProperties, neighborProperties) - must be provided
 * in order to get the custom property stats for each cluster. Can be defined in the main thread
 * - accumulatorFunctionArguments: optional array of arguments for accumulatorFunction (see optional_arguments above)
 */
worker.postMessage({
    superclusterOptions: {
        maxZoom: 17,
        extent: 256,
        radius: 60,
        log: true
    },
    accumulatorFunction: new Blob([accumulatorFunction.toString()], {
        type: 'application/javascript'
    }),
    accumulatorFunctionArguments: [CATEGORY_NAME]
});

function update() {
    if (!ready) return;
    var bounds = map.getBounds();
    worker.postMessage({
        bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        zoom: map.getZoom()
    });
}

map.on('moveend', update);

function sum(p, n) {
    return p + n;
}

function onMarkerClick(e) {
    var props = e.target.feature.properties;
    var result;
    if (props.cluster) {
        var total = Object.values(props.categories).reduce(sum, 0);
        result = Object.assign({}, props, {
            correct: total === props.point_count
        });
    } else {
        result = props[CATEGORY_NAME] === '' ? 'no-category' : props[CATEGORY_NAME];
    }
    console.log('Clicked', result);
}

function getClusterText(categories, total) {
    var categoryNames = Object.keys(categories);

    var getTooltipHtml = function(htmlString, categoryName) {
        var percent = (100 * categories[categoryName] / total).toFixed(2);
        var line = '<span>' + categoryName + '</span>: ' + percent + '%';
        htmlString += line + '<br>';
        return htmlString;
    };

    return '<div>' + categoryNames.reduce(getTooltipHtml, '') + '</div>';
}

function createClusterIcon(feature, latlng) {
    var props = feature.properties;
    if (!props.cluster) {
        var singleMarkerText = props[CATEGORY_NAME] === '' ? 'no-category' : props[CATEGORY_NAME];
        return L.marker(latlng).on('click', onMarkerClick).bindTooltip(singleMarkerText).openTooltip();
    }
    //.on('click', onMarkerClick);

    var count = props.point_count;
    var size = count < 100 ? 'small' :
        count < 1000 ? 'medium' : 'large';
    var icon = L.divIcon({
        html: '<div><span>' + props.point_count_abbreviated + '</span></div>',
        className: 'marker-cluster marker-cluster-' + size,
        iconSize: L.point(40, 40)
    });
    var clusterMarkerText = getClusterText(props.categories, props.point_count);

    return L.marker(latlng, {
        icon: icon
    }).bindTooltip(clusterMarkerText).openTooltip();

//.on('click', onMarkerClick);
}
