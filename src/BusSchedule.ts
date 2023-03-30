/* BusSchedule.html javascript */

// eslint settings  -- start
/* eslint-env browser, jquery */
/* eslint-disable no-console */
/* global google, Modernizr */
// eslint settings  -- end

import * as NexTrip from "./models/nextrip";

"use strict";

// import * as Modernizr from "./modernizr/modernizr.js";

const _version = "20230330_1000";
var _isDebugging = false;
var _buttonMax = 20; // number of recentChoiceButtons, an array from 0 to buttonMax - 1

/*
API examples
nextripv2/routes ---------------------------------

[
  {
    "route_id": "901",
    "agency_id": 0,
    "route_label": "METRO Blue Line"
  },

nextripv2/directions/{route_id} -------------------------- saved as BusDB.RouteDirections.14
[
  {
    "direction_id": 0,
    "direction_name": "Northbound"
  },
  {
    "direction_id": 1,
    "direction_name": "Southbound"
  }
]

nextripv2/{route_id}/{direction_id} --------------------
[
  {
    "place_code": "RBTC",
    "description": "Robbinsdale Transit Center"
  },
  {
    "place_code": "36NB",
    "description": "Noble Ave and 36th Ave"
  },
  ...
]
 
nextripv2/{route_id}/{direction_id}/{place_code} ----------------------
{
  "stops": [
    {
      "stop_id": 17882,
      "latitude": 44.977888,
      "longitude": -93.271671,
      "description": "6th St S & Nicollet Mall"
    }
  ],
  "alerts": [
    {
      "stop_closed": true,
      "alert_text": "string"
    }
  ],
  "departures": [
    {
      "actual": true,
      "trip_id": "string",
      "stop_id": 0,
      "departure_text": "string",
      "departure_time": 0,
      "description": "string",
      "gate": "string",
      "route_id": "string",
      "route_short_name": "string",
      "direction_id": 0,
      "direction_text": "string",
      "terminal": "string",
      "schedule_relationship": "string"
    }
  ]
}

*/

// ----------------------------------------------------------------------- start
// Source: https://weeknumber.net/how-to/javascript
// 
// Returns the ISO week of the date.
function dateToWeek(d: Date): number {
	if(d === undefined || d === null) {
		return -1;
	}

	let dTime = new Date(d.getTime());
	dTime.setHours(0, 0, 0, 0);
	// Thursday in current week decides the year.
	dTime.setDate(dTime.getDate() + 3 - (dTime.getDay() + 6) % 7);
	// January 4 is always in week 1.
	let week1 = new Date(dTime.getFullYear(), 0, 4);
	// Adjust to Thursday in week 1 and count number of weeks from date to week1.
	return 1 + Math.round(((dTime.getTime() - week1.getTime()) / 86400000
						- 3 + (week1.getDay() + 6) % 7) / 7);	
}
// ----------------------------------------------------------------------- end

// ---------------- localStorage as object -- start
class DbTables {
	constructor(databaseName: string) {
		this.databaseName = databaseName;
	}

	databaseName: string;

