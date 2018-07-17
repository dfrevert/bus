/* BusSchedule2.html javascript */
"use strict";
var version = '20180716_2201';

var isDebugging = false;

// todo:
//      minimize the number of button clicks required.
//          example: at 5pm, I'm going to be clicking the "Capella" button.  Do that automagically when the page opens.  (requires another url parameter, maybe something like  &time=4-7pm  or &time=1600-1900)
//          example2: the bus number buttons should refresh the map 
//                        a) if less than 30 seconds have elapsed, use the info embedded in the button 
//                        b) after 30 seconds, requery and display that info  
//                        b.2) if a different bus number, clear the markers on the map, and requery
//

var isFilterByDirection = false;
function filterByDirection(element) {
	isFilterByDirection = !isFilterByDirection;
	if(isFilterByDirection) {
		element.classList.add("button-text-bold");
	}
	else {
		element.classList.remove("button-text-bold");
	}
}

var isFilterByTerminal = false;
function filterByTerminal(element) {
	isFilterByTerminal = !isFilterByTerminal;
	if(isFilterByTerminal) {
		element.classList.add("button-text-bold");
	}
	else {
		element.classList.remove("button-text-bold");
	}
}

// for the purposes of 
// showBusLocation2 uses route in the call to the NexTrip api, uses route later to filter the results
// rename as      3 and only one parameter, the obj btnChoiceobjButton
function showBusLocation3(buttonParams) {
	var xmlhttp8 = new XMLHttpRequest();
	var url8 = "https://svc.metrotransit.org/NexTrip/VehicleLocations/" + buttonParams.route + "?format=json";

	if(isDebugging) {
		console.log("showBusLocation3(" + /* buttonParams.stopNumber + " " + */ buttonParams.route + "... called.  url8=" + url8);
	}
	
	xmlhttp8.onreadystatechange = function () {
		//logAjax(xmlhttp8, "showBusLocation2(" + route + ", " + blockNumber + ")");

		if (xmlhttp8.readyState === 4 && xmlhttp8.status === 200) {
			populateVehicleLocations3(buttonParams, xmlhttp8.responseText);
		}
	};
	xmlhttp8.open("GET", url8, true);
	xmlhttp8.send();
}

function populateVehicleLocations3(buttonParams, responseText) {
	var arr = JSON.parse(responseText);
	var i;
	var headingAsDirection = (buttonParams.heading === 'S' ? 1 : 
							 (buttonParams.heading === 'E' ? 2 :
							 (buttonParams.heading === 'W' ? 3 :
							 (buttonParams.heading === 'N' ? 4 : -1))));
	
	var table = document.getElementById("tableLocations");
	var isFirstRow = true;
	var out = '';
	var targetPoint = {"latitude":parseFloat(buttonParams.latitude), "longitude":parseFloat(buttonParams.longitude)};
	var busAtPoint;
	var milesAndDirectionLetter;
	var milesAway;
	var re = (buttonParams.terminal === undefined || buttonParams.terminal === '') ? null : new RegExp(buttonParams.terminal.toUpperCase());
							 
	for(i = 0; i < arr.length; i++) {
		if(arr[i].Route === buttonParams.route.toString() 
			&& (!isFilterByDirection || (headingAsDirection === '?' || arr[i].Direction === headingAsDirection))
			&& (!isFilterByTerminal || (re === null || re.test(arr[i].Terminal)))
			) { // & arr[i].BlockNumber === blockNumber) {
			var newVal = {"direction": arr[i].Direction,    // 1 = South, 2 = East, 3 = West, 4 = North.
						"locationTime": arr[i].LocationTime,
						"latitude": arr[i].VehicleLatitude,
						"longitude": arr[i].VehicleLongitude,
						"terminal": arr[i].Terminal,
						"blockNumber": arr[i].BlockNumber,
						"bearing": arr[i].Bearing};
						
			if(isFirstRow) {
				while(table.rows != null && table.rows.length > 0) {
					table.deleteRow(0);
				}
				isFirstRow = false;
				out += '<tr><th>Route</th><th>Bus &deg;</th><th>Miles</th><th>Bus #</th></tr>';
			}
			busAtPoint = {"latitude":newVal.latitude, "longitude":newVal.longitude, "locationTime":newVal.locationTime};

			milesAndDirectionLetter = " ? ";
			milesAway = miles(busAtPoint, targetPoint);	
			milesAndDirectionLetter = milesAndDirection(milesAway);
					//out += '<tr><td id="Actual_' + route.toString() + '_' + pI.BlockNumber.toString() + '" class="bg-success" >' +	pI.Actual +	'</td><td>' +
			out += "<tr><td>" +
					buttonParams.route.toString() + newVal.terminal +
					"</td><td>" +
					newVal.bearing + // buttonParams.heading + 
					"</td><td>" +
					(milesAndDirectionLetter !== "" ? milesAndDirectionLetter : "&nbsp;") +
					"</td><td>" +
					'<button type="button" class="button button-small" onclick="blockNumberClicked(' 
						+ targetPoint.latitude + ', ' + targetPoint.longitude + ', '
						+ busAtPoint.latitude + ', ' + busAtPoint.longitude + ', '
						+ '`' + busAtPoint.locationTime + '`, ' + newVal.blockNumber + ')" >' + newVal.blockNumber + '</button>' +
					"</td></tr>";
		}
		// Object { Bearing: 0, BlockNumber: 1203, Direction: 4, LocationTime: "/Date(1447298877000-0600)/", 
		//          Odometer: 0, Route: "14", Speed: 0, Terminal: "R", 
		//          VehicleLatitude: 44.864286, VehicleLongitude: -93.243361 }		
	}
	table.innerHTML = out;
}

