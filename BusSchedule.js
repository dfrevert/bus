/* BusSchedule.html javascript */

// eslint settings  -- start
/* eslint-env browser, jquery */
/* eslint-disable no-console */
/* global google, Modernizr */
// eslint settings  -- end

"use strict";

const _version = "20201002_1258";
var _isDebugging = false;
var _buttonMax = 20; // number of recentChoiceButtons, an array from 0 to buttonMax - 1

/*
Problems:
	2019-05-12   remove day of week + hour that have no corresponding tblRecentChoice button.
	2019-05-12   and/or if no matching tblRecentChoice button exists, create one and fire it.
	2019-05-12   the "Past choices ..." shows well.  Add a button per hour + button name to delete the entry.  
	2019-06-21   long pause Route and Stop buttons so that local storage can be dropped and reloaded.  -done-
*/

// ----------------------------------------------------------------------- start
// Source: https://weeknumber.net/how-to/javascript
// 
// Returns the ISO week of the date.
Date.prototype.getWeek = function() {
	var date = new Date(this.getTime());
	date.setHours(0, 0, 0, 0);
	// Thursday in current week decides the year.
	date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
	// January 4 is always in week 1.
	var week1 = new Date(date.getFullYear(), 0, 4);
	// Adjust to Thursday in week 1 and count number of weeks from date to week1.
	return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000
						- 3 + (week1.getDay() + 6) % 7) / 7);
}
// ----------------------------------------------------------------------- end

if(_isDebugging) {
	if (Modernizr.localstorage) {
		console.log("localStorage is supported.");
	} else {
		console.warn("localStorage is NOT supported.");
	}
}

// ---------------- localStorage as object -- start
var _DbTables = class DbTables {
	constructor(databaseName) {
		this.databaseName = databaseName;
	}

	setByKey(key, value) {
		var fullKey = '' + this.databaseName + '.' + key;
		if (_isDebugging) {
			console.log("setByKey(" + fullKey + ", " + value + ")");
		}
		if (!this.supports_html5_storage) {
			console.warn("Unable to setByKey(" + fullKey + ", " + value + ").");
			return false;
		}
		localStorage[fullKey] = value;
		return true;
	}

	getByKey(key) {
		var fullKey = '' + this.databaseName + '.' + key;
		if (_isDebugging) {
			console.log("getByKey(" + fullKey + ")");
		}
		return localStorage[fullKey];
	}

	removeByKey(key) {
		var fullKey = '' + this.databaseName + '.' + key;
		if(_isDebugging) {
			console.log("removeByKey(" + fullKey + ")");
		}
		return localStorage.removeItem(fullKey);
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
			var storage = window[type];
			var x = '__storage_test__';
			storage.setItem(x, x);
			storage.removeItem(x);
			return true;
		}
		catch (e) {
			console.warn("Storage is not available.");
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
		if(_isDebugging) {
			console.log("DbTable.setByKey(" + fullKey + ", " + value + ")");
		}
		localStorage[fullKey] = value;
	}
	
	getByKey(key) {
		var fullKey = '' + this.databaseName + '.' + this.tableName + '.' + key;
		if(_isDebugging) {
			console.log("DbTable.getByKey(" + fullKey + ")");
		}
		return localStorage[fullKey];
	}
	
	removeByKey(key) {
		var fullKey = '' + this.databaseName + '.' + this.tableName + '.' + key;
		if(_isDebugging) {
			console.log("DbTable.removeByKey(" + fullKey + ")");
		}
		return localStorage.removeItem(fullKey);
	}
	
	deleteAll() {
		if (!_db1.supports_html5_storage) { return null; }
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
		
		if(_isDebugging) {
			console.log("From " + this.databaseName + "." + this.tableName + ", deleted " + removedCount.toString() + " of " + i.toString() + " (key, value) pairs.");
		}
		return true;
	}
}

var _db1 = new _DbTables('BusDB');

var _tblVehicleTracked = new DbTable(_db1, 'VehicleTracked');
var _tblVehicleLocation = new DbTable(_db1, 'VehicleLocation');
var _tblRouteDirections = new DbTable(_db1, 'RouteDirections');
var _tblRouteDirectionStopDeparture = new DbTable(_db1, 'RouteDirectionStopDeparture');
var _tblRouteDirectionStops = new DbTable(_db1, 'RouteDirectionStops');
var _tblStop = new DbTable(_db1, 'Stop');
var _tblRecentChoice = new DbTable(_db1, 'RecentChoice');


// in order to pre-select a BusDB.RecentChoice.N button, need a table of 
//     either   route+direction+stop + weekOfYear + dayOfWeek + hourOfDay     + Count
//     or       numberedStop         + weekOfYear + dayOfWeek + hourOfDay     + Count
// so later, based on weekOfYear + dayOfWeek + hourOfDay, the most likely can be selected
//     Every time the button (recent choice button or the Details button) is clicked
//           the proper entry is found or added
//                            its count is incremented
//
var _tblPastChoices = new DbTable(_db1, 'PastChoices');
// expected data structure
//     someday include: weekOfYear     int  1=            53            // use getWeek() on a Date object
//    
//     dayOfWeek      int  0=Sunday, ... 6 = Saturday  // use getDay()  on a Date object
//     hourOfDay      int  0, ... , 23                 // use getHour() on a Date object
//     choices        array of choice    {{"scheduledStop":{"route":14,"direction":4,"stop":"BL54"},"count":1},
//                                       {"numberedStop":{"stopNumber":15574,"latitude":44.912346,"longitude":-93.252372,"description":"Home to work","routeFilter":"14"},"count":2}}
//
//     key will need to duplicate the week + day + hour, and so should not duplicate the data?
//          so, instead a comma separated string?   like "2,7" to represent  Tuesday 7am 

// ---------------- localStorage as object -- end

function getCurrentPastChoicesKey(dDay, dHour) {
	if(dDay === undefined || dDay === null) {dDay = 0;}
	if(dHour === undefined || dHour === null) {dHour = 0;}
	
	var now = new Date(); 
	var nowAdjusted = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dDay, now.getHours() + dHour, 0, 0);
	
	return nowAdjusted.getDay().toString()+','+nowAdjusted.getHours().toString();
}