	setByKey(key: string, value: string) {
		let fullKey = '' + this.databaseName + '.' + key;
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

	getByKey(key: string): string {
		let fullKey = '' + this.databaseName + '.' + key;
		if (_isDebugging) {
			console.log("getByKey(" + fullKey + ")");
		}
		return localStorage[fullKey];
	}

	removeByKey(key: string) {
		let fullKey = '' + this.databaseName + '.' + key;
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
	storageAvailable(type: any) {
		let storage: any;
		try {
			storage = window[type];
			let x = '__storage_test__';
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
	databaseName: string;
	tableName: string;

	constructor(dbTables: DbTables, tableName: string) {
		this.databaseName = dbTables.databaseName;
		this.tableName = tableName;
	}

	setByKey(key: string, value: string): void {
		let fullKey = '' + this.databaseName + '.' + this.tableName + '.' + key;
		if(_isDebugging) {
			console.log("DbTable.setByKey(" + fullKey + ", " + value + ")");
		}
		localStorage[fullKey] = value;
	}
	
	getByKey(key: string): any {
		let fullKey = '' + this.databaseName + '.' + this.tableName + '.' + key;
		if(_isDebugging) {
			console.log("DbTable.getByKey(" + fullKey + ")");
		}
		return localStorage[fullKey];
	}
	
	removeByKey(key: string): void {
		let fullKey = '' + this.databaseName + '.' + this.tableName + '.' + key;
		if(_isDebugging) {
			console.log("DbTable.removeByKey(" + fullKey + ")");
		}
		return localStorage.removeItem(fullKey);
	}
	
	deleteAll(): boolean {
		if (!_db1.supports_html5_storage) { return false; }
		let i = 0;
		let removedCount = 0;
		let result: string | null = null;
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

var _db1 = new DbTables('BusDB');

var _tblVehicleTracked = new DbTable(_db1, 'VehicleTracked');
var _tblVehicleLocation = new DbTable(_db1, 'VehicleLocation');
var _tblRouteDirections = new DbTable(_db1, 'RouteDirections');
var _tblRouteDirectionStopDeparture = new DbTable(_db1, 'RouteDirectionStopDeparture');
var _tblRouteDirectionStops = new DbTable(_db1, 'RouteDirectionStops');
var _tblRecentChoice = new DbTable(_db1, 'RecentChoice');
var _tblPlaces = new DbTable(_db1, 'Places');  // scheduled stops 
var _tblStops = new DbTable(_db1, 'Stops');    // numbered stops

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
//     **someday** include: weekOfYear     int  1=            53            // use getWeek() on a Date object
//    
//   key=   comma separated string?   like "2,7" to represent  Tuesday 7am
//     dayOfWeek      int  0=Sunday, ... 6 = Saturday  // use getDay()  on a Date object
//     hourOfDay      int  0, ... , 23                 // use getHour() on a Date object
//   value= array of choice    {{"scheduledStop":{"route":14,"direction":4,"stop":"BL54"},"count":1},
//                              {"numberedStop":{"stopNumber":15574,"latitude":44.912346,"longitude":-93.252372,"description":"Home to work","routeFilter":"14"},"count":2}
//                             }
//

// ---------------- localStorage as object -- end

function getCurrentPastChoicesKey(dDay: number = 0, dHour: number = 0) {
	if(dDay === undefined || dDay === null) {dDay = 0;}
	if(dHour === undefined || dHour === null) {dHour = 0;}
	
	let now = new Date(); 
	let nowAdjusted = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dDay, now.getHours() + dHour, 0, 0);
	
	return nowAdjusted.getDay().toString()+','+nowAdjusted.getHours().toString();
}

// recentChoice: NumberedStop | ScheduledStop     .route and/or .stop complain

function savePastChoice(recentChoice: any) {
	if(_isShouldSavePastChoice === undefined || _isShouldSavePastChoice === null || !_isShouldSavePastChoice) {
		if(_isDebugging) {
			console.log("savePastChoice is skipped because isShouldSavePastChoice is not true.");
		}
		return;
	}

	let pastChoicesKey = getCurrentPastChoicesKey();
	if(_isDebugging) {
		console.log("pastChoicesKey = " + pastChoicesKey);
	}

	let pastChoices = _tblPastChoices.getByKey(pastChoicesKey) as string;
	if(pastChoices === undefined || pastChoices === null) {
		let choice = null;
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
		let pastChoicesArray = JSON.parse(pastChoices) as PastChoice[];

		// need to examine the pastChoice (which is actually a list of choices)
		// need to parse the list to see if this recentChoice is already in the list
		if(_isDebugging) {
			console.log("pastChoicesArray = " + pastChoicesArray);
			console.log("pastChoicesArray.length = " + pastChoicesArray.length);
		}
		
		let isScheduledStop = recentChoice.stop !== undefined && recentChoice.stop !== null;
		let matchingChoiceIndex = pastChoicesIndex(pastChoicesArray, recentChoice);

		if(matchingChoiceIndex === -1) {
			// create a new element of the pastChoice[] array
			let choiceNew;
			if(isScheduledStop) {
				choiceNew = {"scheduledStop":recentChoice, "count":1};
			} else {
				choiceNew = {"numberedStop":recentChoice, "count":1};				
			}
			pastChoicesArray.push(choiceNew as PastChoice);
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
//         Need a graphic to indicate where to find a Bus Stop number when at a bus stop
//     SVG of a numbered bus stop, that includes the text

function getActiveNumberedBusStop() {
	let raw = _db1.getByKey("ActiveNumberedBusStop");

	if(raw) {
		return JSON.parse(raw);	
	} else {
		if(_isDebugging) {
			console.warn("getActiveNumberedBusStop() will return null because db1.getByKey('ActiveNumberedBusStop') returned null");
		}
		return null;
	}
}

function getRouteDirectionStopActive() {
	let raw = _db1.getByKey("RouteDirectionStopActive");

	if(raw) {
		return JSON.parse(raw);
	} else {
		if(_isDebugging) {
			console.warn("getRouteDirectionStopActive() will return null because db1.getByKey('RouteDirectionStopActive') returned " + ((raw === undefined) ? "undefined": "null"));
		}
		return null;
	}
}

function logAjax(xmlHttp: XMLHttpRequest, description: string) {
	if(_isDebugging) {
		console.info("logAjax(xmlHttp, " + description + ")  .readyState=" + xmlHttp.readyState + "   .status=" + xmlHttp.status);
	}
	if(description.substring(0,16) === "showBusLocation2") {
		let progress = document.getElementById("mapProgress");
		logAjaxProgressBackground(xmlHttp.readyState, progress);
	}
	if(description.substring(0,8) === "showStop" 
		|| description.substring(0,8) === "getDepar"
		|| description.substring(0,22) === "requestVehiclesOnRoute"
		|| description.substring(0,21) === "requestStopNumberInfo") {
		let progress = document.getElementById("detailsProgress");
		logAjaxProgressBackground(xmlHttp.readyState, progress);
	}
}

function logAjaxProgressBackground(readyState: number, progressElement: HTMLElement): void {
	progressElement.style.width = readyState * 25 + "%";
	if(readyState === 4) {
		progressElement.classList.remove("bg-danger");
		progressElement.classList.add("bg-success");
	} else {
		progressElement.classList.remove("bg-success");
		progressElement.classList.add("bg-danger");			
	}	
}

function showStop2(enteredStopNumber: any, isTestExistence: boolean = false): void {
	if(_isDebugging) {
		console.log("showStop2(n) n=", JSON.stringify(enteredStopNumber), "isTestExistence=", isTestExistence);
	}

	if(isTestExistence) {
		requestStopNumberInfo(enteredStopNumber, true);
		return;
	}

	let stopNumberInfo;
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
	
	requestStopNumberInfo(stopNumberInfo.stopNumber, false);
	
	document.getElementById("collapseDetails").classList.add("show");
	document.getElementById("collapseRoute").classList.remove("show");
}


// need a better name for this method.  It's not so much about showing the stop as it is about getting info for the stop
//      maybe  getStopInfo since stops[], alerts[], and departures[] are returned.
//      the user may have just entered a stop number and we need to know if the stop even exists
//
function requestStopNumberInfo(stopNumber: number | string, isTestExistence = false) {
	if(_isDebugging) {
		console.log("requestStopNumberInfo(", stopNumber, isTestExistence, ")");
	}

	let xmlhttp2 = new XMLHttpRequest();
	let url2 = "https://svc.metrotransit.org/nextrip/" + stopNumber.toString() + "?format=json";
	
	xmlhttp2.onreadystatechange = function () {
		logAjax(xmlhttp2, "requestStopNumberInfo(" + stopNumber.toString() + ", " + isTestExistence.toString() + ")");

		if (xmlhttp2.readyState === 4 && xmlhttp2.status === 200) {
			let myArr = JSON.parse(xmlhttp2.responseText) as NexTrip.NexTripResult;
			populateStopNumberInfo(myArr, isTestExistence);
		}
	};
	xmlhttp2.open("GET", url2, true);
	xmlhttp2.send();
}

function saveNumberedBusStopInfo(enteredStopNumber: any) {
	if(_isDebugging) {
		console.log("saveNumberedBusStopInfo(" + JSON.stringify(enteredStopNumber) + ")");
	}

	let activeNumberedBusStop = getActiveNumberedBusStop();
	if(activeNumberedBusStop
		&& (enteredStopNumber.stopNumber && activeNumberedBusStop.stopNumber === enteredStopNumber.stopNumber)
		&& (enteredStopNumber.routeFilter && activeNumberedBusStop.routeFilter === enteredStopNumber.routeFilter))
	{
		return;
	}
	
	let rawStop = _tblStops.getByKey(enteredStopNumber.stopNumber.toString());
	if(!rawStop) {
		if(_isDebugging) {
			console.log("saveNumberedBusStopInfo(" + enteredStopNumber.stopNumber.toString() + ") called, but rawStop = ", rawStop);
		}
		return;		
	}

	let dbStop = JSON.parse(rawStop);

	// ActiveNumberedBusStop needs to include the description from the enteredStopNumber
	let description = enteredStopNumber.description;
	
	let busStopPoint = {
		"stopNumber": enteredStopNumber.stopNumber, 
		"latitude": dbStop.latitude, 
		"longitude": dbStop.longitude, 
		"description": description, 
		"routeFilter":enteredStopNumber.routeFilter};
	_db1.setByKey("ActiveNumberedBusStop", JSON.stringify(busStopPoint));
	
	rotateRecentChoices(busStopPoint);
	resetRecentChoiceButtons();
}

interface NumberedStop {
	stopNumber: number,
	latitude?: number,
	longitude?: number,
	description: string,
	routeFilter?: string
};

interface ScheduledStop {
	route: string,
	direction: number,
	stop: string,
	stopNumber?: number,
	latitude?: number,
	longitude?: number,
	description?: string,
	routeFilter?: string
};

interface PastChoice {
	numberedStop?: NumberedStop,
	scheduledStop?: ScheduledStop,
	count: number
}

var _numberedStopValue: NumberedStop;

function populateStopNumberInfo(arr: NexTrip.NexTripResult, isTestExistence = false) {
	if(isTestExistence) {
		buildStopResultsHandleStopExistence(arr);
		return;
	}

	_isCurrentTargetANumberedBusStop = true;

	$("#collapseDetails").collapse("show"); // eslint-disable-line no-undef

	let arrDepartures = arr.departures;
	
	if(arrDepartures === undefined || arrDepartures === null || arrDepartures.length === 0) {
		showNoActivity();
		return;
	}

	const newTable = document.createElement("table");
	newTable.setAttribute("class", "table table-sm table-responsive-sm table-bordered");
	let newRow = newTable.insertRow(-1);
	let colHeadings = ["Route", "Departs", "Banner", "Heading", "Miles"];

	for (let j = 0; j < colHeadings.length; j++) {
		let headerCell = document.createElement("th");
		headerCell.textContent = colHeadings[j];
		newRow.appendChild(headerCell);
	}

	let targetPoint = getActiveNumberedBusStop();

	if(_isDebugging) {
		console.log("populateStopNumberInfo  targetPoint=", targetPoint);
	}
	
	for(let i = 0; i < arrDepartures.length; i++) {
	
		if(targetPoint !== undefined && arrDepartures[i] !== undefined && arrDepartures[i].route_id !== undefined && targetPoint.routeFilter !== undefined) {
			let iRouteAndTerminal = arrDepartures[i].route_id + ((arrDepartures[i].terminal === undefined) ? "" : arrDepartures[i].terminal);
			let re = new RegExp(targetPoint.routeFilter, "g");
			if(!iRouteAndTerminal.match(re)) {
				if(_isDebugging) {
					console.log("populateStopNumberInfo(arr) targetPoint.routeFilter=" + targetPoint.routeFilter + " did not match iRouteAndTerminal=" + iRouteAndTerminal);
				}
				continue;    // back to top of for loop 
			}		
		}	

		newRow = newTable.insertRow(-1);
		let newCell = newRow.insertCell(-1);
		if(arrDepartures[i].trip_id === undefined || !arrDepartures[i].actual) {
			newCell.textContent = arrDepartures[i].route_id + (arrDepartures[i].terminal ? arrDepartures[i].terminal : "");
		} else {
			let newButton = document.createElement("button");
			newButton.setAttribute("id", arrDepartures[i].route_id + "_" + arrDepartures[i].direction_id + "_" + arrDepartures[i].trip_id.substring(4,8));
			//newButton.setAttribute("id", arrDepartures[i].stop_id.toString() + "_" + arrDepartures[i].trip_id.substring(4,8));
			newButton.setAttribute("type", "button");
			newButton.setAttribute("class", "btn btn-primary btn-md");

			// there is enough information to give map creation advice on the zoom level and a revised centerpoint for the map.
			//     center should be at the midpoint of a line between target and arrDepartures[i].latitude, .longitude
			//     zoom needs to adjust so that both endpoints are on screen
			// an alternative is just to use the milesAndDirection value for miles and do something like 
			//     miles < 1 = zoom 14
			//     miles < 5 = zoom 13
			//     miles < 10 = zoom 12		
			//     
			newButton.setAttribute("onclick", "busNumberClicked3('" + arrDepartures[i].trip_id.substring(4,8) + "', '" + arrDepartures[i].route_id + "', '" + arrDepartures[i].stop_id.toString() + "')");
			newButton.textContent = arrDepartures[i].route_id + (arrDepartures[i].terminal ? arrDepartures[i].terminal : "") + ' - trip:' + arrDepartures[i].trip_id.substring(4,8);
			newCell.appendChild(newButton);
		}

		newCell = newRow.insertCell(-1);
		newCell.textContent = arrDepartures[i].departure_text;

		newCell = newRow.insertCell(-1);
		newCell.textContent = arrDepartures[i].description;

		newCell = newRow.insertCell(-1);
		newCell.textContent = arrDepartures[i].direction_text;

		newCell = newRow.insertCell(-1);
		newCell.setAttribute("id", "md_" + arrDepartures[i].route_id + "_" + arrDepartures[i].direction_id + "_" + arrDepartures[i].trip_id.substring(4,8));
		newCell.setAttribute("blockNumber", arrDepartures[i].trip_id.substring(4,8));
		const milesAndDirection = getMilesAndDirection(targetPoint, arrDepartures[i]);
		newCell.textContent = milesAndDirection;
	}
	let elementid00B = document.getElementById("id00B");
	newTable.setAttribute("id", "id00B");
	elementid00B.parentNode.replaceChild(newTable, elementid00B);

	document.getElementById("id00B").style.display = "block";
	
	if(targetPoint) {
		document.getElementById("title1").textContent = "Bus Schedule " + targetPoint.stopNumber;
		_numberedStopValue = { "stopNumber": targetPoint.stopNumber, "description": targetPoint.description };
		
		if(_isDebugging) {
			console.log("populateStopNumberInfo(arr) set _numberedStopValue=" + JSON.stringify(_numberedStopValue));
		}

		let outButton = document.createElement("button");
		outButton.setAttribute("id", "showStopButton");
		outButton.setAttribute("type", "button");
		outButton.setAttribute("class", "btn btn-primary align-baseline");
		outButton.setAttribute("onclick", "requestStopNumberInfo(_numberedStopValue.stopNumber);")
		outButton.textContent = targetPoint.stopNumber + ' - '
			+ targetPoint.description 
			+ ((targetPoint.routeFilter === undefined) ? '' : (' ' + targetPoint.routeFilter));

		let timeOfQuery = new Date();
		let outLabel = document.createElement("label");
		outLabel.setAttribute("id", "showStopLabel");
		outLabel.setAttribute("class", "ms-2 align-baseline");
		outLabel.textContent = dateToHHMMSS(timeOfQuery);

		let outDiv = document.createElement("div");
		outDiv.setAttribute("id", "id00C");
		outDiv.setAttribute("class", "align-baseline");
		outDiv.appendChild(outButton);
		outDiv.appendChild(outLabel);

		let elementid00C = document.getElementById("id00C");
		elementid00C.parentNode.replaceChild(outDiv, elementid00C);
	}

	// collect a list of distinct Routes for the numbered stop.
	let arrStopRoutes = new Array();
	arrDepartures.forEach(departure => {
		if(!arrStopRoutes.some(x => x === departure.route_id)) {
			if(_isDebugging) {
				console.log("populateStopNumberInfo(arr) adding route ", departure.route_id, " to arrStopRoutes.");
			}
			arrStopRoutes.push(departure.route_id);
		}
	});

	arrStopRoutes.forEach(route => {
		if(_isDebugging) {
			console.log("populateStopNumberInfo(arr) calling requestVehicleOnRoute(", route, ").");
		}
		requestVehiclesOnRoute(route);
	});
}

function buildStopResultsHandleStopExistence(arr: NexTrip.NexTripResult) {
	let stops = arr.stops;
	stops.forEach(stop => {
		let dbStop = _tblStops.getByKey(stop.stop_id.toString());
		if (!dbStop
			|| dbStop.latitude != stop.latitude
			|| dbStop.longitude != stop.longitude
			|| dbStop.description != stop.description) {
			if (stop.latitude != 0.0 && stop.longitude != 0.0) {
				_tblStops.setByKey(stop.stop_id.toString(), JSON.stringify(stop));
			}
		}

		dbStop = _tblStops.getByKey(stop.stop_id.toString());
	});

	const enteredStopNumber = (<HTMLInputElement> _form.elements.namedItem("stopNumber")).value;

	let numberedBusStop = _tblStops.getByKey(enteredStopNumber);
	if (numberedBusStop === undefined || numberedBusStop === null) {
		// show a validation error
		popupModal("stop number not found.");
	} else {
		if (_isDebugging) {
			console.log("Saving stopNumber.value" + enteredStopNumber);
		}

		/*
		let nValue: BusStopNumberEntry = {
			stopNumber: _form.elements["stopNumber"].value,
			description: _form.elements["stopDescription"].value,
			routeFilter: _form.elements["stopRouteFilter"].value
		};
		_db1.setByKey("BusStopNumberEntered", JSON.stringify(nValue));
		*/

		const enteredStopDescription = (<HTMLInputElement> _form.elements.namedItem("stopDescription")).value;
		const enteredStopRouteFilter = (<HTMLInputElement> _form.elements.namedItem("stopRouteFilter")).value;
	
		let newValue = '{"stopNumber":' + enteredStopNumber 
			+ ', "description":"' + enteredStopDescription 
			+ '", "routeFilter":"' + enteredStopRouteFilter + '"}';
		_db1.setByKey("BusStopNumberEntered", newValue);
		showStop2(newValue, false);
	}
}

function showNoActivity() {
	const elementid00B = document.getElementById("id00B");

	const newDiv = document.createElement("div");
	newDiv.setAttribute("class", "alert alert-warning");
	newDiv.setAttribute("id", "id00B");

	const newStrong = document.createElement("strong");
	newStrong.textContent = "Warning!";

	newDiv.appendChild(newStrong);
	newDiv.appendChild(document.createTextNode(" Metro Transit does not report any activity at the stop."));
	newDiv.style.display = "block";

	elementid00B.parentNode.replaceChild(newDiv, elementid00B);
}

type BusStopNumberEntry = {
	stopNumber: number,
	description: string,
	routeFilter: string
}

type VehicleLocation = {
	direction: number,
	locationTime: Date,
	latitude: number,
	longitude: number,
	speed: number,
	bearing: number
}

/* moved to nextrip.d.ts
type Departure = {
	route_id: string,
	trip_id: string,
}
*/

function getMilesAndDirection(targetPoint: Point, departure: NexTrip.Departure | NexTrip.Vehicle) {
	const busAtPointUnparsed = _tblVehicleLocation.getByKey(departure.route_id + "." + departure.trip_id.substring(4,8));

	if(busAtPointUnparsed) {
		const busAtPoint = JSON.parse(busAtPointUnparsed) as VehicleLocation;
		const milesAway = miles(busAtPoint, targetPoint);
		if(milesAway && milesAway.between > 100) {
			if(_isDebugging) {
				console.log("getMilesAndDirection(targetPoint, departure) failed because milesAway.between > 100 milesAway.between=", milesAway.between)
			}
			return "";
		}
		const s2 = milesAndDirection(milesAway);
		return s2;
	}
	return "";
}

function dateToHHMMSS(d: Date): string {
	if(d === undefined || d === null) {
		return "";
	}
	let timeString = d.toTimeString();
	let spaceAt = timeString.indexOf(" ");
	return timeString.substring(0, spaceAt);
}

function requestVehiclesOnRoute(route: string) {
	if(_isDebugging) {
		console.log("requestVehiclesOnRoute(" + route + ") called.");
	}

	let xmlhttp8 = new XMLHttpRequest();
	let url8 = "https://svc.metrotransit.org/nextrip/vehicles/" + route + "?format=json";

	if(_isDebugging) {
		console.log("requestVehiclesOnRoute(" + route + ") called.  url8=" + url8);
	}
	
	xmlhttp8.onreadystatechange = function () {
		logAjax(xmlhttp8, "requestVehiclesOnRoute(" + route + ")");

		if (xmlhttp8.readyState === 4 && xmlhttp8.status === 200) {
			populateVehiclesOnRoute(route, xmlhttp8.responseText);
		}
	};
	xmlhttp8.open("GET", url8, true);
	xmlhttp8.send();
}

function populateVehiclesOnRoute(route: string, responseText: string) {
	let arr = JSON.parse(responseText);
	
	if(_isDebugging) {
		console.log("populateVehiclesOnRoute(" + route + ", " + responseText + ") called.");
	}
	
	for(let i = 0; i < arr.length; i++) {
		const vehicle = arr[i];
		if(vehicle.latitude !== 0 && vehicle.longitude !== 0){
			const blockNumberFromTripId: string = vehicle.trip_id.substring(4,8);
	
			let newVal: VehicleLocation = {
				"direction": vehicle.direction_id, 
				"locationTime": vehicle.location_time,
				"latitude": vehicle.latitude,
				"longitude": vehicle.longitude,
				"speed": vehicle.speed,
				"bearing": vehicle.bearing
			};
			_tblVehicleLocation.setByKey(route + '.' + blockNumberFromTripId, JSON.stringify(newVal));
			
			refreshGridValues(route, vehicle, blockNumberFromTripId);
			addMarkerForRoute(route, vehicle, blockNumberFromTripId);
		}
	}
}

function refreshGridValues(route: string, vehicle: NexTrip.Vehicle, blockNumberFromTripId: string) {
	if(_isDebugging) {
		console.log("refreshGridValues(route=", route, ", vehicle=", vehicle, ", blockNumberFromTripId=", blockNumberFromTripId, ") called." );
	}

	const id = route + "_" + vehicle.direction_id.toString() + "_" + blockNumberFromTripId;
	if(document.getElementById(id)) {
		const text = route + (vehicle.terminal ? vehicle.terminal : "") + ' - trip:' + blockNumberFromTripId + ' @' + minutesSecondsPhrase(vehicle.location_time);
		document.getElementById(id).textContent = text;
	}

	if(document.getElementById("md_" + id)) {
		let targetPoint = null;
	
		if(_isCurrentTargetANumberedBusStop) {
			targetPoint = getActiveNumberedBusStop();
		} else {
			let activeStop = _db1.getByKey("ActiveScheduledBusStop");
			if(activeStop !== undefined && activeStop !== null) {
				targetPoint = JSON.parse(activeStop);
			} else {
				if(_isDebugging) {
					console.warn("refreshGridValues(route=", route, ", vehicle=", vehicle, ", blockNumberFromTripId=", blockNumberFromTripId, ") unable to determine a targetPoint." );
				}
				return;
			}
		}
	
		const text = getMilesAndDirection(targetPoint, vehicle);
		document.getElementById("md_" + id).textContent = text;
	}
}

var _secondsElapsedOffset = 0;
function rewriteActualTableData(route:string, blockNumber: string) {
	// is this function in use? Yes, when a ScheduledStop button is clicked.  BlockNumber is not set.
	// console.warn("--------------------- rewriteActualTableData called with (", route, ",", blockNumber, ")");
	if(_isDebugging) {
		console.log("rewriteActualTableData(", route + "," + blockNumber, ") starting.");				
	}

	if(blockNumber === null) {
		if(_myBlockNumber && _myBlockNumber !== "0") {
			blockNumber = _myBlockNumber;		
		} else {
			if(_isDebugging) {
				console.log("rewriteActualTableData(" + route + ", null) and _myBlockNumber is not set. Will return.");				
			}
			return;
		}
	}

	if(blockNumber === null) {
		if(_isDebugging) {
			console.log("rewriteActualTableData(route, blockNumber) has no blockNumber, even _myBlockNumber=", _myBlockNumber, "Will return.");
		}
		return;
	}
	
	// nn sec ago:  (up to 100)   n.n min ago:  (up to 5 minutes)
	// miles & direction
	let busLocationTime = null;
	let busLastAt = null;
	let rawVehicleLocation = _tblVehicleLocation.getByKey(route + '.' + blockNumber);
	if(!rawVehicleLocation){
		_myBlockNumber = "0";
		if(_isDebugging){
			console.log("rewriteActualTableData(", route, ",", blockNumber, ") _tblVehicleLocation.getByKey( found nothing! Will return");
		}

		return;
	}
	
	if(rawVehicleLocation){
		busLastAt = JSON.parse(rawVehicleLocation) as VehicleLocation;

		if(busLastAt) {
			busLocationTime = fromDateTimeNumber(busLastAt.locationTime);
		} else {
			if(_isDebugging){
				console.log("rewriteActualTableData(route, blockNumber) busLastAt.locationTime=", busLastAt.locationTime);
			}			
		}
	}
	
	_myBlockNumber = blockNumber;
	
	// addMarker({"route":route, "blockNumber":blockNumber, "time":busLocationTime, "latitude":busLastAt.latitude, "longitude":busLastAt.longitude});
	
	let s1 = elapsedTimePhrase(busLocationTime);

	// ScheduledStop info
	let busAtPoint = {"latitude": busLastAt.latitude, "longitude": busLastAt.longitude};
	let routeDirectionStopActive = getRouteDirectionStopActive();
	let activeStop: PlaceWithPoint = null;
	if(routeDirectionStopActive) {
		// let raw = _tblStop.getByKey(routeDirectionStopActive.stop);
		let raw = _tblPlaces.getByKey(routeDirectionStopActive.stop);
		if(raw === undefined || raw === null) {
			console.warn("Warning: rewriteActualTableData could not find an activeStop.  tblStop.getByKey(" + routeDirectionStopActive.stop + ") is null.");
		}
		else {
			activeStop = JSON.parse(raw);
		}
	}
	
	let busStopPoint = null;
	if(_isCurrentTargetANumberedBusStop) {
		busStopPoint = getActiveNumberedBusStop();
		if(_isDebugging) {
			console.log("busStopPoint=", busStopPoint);
		}
	} else {
		if(activeStop) {
			let actualElement = document.getElementById(route.toString() 
				+ "_" + routeDirectionStopActive.direction.toString() 
				+ "_" + blockNumber.toString());

			// let actualElement = document.getElementById("Actual_" + route.toString() + "_" + blockNumber.toString());
			if(actualElement) {
				busStopPoint =  {"latitude": activeStop.latitude, "longitude": activeStop.longitude};
			} else {
				if(_isDebugging) {
					console.warn("rewriteActualTableData(", route, ",", blockNumber, ") activeStop element was not found.");
				}
			}			
		} else {
			if(_isDebugging) {
				console.warn("activeStop is falsey!", "Actual_" + route.toString() + "_" + blockNumber.toString());
			}
		}
	}
	
	if(busStopPoint === null) {
		if(_isDebugging) {
			console.warn("rewriteActualTableData(" + route.toString() + ", " + blockNumber.toString() + ") called, busStopPoint is null!");
		}
		return;
	}

	if(_isDebugging) {
		console.log("rewriteActualTableData - can the following code(1) be deprecated?");
	}

	let milesAway = miles(busAtPoint, busStopPoint);
	let s2 = milesAndDirection(milesAway);
	let actualRouteBlockNumber = document.getElementById("Actual_" + route.toString() + "_" + blockNumber.toString());

	if(actualRouteBlockNumber) {
		const newDiv = document.createElement("div");
		// newDiv.setAttribute("id", "firstCellOfDetails");
		const id = route + "_";
		newDiv.setAttribute("id", id);
		newDiv.setAttribute("class", "bg-warning text-center");   // is this even reached?  -warning instead of -success

		let d1 = document.createElement("div");
		d1.setAttribute("class", "mt-0 mb-0 ms-1 me-1");
		d1.textContent = s1;
		newDiv.appendChild(d1);

		d1 = document.createElement("div");
		d1.setAttribute("class", "mt-0 mb-0 ms-1 me-1");
		d1.textContent = s2;
		newDiv.appendChild(d1);

		if(_isDebugging) {
			console.log("rewriteActualTableData - can markupBlockNumberButton be deprecated?");
			console.log("rewriteActualTableData - blockNumber=", blockNumber, " route=", route.toString(), " stop=", _myStop);
		}

		const newButton = markupBlockNumberButton(blockNumber);
		newDiv.appendChild(newButton);

		actualRouteBlockNumber.parentNode.replaceChild(newDiv, actualRouteBlockNumber);
	}
}

function minutesSecondsPhrase(busLocationTime: number): string {
	const busLocationDateTime = new Date(busLocationTime * 1000);
	return busLocationDateTime.toISOString().substring(14, 19);
}

function elapsedTimePhrase(busLocationTime: Date): string {
	let now = new Date();
	//let timezoneOffsetInMinutes = now.getTimezoneOffset();
	let busLocationDateTime = new Date(busLocationTime);
	//let secondsElapsed = (now.getTime() - busLocationTime.getTime() * 1000 + 1000 * 60 * timezoneOffsetInMinutes) / 1000;
	let secondsElapsed = (now.getTime() - busLocationDateTime.getTime() * 1000) / 1000;
	// secondsElapsed should never be less than 0
	//                is an indication that the local clock and the Server clock differ
	//                need to save an offset value.
	if (secondsElapsed < 0 && _secondsElapsedOffset < 60) {
		_secondsElapsedOffset = -secondsElapsed + _secondsElapsedOffset;
		if (_isDebugging) {
			console.log("elapsedTimePhrase(busLocationTime) secondsElapsedOffset=", _secondsElapsedOffset, "busLocationTime=", busLocationTime);
		}
	}
	secondsElapsed = secondsElapsed + _secondsElapsedOffset;

	let s1 = "";
	if (0 <= secondsElapsed && secondsElapsed < 100) {
		s1 = secondsElapsed.toFixed(0) + " sec ago";
	}
	else {
		s1 = (secondsElapsed / 60).toFixed(1) + " min ago";
	}
	return s1;
}

function markupBlockNumberButton(blockNumber: string): HTMLButtonElement {
	if(_isDebugging) {
		console.warn("------- is markupBlockNumberButton in use?  blockNumber=", blockNumber);
		// yes, when the BlockNumberButton is clicked.
		console.log("markupBlockNumberButton(" + blockNumber.toString() + ") which creates a button busNumberClicked(" + blockNumber.toString() +")");
	}

	let outButton = document.createElement("button");
	outButton.setAttribute("type", "button");
	outButton.setAttribute("class", "btn btn-primary btn-sm")
	outButton.setAttribute("onclick", "busNumberClicked('" + blockNumber.toString() + "')");
	outButton.textContent = blockNumber.toString();
	return outButton;
}

function markupBlockNumberButton3(blockString: string, routeString: string, stopString: string) {
	if(_isDebugging) {
		console.log("markupBlockNumberButton3(" + blockString.toString() + ") which creates a button busNumberClicked3('" + blockString.toString() + "', '" + routeString + "', '" + stopString.toString() + "')");
	}
	let outButton = document.createElement("button");
	outButton.setAttribute("type", "button");
	outButton.setAttribute("class", "btn btn-primary btn-sm")
	outButton.setAttribute("onclick", "busNumberClicked3('" + blockString.toString() + "', '" + routeString + "', '" + stopString.toString() + "')");
	outButton.textContent = blockString.toString();
	return outButton;
}

// was like:   "\/Date(1447715700000-0600)\/"
// now like:   "1668125613"   or is it just that str.match doesn't work with numbers?
function fromDateTimeNumber(n: Date) {
	return new Date(n);
}

// eslint-disable-next-line no-unused-vars
function requestRoutes() {
	// if we already know the routes, saved to localStorage, use that.
	let p =  _db1.getByKey("Routes"); 
	if(p !== undefined) {
		populateRoutes(p);
		return;
	}

	let xmlhttp3 = new XMLHttpRequest();
	let url3: string = "https://svc.metrotransit.org/nextrip/Routes?format=json";

	xmlhttp3.onreadystatechange = function () {
		logAjax(xmlhttp3, "requestRoutes()");

		if (xmlhttp3.readyState === 4 && xmlhttp3.status === 200) {
			populateRoutes(xmlhttp3.responseText);
			_db1.setByKey("Routes", xmlhttp3.responseText);
		}
	};
	xmlhttp3.open("GET", url3, true);
	xmlhttp3.send();
}

function dropElementChildren(elementWithChildren: HTMLElement) {
	while(elementWithChildren.lastElementChild) {
		elementWithChildren.removeChild(elementWithChildren.lastElementChild);
	}
}

function populateRoutes(responseText: string) {
	let arr = JSON.parse(responseText);
	let outDiv = document.createElement("div");
	outDiv.setAttribute("id", "routeButtonGroup");

	for(let i = 0; i < arr.length; i++) {
		let outButton = document.createElement("button");
		outButton.setAttribute("type", "button");
		outButton.setAttribute("class", "btn btn-primary");
		outButton.setAttribute("style", "margin-right:4px; margin-bottom:4px;");
		outButton.setAttribute("onclick", "routeClicked('" + arr[i].route_id + "')");
		outButton.textContent = arr[i].route_id;
		outDiv.appendChild(outButton);
	}

	let elemId00 = document.getElementById("id00RouteDirectionStop");
	dropElementChildren(elemId00);
	elemId00.appendChild(outDiv);
	elemId00.style.display = "block";
}

// handle the routeButtonGroup click
$('#routeButtonGroup button').on("click", function() {
    $(this).addClass('active').siblings().removeClass('active');
	_myRoute = $(this).val.toString();
});

// eslint-disable-next-line no-unused-vars
function busNumberClicked3(blockNumber: string, routeString: string, stopNumber: number) {
	if(_isDebugging) {
		console.log("busNumberClicked3(" + blockNumber + ", " + routeString + ", " + stopNumber.toString() + ") - starting");
	}

	requestVehiclesOnRoute(routeString);

	if(stopNumber.toString() !== _myStop.toString()){
		_myStop = stopNumber.toString();
	}

	if(routeString.toString() !== _myRoute.toString()){
//		_myRoute = parseInt(routeString);
		_myRoute = routeString;
	}	

	if(blockNumber !== _myBlockNumber){
		_myBlockNumber = blockNumber;
	}
	
	let stop;
	let stopMine;
	if(_myBlockNumber === blockNumber) {

		if(_isDebugging) {
			console.log("busNumberClicked3(" + blockNumber + ", ...) _myBlockNumber === blockNumber ===" + _myBlockNumber);
		}

		if(_map === undefined || _map === null) {
			stop = _tblPlaces.getByKey(_myStop);

			if(_isDebugging) {
				console.log("busNumberClicked3(" + blockNumber.toString() + ", ...) _map is null/undefined  stop =" + stop);
			}

			if(stop) {
				stopMine = JSON.parse(stop);
				document.getElementById("collapseMap").classList.add("show");			
				initializeMap2(stopMine);
				if(_isDebugging) {
					console.log("busNumberClicked3(" + blockNumber.toString() + ", ...) myStop found: stopMine=" + JSON.stringify(stopMine) + " initializeMap2 called.");
				}
			} else {
				if(_isDebugging) {
					console.log("busNumberClicked3(" + blockNumber.toString() + ", ...) map did not exist, myStop not set, a NumberedStop?");
				}

				let targetStop = getActiveNumberedBusStop();
				if(targetStop !== undefined && targetStop !== null) {
					if(_isDebugging) {
						console.log("busNumberClicked3(" + blockNumber.toString() + ", ...) map did not exist, a NumberedStop found.");
					}
					document.getElementById("collapseMap").classList.add("show");
					initializeMap2(targetStop);
				} else {
					if(_isDebugging) {
						console.warn("busNumberClicked3(" + blockNumber.toString() + ", ...) map did not exist, myStop and NumberedStop not set");
					}
				}
			}
		}
/*		
		// too early, the requestVehiclesOnRoute has not happened yet.
		//        requestVehiclesOnRoute(routeString);     // when this finishes, and 
		//        initializeMap2(stopMine);                // and this has run recently
		//                                                 // and _map now exists, add a marker
		if(_map) {
			const vehicleRaw = _tblVehicleLocation.getByKey(routeString + "." + blockNumber);
			if(vehicleRaw) {
				const vehicle = JSON.parse(vehicleRaw);
				
				addMarker(
					{"route":routeString, 
					"blockNumber":blockNumber, 
					"time":vehicle.locationTime, 
					"latitude":vehicle.latitude, 
					"longitude":vehicle.longitude});
			}
		}
*/		
		return;
	}

	if(_isDebugging) {
		console.log("busNumberClicked3(" + blockNumber.toString() + ", ...) will switch away from the previous myBlockNumber=" + _myBlockNumber.toString());
	}

	_myBlockNumber = blockNumber.toString();
	// set a timeout for when to stop tracking the bus by BlockNumber.
	//                                                         20 minutes from now
	_myBlockNumberTimeout = new Date((new Date()).getTime() + 20 * 60 * 1000);
	// save the current row's info, so it can be used to populate the missing row.

	let p = _tblRouteDirectionStopDeparture.getByKey(_myRoute.toString() + '.' + _myDirection.toString() + '.' + _myStop.toString());

	if(_isDebugging) {
		console.log("busNumberClicked3(" + blockNumber.toString() + ", ...) _tblRouteDirectionStopDeparture.getByKey(" + _myRoute.toString() + '.' + _myDirection.toString() + '.' + _myStop.toString() + "  p=" + p);
	}

	if(p) {

		if(_isDebugging) {
			console.log("busNumberClicked3(" + blockNumber.toString() + ", ...) myRoute=" + _myRoute.toString() + " myDirection=" + _myDirection.toString() + " myStop=" + _myStop.toString());
		}
					
		let arr = JSON.parse(p);
		let i;
		for(i = 0; i < arr.length; i++) {
			if(arr[i].trip_id.substring(4,8) === blockNumber.toString()) {
				let newValue = JSON.stringify(arr[i]);	
				_tblVehicleTracked.setByKey(blockNumber, newValue);
				
				if(_map === undefined || _map === null) {
					// stop = _tblStop.getByKey(_myStop);
					stop = _tblPlaces.getByKey(_myStop);
					if(stop !== undefined && stop !== null) {
						stopMine = JSON.parse(stop);
						initializeMap2(stopMine);
					}
				}
			}
		}
	}
}

// eslint-disable-next-line no-unused-vars
function routeClicked(route: string) {
	if(_myRoute === undefined || _myRoute === null || _myRoute !== route) {
		$("#selectDirectionButton").removeClass("active");	
		$("#selectStopButton").removeClass("active");	
	}
	_myRoute = route;

	let selectedRoute = document.getElementById('selectedRoute');
	selectedRoute.textContent = ": " + route;
	selectedRoute.setAttribute("class", "ms-1 me-3");
	
	requestRouteDirections(route, true, true);
}

// --------------------- RouteDirections
// eslint-disable-next-line no-unused-vars
function selectRouteDirectionsUsingMyRoute() {
	$("#selectStopButton").removeClass("active");	
	requestRouteDirections(_myRoute, true, true);
}

function requestRouteDirections(route: string, shouldCreateButton: boolean, shouldPopulate: boolean) {
	if(_isDebugging) {
		console.log("requestRouteDirections(", route, ", shouldCreateButton=", shouldCreateButton, ", shouldPopulate=", shouldPopulate, ")" );
	}

	let p = _tblRouteDirections.getByKey(route);
	if(p !== undefined) {
		if(shouldCreateButton && shouldPopulate) {
			populateRouteDirections(route, p);
		}
		return;
	}

	let xmlhttp4 = new XMLHttpRequest();
	let url4 = "https://svc.metrotransit.org/nextrip/directions/" + route;
	
	// [{ "direction_id": 0, "direction_name": "Northbound" },{ "direction_id": 1, "direction_name": "Southbound" }]
	// 0 = Northbound, 1 = Southbound --- can also be Eastbound and Westbound

	xmlhttp4.onreadystatechange = function (shouldCreateButton) {
		logAjax(xmlhttp4, "requestRouteDirections(" + route + ", " + shouldCreateButton + ", " + shouldPopulate + ")");

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

function populateRouteDirections(route: string, responseText: string) {
	let arr = JSON.parse(responseText);
	if(_isDebugging) {
		console.log("populateRouteDirections responseText = " + responseText );
	}

	let elemDiv = document.createElement("div");
	elemDiv.setAttribute("id", "routeDirectionButtonGroup");

    for(let i = 0; i < arr.length; i++) {
		let elemButton = document.createElement("button");
		elemButton.setAttribute("type", "button");
		elemButton.setAttribute("class", "btn btn-primary");
		elemButton.setAttribute("style", "margin-right:4px; margin-bottom:4px;");
		elemButton.setAttribute("onclick", "routeDirectionClicked('" + route + "', " + arr[i].direction_id + ")");
		elemButton.textContent = arr[i].direction_name;
		elemDiv.appendChild(elemButton);
	}

	// delete all the children, then append this elemDiv
	let elemId00 = document.getElementById("id00RouteDirectionStop");
	dropElementChildren(elemId00);
	elemId00.appendChild(elemDiv);
	elemId00.style.display = "block";

	$("#selectDirectionButton").addClass("active");	
}

// eslint-disable-next-line no-unused-vars
function routeDirectionClicked(route: string, direction_id: number) {
	if(_myRoute === undefined || _myRoute !== route || _myDirection === undefined || _myDirection !== direction_id) {
		$("#selectStopButton").removeClass("active");	
	}
	_myRoute = route;
	_myDirection = direction_id;

	const directions: NexTrip.Direction[] = JSON.parse(_tblRouteDirections.getByKey(route));
	let directionNumberAsString = "";
	if(directions) {
		const routeDirection = directions.find(x => x.direction_id === direction_id);
		directionNumberAsString = directionAsString(directionAsNumber(routeDirection));
		if(_isDebugging) {
			console.log("routeDirectClicked  directions=", directions, "directionNumberAsString=", directionNumberAsString);
		}
	}

	let elem = document.getElementById('selectedDirection');
	elem.textContent = ": " + directionNumberAsString;
	elem.setAttribute("class", "ms-1 me-3");

	if(_isDebugging) {
		console.log("routeDirectClicked(" + route + ", " + direction_id + ")  myRoute=" + _myRoute + "  myDirection=" + _myDirection);
	}
	requestRouteDirectionStops(route, direction_id, true);
}

// --------------------- RouteDirectionStops
// eslint-disable-next-line no-unused-vars
function selectRouteDirectionStopsUsingMyDirection(){
	requestRouteDirectionStops(_myRoute, _myDirection, true);
}

function requestRouteDirectionStops(route: string, direction_id: number, shouldCreateButtons: boolean): void {
	// if route direction stops are known, use them
	let p =  _tblRouteDirectionStops.getByKey(route + '.' + direction_id.toString());
	if(p !== undefined) {
		if(shouldCreateButtons) {
			populateRouteDirectionStops(route, direction_id, p);
		}
		return;
	}

	let xmlhttp5 = new XMLHttpRequest();
	let url5 = "https://svc.metrotransit.org/nextrip/Stops/" + route + "/" + direction_id.toString() + "?format=json";

	xmlhttp5.onreadystatechange = function (shouldCreateButtons) {
		logAjax(xmlhttp5, "requestRouteDirectionStops(" + route + ", " + direction_id.toString() + ", " + shouldCreateButtons + ")");
		if (xmlhttp5.readyState === 4 && xmlhttp5.status === 200) {
			if (shouldCreateButtons) {
				populateRouteDirectionStops(route, direction_id, xmlhttp5.responseText);
			}
			_tblRouteDirectionStops.setByKey(route + "." + direction_id.toString(), xmlhttp5.responseText);
		}
	};
	xmlhttp5.open("GET", url5, true);
	xmlhttp5.send();
}

function populateRouteDirectionStops(route: string, direction_id: number, responseText: string): void {
	const arr = JSON.parse(responseText);
	const outDiv = document.createElement("div");
	outDiv.setAttribute("id", "routeDirectionStopButtonGroup");

	for(let i = 0; i< arr.length; i++) {
		const outButton = document.createElement("button");
		outButton.setAttribute("type", "button");
		outButton.setAttribute("class", "btn btn-primary me-1 mb-1");
		outButton.setAttribute("onclick", "routeDirectionStopClicked('" + route + "', " + direction_id + ", '" + arr[i].place_code + "', '" + arr[i].description + "')");
		outButton.textContent = arr[i].description;
		outDiv.appendChild(outButton);
	}

	const id00Route = document.getElementById("id00RouteDirectionStop");
	dropElementChildren(id00Route);

	id00Route.appendChild(outDiv);
	id00Route.style.display = "block";
	$("#selectStopButton").addClass("active");	
}

function routeDirectionStopClicked(route: string, direction_id: number, stop: string, stopDescription: string): void {
	if(_isDebugging) {
		console.log("routeDirectionStopClicked(route, direction_id, stop, stopDescription)  route=",
			route, 
			"direction_id=", direction_id, 
			"stop=", stop, 
			"stopDescription=", stopDescription);
	}

	_myRoute = route;
	_myDirection = direction_id;
	
	if(_myStop === undefined || _myStop === null || _myStop !== stop) {
		let a = document.getElementById("selectedStop");
		a.textContent = ": " + stopDescription;
		a.setAttribute("style", "ms-2 me-3");
	}

	_myStop = stop;

	if(_isDebugging) {
		console.log("routeDirectionStopClicked()  myRoute=" + _myRoute 
			+ "  myDirection=" + _myDirection
			+ "  myStop=" + _myStop);
	}

	// open the details section
	document.getElementById("collapseDetails").classList.add("show");
	document.getElementById("collapseBusStop").classList.remove("show");

	getVehiclesAndDepartures(route, direction_id, stop);
}

function getVehiclesAndDepartures(route: string, direction_id: number, stop: string) {
	requestVehiclesOnRoute(route);
	requestDepartures(route, direction_id, stop);
	rewriteActualTableData(route, null);
}

// --------------------- Departures
function requestDepartures(route: string, direction_id: number, stop: string) {
	//  Scheduled stops
	if(_isDebugging) {
		console.log("requestDepartures(route=", route, ", direction_id=", direction_id, ", stop=", stop, ")");
	}

	let xmlhttp6 = new XMLHttpRequest();
	let url6 = "https://svc.metrotransit.org/nextrip/" + route + "/" + direction_id.toString() + "/" + stop + "?format=json";
	
	xmlhttp6.onreadystatechange = function () {
		logAjax(xmlhttp6, "requestDepartures(" + route + ", " + direction_id.toString() + ", " + stop + ")");
		if (xmlhttp6.readyState === 4 && xmlhttp6.status === 200) {
			populateDepartures(route, direction_id, stop, xmlhttp6.responseText);
		}
	};
	xmlhttp6.open("GET", url6, true);
	xmlhttp6.send();
}

function populateHeaderRow(row: HTMLTableRowElement, values: string[]) {
	//	const outTableRow = document.createElement("tr");
	//  usage:    const values = ["Actual", "Route", "Departs", "Banner", "Milestone", "Miles"]
	//            const row = document.createElement("tr");
	//			  populateRow(row, true, values);
	for (let i = 0; i < values.length; i++) {
		const th = document.createElement("th");
		th.textContent = values[i];
		row.appendChild(th);
	}
}

function populateDepartures(route: string, direction_id: number, stop: string, responseText: string) {
	let busAtPoint: PointWithTime;
	let milesAway;
	let milesAndDirectionLetter: string;
	let arr = (JSON.parse(responseText)).departures;
	let i: number;
	let isValid = false;
	let targetPoint: NexTrip.Stop | null = null;

	// can also get the latitude/longitude from the (JSON.parse(responseText)).stops;
	let arrStops = (JSON.parse(responseText)).stops;
	if(_isDebugging){
		console.log("populateDepartures arrStops=", arrStops);
	}
	
	let scheduledStop = arrStops[0];

	let place = null;
	let rawPlace = null;
	rawPlace = _tblPlaces.getByKey(stop.toString());
	if(!rawPlace && scheduledStop) {
		_tblPlaces.setByKey(stop.toString(), JSON.stringify(scheduledStop));
		place = scheduledStop;
	} else {
		place = JSON.parse(rawPlace);
	}

	if(_isDebugging && !place) {
		console.warn("populateDepartures(route, direction, stop, responseText)  place is not set.");
	}

	if(place) {
		targetPoint = { "latitude": place.latitude, "longitude": place.longitude, "stop_id": place.stop_id };
	}
	
	_isCurrentTargetANumberedBusStop = false;

	let outDiv = document.createElement("div");
	const outTable = document.createElement("table");
	outTable.setAttribute("class", "table table-sm table-responsive-sm table-bordered");
	
	let outTableRow = document.createElement("tr");
	let values = ["Actual", "Route", "Departs", "Banner", "Bound", "Miles"]
	let outTd;
	populateHeaderRow(outTableRow, values);
	outTable.appendChild(outTableRow);
	
	// a tracked bus number, could disappear from these results, even though it has not reached the stop
	//     need to detect that the tracked bus number is not in the results
	let shouldShowTrackedBus = false;
	if(_myBlockNumber && new Date() < _myBlockNumberTimeout) {
		let hasBlockNumberMatch = false;
		for(i = 0; i < arr.length; i++) {
			if(arr[i].trip_id.substring(4,8) === _myBlockNumber) {
				hasBlockNumberMatch = true;
			}
		}
		
		shouldShowTrackedBus = !hasBlockNumberMatch;
		
		if(shouldShowTrackedBus) {
			// add based on a saved row, 
			let p = _tblVehicleTracked.getByKey(_myBlockNumber.toString());
			if(p) {
				let pI = JSON.parse(p);

				milesAndDirectionLetter = " ? ";
				
				// pI will have a stale version of the row
				//     getDbValue("VehicleLocation.14.1350")    VehicleLocation.14.1350={"direction":1, "locationTime":"/Date(1491594644000-0500)/", "latitude":44.97766, "longitude":-93.27093}
				let vT = _tblVehicleLocation.getByKey(route + '.' + _myBlockNumber.toString());
				if(vT) {
					let vTI = JSON.parse(vT);

					if(targetPoint !== null && vTI !== undefined && vTI.latitude !== undefined && vTI.latitude !== "0") {
						busAtPoint = {"latitude": vTI.latitude, "longitude": vTI.longitude};
						milesAway = miles(busAtPoint, targetPoint);	
						milesAndDirectionLetter = milesAndDirection(milesAway);
					}
				}

				outTableRow = document.createElement("tr");
				// 	["Actual"
				outTd = document.createElement("td");
				// outTd.setAttribute("id", "Actual_" + route.toString() + "_" + pI.BlockNumber.toString());
				if(_isDebugging) {
					console.warn("requestDepartures(route=", route, ", direction=", direction_id, ", stop=", stop, ") pI.direction.toString() =", pI.direction);
				}

				outTd.setAttribute("id", route.toString + "_" + pI.direction.toString() + "_" + pI.BlockNumber.toString());
				// outTd.setAttribute("class", "bg-success");  // stop coloring the background green
				outTd.textContent = pI.Actual;					
				outTableRow.appendChild(outTd);

				// 	[.. , "Route", ..]
				outTd = document.createElement("td");
				outTd.textContent = pI.route + (pI.terminal ? pI.terminal : "");					
				outTableRow.appendChild(outTd);

				// 	[.. , "Departs", ..]
				outTd = document.createElement("td");
				outTd.textContent = " - - ";					
				outTableRow.appendChild(outTd);

				// 	[.. , "Banner", ..]
				outTd = document.createElement("td");
				outTd.textContent = pI.Description;
				outTableRow.appendChild(outTd);

				let vehicleAtLocation: VehicleAtLocation | null = null;
				if(pI.VehicleLatitude !== undefined && pI.VehicleLatitude !== null && pI.VehicleLatitude !== "0") {
					vehicleAtLocation = { point: { latitude: pI.VehicleLatitude, longitude: pI.VehicleLongitude }, route: pI.Route };
				}

				// 	[.. , "Milestone", ..]
				outTd = document.createElement("td");
				outTd.textContent = (pI.VehicleLatitude === undefined || pI.VehicleLatitude === null || pI.VehicleLatitude === "0" ) ? " " : passedMilestone(vehicleAtLocation).simple;
				outTableRow.appendChild(outTd);

				// 	[.. , "Miles"]
				outTd = document.createElement("td");

				outTd.textContent =	(milesAndDirectionLetter !== "" ? milesAndDirectionLetter : (vehicleAtLocation === null) ? " " : distanceInMiles3Digits(vehicleAtLocation));
				outTableRow.appendChild(outTd);

				outTable.appendChild(outTableRow);
			}
		}
	}
	
	if(_isDebugging) {
		console.log("populateDepartures  myBlockNumber:" + _myBlockNumber.toString() + ", shouldShowTrackedBus:" + shouldShowTrackedBus);
	}
	
	for(i = 0; i < arr.length && i < _buttonMax; i++) {
		milesAndDirectionLetter = "";
		let actualBlockNumber = "0";

		if(arr[i].actual !== undefined && arr[i].actual) {
			actualBlockNumber = arr[i].trip_id.substring(4,8);
			isValid = true;
			
			let vehicle = null;
			const raw = _tblVehicleLocation.getByKey(route + "." + actualBlockNumber);
			if(raw) {
				vehicle = JSON.parse(raw);
			}
	
			if(targetPoint !== undefined && targetPoint !== null && vehicle && vehicle.latitude && vehicle.longitude) {
				busAtPoint = {"latitude": vehicle.latitude, "longitude": vehicle.longitude, "locationTime": vehicle.locationTime};
				milesAway = miles(busAtPoint, targetPoint);	
				milesAndDirectionLetter = milesAndDirection(milesAway);
			}

		}

		outTableRow = document.createElement("tr");
		outTd = document.createElement("td");

		if(arr[i].actual === undefined || arr[i].actual === null || !arr[i].actual) {
			outTd.textContent = "";
		} else {
// start
			if(actualBlockNumber && actualBlockNumber.length > 1) {
				//outTd.setAttribute("id", "firstCellOfDetails");
				//outTd.setAttribute("class", "text-center bg-success");   // bg-danger instead of bg-success to see if this is being reached
		/*
				let d1 = document.createElement("div");
				d1.setAttribute("class", "mt-0 mb-0 ms-1 me-1");
				d1.textContent = elapsedTimePhrase(busAtPoint.locationTime);
				outTd.appendChild(d1);
		
				d1 = document.createElement("div");
				d1.setAttribute("class", "mt-0 mb-0 ms-1 me-1");
				d1.textContent = milesAndDirectionLetter;
				outTd.appendChild(d1);
		*/
				const newButton = markupBlockNumberButton3(actualBlockNumber, route.toString(), stop);
		//		let elapsedPhrase = "";
				let minutesSeconds = "";

				if(busAtPoint?.locationTime) {
		//			elapsedPhrase = elapsedTimePhrase(busAtPoint.locationTime);
					minutesSeconds = minutesSecondsPhrase(busAtPoint.locationTime);
				} else {
					if(_isDebugging) {
//						console.log("populateDepartures busAtPoint=", busAtPoint, " busAtPoint?.locationTime=", busAtPoint?.locationTime, " elapsedPhrase=", elapsedPhrase);
						console.log("populateDepartures busAtPoint=", busAtPoint, " busAtPoint?.locationTime=", busAtPoint?.locationTime, " minutesSeconds=", minutesSeconds);
					}
				}

//				newButton.textContent = milesAndDirectionLetter + " @" + elapsedPhrase + " - " + actualBlockNumber;
				newButton.textContent = milesAndDirectionLetter + " @" + minutesSeconds + " - " + actualBlockNumber;
				// const id = route + "_" + vehicle.direction_id.toString() + "_" + blockNumberFromTripId;
				// newButton.setAttribute("id", "firstCellOfDetails");
				newButton.setAttribute("id", route + "_" + arr[i].direction_id.toString() + "_" + actualBlockNumber);
				newButton.setAttribute("class", "btn btn-success mt-1 mb-1 bg-success");  // btn-outline-success  btn-outline-light  
		
				outTd.appendChild(newButton);
				//outTd.setAttribute("class", "bg-light");
			} else {
				outTd.textContent = "?";
			}
// end
		}

		outTableRow.appendChild(outTd);

		outTd = document.createElement("td");
		outTd.textContent = arr[i].route_id + (arr[i].terminal ? arr[i].terminal : "");					
		outTableRow.appendChild(outTd);
		
		outTd = document.createElement("td");
		outTd.textContent = arr[i].departure_text;					
		outTableRow.appendChild(outTd);

		outTd = document.createElement("td");
		outTd.textContent = arr[i].description;					
		outTableRow.appendChild(outTd);

		outTd = document.createElement("td");
		outTd.textContent = arr[i].direction_text;
		outTableRow.appendChild(outTd);

		outTd = document.createElement("td");
		outTd.textContent = milesAndDirectionLetter;
		outTd.setAttribute("id", "md_" + arr[i].route_id + "_" + arr[i].direction_id + "_" + arr[i].trip_id.substring(4,8));
		outTableRow.appendChild(outTd);

		outTable.appendChild(outTableRow);
	}
	
	if(isValid) {
		// do not save until it is known to be a valid response
		_tblRouteDirectionStopDeparture.setByKey(route.toString() + "." + direction_id + "." + stop, responseText);

		let recentValidChoice = {"route":route, "direction":direction_id, "stop":stop }; 
		savePastChoice(recentValidChoice);
		
		if(stop !== _myStop) {
			_myStop = stop;
		}
		if(direction_id !== _myDirection) {
			_myDirection = direction_id;
		}
		if(route !== _myRoute) {
			_myRoute = route;
		}
		
		let routeDirectionStopActive = getRouteDirectionStopActive();
		if(routeDirectionStopActive !== undefined && routeDirectionStopActive !== null 
			&& routeDirectionStopActive.route === route && routeDirectionStopActive.direction === direction_id && routeDirectionStopActive.stop === stop) {
			// dbValue already set to this, so assume it's ok to remove the 00A section
		}
		else {
			let newVal = {"route":route, "direction":direction_id, "stop":stop };
			_db1.setByKey("RouteDirectionStopActive", JSON.stringify(newVal));
			let rawStop = _tblPlaces.getByKey(stop);
			if(rawStop) {
				let stopParsed = JSON.parse(rawStop);
				if(stopParsed) {
					let busStopPoint = {"stop":stop, "latitude": stopParsed.latitude, "longitude": stopParsed.longitude, "stop_id": stopParsed.stop_id};
					_db1.setByKey("ActiveScheduledBusStop", JSON.stringify(busStopPoint));
				}
			}
			rotateRecentChoices(newVal);
		}
		resetRecentChoiceButtons();
		document.getElementById("id00RouteDirectionStop").style.display = "none";
	}

    document.getElementById("title1").textContent = "Bus Schedule " + route.toString();
	if(_isDebugging) {
		console.log("outTable=" + JSON.stringify(outTable));
	}
	
	let elementid00B = document.getElementById("id00B");
	outTable.setAttribute("id", "id00B");
	elementid00B.parentNode.replaceChild(outTable, elementid00B);

	outDiv = document.createElement("div");

	let outButton = document.createElement("button");
	outButton.setAttribute("type", "button");
	outButton.setAttribute("class", "btn btn-primary");
	outButton.setAttribute("onclick", "getVehiclesAndDepartures(" + route.toString() + ", " + direction_id + ", '" + stop + "');");
	outButton.textContent = route.toString() + " - " + directionFromDirectionAndRoute(direction_id, route) + " - " + stop;
	outDiv.appendChild(outButton);	

	let outLabel = document.createElement("label");
	outLabel.setAttribute("class", "ms-1 me-3");
	outLabel.textContent = getStopDescription(route, direction_id, stop);
	outDiv.appendChild(outLabel);

	const timeOfQuery = new Date();
	outLabel = document.createElement("label");
	outLabel.setAttribute("class", "ms-1 me-3");
	outLabel.textContent = dateToHHMMSS(timeOfQuery);
	outDiv.appendChild(outLabel);

	let elementid00C = document.getElementById("id00C");
	outDiv.setAttribute("id", "id00C");
	elementid00C.parentNode.replaceChild(outDiv, elementid00C);

	document.getElementById("collapseDetails").classList.add("show");				
}

function getStopDescription(route: string, direction_id: number, stop: string): string {
	let p =  _tblRouteDirectionStops.getByKey(route + '.' + direction_id.toString());
	if(p) {
		let stops = JSON.parse(p);
		for(let i = 0; i < stops.length; i++) {
			if(stops[i].place_code === stop) {
				return stops[i].description;
			}
		}
	}
	return "";
}

function directionFromDirectionAndRoute(direction_id: number, route: string): string {
	let rawRouteDirections = _tblRouteDirections.getByKey(route);
	if(rawRouteDirections) {
		let routeDirections = JSON.parse(rawRouteDirections) as NexTrip.Direction[];
		if(routeDirections) {
			const result = routeDirections.find(x => x.direction_id === direction_id);
			switch(result.direction_name) {
				case "Northbound": return "N"
				case "Southbound": return "S"
				case "Eastbound": return "E"
				case "Westbound": return "W"
			}
		}
	}
	return "";	
}

// example: let s = directionAsString(recentStop.direction);
function directionAsString(direction: number) {
	// now: 0 North, 1 South, ?, ?
	// was: 1 South, 2 East, 3 West, 4 North
	// console.log("directionAsString()  direction=" + direction);
	// was: return direction === 1 ? "S" : direction === 2 ? "E" : direction === 3 ? "W" : direction === 4 ? "N" : "?";
	return direction === 1 ? "S" : direction === 0 ? "N" : direction === 2 ? "E" : direction === 3 ? "W" : "?";
}

function directionAsNumber(obj: any): number {
	if(obj && obj.direction_name) {
		if(obj.direction_name === "Northbound") return 0;
		if(obj.direction_name === "Southbound") return 1;
		if(obj.direction_name === "Eastbound") return 2;
		if(obj.direction_name === "Westbound") return 3;
		return -1;
	}

	if(obj && obj.direction_text) {
		if(obj.direction_text === "NB") return 0;
		if(obj.direction_text === "SB") return 1;
		if(obj.direction_text === "EB") return 2;
		if(obj.direction_text === "WB") return 3;
		return -1;
	}
}

function distance(latitude1: number, longitude1: number, latitude2: number, longitude2: number): number {
	return Math.sqrt(Math.pow(latitude1 - latitude2, 2) + Math.pow(longitude1 - longitude2, 2));
}

function latitudeDelta(point: Point, wayPoint: Point): number {
	return (point.latitude - wayPoint.latitude) * 69.0539;    // includes near 45deg factor
}

function longitudeDelta(point: Point, wayPoint: Point): number {
	return (point.longitude - wayPoint.longitude) * 48.9930;    // includes near 45deg factor for longitude
}

function distanceNearLatitude45(point: Point, wayPoint: Point): number {
	let latitudeDiff = latitudeDelta(point, wayPoint);
	let longitudeDiff = longitudeDelta(point, wayPoint);
	return Math.sqrt(Math.pow(latitudeDiff, 2) + Math.pow(longitudeDiff, 2));
}

function distanceInMiles3Digits(arrRow: VehicleAtLocation) {
	let strMiles = distanceInMiles(arrRow).toString();
	return strMiles.substring(0, 4);
}

function distanceInMiles(arrRow: VehicleAtLocation) {
	let busAtPoint: Point = {latitude:arrRow.point.latitude, longitude:arrRow.point.longitude};

	let targetPoint = null;
	if(_isCurrentTargetANumberedBusStop) {
		targetPoint = getActiveNumberedBusStop();
	}
	else {
		let activeStop = _db1.getByKey("ActiveScheduledBusStop");
		if(activeStop !== undefined && activeStop !== null) {
			targetPoint = JSON.parse(activeStop);
		} else {
			if(_isDebugging) {
				console.warn("distanceInMiles(arrRow) unable to determine a targetPoint.");
			}
			return "";
		}
	}
	
	if(targetPoint !== undefined && targetPoint !== null) {
		return distanceNearLatitude45(busAtPoint, targetPoint); 
	}
	
	if(arrRow.route==="133") {
		return distanceNearLatitude45(busAtPoint, _Marquette400S);  //400 S Marquette
	}
	if(arrRow.route==="7") {
		return distanceNearLatitude45(busAtPoint, _FourthStreet215S);   //215 S 4th St - #7    FourthStreet215S
	}
	if(arrRow.route==="14") {
		return distanceNearLatitude45(busAtPoint, _SixthStreet201S);  //Capella Tower
	}
	return "";
}

interface Point {
	latitude: number,
	longitude: number
}

interface PointWithTime extends Point {
	locationTime?: number
}

interface WayPoint extends Point {
	stop_id: number,
	description?: string
}

interface PlaceWithPoint extends Point {
	place_code?: string,
	description?: string
}

interface VehicleAtLocation {
	point: Point,
	route: string
}

type Miles = {
	point?: Point;
	wayPoint?: Point;
	between?: number;
	north?: number;
	east?: number;
	isNorthOf?: boolean;
	isSouthOf?: boolean;
	isEastOf?: boolean;
	isWestOf?: boolean;
	angleInDegrees?: number;
}

function miles(aPoint: Point, aWayPoint: Point): Miles {
	const north = latitudeDelta(aPoint, aWayPoint);
	const east = longitudeDelta(aPoint, aWayPoint);

	let obj: Miles = {
		point: aPoint,
		wayPoint: aWayPoint,
		between: distanceNearLatitude45(aPoint, aWayPoint),
		north: north,
		east: east,
		isNorthOf: (north > 0.01),
		isSouthOf: (north < 0.01),
		isEastOf: (east > 0.01),  // longitude increases as you go east
		isWestOf: (east < 0.01),
		angleInDegrees: (Math.atan2(aPoint.longitude - aWayPoint.longitude, aPoint.latitude - aWayPoint.latitude) * 180 / Math.PI)
	};
	return obj;
}

function milesAsString(miles: Miles): string {
	if(miles === undefined || miles === null) return;
	
	return "(" + miles.point.latitude.toFixed(6) + ", " + miles.point.longitude.toFixed(6) + ") vs ("  + miles.wayPoint.latitude.toFixed(6) + ", " + miles.wayPoint.longitude.toFixed(6) + ")"
		+ " .between=" + miles.between.toFixed(2) + " miles, .north=" + miles.north.toFixed(2) + ", .east=" + miles.east.toFixed(2) 
		+ ", " + (miles.isNorthOf ? "N" : miles.isSouthOf ? "S" : "")  
		+ ", " + (miles.isEastOf ? "E" : miles.isWestOf ? "W" : "") 
		;
}

function milesAndDirection(miles: Miles): string {
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

function isNorthAndEastOf(miles: Miles, between: number) {
	return miles.isNorthOf && miles.isEastOf && miles.between <= between;
}

interface PositionResult {
	detail: string,
	simple: string
}

// change to return an object that has {detail: string, simple: string}
function passedMilestone(arrRow: VehicleAtLocation): PositionResult {
	let busAtPoint: Point = { latitude: arrRow.point.latitude, longitude: arrRow.point.longitude };
	
	if(arrRow.route==="133") {
		// false	133	4:15	Ltd Stop/Bloomington/Chicago Av	SOUTHBOUND	1420	A	44.975585, -93.264102	0.32	35W & Franklin	(44.975585, -93.264102) vs (44.979001, -93.268623) .between=0.32 miles, .north=-0.24, .east=0.22, isSouthOf, isEastOf
		// true	133	14 Min	Ltd Stop/Bloomington/Chicago Av	SOUTHBOUND	1824	A	44.97874, -93.26189	0.33	Start of run (Gateway Ramp)	(44.978740, -93.261890) vs (44.979001, -93.268623) .between=0.33 miles, .north=-0.02, .east=0.33, isSouthOf, isEastOf
		
		let milesSWofWashington300S = miles(busAtPoint, _SWofWashington300S);
		if(isNorthAndEastOf(milesSWofWashington300S, 0.2)) {
			return {detail: "NE of 3rd and Washington" + " :" + milesAsString(milesSWofWashington300S),
					simple: milesAndDirection(milesSWofWashington300S) + " of 3rd & Wash"};
		}

		let milesSouthAndWestOfGatewayRamp = miles(busAtPoint, _SouthAndWestOfGatewayRamp);
		if(milesSouthAndWestOfGatewayRamp.isNorthOf && milesSouthAndWestOfGatewayRamp.isEastOf && milesSouthAndWestOfGatewayRamp.between < 0.15) {
			return {detail: "Start of run (Gateway Ramp)" + milesAsString(milesSouthAndWestOfGatewayRamp),
					simple: milesAndDirection(milesSouthAndWestOfGatewayRamp) + " start of run"};
		}
		
		let milesWashington300S = miles(busAtPoint, _Washington300S);
		if(milesWashington300S.isNorthOf && milesWashington300S.isEastOf && milesWashington300S.between < 0.2) {
			return {detail: "East of 3rd and Washington" + milesAsString(milesWashington300S),
					simple: milesAndDirection(milesWashington300S) + " of 3rd & Wash"};
		}
		if(milesWashington300S.isNorthOf && milesWashington300S.isWestOf && milesWashington300S.between < 0.2) {
			return {detail: "Crossed 3rd and Washington" + milesAsString(milesWashington300S),
					simple: milesAndDirection(milesWashington300S) + " crossed 3rd & Wash"};
		}
		
		let milesGrantAnd35W = miles(busAtPoint, _GrantAnd35W);
		if(milesGrantAnd35W.isSouthOf) {
			return {detail: "Still south of downtown" + milesAsString(milesGrantAnd35W),
					simple: milesAndDirection(milesGrantAnd35W) + " of downtown"};
		}
		if(milesGrantAnd35W.east < -1.0) {
			return {detail: "West of downtown" + milesAsString(milesGrantAnd35W),
					simple: milesAndDirection(milesGrantAnd35W) + " of downtown"};
		}
		
		let miles400SMarquette = miles(busAtPoint, _Marquette400S);

		let distanceFrom400SMarquette = distance(arrRow.point.latitude, arrRow.point.longitude, _Marquette400S.latitude, _Marquette400S.longitude);
		let distanceFrom5thAndWashington = distance(arrRow.point.latitude, arrRow.point.longitude, _Washington500N.latitude, _Washington500N.longitude);
		if(distanceFrom400SMarquette <= 0.0001) {
			return {detail: "here", 
					simple: milesAndDirection(miles400SMarquette) + " from Stop"};
			}
		if(distanceFrom400SMarquette <= 0.0169) {
			return {detail: "35W & Franklin",
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
	if(arrRow.route==="14") {
		let milesAway = miles(busAtPoint, _SixthStreet201S);
		
		let milesBroadwayEmerson = miles(busAtPoint, _BroadwayEmerson);
		if(milesBroadwayEmerson.isWestOf) {
			return {detail: "West of Broadway Emerson" + " :" + milesAsString(milesBroadwayEmerson),
					simple: milesAndDirection(milesBroadwayEmerson) + " of Broadway & Emerson"};
		}

		let milesPlymouthWashington = miles(busAtPoint, _PlymouthWashington);
		if(milesPlymouthWashington.east < 0.1 && milesPlymouthWashington.north > -0.1 ) {
			return {detail: "West of Plymouth and Washington" + " :" + milesAsString(milesPlymouthWashington), 
					simple: milesAndDirection(milesPlymouthWashington) + " of Plymouth & Wash"};
		}

		let milesWashington300N = miles(busAtPoint, _Washington300N);
		if(milesWashington300N.isWestOf && milesWashington300N.isNorthOf && milesWashington300N.between < 1) {
			return {detail: "NW of 3rd Ave N and Washington" + " :" + milesAsString(milesWashington300N),
					simple: milesAndDirection(milesWashington300N) + " of 3rd Ave N & Wash"};
		}
		
		let milesFifthStBusRamp = miles(busAtPoint, _FifthStBusRamp);
		if(milesFifthStBusRamp.isNorthOf && milesFifthStBusRamp.north < 0.2) {
			return {detail: "At 5th Street Bus Ramp" + " :" + milesAsString(milesFifthStBusRamp), 
					simple: milesAndDirection(milesFifthStBusRamp) + " of 5th St Bus Ramp"};
		}
		
		let milesFromSixthNicollet = miles(busAtPoint, _SixthNicollet);
		if(milesFifthStBusRamp.isSouthOf && milesFifthStBusRamp.isEastOf && milesFromSixthNicollet.isNorthOf && milesFromSixthNicollet.isWestOf && milesFromSixthNicollet.between > 0.05) {
			return {detail: "Nearing Nicollet Mall" + " :" + milesAsString(milesFromSixthNicollet),
					simple: milesAndDirection(milesFromSixthNicollet) + " of 6th & Nicollet"};
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
	if(arrRow.route==="7") {
		let milesFrom215s4thSt = miles(busAtPoint, _FourthStreet215S);

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

function getDbSize(): string {
	if (localStorage && !localStorage.getItem('size')) {
		let i = 0;
		try {
			// Test up to 10 MB
			for (i = 250; i <= 10000; i += 250) {
				localStorage.setItem('test', new Array(i * 1024 + 1).join('a'));
			}
		} catch (e) {
			localStorage.removeItem('test');
			localStorage.setItem('size', (i - 250).toString());            
		}
	}
	if (localStorage) {
		return localStorage.getItem('size');
	}
}

// eslint-disable-next-line no-unused-vars
function resetDatabase(): void {
    if (!_db1.supports_html5_storage) { 
		return;
	}
	localStorage.clear();
	if(_isDebugging) {
		console.log("resetDatabase to clear all localStorage.");
	}
}

// eslint-disable-next-line no-unused-vars
function showDatabase(): void {
	// show SQL that could be used in a query for Stop names of a route
    // BusDB.RouteDirectionStops.133.1	[{"Text":"Gateway Ramp ","Value":"GTWY"},{"Text":"Marquette Ave and 4th St ","Value":"MA4S"},{"Text":"Marquette Ave and 8th St ","Value":"MA8S"},{"Text":"12th St and 3rd Ave ","Value":"123A"},{"Text":"I-35W and Lake St","Value":"I3LA"},{"Text":"38th St and Chicago Ave","Value":"38CH"},{"Text":"Chicago Ave and 46th St","Value":"46CH"},{"Text":"54th St and Bloomington Ave","Value":"BL54"},{"Text":"1000 46th St E ","Value":"1046"}]	
    // BusDB.RouteDirectionStops.133.4	[{"Text":"1000 46th St E ","Value":"1046"},{"Text":"Bloomington Ave and 54th St","Value":"BL54"},{"Text":"Chicago Ave and 46th St","Value":"46CH"},{"Text":"38th St and Chicago Ave","Value":"38CH"},{"Text":"2nd Ave and 11th St ","Value":"112A"},{"Text":"2nd Ave and 7th St ","Value":"7S2A"},{"Text":"2nd Ave and Washington Ave ","Value":"WA2A"}]	
    if (!_db1.supports_html5_storage) { return null; }

	let routeDirectionCount = 0;
	for(let i=0, len = localStorage.length; i < len; ++i){
		if(localStorage.key(i).substring(0, "BusDB.RouteDirectionStops.".length) === "BusDB.RouteDirectionStops.") {
			if(++routeDirectionCount < 9999) { // 14, 30, 45, 64, 77, 93, 111
				console.log("-- routeDirectionCount=" + routeDirectionCount);
				let rawValues = localStorage.getItem(localStorage.key(i));
				let values = JSON.parse(rawValues);
				for(let j=0, valuesLength = values.length; j < valuesLength; ++j) {
					let value = values[j];
					console.log("('" + localStorage.key(i).substring("BusDB.RouteDirectionStops.".length) + "', '" + value.Text + "', '" + value.Value + "', " + j + "), "); 
				}
			}
		}
	}
}

// eslint-disable-next-line no-unused-vars
function showDbSize(): void {
	let dbSize = getDbSize();
	if(_isDebugging) {
		console.log("localStorage size=" + getDbSize());	
	}
	popupModal("localStorage size is " + dbSize);
}

// eslint-disable-next-line no-unused-vars
function removeDbUndefined(): void {
	if (!_db1.supports_html5_storage) { return null; }
	let i = 0;
	let removedCount = 0;
	let result = null;
	let value = null;
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
	return;
}
// -------------------------------- local storage -- end

// eslint-disable-next-line no-unused-vars
function visitAllRoutes() {
	let route;
	// to populate the local database with values that showDatabase() can use.
    if (!_db1.supports_html5_storage) { 
		return; 
	}
	
	let rawRoutes = _db1.getByKey("Routes");
	if(rawRoutes === null) { 
		if(_isDebugging) {
			console.log("No routes found using db1.getByKey('Routes').");
		}
		return; 
	}
	
	let arrRoutes = JSON.parse(rawRoutes);
	for(let i = 0; i < arrRoutes.length; i++) {
		// need to determine the valid directions for each route
		route = arrRoutes[i].route_id;
		requestRouteDirections(route, false, false);
	}
	
	// now, go through the RouteDirections
	for(let i=0, len = localStorage.length; i < len; ++i){
		if(localStorage.key(i).substring(0, "BusDB.RouteDirections.".length) === "BusDB.RouteDirections.") {
			let rawValues = localStorage.getItem(localStorage.key(i));
			let values = JSON.parse(rawValues);
			for(let j=0, valuesLength = values.length; j < valuesLength; ++j) {
				let direction = values[j].Value;
				route = localStorage.key(i).substring("BusDB.RouteDirections.".length);
				requestRouteDirectionStops(route, direction, false);
			}
		}
	}
}

// --------------------------------------------
// from https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition
// and
// from https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/Using_geolocation

var _currentDeviceGps: any;   // .coords of success callback of .getCurrentPosition

// eslint-disable-next-line no-unused-vars
function getGps() {
    let output = document.getElementById("mapPanelHeadingLabel");
	
	if (output === null) {
		popupModal("getGps() could not find elementId 'mapPanelHeadingLabel'.");
		return;
	}

	if (!navigator.geolocation) {
		popupModal("Geolocation is not supported by your browser");
		return;
	}

	function success(position: any) {
		// let latitude  = position.coords.latitude;
		// let longitude = position.coords.longitude;

		_currentDeviceGps = position.coords;

		console.log('Your current position is:');
		console.log(`Latitude : ${_currentDeviceGps.latitude}`);
		console.log(`Longitude: ${_currentDeviceGps.longitude}`);
		console.log(`More or less ${_currentDeviceGps.accuracy} meters.`);

		initializeMap();
	}

	function error() {
		popupModal("Unable to retrieve your location.");
		return;
	}

	let options = {
		enableHighAccuracy: true,
		timeout: 5000,        // wait up to 5000 milliseconds
		maximumAge: 30000     // milliseconds old or less, retrieve from cache.  0 to always get the latest position, never from cache
	};

	navigator.geolocation.getCurrentPosition(success, error, options);
}
// --------------------------------------------

// ----- create map and add markers ------ start
// based on http://stackoverflow.com/questions/5319488/how-to-set-google-map-marker-by-latitude-and-longitude-and-provide-infomation-bu
// add typescript type: npm i -D @types/google.maps
// fills the <div id="map_canvas"></div>
var _map: google.maps.Map;
var _markers: google.maps.Marker[] = [];

function initializeMap() {
	if(_isDebugging) {
		console.log("initializeMap() called back.");
	}	
	return initializeMap2(_currentDeviceGps); 
}

function initializeMap2(positionOfStop: any) {
	if (_isDebugging) {
		console.log("initializeMap2(positionOfStop) positionOfStop=", positionOfStop);
	}

	if (positionOfStop === undefined 
		|| positionOfStop === null 
		|| positionOfStop.latitude === undefined 
		|| positionOfStop.latitude === null) { return; }

	if (window.getComputedStyle(document.getElementById("collapseMap"), null)
			.getPropertyValue("display") === "none") { return; }

	let latlng = new google.maps.LatLng(positionOfStop.latitude, positionOfStop.longitude);
	let myOptions = {
		zoom: 13, // 14, the bus often was not visible   // stackoverflow version was set to 1
		center: latlng,
		mapTypeId: google.maps.MapTypeId.ROADMAP
	};
	if (_isDebugging) {
		console.log("initializeMap2(positionOfStop) Calling google to set the map. myOptions=" + JSON.stringify(myOptions));
	}

	_map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
	// addMarker(position);
	addMarkerForStop(positionOfStop);

	addBlockButtonToMapTitle();
	addResetButtonToMapTitle();
}

function addBlockButtonToMapTitle() {
	if(_isDebugging) {
		console.log("addBlockButtonToMapTitle markupBlockNumberButton3(myBlockNumber  myBlockNumber=" + _myBlockNumber.toString());
		console.log("addBlockButtonToMapTitle myRoute=", _myRoute);
		console.log("addBlockButtonToMapTitle myStop=", _myStop);
	}
	let divInTitle = document.getElementsByClassName("map-title");
	
	let outButton = markupBlockNumberButton3(_myBlockNumber, _myRoute, _myStop);
	outButton.setAttribute("style", "margin-left: 30%; margin-right: 20%");
	outButton.setAttribute("id", "busNumberMapButton");

	dropElementChildren(divInTitle[0] as HTMLElement);
	divInTitle[0].appendChild(outButton);
}

function addResetButtonToMapTitle() {
	// console.log("addResetButtonToMapTitle() called.");
	let mapTitleResetButton = document.getElementById("mapTitleResetButton");
	if(mapTitleResetButton === null) {
		let divInTitle = document.getElementsByClassName("map-title");
		if(divInTitle !== undefined) {
			let outButton = document.createElement("button");
			outButton.setAttribute("type", "button");
			outButton.setAttribute("class", "btn btn-primary btn-sm float-right");
			outButton.setAttribute("onclick", "clearTracking();");
			outButton.textContent = "Reset Map";
			divInTitle[0].appendChild(outButton);
		}
	}
}

function addMarkerForRoute(route: string, vehicle: object, blockNumberFromTripId: string): void {
	if(_isDebugging) {
		console.log("addMarkerForRoute(" + route + ", ", vehicle, ", " + blockNumberFromTripId + ") _myRoute=" + _myRoute + ", _myBlockNumber=" + _myBlockNumber);
	}

	// only addMarker if this is a marker for the
	if(route === _myRoute.toString() && blockNumberFromTripId === _myBlockNumber) {
		if(_isDebugging) {
			console.log("addMarkerForRoute(...) calling addMarker(", vehicle, ")");
		}
		addMarker(vehicle);
	}
}

function addMarkerForStop(position: Point): void {
	if(_markers === undefined || _markers === null) {
		_markers = [];
	}

	let current = new google.maps.LatLng(position.latitude, position.longitude);
	if(current === undefined || current === null) {
		if(_isDebugging) {
			console.warn("addMarkerForStop(position)  position=" + JSON.stringify(position) + " Unable to determine a current location.");
		}
		return;
	}

	let marker = new google.maps.Marker({
		map: _map,
		position: current,
		icon: {
			path: google.maps.SymbolPath.CIRCLE,
			scale: 5
			}
	});

	_markers.push(marker);
}

var _markerIntervals: number[];

function addMarker(busLocation: any): void {
	let i = 0;
	if(_isDebugging) {
		console.log("addMarker(busLocation)  busLocation=" + JSON.stringify(busLocation));
	}
	
	if(_markers === undefined || _markers === null) {
		_markers = [];
	}
	
    for (i = 0; i < _markers.length; i++) {
		let markerPosition = _markers[i].getPosition();
		if(markerPosition === undefined || markerPosition === null) return;
		if (busLocation.latitude === markerPosition.lat && busLocation.longitude === markerPosition.lng) return;
	}
	
	let current = new google.maps.LatLng(busLocation.latitude, busLocation.longitude);
	if(current === undefined || current === null) {
		if(_isDebugging) {
			console.warn("addMarker(busLocation)  busLocation=" + JSON.stringify(busLocation) + " Unable to determine a current location.");
		}
		return;
	}
	
	// if map is null, create one
	if(_map === undefined || _map === null) {
		if(_isDebugging) {
			console.log("addMarker(busLocation)  map is null.");
		}
		
		let activeStop;
		let rawActiveStop = _db1.getByKey("ActiveScheduledBusStop");
		if(rawActiveStop) {
			activeStop = JSON.parse(rawActiveStop);
		}

		if(activeStop) {
			console.log("addMarker(busLocation) create map, activeStop = " + JSON.stringify(activeStop));
			initializeMap2(activeStop);
		} else {
			console.log("addMarker(busLocation) create map, current = " + JSON.stringify(current));
			initializeMap2(current);
		}
	}	
	if(_map === undefined || _map === null) {
		if(_isDebugging) {
			console.warn("addMarker(busLocation)  map is still null.  Skipping.");
		}
		return;
	} else {
		if(_isDebugging) {
			console.log("addMarker(busLocation)  map is no longer null.");
		}
	}
	
	let marker: google.maps.Marker;
	if(busLocation === undefined || busLocation === null || busLocation.location_time === undefined) {
		if(_isDebugging) {
			console.log("addMarker(busLocation)  busLocation null or busLocation.location_timetime undefined, so add a circular marker based on current=", current);
		}
		marker = new google.maps.Marker({
			map: _map,
			position: current,
			icon: {
				path: google.maps.SymbolPath.CIRCLE,
				scale: 5
				}
		});
	} else
	{
		marker = new google.maps.Marker({
			map: _map,
			position: current,
			title: "" + busLocation.trip_id.substring(4,8),
			opacity: 1.0
		});
		
		let markerInterval = setInterval(function() {
			// 0.9375 ok, 0.9 too fast; both fade to less than 10% too fast.
			// let newOpacity = (marker.opacity * 0.8) + 0.10;    // needs to fade more as a final  0.46 seems to be the minimum
			let newOpacity = marker.getOpacity() * 0.8 + 0.08;
			marker.setOptions({'opacity': newOpacity});
			if(_isDebugging) {
				console.info("setInterval(function() marker.opacity = " + marker.getOpacity());
			}
		}, 15000);   // 15 seconds
		
		setTimeout(function() {
			marker.setOptions({'opacity': 0.0});
			marker.setMap(null);
		}, 20 * 60 * 1000);     // 20 minutes
		
		if(_markerIntervals === undefined || _markerIntervals === null) {
			_markerIntervals = [];
		}
		_markerIntervals.push(markerInterval);
	} 
	_markers.push(marker);

	// busLocation.time does not exist when the location is actually a bus stop, not a bus location
	if(busLocation.location_time) {
		let content = '<div>' + busLocation.trip_id.substring(4,8) + '</div>';
		if(busLocation.location_time > 0) {
			const busLocationTime = new Date(busLocation.location_time * 1000);
			if(_isDebugging) {
				console.log("addMarker(busLocation) > 0 busLocationTime=", busLocationTime, "dateToHHMMSS(busLocationTime)=", dateToHHMMSS(busLocationTime));
			}
			content = '<div>' + dateToHHMMSS(busLocationTime).substr(3,2) + 'm' + dateToHHMMSS(busLocationTime).substr(6,2) + 's</div>' + content;
		} else {
			if(_isDebugging) {
				console.log("addMarker(busLocation) busLocation.location_time is not > 0; busLocation.location_time=", busLocation.location_time);
			}
		}

		addInfoWindow(_map, marker, content);
/*
		_markers[_markers.length - 1]['infowin'] = new google.maps.InfoWindow({
			content: content
		});
		
		google.maps.event.addListener(_markers[_markers.length - 1], 'click', function() {
			this['infowin'].open(_map, this);
		});
*/
	}
}

function addInfoWindow(map: google.maps.Map, marker: google.maps.Marker, message: string) {
	var infoWindow = new google.maps.InfoWindow({
		content: message
	});

	google.maps.event.addListener(marker, 'click', function () {
		infoWindow.open(map, marker);
	});
}
// ----- create map and add markers ------ end

// eslint-disable-next-line no-unused-vars
function clearRecentChoices() {   
	if(_isDebugging) {
		console.debug("clearRecentChoices() starting.");
	}
	
	_tblRecentChoice.deleteAll();

	if(_isDebugging) {
		console.debug("clearRecentChoices() done.");
	}
}

// eslint-disable-next-line no-unused-vars
function clearPastChoices() {
	if(_isDebugging) {
		console.debug("clearPastChoices() starting.");
	}
	
	_tblPastChoices.deleteAll();

	if(_isDebugging) {
		console.debug("clearPastChoices() done.");
	}
}

// eslint-disable-next-line no-unused-vars
function clearPastChoicesOfNow() {
	if(_isDebugging) {
		console.debug("clearPastChoicesOfNow() starting.");
	}
	
	if(_tblPastChoices !== undefined && _tblPastChoices !== null) {
		let pastChoicesKey = getCurrentPastChoicesKey();
		_tblPastChoices.removeByKey(pastChoicesKey);
	}

	if(_isDebugging) {
		console.debug("clearPastChoicesOfNow() done.");
	}
}

// eslint-disable-next-line no-unused-vars
function clearVehicleTracking() {
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

// eslint-disable-next-line no-unused-vars
function deleteStaleVehicleLocations() {
	if(_isDebugging) {
		console.debug("deleteStateVehicleLocations() starting.");
	}

	if(localStorage.length > 0) {
		const now = new Date();
		let index = 0;
		let isDone = false;
		while (!isDone) {
			const key = localStorage.key(index);
			if(key === null) {
				isDone = true;
			} else {
				if(key.substring(0,21) === "BusDB.VehicleLocation") {
					const rawVehicleLocation = localStorage.getItem(key);
					const vehicleLocation = JSON.parse(rawVehicleLocation);
					const vehicleLocationDateTime = new Date(vehicleLocation.locationTime);
					if(now.getTime() - vehicleLocationDateTime.getTime() * 1000 > 1000 * 60 * 20) {
						localStorage.removeItem(key);
						index--;
					} 
				}
				index++;
			}
		}
	}

	if(_isDebugging) {
		console.debug("deleteStateVehicleLocations() done.");
	}
}

// eslint-disable-next-line no-unused-vars
function clearTracking() {
	if(_isDebugging) {
		console.debug("clearTracking() starting.");
	}
	
	dropElementChildren(document.getElementById("map_canvas"));

	if(_markers !== undefined && _markers !== null) {
		for (let i = 0; i < _markers.length; i++) {
			if(_isDebugging) {
				console.debug("clearTracking() setting markers[" + i.toString() + "].setMap(null).");
			}
			_markers[i].setMap(null);
		}
		_markers.length = 0;
		_markers = null;
	}
	if(_isDebugging) {
		console.debug("clearTracking() of markers finished.");
	}

	if(_markerIntervals !== undefined && _markerIntervals !== null) {
		for (let i2 = 0; i2 < _markerIntervals.length; i2++) {
			if(_isDebugging) {
				console.debug("clearTracking()  window.clearInterval(markerIntervals[" + i2.toString() + "]).");
			}
			window.clearInterval(_markerIntervals[i2]);
		}
		_markerIntervals.length = 0;
		_markerIntervals = null;
	}
	if(_isDebugging) {
		console.debug("clearTracking() of markerIntervals finished.");
	}
	
	_map = null;
	if(_isDebugging) {
		console.debug("clearTracking() finished.");
	}
}

var _isPartOfDeleteRecentChoice = false;
var _isShouldSavePastChoice = false;

// eslint-disable-next-line no-unused-vars
function selectRecentChoice(i: number) {
	if(_isDebugging) {
		console.log("selectRecentChoice(i) based on i=" + i.toString());
		console.log("selectRecentChoice(i) _isPartOfDeleteRecentChoice=", _isPartOfDeleteRecentChoice);
	}

	if(!_isPartOfDeleteRecentChoice) {
		_isShouldSavePastChoice = false;
		let recentValue = _tblRecentChoice.getByKey(i.toString());
		if(_isDebugging) {
			if(recentValue === undefined || recentValue === null) {
				console.log("selectRecentChoice(i) based on i=" + i.toString() + " returned only " + recentValue === undefined ? "undefined" : "null" + " as a recentChoice.");
			}
		}
		let msg = "";
		if (recentValue !== undefined && recentValue !== null) {
			let parsedRecentChoice = JSON.parse(recentValue);
			msg = 'unknown';
			if(_isDebugging) {
				if(parsedRecentChoice === undefined || parsedRecentChoice === null) {
					console.log("selectRecentChoice(i) based on i=" + i.toString() + " returned only " + parsedRecentChoice === undefined ? "undefined" : "null" + " as a parsedRecentChoice.");
				}
			}
			if(parsedRecentChoice.stop !== undefined) {
				_isShouldSavePastChoice = true;
				_isPartOfDeleteRecentChoice = false;   // see deleteRecentChoice function
				getVehiclesAndDepartures(parsedRecentChoice.route, parsedRecentChoice.direction, parsedRecentChoice.stop);
				return true;
			}
			if(parsedRecentChoice.stopNumber !== undefined) {
				_isShouldSavePastChoice = true;
				_isPartOfDeleteRecentChoice = false;   // see deleteRecentChoice function
				showStop2(parsedRecentChoice);
				return true;
			}
		}
		popupModal('select i=' + i + '  msg=' + msg);
	}
	_isPartOfDeleteRecentChoice = false;   // see deleteRecentChoice function
	return true;
}

// eslint-disable-next-line no-unused-vars
function deleteRecentChoice(i: number) {
	_isPartOfDeleteRecentChoice = true;

	for(let j = i; j < _buttonMax; j++) {
		let tempVal = _tblRecentChoice.getByKey((j + 1).toString());
		if(tempVal === null) {
			_tblRecentChoice.removeByKey(j.toString());
		}
		else {
			_tblRecentChoice.setByKey(j.toString(), tempVal);
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
	for(let i = 0; i < _buttonMax; i++) {
		// _buttonMax no longer represents a pre-set array of html elements, recentIElement may be undefined or null
		let recentIElement = document.getElementById("recentChoice" + i.toString());
		if(recentIElement === undefined || recentIElement === null) {
			// target: <div id="collapseChoices" class="collapse">
			// target:     <span id="recentChoice0" class="active hidden btn-group" >&nbsp;</span>
			let parentOfRecentChoice = document.getElementById("collapseChoices");
			let child = document.createElement("span");
			child.setAttribute("id", "recentChoice" + i.toString());
			child.setAttribute("class", "active hidden btn-group");
			child.textContent = "";
			parentOfRecentChoice.appendChild(child);
			recentIElement = document.getElementById("recentChoice" + i.toString()); 
		}

		let recentValue = _tblRecentChoice.getByKey(i.toString());
		// rather than prepopulate hidden controls, maybe it would be better to add them as needed.
		if(recentValue === undefined || recentValue === null || recentValue === "undefined") {
			recentIElement.hidden = true;
			recentIElement.classList.add("hidden");
			recentIElement.textContent = "";
		} else {
			recentIElement.hidden = false;
			recentIElement.classList.remove("hidden");
			let parsedRecentChoice = JSON.parse(recentValue);
			// could be a numbered or scheduled stop
			let buttonText = 'unknown';
			if(parsedRecentChoice.stopNumber !== undefined) {
				buttonText = parsedRecentChoice.stopNumber 
						+ ' - ' 
						+ (parsedRecentChoice.description === undefined || parsedRecentChoice.description === null ? " " : parsedRecentChoice.description)
						+ (parsedRecentChoice.routeFilter === undefined || parsedRecentChoice.routeFilter === null ? "" : " " + parsedRecentChoice.routeFilter);
			}
			if(parsedRecentChoice.stop !== undefined) {
				buttonText = parsedRecentChoice.route + ' - ' + directionAsString(parsedRecentChoice.direction) + ' - ' + parsedRecentChoice.stop;
			}
			let outButton = document.createElement("button");
			outButton.setAttribute("class", "active btn btn-secondary");
			outButton.setAttribute("type", "button");
			outButton.setAttribute("onclick", "selectRecentChoice(" + i + ");");
			outButton.textContent = buttonText;

			let outXButton = document.createElement("button");
			outXButton.setAttribute("class", "active btn btn-danger input-group-append");
			outXButton.setAttribute("type", "button");
			outXButton.setAttribute("onclick", "deleteRecentChoice(" + i + ");");
			outXButton.textContent = "X";

			dropElementChildren(recentIElement);
			recentIElement.appendChild(outButton);
			recentIElement.appendChild(outXButton);		
		}
	}
}

function rotateRecentChoices(recent: any) {
	// see: rotateRecentNumberedStops()
	// see: rotateRecentRoutes()

	// recent might be:   let busStopPoint = {"stopNumber":stopNumber, "latitude": latitude, "longitude": longitude, "description": description};
	//                    which is getActiveNumberedBusStop()
	// let recent = getActiveNumberedBusStop();
	if(recent === undefined || recent === null) { return; }
	
	// recent might be:   let newVal = {"route":route, "direction":direction, "stop":stop };
	//                    which is db1.setByKey("RouteDirectionStopActive", JSON.stringify(newVal));
	//                    this is missing latitude/longitude

	let i;
	let isScheduledStop = true;
	if(recent.stop === undefined) {
		isScheduledStop = false;
	}
		
	// is it already in the list? if so, only need to replace up to that one
	// let isAlreadyInTheList = false;
	let matchedChoice = null;
	let matchIndex = -1;
	let emptyIndex = -1;
	for(i=0; i < _buttonMax; i++) {
		let choiceRawI = _tblRecentChoice.getByKey(i.toString());
		if(choiceRawI === undefined || choiceRawI === null || choiceRawI === "undefined") {
			if(emptyIndex === -1) {
				emptyIndex = i;
			}
		} else {
			let choiceI = JSON.parse(choiceRawI);
			// if isScheduledStop, then need to match choiceI.stop == recent.stop
			// else                                   choiceI.stopNumber == recent.stopNumber                     
			if(choiceI !== undefined && choiceI !== null && choiceI !== "undefined") {
				if(isScheduledStop && recent.stop === choiceI.stop) {
					matchedChoice = choiceI;
					matchIndex = i;
				}
				if(!isScheduledStop && recent.stopNumber === choiceI.stopNumber && recent.routeFilter === choiceI.routeFilter) {
					matchedChoice = choiceI;
					matchIndex = i;
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
				let tempRaw = _tblRecentChoice.getByKey('' + i);
				_tblRecentChoice.setByKey('' + (i - 1), tempRaw);
			}
			_tblRecentChoice.setByKey('' + (_buttonMax - 1), JSON.stringify(recent));
		}
	}
}

// eslint-disable-next-line no-unused-vars
function toggleDebug() {
	_isDebugging = !_isDebugging;
	document.getElementById("utilDebugging").textContent = "Toggle debug " + (_isDebugging ? "off" : "on");
}

var _form = document.getElementById("busStopForm") as HTMLFormElement;
_form.addEventListener("submit", function(event) {
	event.preventDefault();
	showStop2((<HTMLInputElement> _form.elements.namedItem("stopNumber")).value, true);
});

// global variables for location
var _Marquette400S: Point    = {latitude:44.979001, longitude:-93.268623};   //133 

var _SouthAndWestOfGatewayRamp: Point  = {latitude:44.9779802, longitude:-93.2642134};   //133  waypoint before Marquette and 4th
var _Washington300S: Point     = {latitude:44.979682,  longitude:-93.264170};            // 133 bus is on the move
var _SWofWashington300S: Point = {latitude:44.979299,  longitude:-93.263962};
var _GrantAnd35W: Point        = {latitude:44.969878,  longitude:-93.269835};            //133  returning, still on 35W

var _FourthStreet215S: Point = {latitude:44.978416,  longitude:-93.266661};   // #7
var _SixthStreet201S: Point  = {latitude:44.9763315, longitude:-93.268188};   // #14
var _Washington300N: Point   = {latitude:44.984393,  longitude:-93.272505};   // #14
var _Washington500N: Point   = {latitude:44.978711,  longitude:-93.262360};   // #14

var _BroadwayEmerson: Point  = {latitude:44.999164,  longitude:-93.294136};   // #14
var _PlymouthWashington: Point = {latitude:44.992010,longitude:-93.281476};   // #14
var _FifthStBusRamp: Point   = {latitude:44.980832,  longitude:-93.275425};   // #14
var _SixthNicollet: Point    = {latitude:44.977802,  longitude:-93.271305};

var _myRoute: string = "-1"; // 14;
var _myDirection: number = -1; // 1;
var _myStop = '';

var _myBlockNumber = "0";
var _myBlockNumberTimeout = new Date(2019,4,1);

var _isCurrentTargetANumberedBusStop = false;    //  numbered vs scheduled bus stop

resetRecentChoiceButtons();

let firstChoice = document.getElementById("recentChoice0");
if(firstChoice !== undefined && firstChoice !== null && !firstChoice.classList.contains("hidden")) {

	// if tblPastChoices has a favorite based on .count for this day of week and hour of day, pre-click it.
	let choicesForThisDayHour = _tblPastChoices.getByKey(getCurrentPastChoicesKey());

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
		let arrayOfChoices = JSON.parse(choicesForThisDayHour);
		if(arrayOfChoices !== undefined && arrayOfChoices !== null && arrayOfChoices.length > 0) {
			// find the maximum .count
			let bestIndex = 0;
			for(let i = 1; i < arrayOfChoices.length; i++) {
				if(arrayOfChoices[bestIndex].count < arrayOfChoices[i].count) {
					bestIndex = i;
				}
			}
			if(_isDebugging) {
				console.log("arrayOfChoices[bestIndex]  bestIndex = " + bestIndex);
			}
			let choice = null;
			if(arrayOfChoices[bestIndex].scheduledStop !== undefined) {
				choice = arrayOfChoices[bestIndex].scheduledStop;
				requestVehiclesOnRoute(choice.route);
				routeDirectionStopClicked(choice.route, choice.direction, choice.stop, choice.stopDescription);
			} else {
				if(arrayOfChoices[bestIndex].numberedStop !== undefined) {
					choice = arrayOfChoices[bestIndex].numberedStop;

					// needs to set the BusDB.ActiveNumberedBusStop, so that requestStopNumberInfo can use it?
					_db1.setByKey("ActiveNumberedBusStop", JSON.stringify(choice));

					requestStopNumberInfo(choice.stopNumber);
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

// move this above the loadingElement being hidded and "real" page getting loaded.
$("footer div small")[0].textContent = "version " + _version;

/* added to convert alert(message); to modal popup ----- start */
// example of code to change from:
//       alert("Stops cleared for this route and direction to allow reloading.");
//                             to:
//       popupModal(Message);

function popupModal(message: string) {
	let modalElement = document.getElementById("popupModal");
	let modalCloseButtonElement = modalElement.getElementsByClassName("close")[0] as HTMLButtonElement;

	modalCloseButtonElement.onclick = function() {
		modalElement.style.display = "none";
	}

	window.onclick = function(event) {
		if (event.target == modalElement) {
			modalElement.style.display = "none";
		}
	}

	let idPopupModalBody = document.getElementById("idPopupModalBody");
	let outParagraph = document.createElement("p");
	outParagraph.textContent = message;

	dropElementChildren(idPopupModalBody);
	idPopupModalBody.appendChild(outParagraph);
	idPopupModalBody.style.display = "block";

	modalElement.style.display = "block";
}
/* added to convert alert(message); to modal popup ----- end */

/* added to support Modal popup ---- start */

// Get the modal
var _modal = document.getElementById('myModal');

// Get the <span> element that closes the modal
var _span = document.getElementsByClassName("close")[0] as HTMLButtonElement;

// When the user clicks on <span> (x), close the modal
_span.onclick = function() {	
	_modal.style.display = "none";
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event): void {
	if (event.target == _modal) {
		_modal.style.display = "none";
	}
}

// Not from the W3 example code:

// eslint-disable-next-line no-unused-vars
function showPastChoices() {
	// build a table from tblPastChoices
	//          Day of week, Hour, Choice Button text, Count
	// 
	let outDiv = document.createElement("div");
	outDiv.setAttribute("id", "idPastChoicesTable");

	let outTable = document.createElement("table");
	outTable.setAttribute("class", "table table-striped table-sm");
	outDiv.appendChild(outTable);

	let outTHead = document.createElement("thead");
	outTable.appendChild(outTHead);

	let outTR = document.createElement("tr");
	outTHead.appendChild(outTR);

	populateHeaderRow(outTR, ["Day", "Hour", "Stop", "Count"]);

	let outBody = document.createElement("tbody");
	outTable.appendChild(outBody);

	let iDay = 0;
	let iHour = 0;
	let pastChoicesKey = iDay.toString()+','+iHour.toString();
	let tblPastChoiceOfDayAndHour;

	for(iDay = 0; iDay < 7; iDay++) {
		for(iHour = 0; iHour < 24; iHour++) {
			pastChoicesKey = iDay.toString()+','+iHour.toString();
		
			tblPastChoiceOfDayAndHour = _tblPastChoices.getByKey(pastChoicesKey);
			if(tblPastChoiceOfDayAndHour !== undefined && tblPastChoiceOfDayAndHour !== null) {
				
				let pastChoicesArray = JSON.parse(tblPastChoiceOfDayAndHour) as PastChoice[];
				
				// sort the array (descending)
				pastChoicesArray.sort(function(a, b){return b.count - a.count});

				for(let i = 0; i < pastChoicesArray.length; i++) {
					// look for a match to recentChoice
					let dayHourI = iDay.toString() + "_" + iHour.toString() + "_" + i.toString();

					if(pastChoicesArray[i].scheduledStop !== undefined) {
						// handle the button text of a scheduled stop
						let outTR = document.createElement("tr");
						outTR.setAttribute("id", dayHourI);
						outBody.appendChild(outTR);

						let outTd = document.createElement("td");
						outTd.textContent = dayOfWeekAsMinimumString(iDay);
						outTR.appendChild(outTd);

						outTd = document.createElement("td");
						outTd.textContent = hourOfDayAsMinimumString(iHour);
						outTR.appendChild(outTd);

						outTd = document.createElement("td");
						outTd.textContent = pastChoicesArray[i].scheduledStop.route.toString() + ' - ' + directionAsString(pastChoicesArray[i].scheduledStop.direction) + ' - ' + pastChoicesArray[i].scheduledStop.stop ;
						outTR.appendChild(outTd);

						outTd = document.createElement("td");
						outTd.textContent = pastChoicesArray[i].count.toString() + " - ";

						let newButton = document.createElement("button");
						newButton.setAttribute("type", "button");
						newButton.setAttribute("class", "btn btn-danger btn-sm");
						newButton.setAttribute("onclick", "dropPastChoice('" + dayHourI + "', '" + pastChoicesKey + "', '" + JSON.stringify(pastChoicesArray[i]) + "')");
						newButton.textContent = "Drop";
						outTd.appendChild(newButton);
						outTR.appendChild(outTd);
					} else {
						if(pastChoicesArray[i].numberedStop !== undefined) {
							// handle the button text of a numbered stop
							// 	{"numberedStop":{"stopNumber":17884,"latitude":44.976246,"longitude":-93.267772,"description":"Capella to Home","routeFilter":"14[^E]"},"count":1}
							let buttonText = pastChoicesArray[i].numberedStop.stopNumber.toString();
							if(pastChoicesArray[i].numberedStop.description !== undefined && pastChoicesArray[i].numberedStop.description !== null) {
								buttonText += ' - ' + pastChoicesArray[i].numberedStop.description;
							}
							if(pastChoicesArray[i].numberedStop.routeFilter !== undefined && pastChoicesArray[i].numberedStop.routeFilter !== null) {
								buttonText += ' ' + pastChoicesArray[i].numberedStop.routeFilter;
							}

							let outTR = document.createElement("tr");
							outTR.setAttribute("id", dayHourI);
							outBody.appendChild(outTR);
	
							let outTd = document.createElement("td");
							outTd.textContent = dayOfWeekAsMinimumString(iDay);
							outTR.appendChild(outTd);
								
							outTd = document.createElement("td");
							outTd.textContent = hourOfDayAsMinimumString(iHour);
							outTR.appendChild(outTd);

							outTd = document.createElement("td");
							outTd.textContent = buttonText;
							outTR.appendChild(outTd);

							outTd = document.createElement("td");
							outTd.textContent = pastChoicesArray[i].count.toString() + " - ";

							let newButton = document.createElement("button");
							newButton.setAttribute("type", "button");
							newButton.setAttribute("class", "btn btn-danger btn-sm");
							newButton.setAttribute("onclick", "dropPastChoice('" + dayHourI + "', '" + pastChoicesKey + "', '" + JSON.stringify(pastChoicesArray[i]) + "')");
							newButton.textContent = "Drop";
							outTd.appendChild(newButton);
							outTR.appendChild(outTd);
						}
					}
				}
			}
		}
	}

	let idPastChoicesTable = document.getElementById("idPastChoicesTable");
	dropElementChildren(idPastChoicesTable);
	idPastChoicesTable.appendChild(outDiv);

	idPastChoicesTable.style.display = "block";

	_modal.style.display = "block";
}

// eslint-disable-next-line no-unused-vars
function dropPastChoice(id: string, key: string, pastChoiceString: string) {
	let pastChoice = JSON.parse(pastChoiceString) as PastChoice;
	let popupRow = document.getElementById(id);

	let popupRowCount = popupRow.getElementsByTagName("TD")[3];
	let popupRowDropButton = popupRowCount.getElementsByTagName("button")[0];
	let buttonText = popupRowDropButton.textContent;

	if(buttonText === "Drop") {
		popupRow.setAttribute("style", "color: lightgray;");
		popupRowDropButton.textContent = "Undo";
	} else {
		popupRow.setAttribute("style", "");
		popupRowDropButton.textContent = "Drop";
	}

	let pastChoices = _tblPastChoices.getByKey(key);
	let pastChoicesArray = JSON.parse(pastChoices) as PastChoice[];
	let isScheduledStop = pastChoice.scheduledStop !== undefined;
	let matchingChoiceIndex = pastChoicesIndex(pastChoicesArray, isScheduledStop ? pastChoice.scheduledStop : pastChoice.numberedStop);

	if(matchingChoiceIndex > -1) {
		pastChoicesArray.splice(matchingChoiceIndex, 1);
	} else {
		// undo the drop
		pastChoicesArray.push(pastChoice);
	}
	_tblPastChoices.setByKey(key, JSON.stringify(pastChoicesArray));
}

function pastChoicesIndex(pastChoicesArray: PastChoice[], findChoice: any) {
	// assumes that findChoice does not include a .scheduledStop or .numberedStop wrapper
	return pastChoicesArray.findIndex(x => 
		(   findChoice.route !== undefined
			&& x.scheduledStop !== undefined 
			&& x.scheduledStop.route === findChoice.route 
			&& x.scheduledStop.direction === findChoice.direction
			&& x.scheduledStop.stop === findChoice.stop)
		|| (
			findChoice.stopNumber !== undefined
			&& x.numberedStop !== undefined 
			&& x.numberedStop.stopNumber === findChoice.stopNumber 
			&& x.numberedStop.description === findChoice.description
			&& x.numberedStop.routeFilter === findChoice.routeFilter)
		);
}

function dayOfWeekAsMinimumString(dayOfWeek: number): string {
	if(dayOfWeek === 0) return 'Su';
	if(dayOfWeek === 1) return 'M';
	if(dayOfWeek === 2) return 'Tu';
	if(dayOfWeek === 3) return 'W';
	if(dayOfWeek === 4) return 'Th';
	if(dayOfWeek === 5) return 'F';
	if(dayOfWeek === 6) return 'Sa';
	return '??';
}

function hourOfDayAsMinimumString(hourOfDay: number): string {
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
	_db1.removeByKey("Routes");
	popupModal("Routes cleared to allow reloading.");
});

var _selectStopButton = document.getElementById("selectStopButton");

// listen for the long-press event
_selectStopButton.addEventListener("long-press", function(e) {

	// stop the event from bubbling up
	e.preventDefault();

	// do the work of the long press
	_tblRouteDirectionStops.removeByKey(_myRoute + '.' + _myDirection);
	popupModal("Stops cleared for this route and direction to allow reloading.");
});

// show the "real" page

var _loadingElement = document.getElementById("page-loader");
_loadingElement.hidden = true;
_loadingElement.classList.add("hidden");

document.getElementById("page-loaded").style.display = "block";
