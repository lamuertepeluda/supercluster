'use strict';

//origin = .. won't work in a blob
function workerBodyDefinition(origin) {
    try {
        importScripts(origin + '/dist/supercluster.js');
    } catch (ex) {
        console.warn(ex);
        self.terminate();
    }

    var now = Date.now();

    var index;

    function loadData(superclusterOptions) {
        getJSON(origin + '/test/fixtures/places.json', function(geojson) {
            console.log('loaded ' + geojson.length + ' points JSON in ' + ((Date.now() - now) / 1000) + 's');

            index = supercluster(superclusterOptions).load(geojson.features);

            console.log(index.getTile(0, 0, 0));
            postMessage({
                ready: true
            });
        });
    }

    self.onmessage = function(e) {
        var data = e.data;
        if (data.superclusterOptions) {
            var superclusterOptions = data.superclusterOptions;
            if (data.accumulatorFunction instanceof Blob) {
                importScripts(URL.createObjectURL(data.accumulatorFunction));
                if (Array.isArray(data.accumulatorFunctionArguments)) {
                    superclusterOptions['accumulator'] = accumulatorFunction.bind.apply(accumulatorFunction, [null].concat(data.accumulatorFunctionArguments));
                } else {
                    superclusterOptions['accumulator'] = accumulatorFunction; //loaded from blob
                }
            }
            loadData(superclusterOptions);
        }
        if (data.bbox && data.zoom) {
            postMessage(index.getClusters(data.bbox, data.zoom));
        }
    };

    function getJSON(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'json';
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.onload = function() {
            if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300 && xhr.response) {
                callback(xhr.response);
            }
        };
        xhr.send();
    }
}

function getSuperclusterWorker() {
    var workerBodyCode = '(' + workerBodyDefinition.toString() + ')("' + window.location.origin + '")';

    var workerBody = URL.createObjectURL(new Blob([workerBodyCode], {
        type: 'application/javascript'
    }));

    return new Worker(workerBody);
}