function savePastChoice(recentChoice) {
	if(isShouldSavePastChoice === undefined || isShouldSavePastChoice === null || !isShouldSavePastChoice) {
		if(_isDebugging) {
			console.log("savePastChoice is skipped because isShouldSavePastChoice is not true.");
		}
		return;
	}

	var pastChoicesKey = getCurrentPastChoicesKey();
	if(_isDebugging) {
		console.log("pastChoicesKey = " + pastChoicesKey);
	}

	var pastChoices = _tblPastChoices.getByKey(pastChoicesKey);
	if(pastChoices === undefined || pastChoices === null) {
		var choice = null;
		if(recentChoice.route !== undefined && recentChoice.route !== null) {
			choice = [{"scheduledStop":recentChoice, "count":1}];
		} else {
			if(recentChoice.stopNumber !== undefined && recentChoice.stopNumber !== null) {
				choice = [{"numberedStop":recentChoice, "count":1}];
			}
		}
		if(choice !== undefined && choice !== null) {
			_tblPastChoices.setByKey(pastChoicesKey, JSON.stringify(choice));
		}
		
	} else {
		var pastChoicesArray = JSON.parse(pastChoices);

		// need to examine the pastChoice (which is actually a list of choices)
		// need to parse the list to see if this recentChoice is already in the list
		if(_isDebugging) {
			console.log("pastChoicesArray = " + pastChoicesArray);
			console.log("pastChoicesArray.length = " + pastChoicesArray.length);
		}
		
		var matchingChoiceIndex = -1;
		var isScheduledStop = true;   // as opposed to isNumberedStop
		if(recentChoice.stopNumber !== undefined && recentChoice.stopNumber !== null) {
			isScheduledStop = false;
		}
		for(var i = 0; i < pastChoicesArray.length; i++) {
			// look for a match to recentChoice

			if(isScheduledStop && pastChoicesArray[i].scheduledStop !== undefined) {
				if(recentChoice.route === pastChoicesArray[i].scheduledStop.route &&
					recentChoice.direction === pastChoicesArray[i].scheduledStop.direction &&
					recentChoice.stop === pastChoicesArray[i].scheduledStop.stop) {
						//
					matchingChoiceIndex = i;
					break;   // break out of the for loop
				}
			} else {
				if(!isScheduledStop && pastChoicesArray[i].numberedStop !== undefined) {
					// is a Numbered Stop like: {"stopNumber":15574,"latitude":44.912346,"longitude":-93.252372,"description":"Home to work","routeFilter":"14"}
					if(recentChoice.stopNumber === pastChoicesArray[i].numberedStop.stopNumber &&
	//				   recentChoice.latitude == pastChoicesArray[i].numberedStop.latitude &&
	//				   recentChoice.longitude == pastChoicesArray[i].numberedStop.longitude &&
						recentChoice.description === pastChoicesArray[i].numberedStop.description &&
						recentChoice.routeFilter === pastChoicesArray[i].numberedStop.routeFilter) {
							//
						matchingChoiceIndex = i;
						break;   // break out of the for loop
					}
				}
			}
		}
		
		if(matchingChoiceIndex === -1) {
			// create a new element of the pastChoice[] array
			var choiceNew;
			if(isScheduledStop) {
				choiceNew = {"scheduledStop":recentChoice, "count":1};
			} else {
				choiceNew = {"numberedStop":recentChoice, "count":1};				
			}
			pastChoicesArray.push(choiceNew);
			_tblPastChoices.setByKey(pastChoicesKey, JSON.stringify(pastChoicesArray));
		} else {
			// increment the count on this element of the pastChoice[] array and save it.
			pastChoicesArray[matchingChoiceIndex].count += 1;
			_tblPastChoices.setByKey(pastChoicesKey, JSON.stringify(pastChoicesArray));
		}
	}
}

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
	var raw = _db1.getByKey("ActiveNumberedBusStop");
	if(raw === undefined || raw === null) {
		if(_isDebugging) {
			console.warn("getActiveNumberedBusStop() will return null because db1.getByKey('ActiveNumberedBusStop') returned null");
		}
		return null;
	}
	return JSON.parse(raw);
}

function getRouteDirectionStopActive() {
	var raw = _db1.getByKey("RouteDirectionStopActive");
	if(raw === undefined || raw === null) {
		if(_isDebugging) {
			console.warn("getRouteDirectionStopActive() will return null because db1.getByKey('RouteDirectionStopActive') returned " + ((raw === undefined) ? "undefined": "null"));
		}
		return null;
	}
	return JSON.parse(raw);
}

