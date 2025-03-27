import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { GoogleMap, Marker, useJsApiLoader, Polyline } from "@react-google-maps/api";
import Route from "../services/Route";
import axios from "axios";



const mapID = import.meta.env.VITE_MAP_ID;
const libraries = ["places", "marker"];
const googleMapsApiKey = import.meta.env.VITE_REACT_APP_API_KEY;

function decodePolyline(encoded) {
  let points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let shift = 0, result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1F) << shift;
      shift += 5;
    } while (byte >= 0x20);

    let deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1F) << shift;
      shift += 5;
    } while (byte >= 0x20);

    let deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

function Results() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const start = queryParams.get("start");
  const end = queryParams.get("end");
  const [startCoords, setStartCoords] = useState(null);
  const [endCoords, setEndCoords] = useState(null);
  const [routes, setRoutes] = useState({});
  const [routeInfo, setRouteInfo] = useState({
    driveDuration: null,
    driveDistance: null,
    transitDuration: null,
    transitDistance: null,
    walkDuration: null,
    walkDistance: null,
  });
  const [bestRoute, setBestRoute] = useState(null);
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);

  const mapRef = useRef(null);
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey, // Use the frontend environment variable
    libraries,
    mapId: mapID
  });

  

  useEffect(() => {
    const fetchRoutes = async () => {
      if (!start || !end) return;

      try {
        const startLocationResponse = await axios.get(`https://hotgirlwalk.onrender.com/api/geocode?address=${start}`);
        const endLocationResponse = await axios.get(`https://hotgirlwalk.onrender.com/api/geocode?address=${end}`);

        const startLocation = startLocationResponse.data;
        const endLocation = endLocationResponse.data;

        setStartCoords(startLocation);
        setEndCoords(endLocation);


        const routeResponse = await axios.post('https://hotgirlwalk.onrender.com/api/get-routes', {
          start: startLocation,
          end: endLocation,
        });


        if (!routeResponse.data || routeResponse.data.length === 0) {
          console.error("No routes found");
          return;
        }
        const routeData = routeResponse.data;
        console.log("TEST", routeData.DRIVE.duration);
        
        
        const newRoutes = {};
        const newRouteInfo = {};
        Object.entries(routeResponse.data).forEach(([mode, route]) => {
          if (mode === 'DRIVE') {
            newRoutes["DRIVE"] = decodePolyline(route.polyline.encodedPolyline);
            newRouteInfo.driveDistance = route.distanceMeters;
            newRouteInfo.driveDuration = route.duration;
          }
          else if (mode === 'TRANSIT') {
            newRoutes.TRANSIT = decodePolyline(route.polyline.encodedPolyline);
            newRouteInfo.transitDistance = route.distanceMeters;
            newRouteInfo.transitDuration = route.duration;
          }
          else if (mode === 'WALK') {
            newRoutes.WALK = decodePolyline(route.polyline.encodedPolyline);
            newRouteInfo.walkDistance = route.distanceMeters;
            newRouteInfo.walkDuration = route.duration;
          }
        });
        console.log("setting new routes", newRoutes)
        setRoutes(newRoutes);
        setRouteInfo(newRouteInfo);
        
      } catch (error) {
        console.error("Error fetching routes:", error.response?.data || error.message);
      }
    };
    fetchRoutes();
  }, [start, end]);
  
  useEffect(() => {
    if (!isLoaded || !startCoords || !endCoords || !mapRef.current) return;
    const { AdvancedMarkerElement } = window.google.maps.marker;
    const bounds = new window.google.maps.LatLngBounds();

    bounds.extend(startCoords);
    bounds.extend(endCoords);

    mapRef.current.fitBounds(bounds);
   
    // Create the start marker
    if (!startMarkerRef.current) {
      startMarkerRef.current = new AdvancedMarkerElement({
        position: startCoords,
        map: mapRef.current,
        title: "Start",
      });
    } else {
      startMarkerRef.current.position = startCoords;
    }

    // Create the end marker
    if (!endMarkerRef.current) {
      endMarkerRef.current = new AdvancedMarkerElement({
        position: endCoords,
        map: mapRef.current,
        title: "End Location",
      });
    } else {
      endMarkerRef.current.position = endCoords;
    }

  }, [isLoaded, startCoords, endCoords]);

  useEffect(()=> {
    if (!routeInfo.driveDistance || !routeInfo.transitDistance || !routeInfo.walkDistance) return;

    const weightDistance = 1
    const weightTime = 2
    var mitigateProximity = 1

    if ((routeInfo.transitDistance == routeInfo.walkDistance) && (routeInfo.transitDuration == routeInfo.walkDuration)) {
      mitigateProximity = 2;
    }
    
    const driveScore = routeInfo.driveDistance && routeInfo.driveDuration 
    ? (weightDistance * routeInfo.driveDistance) + (weightTime * (routeInfo.driveDuration + 300)) + ((routeInfo.driveDistance / 1609) * 1.5)
    : 0;
  

    const walkScore = routeInfo.walkDistance && routeInfo.walkDuration 
    ? (weightDistance * routeInfo.walkDistance) + (weightTime * routeInfo.walkDuration)
    : 0;
   
    const transitScore = routeInfo.transitDistance && routeInfo.transitDuration
    ? ((weightDistance * routeInfo.transitDistance) + (weightTime * routeInfo.transitDuration))
    : 0;
    
    const scores = { 'UBER': driveScore, 'WALK': walkScore, 'TRANSIT': transitScore};

    const best = Object.keys(scores).reduce((a, b) => {
      if (scores[a] === scores[b]) {
        return a === "WALK" ? a : b;
      }
      return scores[a] < scores[b] ? a : b;
    });
    setBestRoute(best);

  }, [routeInfo]);

  

  const getRouteText = () => {
    if (bestRoute === 'UBER') {
      return "Ubering is your best bet. Spending the extra buck allows you to spend the least amount of money but get there on time."
    }
    if (bestRoute === 'TRANSIT') {
      return "Taking the train is best way to get to your destination. Transit is the cheapest and easiest way of travel."
    }
    if (bestRoute === 'WALK') {
      return "Don't bother spending money on an Uber or Lyft. If it's cold out, just thug it out, spend that money at the bar!"
    }
  }


  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      <div style={{ width: '100%', height: '100%' }}>
        {isLoaded && (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={startCoords || { lat: 0, lng: 0 }}
            zoom={15}
            options={{ mapId: mapID}}
            onLoad={(map) => (mapRef.current = map)}
          >
          <>
            {Object.entries(routes).map(([mode, path]) => (
              <Polyline
                key={mode}
                path={path}
                options={{
                  strokeColor: mode === "WALK" ? "red" : mode === "DRIVE" ? "blue" : "purple",
                  strokeWeight: 4,
                  strokeOpacity: 0.7,
                }}
              />
            ))}
          </>
          </GoogleMap>
        )}
      </div>
      <div className="sidebar-overlay">
        <h1>Start: {start}</h1>
        <h1>Destination: {end}</h1>
        <h1>Best way to travel: {bestRoute}</h1>
        <p>{getRouteText()}</p>
        <p>Uber: {parseFloat(routeInfo.driveDistance / 1609).toFixed(2)} mi. {parseFloat(routeInfo.driveDuration / 60).toFixed(2)} min.</p>
        <p>Estimated Uber Price: ~${parseFloat(routeInfo.driveDistance / 1609 * 2.5 + 7.5).toFixed(2)}</p>
        <p>Walk: {parseFloat(routeInfo.walkDistance / 1609).toFixed(2)} mi. {parseFloat(routeInfo.walkDuration / 60).toFixed(2)} min.</p>
        <p>Transit: {parseFloat(routeInfo.transitDistance / 1609).toFixed(2)} mi. {parseFloat(routeInfo.transitDuration / 60).toFixed(2)} min.</p>
      </div>
    </div>
  );
}

export default Results;

