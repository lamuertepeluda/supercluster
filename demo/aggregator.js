var CATEGORY_NAME = 'featureclass';

function aggregatorFunction(point, neighbor) {
    // this example assumes the original point has property CATEGORY_NAME
    var retval = {
        categories: {}
    };
    var pointProperties = point.properties;
    var neighborProperties = neighbor.properties;
    var pointCategory = typeof pointProperties[CATEGORY_NAME] === 'undefined' ? null : pointProperties[CATEGORY_NAME];
    var neighborCategory = typeof neighborProperties[CATEGORY_NAME] === 'undefined' ? null : neighborProperties[CATEGORY_NAME];
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