// from  https://stackoverflow.com/questions/979975/how-to-get-the-value-from-the-get-parameters
// usage: var fType = getUrlVars()["type"];
function getUrlVars() {
	var vars = {}; 
	decodeURIComponent(window.location.search).replace(/[?&]+([^=&]+)=([^&]*)/gi, 
		function(m,key,value) { vars[key] = value; }); 
	return vars;	
}

window.onload = function(e) {
	// given ... BusSchedule2.html?sn=17884&r=14[ab]
	//           getUrlVars()['sn'] == 17884
	// grabs the last one if more than one has the same key, so tack '1' onto the 2nd button
	//alert("getUrlVars()['sn1'] = " + getUrlVars()['sn1']);
	//alert("do spaces work? getUrlVars()['d1'] = " + getUrlVars()['d1']);
	
	// need direction headed  // 1 = South, 2 = East, 3 = West, 4 = North.   &h=N  S  E or W
	// given ... BusSchedule2.html?h=S&sn=17884&r=14&t=[ab]&lat=44.976246&lon=-93.267772&d=Capella&h1=N&sn1=15574&r1=14&t1=[n]&lat1=44.912346&lon1=-93.252372&d1=Home%20to%20work
	// given ... BusSchedule2.html?h=S&r=14&t=[bc]&lat=44.976246&lon=-93.267772&d=Capella&h1=N&r1=14&t1=[drln]&lat1=44.912346&lon1=-93.252372&d1=Home%20to%20work
	
	// convert the URL to buttons on the DOM
	var i = 0;
	var strI = '';
	while (i > -1) {
		if(i > 0) {
			strI = '' + i;
		}
		if(getUrlVars()['r'+strI] == undefined) {
			i = -1;
		} else {
			var objButton = {
				"heading":getUrlVars()['h'+strI],   // S, E, W, or N   will become direction: 1 = South, 2 = East, 3 = West, 4 = North
				// "stopNumber":getUrlVars()['sn'+strI], 
				"route":getUrlVars()['r'+strI], 
				"terminal":getUrlVars()['t'+strI], 
				"latitude":getUrlVars()['lat'+strI], 
				"longitude":getUrlVars()['lon'+strI], 
				"description":getUrlVars()['d'+strI]
				};
			addBusButton(objButton);
			i = i + 1;			
		}
	} 
	var versionFooter = document.getElementById("version");
	versionFooter.innerHTML = 'version ' + version;
}

function addBusButton(objButton) {
  //Create an input type dynamically.   
  var element = document.createElement("input");
  //Assign different attributes to the element. 
  element.type = "button";
  element.classList.add("button");
  element.value = objButton.description;
  // element.name = 'btnChoice' + objButton.stopNumber + '-' + objButton.route;
  element.name = 'btnChoice' + objButton.route + '-' + objButton.heading;
  element.onclick = function() {
    //alert("blabla");
	showBusLocation3(objButton);
  };

  var foo = document.getElementById("previousChoicesForm");
  var firstFilterNode = document.getElementById("firstFilterNode")
  //Append the element in page (in span).  
  //  foo.appendChild(element);
  
  // relies on the id="firstFilterNode" of a filter button
  foo.insertBefore(element, firstFilterNode);
}
//document.getElementById("btnAdd").onclick = function() {
//  add("text");
//};

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

//function isLeftOfLine(pointAOnLine, pointBOnLine, pointC) {
//	return (pointBOnLine.longitude - pointAOnLine.longitude)*(pointC.latitude - pointAOnLine.latitude) > (pointBOnLine.latitude - pointAOnLine.latitude)*(pointC.longitude - pointAOnLine.longitude);
//}

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


