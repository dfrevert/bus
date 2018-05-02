/* BusSchedule.html javascript */

"use strict";

var version = '20180501_1948';

var isDebugging = false;
var buttonMax = 10; // number of recentChoiceButtons, an array from 0 to buttonMax - 1

/*
Can the probable "Previous Choice" be guessed and pre-clicked?
Break the day into 6 hour blocks
Save the "first" chosen "Previous Choice" on each load of the page.
When last 3 choices match, start pre-selecting that choice. 

*/


if(isDebugging) {
	if (Modernizr.localstorage) {
		console.log("localStorage is supported.");
	} else {
		console.log("localStorage is NOT supported.");
	}
}

// ---------------- localStorage as object -- start
var DbTables = class DbTables {
	constructor(databaseName) {
		this.databaseName = databaseName;
	}

	setByKey(key, value) {
		var fullKey = '' + this.databaseName + '.' + key;
		if (isDebugging) {
			console.log("setByKey(" + fullKey + ", " + value + ")");
		}
		if (!this.supports_html5_storage) {
			console.log("Unable to setByKey(" + fullKey + ", " + value + ").");
			return false;
		}
		localStorage[fullKey] = value;
		return true;
	}

	getByKey(key) {
		var fullKey = '' + this.databaseName + '.' + key;
		if (isDebugging) {
			console.log("getByKey(" + fullKey + ")");
		}
		return localStorage[fullKey];
	}

	get supports_html5_storage() {
		if (this.storageAvailable('localStorage')) {
			return true; // Yippee! We can use localStorage awesomeness
		}
		else {
			return false;
			// Too bad, no localStorage for us
		}
	}

	// suggested by https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
	storageAvailable(type) {
		try {
			var storage = window[type],
				x = '__storage_test__';
			storage.setItem(x, x);
			storage.removeItem(x);
			return true;
		}
		catch (e) {
			console.log("Storage is not available.");
			return e instanceof DOMException && (
				// everything except Firefox
				e.code === 22 ||
				// Firefox
				e.code === 1014 ||
				// test name field too, because code might not be present
				// everything except Firefox
				e.name === 'QuotaExceededError' ||
				// Firefox
				e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
				// acknowledge QuotaExceededError only if there's something already stored
				storage.length !== 0;
		}
	}
};

class DbTable {
	constructor(dbTables, tableName) {
		this.databaseName = dbTables.databaseName;
		this.tableName = tableName;
	}

	setByKey(key, value) {
		var fullKey = '' + this.databaseName + '.' + this.tableName + '.' + key;
		if(isDebugging) {
			console.log("DbTable.setByKey(" + fullKey + ", " + value + ")");
		}
		localStorage[fullKey] = value;
	}
	
	getByKey(key) {
		var fullKey = '' + this.databaseName + '.' + this.tableName + '.' + key;
		if(isDebugging) {
			console.log("DbTable.getByKey(" + fullKey + ")");
		}
		return localStorage[fullKey];
	}
	
	removeByKey(key) {
		var fullKey = '' + this.databaseName + '.' + this.tableName + '.' + key;
		if(isDebugging) {
			console.log("DbTable.removeByKey(" + fullKey + ")");
		}
		return localStorage.removeItem(fullKey);
	}
	
	deleteAll() {
		if (!db1.supports_html5_storage) { return null; }
		var i = 0;
		var removedCount = 0;
		var result = null;
		do {
			result = localStorage.key(i);
			if(result !== undefined && result !== null && result.indexOf(this.databaseName + '.' + this.tableName + '.') === 0) {
				localStorage.removeItem(result);
				removedCount++;
			} else {
				i++;
			}
		} 
		while (result !== undefined && result !== null);
		
		if(isDebugging) {
			console.log("From " + this.databaseName + "." + this.tableName + ", deleted " + removedCount.toString() + " of " + i.toString() + " (key, value) pairs.");
		}
		return true;
	}
}

var db1 = new DbTables('BusDB');

var tblVehicleTracked = new DbTable(db1, 'VehicleTracked');
var tblVehicleLocation = new DbTable(db1, 'VehicleLocation');
var tblRouteDirections = new DbTable(db1, 'RouteDirections');
var tblBusStopNumber = new DbTable(db1, 'BusStopNumber');
var tblRouteDirectionStopActive = new DbTable(db1, 'RouteDirectionStopActive');
var tblRouteDirectionStopDeparture = new DbTable(db1, 'RouteDirectionStopDeparture');
var tblRouteDirectionStops = new DbTable(db1, 'RouteDirectionStops');
var tblStop = new DbTable(db1, 'Stop');
var tblRecentChoice = new DbTable(db1, 'RecentChoice');

// ---------------- localStorage as object -- end


// todo
//     First time experience
//         Open the Pick Route panel and the Enter Bus Stop panel
//         Need a graphic to indicate where to find a Bus Stop number when at a bus stop
//     SVG of a numbered bus stop, that includes the text
//     Morning/Evening function for seasoned traveler
//         Look at time of day and when first opening the app, use the appropriate setting.
//
//  notes
//      Latitude and longitude, how much accuracy is enough? 1 deg latitude at 45degrees is 364604.73 ft.
//                                                           50ft is 1.37e-4 or .000137 degrees
//                                                           1 deg longitude at 45deg    is 258683.23 ft.
//                                                           50ft is 1.93e-4 or .000193 degrees
//
function getActiveNumberedBusStop() {
	var raw = db1.getByKey("ActiveNumberedBusStop");
	if(raw === undefined || raw === null) {
		if(isDebugging) {
			console.log("getActiveNumberedBusStop() will return null because db1.getByKey('ActiveNumberedBusStop') returned null");
		}
		return null;
	}
	return JSON.parse(raw);
}

function getRouteDirectionStopActive() {
	var raw = db1.getByKey("RouteDirectionStopActive");
	if(raw === undefined || raw === null) {
		if(isDebugging) {
			console.log("getRouteDirectionStopActive() will return null because db1.getByKey('RouteDirectionStopActive') returned " + raw === undefined ? "undefined": "null");
		}
		return null;
	}
	return JSON.parse(raw);
}

function logAjax(xmlHttp, description) {
	if(isDebugging) {
		console.log("logAjax(xmlHttp, " + description + ")  .readyState=" + xmlHttp.readyState + "   .status=" + xmlHttp.status);
	}
	if(description.substring(0,16) === "showBusLocation2") {
		var progress = document.getElementById("mapProgress");
		logAjaxProgressBackground(xmlHttp.readyState, progress);
	}
	if(description.substring(0,8) === "showStop" || description.substring(0,8) === "getDepar") {
		progress = document.getElementById("detailsProgress");
		logAjaxProgressBackground(xmlHttp.readyState, progress);
	}
}

function logAjaxProgressBackground(readyState, progressElement) {
	progressElement.style.width = readyState * 25 + "%";
	if(readyState === 4) {
		progressElement.classList.remove("bg-danger");
		progressElement.classList.add("bg-success");
	} else {
		progressElement.classList.remove("bg-success");
		progressElement.classList.add("bg-danger");			
	}	
}

function showStop2(enteredStopNumber) {
	if(isDebugging) {
		console.log("showStop2(n) n=" + JSON.stringify(enteredStopNumber));
	}
	var stopNumberInfo;
	if(enteredStopNumber.stopNumber !== undefined) {
		stopNumberInfo = enteredStopNumber;
	} else {
		stopNumberInfo = JSON.parse(enteredStopNumber);
	}
	if(isDebugging) {
		console.log("showStop2  stopNumberInfo=" + JSON.stringify(stopNumberInfo));
	}
	saveNumberedBusStopInfo(stopNumberInfo);
	showStop(stopNumberInfo.stopNumber);
	
	document.getElementById("collapseDetails").classList.remove("collapse");
	document.getElementById("collapseRoute").classList.add("collapse");

}

function showStop(stopNumber) {
	var xmlhttp2 = new XMLHttpRequest();
	var url2 = "https://svc.metrotransit.org/NexTrip/" + stopNumber.toString() + "?format=json";
	
	xmlhttp2.onreadystatechange = function () {
		logAjax(xmlhttp2, "showStop(" + stopNumber.toString() + ")");

		if (xmlhttp2.readyState === 4 && xmlhttp2.status === 200) {
			var myArr = JSON.parse(xmlhttp2.responseText);
			buildStopResults(myArr);
		}
	};
	xmlhttp2.open("GET", url2, true);
	xmlhttp2.send();
}

function saveNumberedBusStopInfo(enteredStopNumber) {
	var activeNumberedBusStop = getActiveNumberedBusStop();
	if(activeNumberedBusStop !== undefined && activeNumberedBusStop !== null && activeNumberedBusStop.stopNumber === enteredStopNumber.stopNumber) {
		return;
	}
	
	if(isDebugging) {
		console.log("saveNumberedBusStopInfo(" + JSON.stringify(enteredStopNumber) + ")");
	}

	// lookup the stop offset
	var oStopNumber = "o" + enteredStopNumber.stopNumber.toString();
	var dbStopNumber = db1.getByKey(oStopNumber);
	if(dbStopNumber === undefined || dbStopNumber === null) {
		if(isDebugging) {
			console.log("saveNumberedBusStopInfo(" + enteredStopNumber.stopNumber.toString() + ") being skipped because db1.getByKey(\"" + oStopNumber + "\") is null. Skipping.");
		}
		return;
	}

	var offsetForStop = JSON.parse(dbStopNumber);
	if(offsetForStop === undefined || offsetForStop === null) {
		if(isDebugging) {
			console.log("saveNumberedBusStopInfo(" + enteredStopNumber.stopNumber.toString() + ") caused offsetForStop to be null. Skipping.");
		}
		return;
	}

	if(isDebugging) {
		console.log("saveNumberedBusStopInfo(" + enteredStopNumber.stopNumber.toString() + ") called, offsetForStop = " + JSON.stringify(offsetForStop));
	}
	
	// offsets have been multiplied by 10,000 and rounded to 0 from these MIN values
	// @lat_min     @lon_min
    // 44.707146	-94.157372
	// stop_id  stop_lat   stop_lon   stop_name
	// 15574    44.912369  -93.252335 Bloomington Ave S & 50th St E
	// 	setDbValue("o15574","{\"n\":2052,\"e\":9050}");
    var latitude = 0.0 + offsetForStop.n/10000.0 + 44.707146;
	var longitude = 0.0 + offsetForStop.e/10000.0 - 94.157372;
	
	// ActiveNumberedBusStop needs to include the description from the BusStopNumberEntered
	var description = enteredStopNumber.description;
	
	var busStopPoint = {"stopNumber":enteredStopNumber.stopNumber, "latitude": latitude, "longitude": longitude, "description": description};
	db1.setByKey("ActiveNumberedBusStop", JSON.stringify(busStopPoint));
	
	// rotateRecentNumberedStops();
	rotateRecentChoices(busStopPoint);
	resetRecentChoiceButtons();
}

function buildStopResults(arr) {
	isCurrentTargetANumberedBusStop = true;

	$("#collapseDetails").collapse("show");

	if(arr === undefined || arr === null || arr.length === 0) {
		var element = document.getElementById("id00B");
		element.innerHTML = '<div class="alert alert-warning"><strong>Warning!</strong> Metro Transit does not report any activity at the stop.</div>';
		element.style.display = "block";
		return;
	}

	var i;

	var out = "<div><table class=\"table table-sm table-responsive-sm table-bordered\"><tr><th>Route</th><th>Departs</th><th>Banner</th><th>Heading</th><th>Miles</th></tr>";

	var targetPoint = getActiveNumberedBusStop();
	
	for(i = 0; i < arr.length; i++) {
	
		var milesAndDirectionLetter = "";
		if(targetPoint !== undefined && arr[i] !== undefined && arr[i].VehicleLatitude !== undefined && arr[i].VehicleLatitude !== 0) {
			var busAtPoint = {"latitude": arr[i].VehicleLatitude, "longitude": arr[i].VehicleLongitude};
			var milesAway = miles(busAtPoint, targetPoint);	
			milesAndDirectionLetter = milesAndDirection(milesAway);
		}
	
		out += "<tr><td>" +
		// "</td><td>" +
		(arr[i].BlockNumber === undefined ? arr[i].Route + arr[i].Terminal : '<button type="button" class="btn btn-primary btn-md" onclick="busNumberClicked2(' + arr[i].BlockNumber.toString() + ', ' + arr[i].Route +')" >' + arr[i].Route + arr[i].Terminal + ' bus:' + arr[i].BlockNumber.toString() + '</button>') +
		"</td><td>" +
		arr[i].DepartureText +
		"</td><td>" +
		arr[i].Description +
		"</td><td>" +
		stripBound(arr[i].RouteDirection) +
		"</td><td>" +
		(milesAndDirectionLetter === "" ? "&nbsp;" : milesAndDirectionLetter) +
		"</td></tr>";
	}
	out += "</table></div>";
	document.getElementById("id00B").innerHTML = out;
	document.getElementById("id00B").style.display = "block";
	
	if(targetPoint !== undefined && targetPoint !== null) {
		document.getElementById("title1").innerHTML = "Bus Schedule " + targetPoint.stopNumber;
		
		_numberedStopValue = JSON.parse('{"stopNumber":' + targetPoint.stopNumber + ', "description":"' + targetPoint.description + '"}');
		
		if(isDebugging) {
			console.log("buildStopResults(arr) _numberedStopValue=" + JSON.stringify(_numberedStopValue));
		}
		
		var outButton = '<button type="button" class="btn btn-primary" onclick="showStop(_numberedStopValue.stopNumber);" >' + targetPoint.stopNumber + ' - ' + targetPoint.description + '</button>';
		var timeOfQuery = new Date();
		outButton += '<label>&nbsp;&nbsp;' + timeOfQuery.toHHMMSS() + '</label>';
		
		document.getElementById("id00C").innerHTML = outButton;	
	}
}

function stripBound(routeDirection) {
	if(routeDirection === undefined || routeDirection === null) {
		return "";
	}
	if(routeDirection === "NORTHBOUND") {return "North";}
	if(routeDirection === "SOUTHBOUND") {return "South";}
	if(routeDirection === "EASTBOUND") {return "East";}
	if(routeDirection === "WESTBOUND") {return "West";}
	return routeDirection;
}

var _numberedStopValue;
// to use:     alert("current time is " + new Date().toHHMMSS());
Date.prototype.toHHMMSS = function () {
	// want everything up to the first space
	var timeString = this.toTimeString();
	var spaceAt = timeString.indexOf(" ");
	return timeString.substr(0, spaceAt);
};

function showBusLocation2(route, blockNumber) {
	var xmlhttp8 = new XMLHttpRequest();
	var url8 = "https://svc.metrotransit.org/NexTrip/VehicleLocations/" + route + "?format=json";

	if(isDebugging) {
		console.log("showBusLocation2(" + route + ", " + blockNumber + ") called.  url8=" + url8);
	}
	
	xmlhttp8.onreadystatechange = function () {
		logAjax(xmlhttp8, "showBusLocation2(" + route + ", " + blockNumber + ")");

		if (xmlhttp8.readyState === 4 && xmlhttp8.status === 200) {
			populateVehicleLocations2(route, blockNumber, xmlhttp8.responseText);
		}
	};
	xmlhttp8.open("GET", url8, true);
	xmlhttp8.send();
}

function populateVehicleLocations2(route, blockNumber, responseText) {
	var arr = JSON.parse(responseText);
	var i;
	for(i = 0; i < arr.length; i++) {
		if(arr[i].Route === route.toString() && arr[i].BlockNumber === blockNumber) {
			var newVal = {"direction": arr[i].Direction, 
						"locationTime": arr[i].LocationTime,
						"latitude": arr[i].VehicleLatitude,
						"longitude": arr[i].VehicleLongitude };
			tblVehicleLocation.setByKey(route.toString() + '.' + blockNumber.toString(), JSON.stringify(newVal));
			rewriteActualTableData(route, blockNumber);

			// assumes only one block number needs to be clickable
			return;
		}
		// Object { Bearing: 0, BlockNumber: 1203, Direction: 4, LocationTime: "/Date(1447298877000-0600)/", 
		//          Odometer: 0, Route: "14", Speed: 0, Terminal: "R", 
		//          VehicleLatitude: 44.864286, VehicleLongitude: -93.243361 }
	}
}

var secondsElapsedOffset = 0;
function rewriteActualTableData(route, blockNumber) {
	// nn sec ago:  (up to 100)   n.n min ago:  (up to 5 minutes)
	// miles & direction
	var busLastAt = JSON.parse(tblVehicleLocation.getByKey(route.toString() + '.' + blockNumber.toString()));
	var busLocationTime = fromDateString(busLastAt.locationTime);
	
	myBlockNumber = blockNumber;
	
	addMarker({"route":route, "blockNumber":blockNumber, "time":busLocationTime, "latitude":busLastAt.latitude, "longitude":busLastAt.longitude});
	
	var now = new Date();
	var timezoneOffsetInMinutes = now.getTimezoneOffset();
	var secondsElapsed = (now - busLocationTime.getTime() + 1000 * 60 * timezoneOffsetInMinutes) / 1000;
	// secondsElapsed should never be less than 0
	//                is an indication that the local clock and the Server clock differ
	//                need to save an offset value.
	if(secondsElapsed < 0 && secondsElapsedOffset < 60) {
		secondsElapsedOffset = -secondsElapsed + secondsElapsedOffset;
		if(isDebugging) {
			console.log("secondsElapsedOffset=" + secondsElapsedOffset + " adjusted");
		}
	}
	secondsElapsed = secondsElapsed + secondsElapsedOffset;
	
	var s = "";
	if(0 <= secondsElapsed && secondsElapsed < 100) {
		s += secondsElapsed.toFixed(0) + " sec ago";
	}
	else {
		s += (secondsElapsed/60).toFixed(1) + " min ago";
	}
	s += "<br>";

	// ScheduledStop info
	var busAtPoint = {"latitude": busLastAt.latitude, "longitude": busLastAt.longitude};
	var routeDirectionStopActive = getRouteDirectionStopActive();
	var activeStop = null;
	if(routeDirectionStopActive !== undefined && routeDirectionStopActive !== null) {
		var raw = tblStop.getByKey(routeDirectionStopActive.stop);
		if(raw === undefined || raw === null) {
			console.log("Warning: rewriteActualTableData could not find an activeStop.  tblStop.getByKey(" + routeDirectionStopActive.stop + ") is null.");
		}
		else {
			activeStop = JSON.parse(raw);
		}
	}
	
	var busStopPoint = null;
	if(isCurrentTargetANumberedBusStop) {
		busStopPoint = getActiveNumberedBusStop();
	} else {
		if(activeStop !== undefined && activeStop !== null) {
			var actualElement = document.getElementById("Actual_" + route.toString() + "_" + blockNumber.toString());
			if(actualElement !== undefined && actualElement !== null) {
				busStopPoint =  {"latitude": activeStop.latitude, "longitude": activeStop.longitude};
			}
		}
	}
	if(busStopPoint === null) {
		if(isDebugging) {
			console.log("rewriteActualTableData(" + route.toString() + ", " + blockNumber.toString() + ") called, activeNumberedBusStop db value is Null!");
		}
		return;
	}

	var milesAway = miles(busAtPoint, busStopPoint);
	s += milesAndDirection(milesAway);
	s += '<br>bus: ' + markupBlockNumberButton(blockNumber);
	
	var actualRouteBlockNumber = document.getElementById("Actual_" + route.toString() + "_" + blockNumber.toString());
	if(actualRouteBlockNumber !== undefined && actualRouteBlockNumber !== null) {
		actualRouteBlockNumber.innerHTML = s; 
	}
}

function markupBlockNumberButton(blockNumber) {
	return '<button type="button" class="btn btn-primary btn-sm" onclick="busNumberClicked(' + blockNumber.toString() + ')" >' + blockNumber.toString() + '</button>';
}

// like:   "\/Date(1447715700000-0600)\/"
function fromDateString(str) {
	var res = str.match(/\/Date\((\d+)(?:([+-])(\d\d)(\d\d))?\)\//);
	if (res === null)
		return new Date(NaN); // or something that indicates it was not a DateString
	var time = parseInt(res[1], 10);
	if (res[2] && res[3] && res[4]) {
		var dir = res[2] === "+" ? -1 : 1,
			h = parseInt(res[3], 10),
			m = parseInt(res[4], 10);
		time += dir * (h * 60 + m) * 60000;
	}
	return new Date(time);
}

function selectRoute() {
	// if we already know the routes, saved to localStorage, use that.
	if(Modernizr.localstorage) {
		var p =  db1.getByKey("Routes"); 
		if(p !== undefined) {
			populateRoutes(p);
			return;
		}
	}

	var xmlhttp3 = new XMLHttpRequest();
	var url3 = "https://svc.metrotransit.org/NexTrip/Routes?format=json";

	xmlhttp3.onreadystatechange = function () {
		logAjax(xmlhttp3, "selectRoute()");

		if (xmlhttp3.readyState === 4 && xmlhttp3.status === 200) {
			populateRoutes(xmlhttp3.responseText);
			db1.setByKey("Routes", xmlhttp3.responseText);
		}
	};
	xmlhttp3.open("GET", url3, true);
	xmlhttp3.send();
}

function populateRoutes(responseText) {
	var arr = JSON.parse(responseText);
	var i;
	// var out = '<div id="routeButtonGroup" class="btn-group btn-group-md-1" >';
	var out = '<div id="routeButtonGroup" >';
	var j = 0;
	for(i = 0; i < arr.length; i++) {
		out += '<button type="button" class="btn btn-primary" style="margin-right:4px; margin-bottom:4px;" onclick="routeClicked(' + arr[i].Route + ')" >' + arr[i].Route + '</button>';
	}
    out += "</div>";
    document.getElementById("id00RouteDirectionStop").innerHTML = out;
	document.getElementById("id00RouteDirectionStop").style.display = "block";
}

// handle the routeButtonGroup click
$('#routeButtonGroup button').on("click", function() {
    $(this).addClass('active').siblings().removeClass('active');
	myRoute = $(this).Value;
});


function busNumberClicked2(blockNumber, routeNumber) {
	myRoute = routeNumber;
	
	if(map === undefined || map === null) {
		var targetStop = getActiveNumberedBusStop();
		if(targetStop !== undefined && targetStop !== null) {
			myBlockNumber = blockNumber;
			document.getElementById("collapseMap").classList.remove("collapse");			
			initializeMap2(targetStop);
		}
	}

	busNumberClicked(blockNumber);
	return;
}

function busNumberClicked(blockNumber) {
	var stop;
	var stopMine;
	if(myBlockNumber === blockNumber) {
		if(map === undefined || map === null) {
			stop = tblStop.getByKey(myStop);
			if(stop !== undefined && stop !== null) {
				stopMine = JSON.parse(stop);
				document.getElementById("collapseMap").classList.remove("collapse");			
				initializeMap2(stopMine);
				if(isDebugging) {
					console.log("busNumberClicked line 614, stopMine=" + JSON.stringify(stopMine) + " initializeMap2 called.");
				}
			}
		}
		showBusLocation2(myRoute, blockNumber);
		return;
	}

	myBlockNumber = blockNumber;
	// set a timeout for when to stop tracking the bus by BlockNumber.
	//                                                         20 minutes from now
	myBlockNumberTimeout = new Date((new Date()).getTime() + 20 * 60 * 1000);
	// save the current row's info, so it can be used to populate the missing row.

	if(Modernizr.localstorage) {
		var p = tblRouteDirectionStopDeparture.getByKey(myRoute + '.' + myDirection + '.' + myStop);
		if(p !== undefined && p !== null) {
			var arr = JSON.parse(p);
			var i;
			for(i = 0; i < arr.length; i++) {
				if(arr[i].BlockNumber === blockNumber) {
					var newValue = JSON.stringify(arr[i]);	
					var isOk = tblVehicleTracked.setByKey(blockNumber, newValue);
					
					if(map === undefined) {
						stop = tblStop.getByKey(myStop);
						if(stop !== undefined && stop !== null) {
							stopMine = JSON.parse(stop);
							initializeMap2(stopMine);
						}
					}
				}
			}
		}
	}
}

function routeClicked(route) {
	if(myRoute === undefined || myRoute === null || myRoute !== route) {
		$("#selectDirectionButton").removeClass("active");	
		$("#selectStopButton").removeClass("active");	
	}
	myRoute = route;
	// show the selected route 
	document.getElementById('selectedRoute').innerHTML = '&nbsp;:&nbsp;' + route + '&nbsp;&nbsp;&nbsp;';
	selectRouteDirections(route);
}

// --------------------- RouteDirections
function selectRouteDirectionsUsingMyRoute() {
	$("#selectStopButton").removeClass("active");	
	selectRouteDirections2(myRoute, true, true);
}

function selectRouteDirections(route) {
	selectRouteDirections2(route, true, true);
}

function selectRouteDirections3(route) {
	selectRouteDirections2(route, false, false);
}

function selectRouteDirections2(route, shouldCreateButton, shouldPopulate) {
	// if route directions are known, use them
	if(Modernizr.localstorage) {
		var p =  tblRouteDirections.getByKey(route);
		if(p !== undefined) {
			if(shouldCreateButton && shouldPopulate) {
				populateRouteDirections(route, p);
			}
			return;
		}
	}

	var xmlhttp4 = new XMLHttpRequest();
	var url4 = "https://svc.metrotransit.org/NexTrip/Directions/" + route + "?format=json";
	
	// [{"Text":"NORTHBOUND","Value":"4"},{"Text":"SOUTHBOUND","Value":"1"}]
	// 1 = South, 2 = East, 3 = West, 4 = North.
	// one of 2 possible settings   ns or ew, each will cause the UI to show 2 buttons.

	xmlhttp4.onreadystatechange = function (shouldCreateButton) {
		logAjax(xmlhttp4, "selectRouteDirections2(" + route + ", " + shouldCreateButton + ", " + shouldPopulate + ")");

		if (xmlhttp4.readyState === 4 && xmlhttp4.status === 200) {
			if (shouldCreateButton) {
				populateRouteDirections(route, xmlhttp4.responseText);
			}
			tblRouteDirections.setByKey('' + route, xmlhttp4.responseText);
		}
	};
	xmlhttp4.open("GET", url4, true);
	xmlhttp4.send();
}

function populateRouteDirections(route, responseText) {
	var arr = JSON.parse(responseText);
    var i;
	var out = '<div id="routeDirectionButtonGroup">';
    for(i = 0; i < arr.length; i++) {
		out += '<button type="button" class="btn btn-primary" style="margin-right:4px; margin-bottom:4px;" onclick="routeDirectionClicked(' + route + ', ' + arr[i].Value + ')" >' + arr[i].Text + '</button>';
	}
    out += "</div>";
    document.getElementById("id00RouteDirectionStop").innerHTML = out;
	document.getElementById("id00RouteDirectionStop").style.display = "block";
	
	$("#selectDirectionButton").addClass("active");	
}

function routeDirectionClicked(route, direction) {
	if(myRoute === undefined || myRoute !== route || myDirection === undefined || myDirection !== direction) {
		$("#selectStopButton").removeClass("active");	
	}
	myRoute = route;
	myDirection = direction;

	document.getElementById('selectedDirection').innerHTML = '&nbsp;:&nbsp;' + directionAsString(direction) + '&nbsp;&nbsp;&nbsp;';

	if(isDebugging) {
		console.log("routeDirectClicked(" + route + ", " + direction + ")  myRoute=" + myRoute + "  myDirection=" + myDirection);
	}
	selectRouteDirectionStops(route, direction);
}

// --------------------- RouteDirectionStops
function selectRouteDirectionStopsUsingMyDirection(){
	selectRouteDirectionStops2(myRoute, myDirection, true);
}

function selectRouteDirectionStops(route, direction) {
	selectRouteDirectionStops2(route, direction, true);
}

function selectRouteDirectionStops2(route, direction, shouldCreateButtons) {
	// if route direction stops are known, use them
	if(Modernizr.localstorage) {
		var p =  tblRouteDirectionStops.getByKey(route + '.' + direction);
		if(p !== undefined) {
			if(shouldCreateButtons) {
				populateRouteDirectionStops(route, direction, p);
			}
			return;
		}
	}

	var xmlhttp5 = new XMLHttpRequest();
	var url5 = "https://svc.metrotransit.org/NexTrip/Stops/" + route + "/" + direction + "?format=json";

	xmlhttp5.onreadystatechange = function (shouldCreateButtons) {
		logAjax(xmlhttp5, "selectRouteDirectionStops2(" + route + ", " + direction + ", " + shouldCreateButtons + ")");
		if (xmlhttp5.readyState === 4 && xmlhttp5.status === 200) {
			if (shouldCreateButtons) {
				populateRouteDirectionStops(route, direction, xmlhttp5.responseText);
			}
			tblRouteDirectionStops.setByKey(route + "." + direction, xmlhttp5.responseText);
		}
	};
	xmlhttp5.open("GET", url5, true);
	xmlhttp5.send();
}

function populateRouteDirectionStops(route, direction, responseText) {
	var arr = JSON.parse(responseText);
    var i;
	var out = '<div id="routeDirectionStopButtonGroup">';
    for(i = 0; i < arr.length; i++) {
		out += '<button type="button" class="btn btn-primary" style="margin-right: 6px; margin-bottom: 6px;" onclick="routeDirectionStopClicked(' + route + ', ' + direction + ', &quot;' + arr[i].Value + '&quot;, &quot;' + arr[i].Text + '&quot;)" >' + arr[i].Text + '</button>';
	}
    out += "</div>";

	var id00Route = document.getElementById("id00RouteDirectionStop");
    id00Route.innerHTML = out;
	id00Route.style.display = "block";
	$("#selectStopButton").addClass("active");	
}

function routeDirectionStopClicked(route, direction, stop, stopDescription) {
	myRoute = route;
	myDirection = direction;
	
	if(myStop === undefined || myStop === null || myStop !== stop) {
		document.getElementById('selectedStop').innerHTML = '&nbsp;&nbsp;' + stopDescription + '&nbsp;&nbsp;&nbsp;';
	}
	myStop = stop;
	if(isDebugging) {
		console.log("routeDirectionStop()  myRoute=" + myRoute 
			+ "  myDirection=" + myDirection
			+ "  myStop=" + myStop);
	}
	// open the details section
	document.getElementById("collapseDetails").classList.remove("collapse");
	document.getElementById("collapseBusStop").classList.add("collapse");
	
	getDepartures(route, direction, stop);
}

// --------------------- Departures
function getDepartures(route, direction, stop) {
	//  Scheduled stops

	var xmlhttp6 = new XMLHttpRequest();
	var url6 = "https://svc.metrotransit.org/NexTrip/" + route + "/" + direction + "/" + stop + "?format=json";
	
	xmlhttp6.onreadystatechange = function () {
		logAjax(xmlhttp6, "getDepartures(" + route + ", " + direction + ", " + stop + ")");
		if (xmlhttp6.readyState === 4 && xmlhttp6.status === 200) {
			populateDepartures(route, direction, stop, xmlhttp6.responseText);
		}
	};
	xmlhttp6.open("GET", url6, true);
	xmlhttp6.send();
}

function populateDepartures(route, direction, stop, responseText) {
	var busAtPoint;
	var milesAway;
	var milesAndDirectionLetter;
	var arr = JSON.parse(responseText);
	var i;
	var isValid = false;
	var hasActuals = false;
	var actualBlockNumber = 0;
	
	var targetPoint = null;
	var scheduledStop = tblStop.getByKey(stop);
	if(scheduledStop !== undefined && scheduledStop !== null) {
		targetPoint = JSON.parse(scheduledStop);
	}

	isCurrentTargetANumberedBusStop = false;
	
	var out = '<div><table class="table table-sm table-responsive-sm table-bordered"><tr><th>Actual</th><th>Route</th><th>Departs</th><th>Banner</th><th>Milestone</th><th>Miles</th></tr>';
	
	// a tracked bus number, could disappear from these results, even though it has not reached the stop
	//     need to detect that the tracked bus number is not in the results
	var shouldShowTrackedBus = false;
	if(myBlockNumber > 0 && new Date() < myBlockNumberTimeout) {
		var hasBlockNumberMatch = false;
		for(i = 0; i < arr.length; i++) {
			if(arr[i].BlockNumber === myBlockNumber) {
				hasBlockNumberMatch = true;
			}
		}
		shouldShowTrackedBus = !hasBlockNumberMatch;
		
		if(shouldShowTrackedBus) {
			// need to be able to add based on a saved row, 
			if(Modernizr.localstorage) {
				var p = tblVehicleTracked.getByKey(myBlockNumber.toString());
				if(p !== undefined && p !== null) {
					var pI = JSON.parse(p);

					milesAndDirectionLetter = " ? ";
					
					// pI will have a stale version of the row
					//     getDbValue("VehicleLocation.14.1350")    VehicleLocation.14.1350={"direction":1, "locationTime":"/Date(1491594644000-0500)/", "latitude":44.97766, "longitude":-93.27093}
					var vT = tblVehicleLocation.getByKey(route.toString() + '.' + myBlockNumber.toString());
					if(vT !== undefined && vT !== null) {
						var vTI = JSON.parse(vT);

						if(targetPoint !== undefined && vTI !== undefined && vTI.latitude !== undefined && vTI.latitude !== "0") {
							busAtPoint = {"latitude": vTI.latitude, "longitude": vTI.longitude};
							milesAway = miles(busAtPoint, targetPoint);	
							milesAndDirectionLetter = milesAndDirection(milesAway);
						}
					}

					out += '<tr><td id="Actual_' + route.toString() + '_' + pI.BlockNumber.toString() + '" class="bg-success" >' +	pI.Actual +	'</td><td>' +

					pI.Route + pI.Terminal +
					"</td><td>" +
					" - - " + /* pI.DepartureText + */
					"</td><td>" +
					pI.Description +
					"</td><td>" +
					(pI.VehicleLatitude === undefined || pI.VehicleLatitude === null || pI.VehicleLatitude === "0" ) ? "&nbsp;" : passedMilestone(pI).simple +
					"</td><td>" +
					(milesAndDirectionLetter !== "" ? milesAndDirectionLetter : pI.VehicleLatitude === undefined || pI.VehicleLatitude === null || pI.VehicleLatitude === "0" ? "&nbsp;" : distanceInMiles3Digits(pI)) +
					"</td></tr>";
				}
			}
		}
	}
	
	if(isDebugging) {
		console.log("populateDepartures  myBlockNumber:" + myBlockNumber.toString() + ", shouldShowTrackedBus:" + shouldShowTrackedBus);
	}
	
	for(i = 0; i < arr.length && i < buttonMax; i++) {
		if(!isValid && arr[i] !== undefined && arr[i].VehicleLatitude !== undefined) {
			isValid = true;
		}
		if(!hasActuals && arr[i].Actual !== undefined && arr[i].Actual) {
			hasActuals = true;
			actualBlockNumber = arr[i].BlockNumber;
		}

		// copied from elsewhere
		milesAndDirectionLetter = "";
		if(targetPoint !== undefined && targetPoint !== null && arr[i] !== undefined && arr[i].VehicleLatitude !== undefined && arr[i].VehicleLatitude !== 0) {
			busAtPoint = {"latitude": arr[i].VehicleLatitude, "longitude": arr[i].VehicleLongitude};
			milesAway = miles(busAtPoint, targetPoint);	
			milesAndDirectionLetter = milesAndDirection(milesAway);
		}

		out += '<tr>';

		out += 
		arr[i].Actual === undefined || arr[i].Actual === null || !arr[i].Actual ? '<td>&nbsp;</td>' : '<td id="Actual_' + route.toString() + '_' + arr[i].BlockNumber.toString() + '" class="bg-success" >' + arr[i].Actual + '</td>';

		out +=
		'<td>' +
		arr[i].Route + arr[i].Terminal +
		"</td><td>" +
		arr[i].DepartureText +
		"</td><td>" +
		arr[i].Description +
		"</td><td>";
		
//		if(isDebugging) {
//			console.log("out=" + out);
//		}

		out +=
		arr[i].VehicleLatitude === undefined || arr[i].VehicleLatitude === null || arr[i].VehicleLatitude === 0 ? "&nbsp;" : passedMilestone(arr[i]).simple +
		"</td><td>";
		
		out +=
		milesAndDirectionLetter !== "" ? milesAndDirectionLetter : arr[i].VehicleLatitude === undefined || arr[i].VehicleLatitude === null || arr[i].VehicleLatitude === 0 ? "&nbsp;" : distanceInMiles3Digits(arr[i]);

		out += "</td></tr>";
		
//		if(isDebugging) {
//			console.log("line 900 out=" + out);
//		}
	}
	out += "</table></div>";
	// console.log("out=" + out);
	
	if(isValid) {
		// do not save until it is known to be a valid response
		tblRouteDirectionStopDeparture.setByKey(route.toString() + "." + direction + "." + stop, responseText);
		
		if(stop !== myStop) {
			myStop = stop;
		}
		if(direction !== myDirection) {
			myDirection = direction;
		}
		if(route !== myRoute) {
			myRoute = route;
		}
		
		var routeDirectionStopActive = getRouteDirectionStopActive();
		if(routeDirectionStopActive !== undefined && routeDirectionStopActive !== null 
			&& routeDirectionStopActive.route === route && routeDirectionStopActive.direction === direction && routeDirectionStopActive.stop === stop) {
			// dbValue already set to this, so assume it's ok to remove the 00A section
		}
		else {
			var newVal = {"route":route, "direction":direction, "stop":stop };
			db1.setByKey("RouteDirectionStopActive", JSON.stringify(newVal));
			var rawStop = tblStop.getByKey(stop);
			if(rawStop !== undefined && rawStop !== null) {
				var stopParsed = JSON.parse(rawStop);
				if(stopParsed !== undefined && stopParsed !== null) {
					var busStopPoint = {"stop":stop, "latitude": stopParsed.latitude, "longitude": stopParsed.longitude};
					db1.setByKey("ActiveScheduledBusStop", JSON.stringify(busStopPoint));
				}
			}
			// rotateRecentRoutes();
			rotateRecentChoices(newVal);
		}
		resetRecentChoiceButtons();
		document.getElementById("id00RouteDirectionStop").style.display = "none";
	}

    document.getElementById("title1").innerHTML = "Bus Schedule " + route.toString();
	if(isDebugging) {
		console.log("out=" + out);
	}
	
    document.getElementById("id00B").innerHTML = out;
	
	var outButton = '<button type="button" class="btn btn-primary" onclick="getDepartures(' + route.toString() + ', ' + direction + ', \'' + stop + '\');" >' + route.toString() + ' - ' + directionAsString(direction) + ' - ' + stop + '</button>';
	
	var timeOfQuery = new Date();
	outButton += '<label>&nbsp;&nbsp;' + getStopDescription(route, direction, stop) + '</label><label>&nbsp;&nbsp;' + timeOfQuery.toHHMMSS() + '</label>';
	
    document.getElementById("id00C").innerHTML = outButton;
	
	if(hasActuals) {
		showBusLocation2(route, actualBlockNumber);
	}
	
	document.getElementById("collapseDetails").classList.remove("collapse");				
}

function getStopDescription(route, direction, stop) {
	if(Modernizr.localstorage) {
		var p =  tblRouteDirectionStops.getByKey(route.toString() + '.' + direction);
		if(p !== undefined) {
			var stops = JSON.parse(p);
			for(var i = 0; i < stops.length; i++) {
				if(stops[i].Value === stop) {
					return stops[i].Text;
				}
			}
		}
	}
	return "";
}

function showRecentNumberedStop(buttonIndex, description) {
	var recentIElement = document.getElementById("recentStop" + buttonIndex);
	if(recentIElement === undefined || recentIElement === null) {
		if(isDebugging) {
			console.log("showRecentNumberedStop(buttonIndex, description) failed.  buttonIndex=" + buttonIndex + "  description=" + description);
		}
		return;
	}
	recentIElement.hidden = false;
	recentIElement.classList.remove("hidden");
	recentIElement.innerHTML = description === undefined || description === null || description === "" ? "&nbsp;" : description;
}

// example: var s = directionAsString(recentStop.direction);
function directionAsString(direction) {
	// 1 South, 2 East, 3 West, 4 North
	// console.log("directionAsString()  direction=" + direction);
	return direction === 1 ? "S" : direction === 2 ? "E" : direction === 3 ? "W" : direction === 4 ? "N" : "?";
}


/* ================ probable dead code ================= */
function getRouteDirectionStopActiveDotI(i) {
	var fullKey = '' + i;
	var raw = tblRouteDirectionStopActive.getByKey(fullKey);
	if(raw === undefined || raw === null) {
		if(isDebugging) {
			console.log("getRouteDirectionStopActiveDotI(" + i + ") will return null because tblRouteDirectionStopActive.getByKey(" + i + ") returned null");
		}
		return null;
	}
	return JSON.parse(raw);
}

// Where a = line point 1; b = line point 2; c = point to check against.
function isLeftOfLine(pointAOnLine, pointBOnLine, pointC) {
	return (pointBOnLine.longitude - pointAOnLine.longitude)*(pointC.latitude - pointAOnLine.latitude) > (pointBOnLine.latitude - pointAOnLine.latitude)*(pointC.longitude - pointAOnLine.longitude);
}

function distance(latitude1, longitude1, latitude2, longitude2) {
	return Math.sqrt(Math.pow(latitude1 - latitude2, 2) + Math.pow(longitude1 - longitude2, 2));
}

function latitudeDelta(point, wayPoint) {
	return (point.latitude - wayPoint.latitude) * 69.0539;    // includes near 45deg factor
}
function longitudeDelta(point, wayPoint) {
	return (point.longitude - wayPoint.longitude) * 48.9930;    // includes near 45deg factor for longitude
}

function distanceNearLatitude45(point, wayPoint) {
	var latitudeDiff = latitudeDelta(point, wayPoint);
	var longitudeDiff = longitudeDelta(point, wayPoint);
	return Math.sqrt(Math.pow(latitudeDiff, 2) + Math.pow(longitudeDiff, 2));
}

function distanceInMiles3Digits(arrRow) {
	var strMiles = distanceInMiles(arrRow).toString();
	return strMiles.substr(0, 4);
}

function busStopWayPoint(arrRow) {
	if(arrRow.Route==="133") {
		return Marquette400S;  //400 S Marquette
	}
	if(arrRow.Route==="7") {
		return FourthStreet215S;   //215 S 4th St - #7    FourthStreet215S
	}
	if(arrRow.Route==="14") {
		return SixthStreet201S;  //Capella Tower
	}
	return null;
}

function distanceInMiles(arrRow) {
	var busAtPoint = {latitude:arrRow.VehicleLatitude, longitude:arrRow.VehicleLongitude};

	var targetPoint = null;
	if(isCurrentTargetANumberedBusStop) {
		targetPoint = getActiveNumberedBusStop();
	}
	else {
		var activeStop = db1.getByKey("ActiveScheduledBusStop");
		if(activeStop !== undefined && activeStop !== null) {
			targetPoint = JSON.parse(activeStop);
		}
	}
	
	if(targetPoint !== undefined && targetPoint !== null) {
		return distanceNearLatitude45(busAtPoint, targetPoint); 
	}
	
	if(arrRow.Route==="133") {
		return distanceNearLatitude45(busAtPoint, Marquette400S);  //400 S Marquette
	}
	if(arrRow.Route==="7") {
		return distanceNearLatitude45(busAtPoint, FourthStreet215S);   //215 S 4th St - #7    FourthStreet215S
	}
	if(arrRow.Route==="14") {
		return distanceNearLatitude45(busAtPoint, SixthStreet201S);  //Capella Tower
	}
	return "";
}

function miles(aPoint, aWayPoint) {
	var obj = {};
	obj.point = aPoint;
	obj.wayPoint = aWayPoint;
	obj.between = distanceNearLatitude45(aPoint, aWayPoint);
	obj.north = latitudeDelta(aPoint, aWayPoint);
	obj.east  = longitudeDelta(aPoint, aWayPoint);
	obj.isNorthOf = obj.north > 0.01;
	obj.isSouthOf = obj.north < 0.01;
	obj.isEastOf = obj.east > 0.01;        // longitude increases as you go east
	obj.isWestOf = obj.east < 0.01;

	// angle in degrees
	obj.angleInDegrees = Math.atan2(aPoint.longitude - aWayPoint.longitude, aPoint.latitude - aWayPoint.latitude) * 180 / Math.PI;

	return obj;
}

function milesAsString(miles) {
	if(miles === undefined || miles === null) return;
	
	return "(" + miles.point.latitude.toFixed(6) + ", " + miles.point.longitude.toFixed(6) + ") vs ("  + miles.wayPoint.latitude.toFixed(6) + ", " + miles.wayPoint.longitude.toFixed(6) + ")"
		+ " .between=" + miles.between.toFixed(2) + " miles, .north=" + miles.north.toFixed(2) + ", .east=" + miles.east.toFixed(2) 
		+ ", " + (miles.isNorthOf ? "N" : miles.isSouthOf ? "S" : "")  
		+ ", " + (miles.isEastOf ? "E" : miles.isWestOf ? "W" : "") 
		;
}

function milesAndDirection(miles) {
	if(miles === undefined || miles === null) return;

	if( 180.0 - 11.25 < miles.angleInDegrees && miles.angleInDegrees <  180.0 + 11.25) { return miles.between.toFixed(2) + " S"; }
	if(-180.0 - 11.25 < miles.angleInDegrees && miles.angleInDegrees < -180.0 + 11.25) { return miles.between.toFixed(2) + " S"; }
	if(-157.5 - 11.25 < miles.angleInDegrees && miles.angleInDegrees < -157.5 + 11.25) { return miles.between.toFixed(2) + " SSW"; }
	if(-135.0 - 11.25 < miles.angleInDegrees && miles.angleInDegrees < -135.0 + 11.25) { return miles.between.toFixed(2) + " SW"; }
	if(-112.5 - 11.25 < miles.angleInDegrees && miles.angleInDegrees < -112.5 + 11.25) { return miles.between.toFixed(2) + " WSW"; }
	if( -90.0 - 11.25 < miles.angleInDegrees && miles.angleInDegrees <  -90.0 + 11.25) { return miles.between.toFixed(2) + " W"; }
	if( -67.5 - 11.25 < miles.angleInDegrees && miles.angleInDegrees <  -67.5 + 11.25) { return miles.between.toFixed(2) + " WNW"; }
	if( -45.0 - 11.25 < miles.angleInDegrees && miles.angleInDegrees <  -45.0 + 11.25) { return miles.between.toFixed(2) + " NW"; }
	if( -22.5 - 11.25 < miles.angleInDegrees && miles.angleInDegrees <  -22.5 + 11.25) { return miles.between.toFixed(2) + " NNW"; }
	if(   0.0 - 11.25 < miles.angleInDegrees && miles.angleInDegrees <    0.0 + 11.25) { return miles.between.toFixed(2) + " N"; }
	if(  22.5 - 11.25 < miles.angleInDegrees && miles.angleInDegrees <   22.5 + 11.25) { return miles.between.toFixed(2) + " NNE"; }
	if(  45.0 - 11.25 < miles.angleInDegrees && miles.angleInDegrees <   45.0 + 11.25) { return miles.between.toFixed(2) + " NE"; }
	if(  67.5 - 11.25 < miles.angleInDegrees && miles.angleInDegrees <   67.5 + 11.25) { return miles.between.toFixed(2) + " ENE"; }
	if(  90.0 - 11.25 < miles.angleInDegrees && miles.angleInDegrees <   90.0 + 11.25) { return miles.between.toFixed(2) + " E"; }
	if( 112.5 - 11.25 < miles.angleInDegrees && miles.angleInDegrees <  112.5 + 11.25) { return miles.between.toFixed(2) + " ESE"; }
	if( 135.0 - 11.25 < miles.angleInDegrees && miles.angleInDegrees <  135.0 + 11.25) { return miles.between.toFixed(2) + " SE"; }
	if( 157.5 - 11.25 < miles.angleInDegrees && miles.angleInDegrees <  157.5 + 11.25) { return miles.between.toFixed(2) + " SSE"; }
	
	if(miles.isNorthOf && Math.abs(miles.north) > Math.abs(miles.east) * 2.0) {
		// more north than northwest or northeast
		return miles.between.toFixed(2) + " Nx";
	}
		
	if(miles.isSouthOf && Math.abs(miles.north) > Math.abs(miles.east) * 2.0) {
		return miles.between.toFixed(2) + " Sx";
	}

	if(miles.isEastOf && Math.abs(miles.east) > Math.abs(miles.north) * 2.0) {
		return miles.between.toFixed(2) + " Ex";
	}

	if(miles.isWestOf && Math.abs(miles.east) > Math.abs(miles.north) * 2.0) {
		return miles.between.toFixed(2) + " Wx";
	}

	if(miles.isNorthOf && miles.isWestOf) {
		return miles.between.toFixed(2) + " NWx";
	}

	if(miles.isNorthOf && miles.isEastOf) {
		return miles.between.toFixed(2) + " NEx";
	}

	if(miles.isSouthOf && miles.isEastOf) {
		return miles.between.toFixed(2) + " SEx";
	}

	if(miles.isSouthOf && miles.isWestOf) {
		return miles.between.toFixed(2) + " SWx";
	}

	if(miles === undefined || miles === null || miles.between === undefined || miles.between === null) {
		return "n/a";
	}

	return miles.between.toFixed(2) + " ??";
}

function isNorthAndEastOf(miles, between) {
	return miles.isNorthOf && miles.isEastOf && miles.between <= between;
}

// change to return an object that has {detail: string, simple: string}
function passedMilestone(arrRow) {
	var busAtPoint = {latitude:arrRow.VehicleLatitude, longitude:arrRow.VehicleLongitude};
	
	if(arrRow.Route==="133") {
		// false	133	4:15	Ltd Stop/Bloomington/Chicago Av	SOUTHBOUND	1420	A	44.975585, -93.264102	0.32	35W & Franklin	(44.975585, -93.264102) vs (44.979001, -93.268623) .between=0.32 miles, .north=-0.24, .east=0.22, isSouthOf, isEastOf
		// true	133	14 Min	Ltd Stop/Bloomington/Chicago Av	SOUTHBOUND	1824	A	44.97874, -93.26189	0.33	Start of run (Gateway Ramp)	(44.978740, -93.261890) vs (44.979001, -93.268623) .between=0.33 miles, .north=-0.02, .east=0.33, isSouthOf, isEastOf
		
		var milesSWofWashington300S = miles(busAtPoint, SWofWashington300S);
		if(isNorthAndEastOf(milesSWofWashington300S, 0.2)) {
			return {detail: "NE of 3rd and Washington" + " :" + milesAsString(milesSWofWashington300S),
					simple: milesAndDirection(milesSWofWashington300S) + " of 3rd &amp; Wash"};
		}

		var milesSouthAndWestOfGatewayRamp = miles(busAtPoint, SouthAndWestOfGatewayRamp);
		if(milesSouthAndWestOfGatewayRamp.isNorthOf && milesSouthAndWestOfGatewayRamp.isEastOf && milesSouthAndWestOfGatewayRamp.between < 0.15) {
			return {detail: "Start of run (Gateway Ramp)" + milesAsString(milesSouthAndWestOfGatewayRamp),
					simple: milesAndDirection(milesSouthAndWestOfGatewayRamp) + " start of run"};
		}
		
		var milesWashington300S = miles(busAtPoint, Washington300S);
		if(milesWashington300S.isNorthOf && milesWashington300S.isEastOf && milesWashington300S.between < 0.2) {
			return {detail: "East of 3rd and Washington" + milesAsString(milesWashington300S),
					simple: milesAndDirection(milesWashington300S) + " of 3rd &amp; Wash"};
		}
		if(milesWashington300S.isNorthOf && milesWashington300S.isWestOf && milesWashington300S.between < 0.2) {
			return {detail: "Crossed 3rd and Washington" + milesAsString(milesWashington300S),
					simple: milesAndDirection(milesWashington300S) + " crossed 3rd &amp; Wash"};
		}
		
		var milesGrantAnd35W = miles(busAtPoint, GrantAnd35W);
		if(milesGrantAnd35W.isSouthOf) {
			return {detail: "Still south of downtown" + milesAsString(milesGrantAnd35W),
					simple: milesAndDirection(milesGrantAnd35W) + " of downtown"};
		}
		if(milesGrantAnd35W.east < -1.0) {
			return {detail: "West of downtown" + milesAsString(milesGrantAnd35W),
					simple: milesAndDirection(milesGrantAnd35W) + " of downtown"};
		}
		
		var miles400SMarquette = miles(busAtPoint, Marquette400S);

		var distanceFrom400SMarquette = distance(arrRow.VehicleLatitude, arrRow.VehicleLongitude, Marquette400S.latitude, Marquette400S.longitude);
		var distanceFrom5thAndWashington = distance(arrRow.VehicleLatitude, arrRow.VehicleLongitude, Washington500N.latitude, Washington500N.longitude);
		if(distanceFrom400SMarquette <= 0.0001) {
			return {detail: "here", 
					simple: milesAndDirection(miles400SMarquette) + " from Stop"};
			}
		if(distanceFrom400SMarquette <= 0.0169) {
			return {detail: "35W &amp; Franklin",
					simple: milesAndDirection(miles400SMarquette) + " near 35W &amp Franklin"};
		}
		if(distanceFrom400SMarquette <= 1 && distanceFrom5thAndWashington <= 0.2) {
			return {detail: "Turning to head south", 
					simple: milesAndDirection(miles400SMarquette) + " turning to head south"};
		}
		else {
			return {detail: "outside downtown, " + milesAsString(miles400SMarquette),
					simple: milesAndDirection(miles400SMarquette) + "outside downtown"};
		}
	}
	if(arrRow.Route==="14") {
		var milesAway = miles(busAtPoint, SixthStreet201S);
		
		var milesBroadwayEmerson = miles(busAtPoint, BroadwayEmerson);
		if(milesBroadwayEmerson.isWestOf) {
			return {detail: "West of Broadway Emerson" + " :" + milesAsString(milesBroadwayEmerson),
					simple: milesAndDirection(milesBroadwayEmerson) + " of Broadway &amp; Emerson"};
		}

		var milesPlymouthWashington = miles(busAtPoint, PlymouthWashington);
		if(milesPlymouthWashington.east < 0.1 && milesPlymouthWashington.north > -0.1 ) {
			return {detail: "West of Plymouth and Washington" + " :" + milesAsString(milesPlymouthWashington), 
					simple: milesAndDirection(milesPlymouthWashington) + " of Plymouth &amp; Wash"};
		}

		var milesWashington300N = miles(busAtPoint, Washington300N);
		if(milesWashington300N.isWestOf && milesWashington300N.isNorthOf && milesWashington300N.between < 1) {
			return {detail: "NW of 3rd Ave N and Washington" + " :" + milesAsString(milesWashington300N),
					simple: milesAndDirection(milesWashington300N) + " of 3rd Ave N &amp; Wash"};
		}
		
		var milesFifthStBusRamp = miles(busAtPoint, FifthStBusRamp);
		if(milesFifthStBusRamp.isNorthOf && milesFifthStBusRamp.north < 0.2) {
			return {detail: "At 5th Street Bus Ramp" + " :" + milesAsString(milesFifthStBusRamp), 
					simple: milesAndDirection(milesFifthStBusRamp) + " of 5th St Bus Ramp"};
		}
		
		var milesFromSixthNicollet = miles(busAtPoint, SixthNicollet);
		if(milesFifthStBusRamp.isSouthOf && milesFifthStBusRamp.isEastOf && milesFromSixthNicollet.isNorthOf && milesFromSixthNicollet.isWestOf && milesFromSixthNicollet.between > 0.05) {
			return {detail: "Nearing Nicollet Mall" + " :" + milesAsString(milesFromSixthNicollet),
					simple: milesAndDirection(milesFromSixthNicollet) + " of 6th &amp; Nicollet"};
		}			

		if(milesFromSixthNicollet.isNorthOf && milesFromSixthNicollet.between < 0.05) {
			return {detail: "At Nicollet Mall" + " :" + milesAsString(milesFromSixthNicollet),
					simple: milesAndDirection(milesFromSixthNicollet) + " Nicollet Mall"};
		}			
				
		if(Math.abs(milesAway.between) < 0.0001) {
			return {detail: "here",
					simple: milesAndDirection(milesAway) + " of Capella"};
		}
		if(milesAway.isNorthOf && milesAway.isWestOf && Math.abs(milesAway.between) <= 0.0041) {
			return {detail: "Nicollet Mall",
					simple: milesAndDirection(milesAway) + " of Capella"};
		}
		
		return {detail: "todo - " + milesAsString(milesAway),
				simple: milesAndDirection(milesAway) + " of Capella"};
	}
	if(arrRow.Route==="7") {
		var milesFrom215s4thSt = miles(busAtPoint, FourthStreet215S);

		if(Math.abs(milesFrom215s4thSt.between) < 0.0001) {
			return {detail: "here",
					simple: milesAndDirection(milesFrom215s4thSt) + " at the Stop"};
		}

		return {detail: "todo - " + milesAsString(milesFrom215s4thSt),
				simple: milesAndDirection(milesFrom215s4thSt) + " of 215 S 4th"};

	}
	return {detail: "Route not implemented.",
			simple: "n/a"};
}
	
function timeSince(when) { // this ignores months
	var obj = {};
	obj._milliseconds = (new Date()).valueOf() - when.valueOf();
	obj.milliseconds = obj._milliseconds % 1000;
	obj._seconds = (obj._milliseconds - obj.milliseconds) / 1000;
	obj.seconds = obj._seconds % 60;
	obj._minutes = (obj._seconds - obj.seconds) / 60;
	obj.minutes = obj._minutes % 60;
	obj._hours = (obj._minutes - obj.minutes) / 60;
	obj.hours = obj._hours % 24;
	obj._days = (obj._hours - obj.hours) / 24;
	obj.days = obj._days % 365;
	obj.years = (obj._days - obj.days) / 365;
	return obj;
}



// -------------------------------- local storage -- start
// see http://diveintohtml5.info/storage.html
// see "class DbTables" in this doc

function getDbSize() {
	if (localStorage && !localStorage.getItem('size')) {
		var i = 0;
		try {
			// Test up to 10 MB
			for (i = 250; i <= 10000; i += 250) {
				localStorage.setItem('test', new Array(i * 1024 + 1).join('a'));
			}
		} catch (e) {
			localStorage.removeItem('test');
			localStorage.setItem('size', i - 250);            
		}
	}
	if (localStorage) {
		return localStorage.getItem('size');
	}
}

function resetDatabase() {
    if (!db1.supports_html5_storage) { return null; }
	localStorage.clear();
	if(isDebugging) {
		console.log("resetDatabase to clear all localStorage.");
	}
}

function showDatabase() {
	// show SQL that could be used in a query for Stop names of a route
    // BusDB.RouteDirectionStops.133.1	[{"Text":"Gateway Ramp ","Value":"GTWY"},{"Text":"Marquette Ave and 4th St ","Value":"MA4S"},{"Text":"Marquette Ave and 8th St ","Value":"MA8S"},{"Text":"12th St and 3rd Ave ","Value":"123A"},{"Text":"I-35W and Lake St","Value":"I3LA"},{"Text":"38th St and Chicago Ave","Value":"38CH"},{"Text":"Chicago Ave and 46th St","Value":"46CH"},{"Text":"54th St and Bloomington Ave","Value":"BL54"},{"Text":"1000 46th St E ","Value":"1046"}]	
    // BusDB.RouteDirectionStops.133.4	[{"Text":"1000 46th St E ","Value":"1046"},{"Text":"Bloomington Ave and 54th St","Value":"BL54"},{"Text":"Chicago Ave and 46th St","Value":"46CH"},{"Text":"38th St and Chicago Ave","Value":"38CH"},{"Text":"2nd Ave and 11th St ","Value":"112A"},{"Text":"2nd Ave and 7th St ","Value":"7S2A"},{"Text":"2nd Ave and Washington Ave ","Value":"WA2A"}]	
    if (!db1.supports_html5_storage) { return null; }

	var routeDirectionCount = 0;
	for(var i=0, len = localStorage.length; i < len; ++i){
		if(localStorage.key(i).substring(0, "BusDB.RouteDirectionStops.".length) === "BusDB.RouteDirectionStops.") {
			if(++routeDirectionCount < 9999) { // 14, 30, 45, 64, 77, 93, 111
				console.log("-- routeDirectionCount=" + routeDirectionCount);
				var rawValues = localStorage.getItem(localStorage.key(i));
				var values = JSON.parse(rawValues);
				for(var j=0, valuesLength = values.length; j < valuesLength; ++j) {
					var value = values[j];
					console.log("('" + localStorage.key(i).substring("BusDB.RouteDirectionStops.".length) + "', '" + value.Text + "', '" + value.Value + "', " + j + "), "); 
				}
			}
		}
	}
}

function showDbSize() {
	var dbSize = getDbSize();
	if(isDebugging) {
		console.log("localStorage size=" + getDbSize());	
	}
	alert("localStorage size is " + dbSize);
}

function removeDbUndefined() {
	if (!db1.supports_html5_storage) { return null; }
	var i = 0;
	var removedCount = 0;
	var result = null;
	var value = null;
	do {
		result = localStorage.key(i);
		if(result !== undefined && result !== null) {
			value = localStorage[result];
			if(value !== undefined && value !== null && value === "undefined") {
				localStorage.removeItem(result);
				removedCount++;
			} else {
				i++;
			}
		} else {
			i++;
		}
	} 
	while (result !== undefined && result !== null);
	
	if(isDebugging) {
		console.log("From localStorage, deleted " + removedCount.toString() + " of " + i.toString() + " (key, undefined) pairs.");
	}
	alert("Removed " + removedCount.toString() + " undefined values from localStorage.");	
	return true;
}
// -------------------------------- local storage -- end

function visitAllRoutes() {
	var route;
	// to populate the local database with values that showDatabase() can use.
    if (!db1.supports_html5_storage) { 
		return; 
	}
	
	var rawRoutes = db1.getByKey("Routes");
	if(rawRoutes === null) { 
		if(isDebugging) {
			console.log("No routes found using db1.getByKey('Routes').");
		}
		return; 
	}
	
	var arrRoutes = JSON.parse(rawRoutes);
	for(i = 0; i < arrRoutes.length; i++) {
		// need to determine the valid directions for each route
		route = arrRoutes[i].Route;
		// is there a function to call that does not create/update a button?
		var shouldCreateButton = false;
		selectRouteDirections3(route);
	}
	
	// now, go through the RouteDirections
	for(var i=0, len = localStorage.length; i < len; ++i){
		if(localStorage.key(i).substring(0, "BusDB.RouteDirections.".length) === "BusDB.RouteDirections.") {
			var rawValues = localStorage.getItem(localStorage.key(i));
			var values = JSON.parse(rawValues);
			for(var j=0, valuesLength = values.length; j < valuesLength; ++j) {
				var direction = values[j].Value;
				route = localStorage.key(i).substring("BusDB.RouteDirections.".length);
				selectRouteDirectionStops2(route, direction, false);
			}
		}
	}
}

// --------------------------------------------
// from https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition
// and
// from https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/Using_geolocation

var currentDeviceGps;   // .coords of success callback of .getCurrentPosition

function getGps() {
    var output = document.getElementById("mapPanelHeadingLabel");
	
	if (output === null) {
		alert("getGps() could not find elementId 'mapPanelHeadingLabel'.");
		return;
	}

	if (!navigator.geolocation) {
		output.innerHTML = '<p class="text-danger">Geolocation is not supported by your browser</p>';
		return;
	}

	function success(position) {
		// var latitude  = position.coords.latitude;
		// var longitude = position.coords.longitude;

		currentDeviceGps = position.coords;

		console.log('Your current position is:');
		console.log(`Latitude : ${currentDeviceGps.latitude}`);
		console.log(`Longitude: ${currentDeviceGps.longitude}`);
		console.log(`More or less ${currentDeviceGps.accuracy} meters.`);

		initializeMap();
	}

	function error() {
		output.innerHTML = '<span class="text-danger">Unable to retrieve your location</span>';
	}

	var options = {
		enableHighAccuracy: true,
		timeout: 5000,        // wait up to 5000 milliseconds
		maximumAge: 30000     // milliseconds old or less, retrieve from cache.  0 to always get the latest position, never from cache
	};

	output.innerHTML = '<span class="text-default">Locating . . . </span>';

	navigator.geolocation.getCurrentPosition(success, error, options);
}
// --------------------------------------------

// ----- create map and add markers ------ start
// based on http://stackoverflow.com/questions/5319488/how-to-set-google-map-marker-by-latitude-and-longitude-and-provide-infomation-bu
// fills the <div id="map_canvas"></div>
var map;
var markers = [];

function initializeMap() { return initializeMap2(currentDeviceGps); }

function initializeMap2(position) {
	if (position === undefined || position === null || position.latitude === undefined || position.latitude === null) { return; }

	if (window.getComputedStyle(document.getElementById("collapseMap"), null).getPropertyValue("display") === "none") { return; }

	var latlng = new google.maps.LatLng(position.latitude, position.longitude);
	var myOptions = {
		zoom: 14,   // stackoverflow version was set to 1
		center: latlng,
		mapTypeId: google.maps.MapTypeId.ROADMAP
	};
	if (isDebugging) {
		console.log("Calling google to set the map. myOptions=" + JSON.stringify(myOptions));
	}

	map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
	addMarker(position);

	addBlockButtonToMapTitle();
	addResetButtonToMapTitle();
}

function addBlockButtonToMapTitle() {
	if(isDebugging) {
		console.log("addBlockButtonToMapTitle markupBlockNumberButton(myBlockNumber)  myBlockNumber=" + myBlockNumber.toString());
	}
	var divInTitle = document.getElementsByClassName("map-title");
	var markup = markupBlockNumberButton(myBlockNumber);
	markup = markup.replace(' onclick', ' style="margin-left: 30%; margin-right: 20%" onclick');
	markup = markup.replace('button type=', 'button id="busNumberMapButton" type=');
	divInTitle[0].innerHTML = markup;
}

function addResetButtonToMapTitle() {
	// console.log("addResetButtonToMapTitle() called.");
	var mapTitleResetButton = document.getElementById("mapTitleResetButton");
	if(mapTitleResetButton === null) {
		var divInTitle = document.getElementsByClassName("map-title");
		if(divInTitle !== undefined) {
			divInTitle[0].innerHTML = divInTitle[0].innerHTML + 
				'<button type="button" class="btn btn-primary btn-sm float-right" onclick="clearTracking()">Reset Map</button>';
		}
	}
}

function addMarker(busLocation) {
	var i = 0;
	if(isDebugging) {
		console.log("addMarker(busLocation)  busLocation=" + JSON.stringify(busLocation));
	}
	
	if(markers === undefined || markers === null) {
		markers = [];
	}
	
    for (i = 0; i < markers.length; i++)
		if (busLocation.latitude === markers[i].position.lat() && busLocation.longitude === markers[i].position.lng()) return;

	var current = new google.maps.LatLng(busLocation.latitude, busLocation.longitude);
	if(current === undefined || current === null) {
		return;
	}
	
	// if map is null, create one
	if(map === undefined || map === null) {
		if(isDebugging) {
			console.log("addMarker(busLocation)  map is null.");
		}
		
		var activeStop;
		var rawActiveStop = db1.getByKey("ActiveScheduledBusStop");
		if(rawActiveStop !== undefined && rawActiveStop !== null) {
			activeStop = JSON.parse(rawActiveStop);
		}

		if(activeStop !== undefined && activeStop !== null) {
			//console.log("create map, activeStop = " + JSON.stringify(activeStop));
			initializeMap2(activeStop);
		} else {
			//console.log("create map, current = " + JSON.stringify(current));
			initializeMap2(current);
		}
	}	
	if(map === undefined || map === null) {
		if(isDebugging) {
			console.log("addMarker(busLocation)  map is still null.  Skipping.");
		}
		return;
	}
	
	var marker;
	if(busLocation === undefined || busLocation === null || busLocation.time === undefined) {
		marker = new google.maps.Marker({
			map: map,
			position: current,
			icon: {
				path: google.maps.SymbolPath.CIRCLE,
				scale: 5
				}
		});
	} else
	{
		marker = new google.maps.Marker({
			map: map,
			position: current,
			title: "" + busLocation.blockNumber,
			opacity: 1.0
		});
		
		setInterval(function() {
			// 0.9375 ok, 0.9 too fast; both fade to less than 10% too fast.
			// var newOpacity = (marker.opacity * 0.8) + 0.10;    // needs to fade more as a final  0.46 seems to be the minimum
			var newOpacity = marker.opacity * 0.8 + 0.08;
			marker.setOptions({'opacity': newOpacity});
			if(isDebugging) {
				console.log("setInterval(function() marker.opacity = " + marker.opacity);
			}
		}, 15000);   // 15 seconds
		
		setTimeout(function() {
			marker.setOptions({'opacity': 0.0});
			marker.setMap(null);
		}, 20 * 60 * 1000);     // 20 minutes
	} 
	markers.push(marker);

	// busLocation.time does not exist when the location is actually a bus stop, not a bus location
	if(busLocation.time !== undefined) {
		markers[markers.length - 1]['infowin'] = new google.maps.InfoWindow({
			content: '<div>' + busLocation.time.toHHMMSS().substr(3,2) + 'm' + busLocation.time.toHHMMSS().substr(6,2) + 's</div>'
				+ '<div>' + busLocation.blockNumber + '</div>'
		});
		
		google.maps.event.addListener(markers[markers.length - 1], 'click', function() {
			this['infowin'].open(map, this);
		});
	}
}
// ----- create map and add markers ------ end

function clearTracking() {
//	return new Promise(function(resolve, reject) {
//		
//	}
	
	tblVehicleLocation.deleteAll();
	tblVehicleTracked.deleteAll();
	document.getElementById("map_canvas").innerHTML = "";
	if(markers !== undefined && markers !== null) {
		for (var i = 0; i < markers.length; i++) {
			markers[i].setMap(null);
		}
		markers.length = 0;
		markers = null;
	}
	map = null;
}

var isPartOfDeleteRecentChoice = false;
function selectRecentChoice(i) {
	if(!isPartOfDeleteRecentChoice) {
		var recentValue = tblRecentChoice.getByKey(i.toString());
		if(isDebugging) {
			if(recentValue === undefined || recentValue === null) {
				console.log("selectRecentChoice(i) based on i=" + i.toString() + " returned only " + recentValue === undefined ? "undefined" : "null" + " as a recentChoice.");
			}
		}
		if (recentValue !== undefined && recentValue !== null) {
			var parsedRecentChoice = JSON.parse(recentValue);
			var msg = 'unknown';
			if(isDebugging) {
				if(parsedRecentChoice === undefined || parsedRecentChoice === null) {
					console.log("selectRecentChoice(i) based on i=" + i.toString() + " returned only " + parsedRecentChoice === undefined ? "undefined" : "null" + " as a parsedRecentChoice.");
				}
			}
			if(parsedRecentChoice.stop !== undefined) {
				isPartOfDeleteRecentChoice = false;   // see deleteRecentChoice function
				getDepartures(parsedRecentChoice.route, parsedRecentChoice.direction, parsedRecentChoice.stop);
				return true;
			}
			if(parsedRecentChoice.stopNumber !== undefined) {
				// msg = parsedRecentChoice.stopNumber;
				isPartOfDeleteRecentChoice = false;   // see deleteRecentChoice function
				showStop2(parsedRecentChoice);
				return true;
			}
		}
		alert('select i=' + i + '  msg=' + msg);
	}
	isPartOfDeleteRecentChoice = false;   // see deleteRecentChoice function
	return true;
}

function deleteRecentChoice(i) {
	isPartOfDeleteRecentChoice = true;

	for(var j=i; j < buttonMax; j++) {
		var tempVal = tblRecentChoice.getByKey('' + (j + 1));
		if(tempVal === null) {
			tblRecentChoice.removeByKey(j);
		}
		else {
			tblRecentChoice.setByKey('' + j, tempVal);
		}
	}
	resetRecentChoiceButtons();
}

// refactor the scheduledStopButtons and numberedStopButtons into a common group of buttons
// target:
// target:    <li id="recentChoice0" class="active btn btn-secondary" onclick="selectRecentChoice(0);">
// target:    	<div class="input-group-btn" >
// target:    	  <button class="active btn btn-secondary"            type="button" >Bus 22222 - 12345</button>
// target:    	  <button class="active btn btn-secondary btn-danger" type="button" onclick="deleteRecentChoice(0);">X</button>
// target:    	</div>
// target:    </li>
// target:
//           // bootstrap 4 target
// target:    <div id="recentChoice999b" class="active input-group">
// target:    	  <button class="active btn btn-secondary"                 type="button" onclick="alert('recentChoice999b button'); selectRecentChoice(0);">Bus 22222 - 12345</button>
// target:    	  <button class="active btn btn-danger input-group-append" type="button" onclick="alert('recentChoice999b delete'); deleteRecentChoice(0);">X</button>
// target:    </div>


function resetRecentChoiceButtons() {
	//see:  resetRecentButtons();
	//see:  resetRecentNumberedStopButtons();
	// spin through the 
	for(var i=0; i < buttonMax; i++) {
		var recentIElement = document.getElementById("recentChoice" + i.toString());
		var recentValue = tblRecentChoice.getByKey(i.toString());
		// rather than prepopulate hidden controls, maybe it would be better to add them as needed.
		if(recentValue === undefined || recentValue === null || recentValue === "undefined") {
			recentIElement.hidden = true;
			recentIElement.classList.add("hidden");
			recentIElement.innerHTML = '&nbsp;';			
		} else {
			recentIElement.hidden = false;
			recentIElement.classList.remove("hidden");
			var parsedRecentChoice = JSON.parse(recentValue);
			// could be a numbered or scheduled stop
			// var recentBusStopNumber = JSON.parse(recentValue);
			var buttonText = 'unknown';
			if(parsedRecentChoice.stopNumber !== undefined) {
				buttonText = parsedRecentChoice.stopNumber + ' - ' + (parsedRecentChoice.description === undefined || parsedRecentChoice.description === null ? " " : parsedRecentChoice.description);
			}
			if(parsedRecentChoice.stop !== undefined) {
				buttonText = parsedRecentChoice.route + ' - ' + directionAsString(parsedRecentChoice.direction) + ' - ' + parsedRecentChoice.stop;
			}
			// let idTemp = 'recentChoice' + i;
			// var out = '<div id="' + idTemp + '" class="active input-group" >'
			var out = '<button class="active btn btn-secondary"                 type="button" onclick="selectRecentChoice(' + i + ');" >' 
					+ buttonText
					+ '</button>'
					+ '<button class="active btn btn-danger input-group-append" type="button" onclick="deleteRecentChoice(' + i + ');">X</button>';
			recentIElement.innerHTML = out;			
		}
	}
}

function rotateRecentChoices(recent) {
	// see: rotateRecentNumberedStops()
	// see: rotateRecentRoutes()

	// recent might be:   var busStopPoint = {"stopNumber":stopNumber, "latitude": latitude, "longitude": longitude, "description": description};
	//                    which is getActiveNumberedBusStop()
	// var recent = getActiveNumberedBusStop();
	if(recent === undefined || recent === null) { return; }
	
	// recent might be:   var newVal = {"route":route, "direction":direction, "stop":stop };
	//                    which is db1.setByKey("RouteDirectionStopActive", JSON.stringify(newVal));
	//                    this is missing latitude/longitude

	var i;
	var isScheduledStop = true;
	if(recent.stop === undefined) {
		isScheduledStop = false;
	}
		
	// is it already in the list? if so, only need to replace up to that one
	var isAlreadyInTheList = false;
	var matchedChoice = null;
	var matchIndex = -1;
	var emptyIndex = -1;
	for(i=0; i < buttonMax; i++) {
		var choiceRawI = tblRecentChoice.getByKey(i.toString());
		if(choiceRawI === undefined || choiceRawI === null || choiceRawI === "undefined") {
			if(emptyIndex === -1) {
				emptyIndex = i;
			}
		} else {
			var choiceI = JSON.parse(choiceRawI);
			// if isScheduledStop, then need to match choiceI.stop == recent.stop
			// else                                   choiceI.stopNumber == recent.stopNumber                     
			if(choiceI !== undefined && choiceI !== null && choiceI !== "undefined") {
				if(isScheduledStop && recent.stop === choiceI.stop) {
					matchedChoice = choiceI;
					matchIndex = i;
					isAlreadyInTheList = true;
				}
				if(!isScheduledStop && recent.stopNumber === choiceI.stopNumber) {
					matchedChoice = choiceI;
					matchIndex = i;
					isAlreadyInTheList = true;
				}
			}
		}
	}
	if(matchedChoice !== undefined && matchedChoice !== null && matchedChoice !== "undefined") {
		if(isDebugging) {
			console.log('Found an existing stop/stopNumber in rotateRecentChoices(' + recent + ')' );
		}
		// found an existing (matchedChoice) use (recent) to change matchedChoice
		// not sure this is needed:   matchedChoice.description = recent.description;
		//                            tblRecentChoice.setByKey('' + matchIndex, JSON.stringify(matchedChoice));   // uses object
		//                            showRecentNumberedStop(matchIndex, recent.description);
	} else {
		if(matchIndex === -1 && emptyIndex > -1) {
			// add at the end
			tblRecentChoice.setByKey('' + emptyIndex, JSON.stringify(recent));
		} else {
			// drop the oldest Choice   drop 0, copy 1 to 0, 2 to 1, ... 4 to 3, add in 4
			for(i=1; i < buttonMax; i++) {
				var tempRaw = tblRecentChoice.getByKey('' + i);
				tblRecentChoice.setByKey('' + (i - 1), tempRaw);
			}
			tblRecentChoice.setByKey('' + (buttonMax - 1), JSON.stringify(recent));
		}
	}
}

function toggleDebug() {
	isDebugging = !isDebugging;
	document.getElementById("utilDebugging").innerText = "Toggle debug " + (isDebugging ? "off" : "on");
}

var form = document.getElementById("busStopForm");
form.addEventListener("submit", function(event) {
	event.preventDefault();
//	var numberedBusStopo70101 = db1.getByKey("o70101");
//	if(numberedBusStopo70101 === undefined || numberedBusStopo70101 === null) {
//		loadNumberedBusStopData();
//	}
	
	var numberedBusStop = db1.getByKey("o" + form.elements.stopNumber.value);
	if(numberedBusStop === undefined || numberedBusStop === null) {
		// show a validation error
		alert("stop number not found.");
		return;
	}
	
	if(isDebugging) {
		console.log("Saving stopNumber.value" + form.elements.stopNumber.value);
	}

	var newValue = '{"stopNumber":' + form.elements.stopNumber.value + ', "description":"' + form.elements.stopDescription.value + '"}';
	db1.setByKey("BusStopNumberEntered", newValue);
	showStop2(newValue);
  });

if(db1.getByKey("o70101") === undefined && db1.supports_html5_storage){
	var sNew = document.createElement('script');
	sNew.async = false; // true;
	sNew.src = "stopOffsets.js";
	var s0 = document.getElementsByTagName('script')[0];
	s0.parentNode.insertBefore(sNew, s0);
}

if(tblStop.getByKey('WIHA') === undefined && db1.supports_html5_storage) {
	var sNew = document.createElement('script');
	sNew.async = false; // true;
	sNew.src = "stopLocations.js";
	var s0 = document.getElementsByTagName('script')[0];
	s0.parentNode.insertBefore(sNew, s0);
}

// global variables for location
var Marquette400S    = {latitude:44.979001, longitude:-93.268623};   //133 

var SouthAndWestOfGatewayRamp  = {latitude:44.9779802, longitude:-93.2642134};   //133  waypoint before Marquette and 4th
var Washington300S     = {latitude:44.979682,  longitude:-93.264170};            // 133 bus is on the move
var SWofWashington300S = {latitude:44.979299,  longitude:-93.263962};
var GrantAnd35W        = {latitude:44.969878,  longitude:-93.269835};            //133  returning, still on 35W

var FourthStreet215S = {latitude:44.978416,  longitude:-93.266661};   // #7
var SixthStreet201S  = {latitude:44.9763315, longitude:-93.268188};   // #14
var Washington300N   = {latitude:44.984393,  longtiude:-93.272505};   // #14
var Washington500N   = {latitude:44.978711,  longitude:-93.262360};   // #14

var BroadwayEmerson  = {latitude:44.999164,  longitude:-93.294136};   // #14
var PlymouthWashington = {latitude:44.992010,longitude:-93.281476};   // #14
var FifthStBusRamp   = {latitude:44.980832,  longitude:-93.275425};   // #14
var SixthNicollet    = {latitude:44.977802,  longitude:-93.271305};

var myRoute = -1; // 14;
var myDirection = -1; // 1;
var myStop = '';

var myBlockNumber = 0;
var myBlockNumberTimeout = new Date(2018,1,1);

var isCurrentTargetANumberedBusStop = false;    //  numbered vs scheduled bus stop

if(Modernizr.localstorage) {
	resetRecentChoiceButtons();
	
	// if any button is loaded, open the "collapseChoices" section
	var firstChoice = document.getElementById("recentChoice0");
	if(firstChoice !== undefined && firstChoice !== null && firstChoice.classList.contains("hidden") === false) {
		document.getElementById("collapseChoices").classList.remove("collapse");
	} else {
		document.getElementById("collapseRoute").classList.remove("collapse");
		document.getElementById("collapseBusStop").classList.remove("collapse");
	}
}

var loadingElement = document.getElementById("page-loader");
loadingElement.hidden = true;
loadingElement.classList.add("hidden");

document.getElementById("page-loaded").style.display = "block";