function logAjax(xmlHttp, description) {
	if(_isDebugging) {
		console.info("logAjax(xmlHttp, " + description + ")  .readyState=" + xmlHttp.readyState + "   .status=" + xmlHttp.status);
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
	if(_isDebugging) {
		console.log("showStop2(n) n=" + JSON.stringify(enteredStopNumber));
	}
	var stopNumberInfo;
	if(enteredStopNumber.stopNumber !== undefined) {
		stopNumberInfo = enteredStopNumber;
	} else {
		stopNumberInfo = JSON.parse(enteredStopNumber);
	}
	if(_isDebugging) {
		console.log("showStop2  stopNumberInfo=" + JSON.stringify(stopNumberInfo));
	}
	saveNumberedBusStopInfo(stopNumberInfo);
	
	savePastChoice(stopNumberInfo);
	
	showStop(stopNumberInfo.stopNumber);
	
	document.getElementById("collapseDetails").classList.add("show");
	document.getElementById("collapseRoute").classList.remove("show");
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
	if(activeNumberedBusStop !== undefined 
		&& activeNumberedBusStop !== null 
		&& activeNumberedBusStop.stopNumber === enteredStopNumber.stopNumber
		&& activeNumberedBusStop.routeFilter === enteredStopNumber.routeFilter) {
		return;
	}
	
	if(_isDebugging) {
		console.log("saveNumberedBusStopInfo(" + JSON.stringify(enteredStopNumber) + ")");
	}

	// lookup the stop offset
	var oStopNumber = "o" + enteredStopNumber.stopNumber.toString();
	var dbStopNumber = _db1.getByKey(oStopNumber);
	if(dbStopNumber === undefined || dbStopNumber === null) {
		if(_isDebugging) {
			console.warn("saveNumberedBusStopInfo(" + enteredStopNumber.stopNumber.toString() + ") being skipped because db1.getByKey(\"" + oStopNumber + "\") is null. Skipping.");
		}
		return;
	}

	var offsetForStop = JSON.parse(dbStopNumber);
	if(offsetForStop === undefined || offsetForStop === null) {
		if(_isDebugging) {
			console.warn("saveNumberedBusStopInfo(" + enteredStopNumber.stopNumber.toString() + ") caused offsetForStop to be null. Skipping.");
		}
		return;
	}

	if(_isDebugging) {
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
	
	var busStopPoint = {"stopNumber":enteredStopNumber.stopNumber, "latitude": latitude, "longitude": longitude, "description": description, "routeFilter":enteredStopNumber.routeFilter};
	_db1.setByKey("ActiveNumberedBusStop", JSON.stringify(busStopPoint));
	
	// rotateRecentNumberedStops();
	rotateRecentChoices(busStopPoint);
	resetRecentChoiceButtons();
}

function buildStopResults(arr) {
	_isCurrentTargetANumberedBusStop = true;

	$("#collapseDetails").collapse("show"); // eslint-disable-line no-undef

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
		
		if(targetPoint !== undefined && arr[i] !== undefined && arr[i].Route !== undefined && targetPoint.routeFilter !== undefined) {
			var iRouteAndTerminal = arr[i].Route + ((arr[i].Terminal === undefined) ? "" : arr[i].Terminal);
			// var re = new RegExp("\\" + targetPoint.routeFilter + "\\", "g");
			var re = new RegExp(targetPoint.routeFilter, "g");
			if(!iRouteAndTerminal.match(re)) {
				if(_isDebugging) {
					console.log("buildStopResults(arr) targetPoint.routeFilter=" + targetPoint.routeFilter + " did not match iRouteAndTerminal=" + iRouteAndTerminal);
				}
				continue;    // back to top of for loop 
			}		
		}	
		
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
		
		if(_isDebugging) {
			console.log("buildStopResults(arr) set _numberedStopValue=" + JSON.stringify(_numberedStopValue));
		}
		
		var outButton = '<button type="button" class="btn btn-primary" onclick="showStop(_numberedStopValue.stopNumber);" >' 
					+ targetPoint.stopNumber + ' - ' 
					+ targetPoint.description 
					+ ((targetPoint.routeFilter === undefined) ? '' : (' ' + targetPoint.routeFilter))
					+ '</button>';
		var timeOfQuery = new Date();
		outButton += '<label>&nbsp;&nbsp;' + timeOfQuery.toHHMMSS() + '</label>';
		
		document.getElementById("id00C").innerHTML = outButton;	
	}
}

function stripBound(routeDirection) {
	if(routeDirection === undefined || routeDirection === null) {
		if(_isDebugging) {
			console.warn("stripBound(routeDirection) with undefined or null routeDirection");
		}
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

	if(_isDebugging) {
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
	
	if(_isDebugging) {
		console.log("populateVehicleLocations2(" + route.toString() + ", " + blockNumber + ", " + responseText + ") called.");
	}
	
	var i;
	for(i = 0; i < arr.length; i++) {
		if(arr[i].Route === route.toString() && arr[i].BlockNumber === blockNumber) {

			if(_isDebugging) {
				console.log("populateVehicleLocations2  .Route, .BlockNumber match found. (" + route.toString() + ", " + blockNumber + ").");
			}

			var newVal = {"direction": arr[i].Direction, 
						"locationTime": arr[i].LocationTime,
						"latitude": arr[i].VehicleLatitude,
						"longitude": arr[i].VehicleLongitude };
			_tblVehicleLocation.setByKey(route.toString() + '.' + blockNumber.toString(), JSON.stringify(newVal));
			rewriteActualTableData(route, blockNumber);

			// assumes only one block number needs to be clickable
			return;
		}
		else {

			if(_isDebugging) {
				console.log("populateVehicleLocations2  .Route, .BlockNumber match NOT found. (" + arr[i].Route + ", " + arr[i].BlockNumber + ").");
			}

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
	var busLastAt = JSON.parse(_tblVehicleLocation.getByKey(route.toString() + '.' + blockNumber.toString()));
	var busLocationTime = fromDateString(busLastAt.locationTime);
	
	_myBlockNumber = blockNumber;
	
	addMarker({"route":route, "blockNumber":blockNumber, "time":busLocationTime, "latitude":busLastAt.latitude, "longitude":busLastAt.longitude});
	
	var now = new Date();
	var timezoneOffsetInMinutes = now.getTimezoneOffset();
	var secondsElapsed = (now - busLocationTime.getTime() + 1000 * 60 * timezoneOffsetInMinutes) / 1000;
	// secondsElapsed should never be less than 0
	//                is an indication that the local clock and the Server clock differ
	//                need to save an offset value.
	if(secondsElapsed < 0 && secondsElapsedOffset < 60) {
		secondsElapsedOffset = -secondsElapsed + secondsElapsedOffset;
		if(_isDebugging) {
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
		var raw = _tblStop.getByKey(routeDirectionStopActive.stop);
		if(raw === undefined || raw === null) {
			console.log("Warning: rewriteActualTableData could not find an activeStop.  tblStop.getByKey(" + routeDirectionStopActive.stop + ") is null.");
		}
		else {
			activeStop = JSON.parse(raw);
		}
	}
	
	var busStopPoint = null;
	if(_isCurrentTargetANumberedBusStop) {
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
		if(_isDebugging) {
			console.warn("rewriteActualTableData(" + route.toString() + ", " + blockNumber.toString() + ") called, busStopPoint is null!");
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
	if(_isDebugging) {
		console.log("markupBlockNumberButton(" + blockNumber.toString() + ") which creates a button busNumberClicked(" + blockNumber.toString() +")");
	}
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

function selectRoute() {  // eslint-disable-line no-unused-vars
	// if we already know the routes, saved to localStorage, use that.
	if(Modernizr.localstorage) {
		var p =  _db1.getByKey("Routes"); 
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
			_db1.setByKey("Routes", xmlhttp3.responseText);
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
	_myRoute = $(this).Value;
});

// eslint-disable-next-line no-unused-vars
function busNumberClicked2(blockNumber, routeNumber) {
	_myRoute = routeNumber;
	
	if(map === undefined || map === null) {
		var targetStop = getActiveNumberedBusStop();
		if(targetStop !== undefined && targetStop !== null) {
			_myBlockNumber = blockNumber;
			_myStop = null;
//			document.getElementById("collapseMap").classList.add("show");			
//			initializeMap2(targetStop);
		}
	}

	busNumberClicked(blockNumber);
	return;
}

function busNumberClicked(blockNumber) {
	var stop;
	var stopMine;
	if(_myBlockNumber === blockNumber) {
		if(map === undefined || map === null) {
			stop = _tblStop.getByKey(_myStop);
			if(stop !== undefined && stop !== null) {
				stopMine = JSON.parse(stop);
				document.getElementById("collapseMap").classList.add("show");			
				initializeMap2(stopMine);
				if(_isDebugging) {
					console.log("busNumberClicked(" +blockNumber.toString() + ") myStop found: stopMine=" + JSON.stringify(stopMine) + " initializeMap2 called.");
				}
			} else {
				if(_isDebugging) {
					console.log("busNumberClicked(" +blockNumber.toString() + ") map did not exist, myStop not set, a NumberedStop?");
				}

				var targetStop = getActiveNumberedBusStop();
				if(targetStop !== undefined && targetStop !== null) {
					// myBlockNumber = blockNumber;
					if(_isDebugging) {
						console.log("busNumberClicked(" +blockNumber.toString() + ") map did not exist, a NumberedStop found.");
					}
					document.getElementById("collapseMap").classList.add("show");			
					initializeMap2(targetStop);
				} else {
					if(_isDebugging) {
						console.warn("busNumberClicked(" +blockNumber.toString() + ") map did not exist, myStop and NumberedStop not set");
					}
				}
			}
		}
		showBusLocation2(_myRoute, blockNumber);
		return;
	}

	if(_isDebugging) {
		console.log("busNumberClicked(" +blockNumber.toString() + ") will switch away from the previous myBlockNumber=" + _myBlockNumber.toString());
	}

	_myBlockNumber = blockNumber;
	// set a timeout for when to stop tracking the bus by BlockNumber.
	//                                                         20 minutes from now
	_myBlockNumberTimeout = new Date((new Date()).getTime() + 20 * 60 * 1000);
	// save the current row's info, so it can be used to populate the missing row.

	if(Modernizr.localstorage) {
		var p = _tblRouteDirectionStopDeparture.getByKey(_myRoute.toString() + '.' + _myDirection.toString() + '.' + _myStop);
		if(p !== undefined && p !== null) {

			if(_isDebugging) {
				console.log("busNumberClicked(" +blockNumber.toString() + ") myRoute=" + _myRoute.toString() + " myDirection=" + _myDirection.toString() + " myStop=" + _myStop);
			}
						
			var arr = JSON.parse(p);
			var i;
			for(i = 0; i < arr.length; i++) {
				if(arr[i].BlockNumber === blockNumber) {
					var newValue = JSON.stringify(arr[i]);	
					_tblVehicleTracked.setByKey(blockNumber, newValue);
					
					if(map === undefined) {
						stop = _tblStop.getByKey(_myStop);
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

// eslint-disable-next-line no-unused-vars
function routeClicked(route) {
	if(_myRoute === undefined || _myRoute === null || _myRoute !== route) {
		$("#selectDirectionButton").removeClass("active");	
		$("#selectStopButton").removeClass("active");	
	}
	_myRoute = route;
	// show the selected route 
	document.getElementById('selectedRoute').innerHTML = '&nbsp;:&nbsp;' + route + '&nbsp;&nbsp;&nbsp;';
	selectRouteDirections(route);
}

// --------------------- RouteDirections
// eslint-disable-next-line no-unused-vars
function selectRouteDirectionsUsingMyRoute() {
	$("#selectStopButton").removeClass("active");	
	selectRouteDirections2(_myRoute, true, true);
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
		var p =  _tblRouteDirections.getByKey(route);
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
			_tblRouteDirections.setByKey('' + route, xmlhttp4.responseText);
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

// eslint-disable-next-line no-unused-vars
function routeDirectionClicked(route, direction) {
	if(_myRoute === undefined || _myRoute !== route || _myDirection === undefined || _myDirection !== direction) {
		$("#selectStopButton").removeClass("active");	
	}
	_myRoute = route;
	_myDirection = direction;

	document.getElementById('selectedDirection').innerHTML = '&nbsp;:&nbsp;' + directionAsString(direction) + '&nbsp;&nbsp;&nbsp;';

	if(_isDebugging) {
		console.log("routeDirectClicked(" + route + ", " + direction + ")  myRoute=" + _myRoute + "  myDirection=" + _myDirection);
	}
	selectRouteDirectionStops(route, direction);
}

// --------------------- RouteDirectionStops
// eslint-disable-next-line no-unused-vars
function selectRouteDirectionStopsUsingMyDirection(){
	selectRouteDirectionStops2(_myRoute, _myDirection, true);
}

function selectRouteDirectionStops(route, direction) {
	selectRouteDirectionStops2(route, direction, true);
}

function selectRouteDirectionStops2(route, direction, shouldCreateButtons) {
	// if route direction stops are known, use them
	if(Modernizr.localstorage) {
		var p =  _tblRouteDirectionStops.getByKey(route + '.' + direction);
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
			_tblRouteDirectionStops.setByKey(route + "." + direction, xmlhttp5.responseText);
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
	_myRoute = route;
	_myDirection = direction;
	
	if(_myStop === undefined || _myStop === null || _myStop !== stop) {
		document.getElementById('selectedStop').innerHTML = '&nbsp;&nbsp;' + stopDescription + '&nbsp;&nbsp;&nbsp;';
	}
	_myStop = stop;
	if(_isDebugging) {
		console.log("routeDirectionStop()  myRoute=" + _myRoute 
			+ "  myDirection=" + _myDirection
			+ "  myStop=" + _myStop);
	}
	// open the details section
	document.getElementById("collapseDetails").classList.add("show");
	document.getElementById("collapseBusStop").classList.remove("show");
	
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
	var scheduledStop = _tblStop.getByKey(stop);
	if(scheduledStop !== undefined && scheduledStop !== null) {
		targetPoint = JSON.parse(scheduledStop);
	}

	_isCurrentTargetANumberedBusStop = false;
	
	var out = '<div><table class="table table-sm table-responsive-sm table-bordered"><tr><th>Actual</th><th>Route</th><th>Departs</th><th>Banner</th><th>Milestone</th><th>Miles</th></tr>';
	
	// a tracked bus number, could disappear from these results, even though it has not reached the stop
	//     need to detect that the tracked bus number is not in the results
	var shouldShowTrackedBus = false;
	if(_myBlockNumber > 0 && new Date() < _myBlockNumberTimeout) {
		var hasBlockNumberMatch = false;
		for(i = 0; i < arr.length; i++) {
			if(arr[i].BlockNumber === _myBlockNumber) {
				hasBlockNumberMatch = true;
			}
		}
		
		shouldShowTrackedBus = !hasBlockNumberMatch;
		
		if(shouldShowTrackedBus) {
			// need to be able to add based on a saved row, 
			if(Modernizr.localstorage) {
				var p = _tblVehicleTracked.getByKey(_myBlockNumber.toString());
				if(p !== undefined && p !== null) {
					var pI = JSON.parse(p);

					milesAndDirectionLetter = " ? ";
					
					// pI will have a stale version of the row
					//     getDbValue("VehicleLocation.14.1350")    VehicleLocation.14.1350={"direction":1, "locationTime":"/Date(1491594644000-0500)/", "latitude":44.97766, "longitude":-93.27093}
					var vT = _tblVehicleLocation.getByKey(route.toString() + '.' + _myBlockNumber.toString());
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
	
	if(_isDebugging) {
		console.log("populateDepartures  myBlockNumber:" + _myBlockNumber.toString() + ", shouldShowTrackedBus:" + shouldShowTrackedBus);
	}
	
	for(i = 0; i < arr.length && i < _buttonMax; i++) {
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
		_tblRouteDirectionStopDeparture.setByKey(route.toString() + "." + direction + "." + stop, responseText);

		var recentValidChoice = {"route":route, "direction":direction, "stop":stop }; 
		savePastChoice(recentValidChoice);
		
		if(stop !== _myStop) {
			_myStop = stop;
		}
		if(direction !== _myDirection) {
			_myDirection = direction;
		}
		if(route !== _myRoute) {
			_myRoute = route;
		}
		
		var routeDirectionStopActive = getRouteDirectionStopActive();
		if(routeDirectionStopActive !== undefined && routeDirectionStopActive !== null 
			&& routeDirectionStopActive.route === route && routeDirectionStopActive.direction === direction && routeDirectionStopActive.stop === stop) {
			// dbValue already set to this, so assume it's ok to remove the 00A section
		}
		else {
			var newVal = {"route":route, "direction":direction, "stop":stop };
			_db1.setByKey("RouteDirectionStopActive", JSON.stringify(newVal));
			var rawStop = _tblStop.getByKey(stop);
			if(rawStop !== undefined && rawStop !== null) {
				var stopParsed = JSON.parse(rawStop);
				if(stopParsed !== undefined && stopParsed !== null) {
					var busStopPoint = {"stop":stop, "latitude": stopParsed.latitude, "longitude": stopParsed.longitude};
					_db1.setByKey("ActiveScheduledBusStop", JSON.stringify(busStopPoint));
				}
			}
			// rotateRecentRoutes();
			rotateRecentChoices(newVal);
		}
		resetRecentChoiceButtons();
		document.getElementById("id00RouteDirectionStop").style.display = "none";
	}

    document.getElementById("title1").innerHTML = "Bus Schedule " + route.toString();
	if(_isDebugging) {
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
	
	document.getElementById("collapseDetails").classList.add("show");				
}

function getStopDescription(route, direction, stop) {
	if(Modernizr.localstorage) {
		var p =  _tblRouteDirectionStops.getByKey(route.toString() + '.' + direction);
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

// example: var s = directionAsString(recentStop.direction);
function directionAsString(direction) {
	// 1 South, 2 East, 3 West, 4 North
	// console.log("directionAsString()  direction=" + direction);
	return direction === 1 ? "S" : direction === 2 ? "E" : direction === 3 ? "W" : direction === 4 ? "N" : "?";
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

function distanceInMiles(arrRow) {
	var busAtPoint = {latitude:arrRow.VehicleLatitude, longitude:arrRow.VehicleLongitude};

	var targetPoint = null;
	if(_isCurrentTargetANumberedBusStop) {
		targetPoint = getActiveNumberedBusStop();
	}
	else {
		var activeStop = _db1.getByKey("ActiveScheduledBusStop");
		if(activeStop !== undefined && activeStop !== null) {
			targetPoint = JSON.parse(activeStop);
		}
	}
	
	if(targetPoint !== undefined && targetPoint !== null) {
		return distanceNearLatitude45(busAtPoint, targetPoint); 
	}
	
	if(arrRow.Route==="133") {
		return distanceNearLatitude45(busAtPoint, _Marquette400S);  //400 S Marquette
	}
	if(arrRow.Route==="7") {
		return distanceNearLatitude45(busAtPoint, _FourthStreet215S);   //215 S 4th St - #7    FourthStreet215S
	}
	if(arrRow.Route==="14") {
		return distanceNearLatitude45(busAtPoint, _SixthStreet201S);  //Capella Tower
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
		
		var milesSWofWashington300S = miles(busAtPoint, _SWofWashington300S);
		if(isNorthAndEastOf(milesSWofWashington300S, 0.2)) {
			return {detail: "NE of 3rd and Washington" + " :" + milesAsString(milesSWofWashington300S),
					simple: milesAndDirection(milesSWofWashington300S) + " of 3rd &amp; Wash"};
		}

		var milesSouthAndWestOfGatewayRamp = miles(busAtPoint, _SouthAndWestOfGatewayRamp);
		if(milesSouthAndWestOfGatewayRamp.isNorthOf && milesSouthAndWestOfGatewayRamp.isEastOf && milesSouthAndWestOfGatewayRamp.between < 0.15) {
			return {detail: "Start of run (Gateway Ramp)" + milesAsString(milesSouthAndWestOfGatewayRamp),
					simple: milesAndDirection(milesSouthAndWestOfGatewayRamp) + " start of run"};
		}
		
		var milesWashington300S = miles(busAtPoint, _Washington300S);
		if(milesWashington300S.isNorthOf && milesWashington300S.isEastOf && milesWashington300S.between < 0.2) {
			return {detail: "East of 3rd and Washington" + milesAsString(milesWashington300S),
					simple: milesAndDirection(milesWashington300S) + " of 3rd &amp; Wash"};
		}
		if(milesWashington300S.isNorthOf && milesWashington300S.isWestOf && milesWashington300S.between < 0.2) {
			return {detail: "Crossed 3rd and Washington" + milesAsString(milesWashington300S),
					simple: milesAndDirection(milesWashington300S) + " crossed 3rd &amp; Wash"};
		}
		
		var milesGrantAnd35W = miles(busAtPoint, _GrantAnd35W);
		if(milesGrantAnd35W.isSouthOf) {
			return {detail: "Still south of downtown" + milesAsString(milesGrantAnd35W),
					simple: milesAndDirection(milesGrantAnd35W) + " of downtown"};
		}
		if(milesGrantAnd35W.east < -1.0) {
			return {detail: "West of downtown" + milesAsString(milesGrantAnd35W),
					simple: milesAndDirection(milesGrantAnd35W) + " of downtown"};
		}
		
		var miles400SMarquette = miles(busAtPoint, _Marquette400S);

		var distanceFrom400SMarquette = distance(arrRow.VehicleLatitude, arrRow.VehicleLongitude, _Marquette400S.latitude, _Marquette400S.longitude);
		var distanceFrom5thAndWashington = distance(arrRow.VehicleLatitude, arrRow.VehicleLongitude, _Washington500N.latitude, _Washington500N.longitude);
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
		var milesAway = miles(busAtPoint, _SixthStreet201S);
		
		var milesBroadwayEmerson = miles(busAtPoint, +_BroadwayEmerson);
		if(milesBroadwayEmerson.isWestOf) {
			return {detail: "West of Broadway Emerson" + " :" + milesAsString(milesBroadwayEmerson),
					simple: milesAndDirection(milesBroadwayEmerson) + " of Broadway &amp; Emerson"};
		}

		var milesPlymouthWashington = miles(busAtPoint, _PlymouthWashington);
		if(milesPlymouthWashington.east < 0.1 && milesPlymouthWashington.north > -0.1 ) {
			return {detail: "West of Plymouth and Washington" + " :" + milesAsString(milesPlymouthWashington), 
					simple: milesAndDirection(milesPlymouthWashington) + " of Plymouth &amp; Wash"};
		}

		var milesWashington300N = miles(busAtPoint, _Washington300N);
		if(milesWashington300N.isWestOf && milesWashington300N.isNorthOf && milesWashington300N.between < 1) {
			return {detail: "NW of 3rd Ave N and Washington" + " :" + milesAsString(milesWashington300N),
					simple: milesAndDirection(milesWashington300N) + " of 3rd Ave N &amp; Wash"};
		}
		
		var milesFifthStBusRamp = miles(busAtPoint, _FifthStBusRamp);
		if(milesFifthStBusRamp.isNorthOf && milesFifthStBusRamp.north < 0.2) {
			return {detail: "At 5th Street Bus Ramp" + " :" + milesAsString(milesFifthStBusRamp), 
					simple: milesAndDirection(milesFifthStBusRamp) + " of 5th St Bus Ramp"};
		}
		
		var milesFromSixthNicollet = miles(busAtPoint, _SixthNicollet);
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
		var milesFrom215s4thSt = miles(busAtPoint, _FourthStreet215S);

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

function resetDatabase() {   // eslint-disable-line no-unused-vars
    if (!_db1.supports_html5_storage) { return null; }
	localStorage.clear();
	if(_isDebugging) {
		console.log("resetDatabase to clear all localStorage.");
	}
}

function showDatabase() {   // eslint-disable-line no-unused-vars
	// show SQL that could be used in a query for Stop names of a route
    // BusDB.RouteDirectionStops.133.1	[{"Text":"Gateway Ramp ","Value":"GTWY"},{"Text":"Marquette Ave and 4th St ","Value":"MA4S"},{"Text":"Marquette Ave and 8th St ","Value":"MA8S"},{"Text":"12th St and 3rd Ave ","Value":"123A"},{"Text":"I-35W and Lake St","Value":"I3LA"},{"Text":"38th St and Chicago Ave","Value":"38CH"},{"Text":"Chicago Ave and 46th St","Value":"46CH"},{"Text":"54th St and Bloomington Ave","Value":"BL54"},{"Text":"1000 46th St E ","Value":"1046"}]	
    // BusDB.RouteDirectionStops.133.4	[{"Text":"1000 46th St E ","Value":"1046"},{"Text":"Bloomington Ave and 54th St","Value":"BL54"},{"Text":"Chicago Ave and 46th St","Value":"46CH"},{"Text":"38th St and Chicago Ave","Value":"38CH"},{"Text":"2nd Ave and 11th St ","Value":"112A"},{"Text":"2nd Ave and 7th St ","Value":"7S2A"},{"Text":"2nd Ave and Washington Ave ","Value":"WA2A"}]	
    if (!_db1.supports_html5_storage) { return null; }

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

function showDbSize() {   // eslint-disable-line no-unused-vars
	var dbSize = getDbSize();
	if(_isDebugging) {
		console.log("localStorage size=" + getDbSize());	
	}
	popupModal("localStorage size is " + dbSize);
}

function removeDbUndefined() {   // eslint-disable-line no-unused-vars
	if (!_db1.supports_html5_storage) { return null; }
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
	
	if(_isDebugging) {
		console.log("From localStorage, deleted " + removedCount.toString() + " of " + i.toString() + " (key, undefined) pairs.");
	}
	popupModal("Removed " + removedCount.toString() + " undefined values from localStorage.");
	return true;
}
// -------------------------------- local storage -- end

function visitAllRoutes() {   // eslint-disable-line no-unused-vars
	var route;
	// to populate the local database with values that showDatabase() can use.
    if (!_db1.supports_html5_storage) { 
		return; 
	}
	
	var rawRoutes = _db1.getByKey("Routes");
	if(rawRoutes === null) { 
		if(_isDebugging) {
			console.log("No routes found using db1.getByKey('Routes').");
		}
		return; 
	}
	
	var arrRoutes = JSON.parse(rawRoutes);
	for(i = 0; i < arrRoutes.length; i++) {
		// need to determine the valid directions for each route
		route = arrRoutes[i].Route;
		// is there a function to call that does not create/update a button?
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

function getGps() {  // eslint-disable-line no-unused-vars
    var output = document.getElementById("mapPanelHeadingLabel");
	
	if (output === null) {
		popupModal("getGps() could not find elementId 'mapPanelHeadingLabel'.");
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

function initializeMap() {
	if(_isDebugging) {
		console.log("initializeMap() called back.");
	}	
	return initializeMap2(currentDeviceGps); 
}

function initializeMap2(position) {
	if (position === undefined || position === null || position.latitude === undefined || position.latitude === null) { return; }

	if (window.getComputedStyle(document.getElementById("collapseMap"), null).getPropertyValue("display") === "none") { return; }

	var latlng = new google.maps.LatLng(position.latitude, position.longitude);
	var myOptions = {
		zoom: 14,   // stackoverflow version was set to 1
		center: latlng,
		mapTypeId: google.maps.MapTypeId.ROADMAP
	};
	if (_isDebugging) {
		console.log("Calling google to set the map. myOptions=" + JSON.stringify(myOptions));
	}

	map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
	addMarker(position);

	addBlockButtonToMapTitle();
	addResetButtonToMapTitle();
}

function addBlockButtonToMapTitle() {
	if(_isDebugging) {
		console.log("addBlockButtonToMapTitle markupBlockNumberButton(myBlockNumber)  myBlockNumber=" + _myBlockNumber.toString());
	}
	var divInTitle = document.getElementsByClassName("map-title");
	var markup = markupBlockNumberButton(_myBlockNumber);
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

var markerIntervals;

function addMarker(busLocation) {
	var i = 0;
	if(_isDebugging) {
		console.log("addMarker(busLocation)  busLocation=" + JSON.stringify(busLocation));
	}
	
	if(markers === undefined || markers === null) {
		markers = [];
	}
	
    for (i = 0; i < markers.length; i++) {
		if(markers[i].position === undefined || markers[i].position === null) return;
		if (busLocation.latitude === markers[i].position.lat() && busLocation.longitude === markers[i].position.lng()) return;
	}
	
	var current = new google.maps.LatLng(busLocation.latitude, busLocation.longitude);
	if(current === undefined || current === null) {
		if(_isDebugging) {
			console.warn("addMarker(busLocation)  busLocation=" + JSON.stringify(busLocation) + " Unable to determine a current location.");
		}
		return;
	}
	
	// if map is null, create one
	if(map === undefined || map === null) {
		if(_isDebugging) {
			console.log("addMarker(busLocation)  map is null.");
		}
		
		var activeStop;
		var rawActiveStop = _db1.getByKey("ActiveScheduledBusStop");
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
		if(_isDebugging) {
			console.warn("addMarker(busLocation)  map is still null.  Skipping.");
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
		
		var markerInterval = setInterval(function() {
			// 0.9375 ok, 0.9 too fast; both fade to less than 10% too fast.
			// var newOpacity = (marker.opacity * 0.8) + 0.10;    // needs to fade more as a final  0.46 seems to be the minimum
			var newOpacity = marker.opacity * 0.8 + 0.08;
			marker.setOptions({'opacity': newOpacity});
			if(_isDebugging) {
				console.info("setInterval(function() marker.opacity = " + marker.opacity);
			}
		}, 15000);   // 15 seconds
		
		setTimeout(function() {
			marker.setOptions({'opacity': 0.0});
			marker.setMap(null);
		}, 20 * 60 * 1000);     // 20 minutes
		
		if(markerIntervals === undefined || markerIntervals === null) {
			markerIntervals = [];
		}
		markerIntervals.push(markerInterval);
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

function clearRecentChoices() {   // eslint-disable-line no-unused-vars
	if(_isDebugging) {
		console.debug("clearRecentChoices() starting.");
	}
	
	_tblRecentChoice.deleteAll();

	if(_isDebugging) {
		console.debug("clearRecentChoices() done.");
	}
}

function clearPastChoices() {   // eslint-disable-line no-unused-vars
	if(_isDebugging) {
		console.debug("clearPastChoices() starting.");
	}
	
	_tblPastChoices.deleteAll();

	if(_isDebugging) {
		console.debug("clearPastChoices() done.");
	}
}

function clearPastChoicesOfNow() {   // eslint-disable-line no-unused-vars
	if(_isDebugging) {
		console.debug("clearPastChoicesOfNow() starting.");
	}
	
// 	var pastChoices = tblPastChoices.getByKey(pastChoicesKey);
	if(_tblPastChoices !== undefined && _tblPastChoices !== null) {
		// if(pastChoices !== undefined && pastChoices !== null)
			var pastChoicesKey = getCurrentPastChoicesKey();
			_tblPastChoices.removeByKey(pastChoicesKey);
	}

	if(_isDebugging) {
		console.debug("clearPastChoicesOfNow() done.");
	}
}

function clearVehicleTracking() {   // eslint-disable-line no-unused-vars
	if(_isDebugging) {
		console.debug("clearVehicleTracking() starting.");
	}
	
	_tblVehicleLocation.deleteAll();

	if(_isDebugging) {
		console.debug("clearVehicleTracking() half done.");
	}

	_tblVehicleTracked.deleteAll();
	
	if(_isDebugging) {
		console.debug("clearVehicleTracking() done.");
	}
	
}

function clearTracking() {   // eslint-disable-line no-unused-vars
	if(_isDebugging) {
		console.debug("clearTracking() starting.");
	}
	
	document.getElementById("map_canvas").innerHTML = "";
	if(markers !== undefined && markers !== null) {
		for (var i = 0; i < markers.length; i++) {
			if(_isDebugging) {
				console.debug("clearTracking() setting markers[" + i.toString() + "].setMap(null).");
			}
			markers[i].setMap(null);
		}
		markers.length = 0;
		markers = null;
	}
	if(_isDebugging) {
		console.debug("clearTracking() of markers finished.");
	}

	if(markerIntervals !== undefined && markerIntervals !== null) {
		for (var i2 = 0; i2 < markerIntervals.length; i2++) {
			if(_isDebugging) {
				console.debug("clearTracking()  window.clearInterval(markerIntervals[" + i2.toString() + "]).");
			}
			window.clearInterval(markerIntervals[i2]);
		}
		markerIntervals.length = 0;
		markerIntervals = null;
	}
	if(_isDebugging) {
		console.debug("clearTracking() of markerIntervals finished.");
	}
	
	map = null;
	if(_isDebugging) {
		console.debug("clearTracking() finished.");
	}
}

var isPartOfDeleteRecentChoice = false;
var isShouldSavePastChoice = false;

function selectRecentChoice(i) { // eslint-disable-line no-unused-vars
	if(!isPartOfDeleteRecentChoice) {
		if(_isDebugging) {
			console.log("selectRecentChoice(i) based on i=" + i.toString());
		}

		isShouldSavePastChoice = false;
		var recentValue = _tblRecentChoice.getByKey(i.toString());
		if(_isDebugging) {
			if(recentValue === undefined || recentValue === null) {
				console.log("selectRecentChoice(i) based on i=" + i.toString() + " returned only " + recentValue === undefined ? "undefined" : "null" + " as a recentChoice.");
			}
		}
		if (recentValue !== undefined && recentValue !== null) {
			var parsedRecentChoice = JSON.parse(recentValue);
			var msg = 'unknown';
			if(_isDebugging) {
				if(parsedRecentChoice === undefined || parsedRecentChoice === null) {
					console.log("selectRecentChoice(i) based on i=" + i.toString() + " returned only " + parsedRecentChoice === undefined ? "undefined" : "null" + " as a parsedRecentChoice.");
				}
			}
			if(parsedRecentChoice.stop !== undefined) {
				isShouldSavePastChoice = true;
				isPartOfDeleteRecentChoice = false;   // see deleteRecentChoice function
				getDepartures(parsedRecentChoice.route, parsedRecentChoice.direction, parsedRecentChoice.stop);
				return true;
			}
			if(parsedRecentChoice.stopNumber !== undefined) {
				isShouldSavePastChoice = true;
				// msg = parsedRecentChoice.stopNumber;
				isPartOfDeleteRecentChoice = false;   // see deleteRecentChoice function
				showStop2(parsedRecentChoice);
				return true;
			}
		}
		popupModal('select i=' + i + '  msg=' + msg);
	}
	isPartOfDeleteRecentChoice = false;   // see deleteRecentChoice function
	return true;
}

function deleteRecentChoice(i) {   // eslint-disable-line no-unused-vars
	isPartOfDeleteRecentChoice = true;

	for(var j=i; j < _buttonMax; j++) {
		var tempVal = _tblRecentChoice.getByKey('' + (j + 1));
		if(tempVal === null) {
			_tblRecentChoice.removeByKey(j);
		}
		else {
			_tblRecentChoice.setByKey('' + j, tempVal);
		}
	}
	resetRecentChoiceButtons();
}

// refactor the scheduledStopButtons and numberedStopButtons into a common group of buttons
//           // bootstrap 4 target
// target: <div id="collapseChoices" class="collapse show" style="">
// target:     <span id="recentChoice999" class="active btn-group">
// target:     	   <button class="active btn btn-secondary"                 type="button" onclick="selectRecentChoice(0);">Bus 22222 - 12345</button>
// target:     	   <button class="active btn btn-danger input-group-append" type="button" onclick="deleteRecentChoice(0);">X</button>
// target:     </span>

function resetRecentChoiceButtons() {
	for(var i=0; i < _buttonMax; i++) {
		// _buttonMax no longer represents a pre-set array of html elements, recentIElement may be undefined or null
		var recentIElement = document.getElementById("recentChoice" + i.toString());
		if(recentIElement === undefined || recentIElement === null) {
			// target: <div id="collapseChoices" class="collapse">
			// target:     <span id="recentChoice0" class="active hidden btn-group" >&nbsp;</span>
			var parentOfRecentChoice = document.getElementById("collapseChoices");
			var child = document.createElement("span");
			child.setAttribute("id", "recentChoice" + i.toString());
			child.setAttribute("class", "active hidden btn-group");
			child.textContent = "&nbsp;";
			parentOfRecentChoice.appendChild(child);
			recentIElement = document.getElementById("recentChoice" + i.toString()); 
		}

		var recentValue = _tblRecentChoice.getByKey(i.toString());
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
				buttonText = parsedRecentChoice.stopNumber 
						+ ' - ' 
						+ (parsedRecentChoice.description === undefined || parsedRecentChoice.description === null ? " " : parsedRecentChoice.description)
						+ (parsedRecentChoice.routeFilter === undefined || parsedRecentChoice.routeFilter === null ? "" : " " + parsedRecentChoice.routeFilter);
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
	// var isAlreadyInTheList = false;
	var matchedChoice = null;
	var matchIndex = -1;
	var emptyIndex = -1;
	for(i=0; i < _buttonMax; i++) {
		var choiceRawI = _tblRecentChoice.getByKey(i.toString());
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
					// isAlreadyInTheList = true;
				}
				if(!isScheduledStop && recent.stopNumber === choiceI.stopNumber && recent.routeFilter === choiceI.routeFilter) {
					matchedChoice = choiceI;
					matchIndex = i;
					// isAlreadyInTheList = true;
				}
			}
		}
	}
	if(matchedChoice !== undefined && matchedChoice !== null && matchedChoice !== "undefined") {
		if(_isDebugging) {
			console.log('Found an existing stop/stopNumber in rotateRecentChoices(' + recent + ')' );
		}
		// found an existing (matchedChoice) use (recent) to change matchedChoice
	} else {
		if(matchIndex === -1 && emptyIndex > -1) {
			// add at the end
			_tblRecentChoice.setByKey('' + emptyIndex, JSON.stringify(recent));
		} else {
			// drop the oldest Choice   drop 0, copy 1 to 0, 2 to 1, ... 4 to 3, add in 4
			for(i=1; i < _buttonMax; i++) {
				var tempRaw = _tblRecentChoice.getByKey('' + i);
				_tblRecentChoice.setByKey('' + (i - 1), tempRaw);
			}
			_tblRecentChoice.setByKey('' + (_buttonMax - 1), JSON.stringify(recent));
		}
	}
}

function toggleDebug() {   // eslint-disable-line no-unused-vars
	_isDebugging = !_isDebugging;
	document.getElementById("utilDebugging").innerText = "Toggle debug " + (_isDebugging ? "off" : "on");
}

var form = document.getElementById("busStopForm");
form.addEventListener("submit", function(event) {
	event.preventDefault();

	var numberedBusStop = _db1.getByKey("o" + form.elements.stopNumber.value);
	if(numberedBusStop === undefined || numberedBusStop === null) {
		// show a validation error
		popupModal("stop number not found.");
		return;
	}
	
	if(_isDebugging) {
		console.log("Saving stopNumber.value" + form.elements.stopNumber.value);
	}

	var newValue = '{"stopNumber":' + form.elements.stopNumber.value + ', "description":"' + form.elements.stopDescription.value + '", "routeFilter":"' + form.elements.stopRouteFilter.value + '"}';
	_db1.setByKey("BusStopNumberEntered", newValue);
	showStop2(newValue);
});
//  did not remove the "Violation" verbose message  }, Modernizr.passiveeventlisteners ? {passive: true} : false);

if(_db1.getByKey("o302") === undefined && _db1.supports_html5_storage){
	var sNew = document.createElement('script');
	sNew.async = false; // true;
	sNew.src = "stopOffsets.js";
	var s0 = document.getElementsByTagName('script')[0];
	s0.parentNode.insertBefore(sNew, s0);	
}

if(_tblStop.getByKey('101N') === undefined && _db1.supports_html5_storage) {
	var sNew2 = document.createElement('script');
	sNew2.async = false; // true;
	sNew2.src = "stopLocations.js";
	var s02 = document.getElementsByTagName('script')[0];
	s02.parentNode.insertBefore(sNew2, s02);
}

// global variables for location
var _Marquette400S    = {latitude:44.979001, longitude:-93.268623};   //133 

var _SouthAndWestOfGatewayRamp  = {latitude:44.9779802, longitude:-93.2642134};   //133  waypoint before Marquette and 4th
var _Washington300S     = {latitude:44.979682,  longitude:-93.264170};            // 133 bus is on the move
var _SWofWashington300S = {latitude:44.979299,  longitude:-93.263962};
var _GrantAnd35W        = {latitude:44.969878,  longitude:-93.269835};            //133  returning, still on 35W

var _FourthStreet215S = {latitude:44.978416,  longitude:-93.266661};   // #7
var _SixthStreet201S  = {latitude:44.9763315, longitude:-93.268188};   // #14
var _Washington300N   = {latitude:44.984393,  longtiude:-93.272505};   // #14
var _Washington500N   = {latitude:44.978711,  longitude:-93.262360};   // #14

var _BroadwayEmerson  = {latitude:44.999164,  longitude:-93.294136};   // #14
var _PlymouthWashington = {latitude:44.992010,longitude:-93.281476};   // #14
var _FifthStBusRamp   = {latitude:44.980832,  longitude:-93.275425};   // #14
var _SixthNicollet    = {latitude:44.977802,  longitude:-93.271305};

var _myRoute = -1; // 14;
var _myDirection = -1; // 1;
var _myStop = '';

var _myBlockNumber = 0;
var _myBlockNumberTimeout = new Date(2019,4,1);

var _isCurrentTargetANumberedBusStop = false;    //  numbered vs scheduled bus stop

if(Modernizr.localstorage) {
	resetRecentChoiceButtons();
	
	var firstChoice = document.getElementById("recentChoice0");
	if(firstChoice !== undefined && firstChoice !== null && !firstChoice.classList.contains("hidden")) {

		// if tblPastChoices has a favorite based on .count for this day of week and hour of day, pre-click it.
		var choicesForThisDayHour = _tblPastChoices.getByKey(getCurrentPastChoicesKey());

		if(_isDebugging && choicesForThisDayHour !== undefined && choicesForThisDayHour !== null) {
			console.log("loaded choicesForThisDayHour based on Now");
		}

		if(choicesForThisDayHour === undefined || choicesForThisDayHour === null) {
			// nothing for now (today), how about yesterday at the same time
			choicesForThisDayHour = _tblPastChoices.getByKey(getCurrentPastChoicesKey(-1, 0));

			if(_isDebugging && choicesForThisDayHour !== undefined && choicesForThisDayHour !== null) {
				console.log("loaded choicesForThisDayHour based on (-1, 0)");
			}

		}

		if(choicesForThisDayHour === undefined || choicesForThisDayHour === null) {
			// nothing for now (today), how about today, one hour earlier
			choicesForThisDayHour = _tblPastChoices.getByKey(getCurrentPastChoicesKey(0, -1));

			if(_isDebugging && choicesForThisDayHour !== undefined && choicesForThisDayHour !== null) {
				console.log("loaded choicesForThisDayHour based on (0, -1)");
			}

		}
		
		if(choicesForThisDayHour !== undefined && choicesForThisDayHour !== null) {
			var arrayOfChoices = JSON.parse(choicesForThisDayHour);
			if(arrayOfChoices !== undefined && arrayOfChoices !== null && arrayOfChoices.length > 0) {
				// find the maximum .count
				var bestIndex = 0;
				for(var i = 1; i < arrayOfChoices.length; i++) {
					if(arrayOfChoices[bestIndex].count < arrayOfChoices[i].count) {
						bestIndex = i;
					}
				}
				if(_isDebugging) {
					console.log("arrayOfChoices[bestIndex]  bestIndex = " + bestIndex);
				}
				var choice = null;
				if(arrayOfChoices[bestIndex].scheduledStop !== undefined) {
					choice = arrayOfChoices[bestIndex].scheduledStop;
					routeDirectionStopClicked(choice.route, choice.direction, choice.stop, choice.stopDescription);

				} else {
					if(arrayOfChoices[bestIndex].numberedStop !== undefined) {
						choice = arrayOfChoices[bestIndex].numberedStop;

						// needs to set the BusDB.ActiveNumberedBusStop, so that showStop can use it?
						_db1.setByKey("ActiveNumberedBusStop", JSON.stringify(choice));

						showStop(choice.stopNumber);
					} else {
						document.getElementById("collapseChoices").classList.add("show");
					}
				}
			} else {
				// if any button is loaded, open the "collapseChoices" section
				document.getElementById("collapseChoices").classList.add("show");
			} 
		} else {

			if(_isDebugging) {
				console.log("loaded choicesForThisDayHour nothing found.");
			}

			document.getElementById("collapseChoices").classList.add("show");
		}
	} else {
		document.getElementById("collapseRoute").classList.add("show");
		document.getElementById("collapseBusStop").classList.add("show");
	}
}

// move this above the loadingElement being hidded and "real" page getting loaded.
$("footer div small")[0].innerText = "version " + _version;

/* added to convert alert(message); to modal popup ----- start */
// example of code to change from:
//       alert("Stops cleared for this route and direction to allow reloading.");
//                             to:
//       popupModal(Message);

function popupModal(message) {     // eslint-disable-line no-unused-vars
	var modalElement = document.getElementById("popupModal");
	var modalCloseButtonElement = modalElement.getElementsByClassName("close")[0];

	modalCloseButtonElement.onclick = function() {
		modalElement.style.display = "none";
	}

	window.onclick = function(event) {
		if (event.target == modalElement) {
			modalElement.style.display = "none";
		}
	}

	var idPopupModalBody = document.getElementById("idPopupModalBody");
	idPopupModalBody.innerHTML = '<p>' + message + '</p>';
	idPopupModalBody.style.display = "block";

	modalElement.style.display = "block";
}

/* added to convert alert(message); to modal popup ----- end */


/* added to support Modal popup ---- start */

// Get the modal
var _modal = document.getElementById('myModal');

// Get the button that opens the modal
//var btn = document.getElementById("myBtn");

// Get the <span> element that closes the modal
var _span = document.getElementsByClassName("close")[0];

// When the user clicks on the button, open the modal
//btn.onclick = function() {
//  modal.style.display = "block";
//}

// When the user clicks on <span> (x), close the modal
_span.onclick = function() {	
	_modal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
	if (event.target == _modal) {
		_modal.style.display = "none";
	}
}

// Not from the W3 example code:

function showPastChoices() {   // eslint-disable-line no-unused-vars
	// build a table from tblPastChoices
	//          Day of week, Hour, Choice Button text, Count
	// 
	var out = '<div id="idPastChoicesTable">';
	out += '  <table class="table table-striped table-sm"><thead><tr><th>Day</th><th>Hour</th><th>Stop</th><th>Count</th></tr></thead>';
	out += '    <tbody>';
	
	var iDay = 0;
	var iHour = 0;
	var pastChoicesKey = iDay.toString()+','+iHour.toString();
	var tblPastChoiceOfDayAndHour;

	for(iDay = 0; iDay < 7; iDay++) {
		for(iHour = 0; iHour < 24; iHour++) {
			pastChoicesKey = iDay.toString()+','+iHour.toString();
		
			tblPastChoiceOfDayAndHour = _tblPastChoices.getByKey(pastChoicesKey);
			if(tblPastChoiceOfDayAndHour !== undefined && tblPastChoiceOfDayAndHour !== null) {
				
				var pastChoicesArray = JSON.parse(tblPastChoiceOfDayAndHour);
				
				// sort the array (descending)
				pastChoicesArray.sort(function(a, b){return b.count - a.count});

				for(var i = 0; i < pastChoicesArray.length; i++) {
					// look for a match to recentChoice

					if(pastChoicesArray[i].scheduledStop !== undefined) {
						// handle the button text of a scheduled stop
						out += '<tr><td>' + dayOfWeekAsMinimumString(iDay) 
							+ '</td><td>' + hourOfDayAsMinimumString(iHour) 
							+ '</td><td>' + pastChoicesArray[i].scheduledStop.route.toString() + ' - ' + directionAsString(pastChoicesArray[i].scheduledStop.direction) + ' - ' + pastChoicesArray[i].scheduledStop.stop 
							+ '</td><td>' + pastChoicesArray[i].count.toString() 
							+ '</td></tr>';
						
					} else {
						if(pastChoicesArray[i].numberedStop !== undefined) {
							// handle the button text of a numbered stop
							// 	{"numberedStop":{"stopNumber":17884,"latitude":44.976246,"longitude":-93.267772,"description":"Capella to Home","routeFilter":"14[^E]"},"count":1}
							var buttonText = pastChoicesArray[i].numberedStop.stopNumber.toString();
							if(pastChoicesArray[i].numberedStop.description !== undefined && pastChoicesArray[i].numberedStop.description !== null) {
								buttonText += ' - ' + pastChoicesArray[i].numberedStop.description;
							}
							if(pastChoicesArray[i].numberedStop.routeFilter !== undefined && pastChoicesArray[i].numberedStop.routeFilter !== null) {
								buttonText += ' ' + pastChoicesArray[i].numberedStop.routeFilter;
							}
							
							out += '<tr><td>' + dayOfWeekAsMinimumString(iDay) 
								+ '</td><td>' + hourOfDayAsMinimumString(iHour) 
								+ '</td><td>' + buttonText 
								+ '</td><td>' + pastChoicesArray[i].count.toString() 
								+ '</td></tr>';
						}
					}
				}
			}
		}
	}

	out += "</tbody></table></div>";

	var idPastChoicesTable = document.getElementById("idPastChoicesTable");
	idPastChoicesTable.innerHTML = out;
	idPastChoicesTable.style.display = "block";

	_modal.style.display = "block";
}

function dayOfWeekAsMinimumString(dayOfWeek) {
	if(dayOfWeek === 0) return 'Su';
	if(dayOfWeek === 1) return 'M';
	if(dayOfWeek === 2) return 'Tu';
	if(dayOfWeek === 3) return 'W';
	if(dayOfWeek === 4) return 'Th';
	if(dayOfWeek === 5) return 'F';
	if(dayOfWeek === 6) return 'Sa';
	return '??';
}

function hourOfDayAsMinimumString(hourOfDay) {
	if(hourOfDay === 0) return '12am';
	if(1 <= hourOfDay && hourOfDay <= 11) return hourOfDay.toString() + 'am';
	if(hourOfDay === 12) return '12pm';
	if(13 <= hourOfDay && hourOfDay <= 23) return (hourOfDay - 12).toString() + 'pm';
	return '??';
}
/* added to support Modal popup ---- end */

/* added to support the long pause behavior on the selectRouteButton.  Requires long-press-event.js */
// grab the element
var _selectRouteButton = document.getElementById("selectRouteButton");

// listen for the long-press event
_selectRouteButton.addEventListener("long-press", function(e) {

	// stop the event from bubbling up
	e.preventDefault();

	// do the work of the long press
	// console.log(e.target);

	_db1.removeByKey("Routes");
	popupModal("Routes cleared to allow reloading.");
});

// <span id="selectStopButton"         class="btn btn-secondary" onclick="selectRouteDirectionStopsUsingMyDirection()">Stop</span>
var _selectStopButton = document.getElementById("selectStopButton");

// listen for the long-press event
_selectStopButton.addEventListener("long-press", function(e) {

	// stop the event from bubbling up
	e.preventDefault();

	// do the work of the long press
	// console.log(e.target);

	_tblRouteDirectionStops.removeByKey(_myRoute + '.' + _myDirection);
	popupModal("Stops cleared for this route and direction to allow reloading.");
});

// show the "real" page

var _loadingElement = document.getElementById("page-loader");
_loadingElement.hidden = true;
_loadingElement.classList.add("hidden");

document.getElementById("page-loaded").style.display = "block";
