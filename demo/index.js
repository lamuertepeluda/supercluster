'use strict';

/*global L */

var map = L.map('map').setView([0, 0], 2);

L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

var markers = L.geoJson(null, {
    pointToLayer: createClusterIcon
}).addTo(map);

var worker = new Worker('worker.js');
var ready = false;

worker.onmessage = function (e) {
    if (e.data.ready) {
        ready = true;
        update();
    } else {
        markers.clearLayers();
        markers.addData(e.data);
    }
};

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

var CATEGORY_NAME = 'featureclass'; //must be the same property used in aggregator.js

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

    var getTooltipHtml = function (htmlString, categoryName) {
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