function blockNumberClicked(targetLat, targetLon, busLocationLat, busLocationLon, busLocationTime, blockNumber) {
	var objTarget = {"latitude":parseFloat(targetLat), "longitude":parseFloat(targetLon)};
	var objBusLocation = {"latitude":parseFloat(busLocationLat), "longitude":parseFloat(busLocationLon), "time":busLocationTime, "blockNumber":blockNumber};
	
	if(map === undefined || map === null) {
		initializeMap2(objTarget);
	}
	addMarker(objBusLocation);
}


// ----- create map and add markers ------ start
// based on http://stackoverflow.com/questions/5319488/how-to-set-google-map-marker-by-latitude-and-longitude-and-provide-infomation-bu
// fills the <div id="map_canvas"></div>
var map;
var markers = [];

function initializeMap2(position) {
	if (position === undefined || position === null || position.latitude === undefined || position.latitude === null) { return; }

	var latlng = new google.maps.LatLng(position.latitude, position.longitude);
	var myOptions = {
		zoom: 14,   // stackoverflow version was set to 1
		center: latlng,
		mapTypeId: google.maps.MapTypeId.ROADMAP
	};
	map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
	addMarker(position);

	// addBlockButtonToMapTitle();
	// addResetButtonToMapTitle();
}

//function addBlockButtonToMapTitle() {
//	var divInTitle = document.getElementsByClassName("map-title");
//	var markup = markupBlockNumberButton(myBlockNumber);
//	markup = markup.replace(' onclick', ' style="margin-left: 30%; margin-right: 20%" onclick');
//	markup = markup.replace('button type=', 'button id="busNumberMapButton" type=');
//	divInTitle[0].innerHTML = markup;
//}

//function addResetButtonToMapTitle() {
	// console.log("addResetButtonToMapTitle() called.");
//	var mapTitleResetButton = document.getElementById("mapTitleResetButton");
//	if(mapTitleResetButton === null) {
//		var divInTitle = document.getElementsByClassName("map-title");
//		if(divInTitle !== undefined) {
//			divInTitle[0].innerHTML = divInTitle[0].innerHTML + 
//				'<button type="button" class="btn btn-primary btn-sm float-right" onclick="clearTracking()">Reset Map</button>';
//		}
//	}
//}

var markerIntervals;

function addMarker(busLocation) {
	var i = 0;
//	if(isDebugging) {
//		console.log("addMarker(busLocation)  busLocation=" + JSON.stringify(busLocation));
//	}
	
	if(markers === undefined || markers === null) {
		markers = [];
	}
	
    for (i = 0; i < markers.length; i++)
		if (busLocation.latitude === markers[i].position.lat() && busLocation.longitude === markers[i].position.lng()) return;

	var current = new google.maps.LatLng(busLocation.latitude, busLocation.longitude);
	if(current === undefined || current === null) {
//		if(isDebugging) {
			console.warn("addMarker(busLocation)  busLocation=" + JSON.stringify(busLocation) + " Unable to determine a current location.");
//		}
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
//			if(isDebugging) {
//				console.info("setInterval(function() marker.opacity = " + marker.opacity);
//			}
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
		var busLocationDate = fromDateString(busLocation.time);
		
		markers[markers.length - 1]['infowin'] = new google.maps.InfoWindow({
			content: '<div>' + busLocationDate.toHHMMSS().substr(3,2) + 'm' + busLocationDate.toHHMMSS().substr(6,2) + 's</div>'
				+ '<div>' + busLocation.blockNumber + '</div>'
		});
		
		google.maps.event.addListener(markers[markers.length - 1], 'click', function() {
			this['infowin'].open(map, this);
		});
	}
}
// ----- create map and add markers ------ end

function clearTracking() {
	document.getElementById("map_canvas").innerHTML = "";
	if(markers !== undefined && markers !== null) {
		for (var i = 0; i < markers.length; i++) {
			markers[i].setMap(null);
		}
		markers.length = 0;
		markers = null;
	}

	if(markerIntervals !== undefined && markerIntervals !== null) {
		for (var i = 0; i < markerIntervals.length; i++) {
			window.clearInterval(markerIntervals[i]);
		}
		markerIntervals.length = 0;
		markerIntervals = null;
	}
	map = null;
}

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

Date.prototype.toHHMMSS = function () {
	// want everything up to the first space
	var timeString = this.toTimeString();
	var spaceAt = timeString.indexOf(" ");
	return timeString.substr(0, spaceAt);
};

