export interface AlertMessage {
    stop_closed: boolean
    alert_text?: string
}

export interface Departure {
    actual: boolean,
    trip_id?: string,
    stop_id: number,
    departure_text?: string,
    departure_time: number,
    description?: string,
    gate?: string,
    route_id?: string,
    route_short_name?: string,
    direction_id: number,
    direction_text?: string,
    terminal?: string,
    schedule_relationship?: string
}

export interface Direction {
    direction_id: number,
    direction_name?: string
}

export interface NexTripResult {
    stops?: Stop[],
    alerts?: AlertMessage[],
    departures?: Departure[]
}

export interface Stop {
    stop_id: number
    latitude: number
    longitude: number
    description?: string
}

export interface Vehicle {
    trip_id?: string
    direction_id: number,
    direction?: string,
    location_time: number,
    route_id?: string,
    terminal?: string,
    latitude: number,
    longitude: number, 
    bearing: number,
    odometer: number,
    speed: number
}
