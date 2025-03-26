import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import Route from "../services/Route";
import axios from "axios";


const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
console.log(googleMapsApiKey)
const mapID = import.meta.env.VITE_MAP_ID;
const libraries = ["places", "marker"];


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
    googleMapsApiKey: googleMapsApiKey,
    libraries,
    mapId: [mapID]
  });

  useEffect(() => {
    if (!isLoaded || !routes || !mapRef.current) return;
  
    const bounds = new window.google.maps.LatLngBounds();
  
    // Loop through all route paths and extend the bounds
    Object.values(routes).forEach((route) => {
      route.forEach((point) => {
        bounds.extend(new window.google.maps.LatLng(point.lat, point.lng));
      });
    });
  
    // Fit the map to the route's bounds
    mapRef.current.fitBounds(bounds, { top: 80, right: 80, left: 50, bottom: 50 });
  }, [isLoaded, routes]);

  useEffect(() => {
    const geocode = async (address) => {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${googleMapsApiKey}`);
      const data = await response.json();
      return data.results.length > 0 ? data.results[0].geometry.location : null;
    };

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

    

    const fetchRoutes = async () => {
      if (!start || !end) return;

      try {
        const startLocation = await geocode(start);
        const endLocation = await geocode(end);
        setStartCoords(startLocation);
        setEndCoords(endLocation);

        console.log(start, end);
        console.log(startLocation, endLocation);
        console.log(startLocation.lng);

        const travelModes = ["WALK", "DRIVE", "TRANSIT"];
        const routeRequests = travelModes.map(async (mode) => {
          const requestBody = {
            origin: { location: { latLng: { latitude: startLocation.lat, longitude: startLocation.lng}} },
            destination: { location: { latLng: { latitude: endLocation.lat, longitude: endLocation.lng } } },
            travelMode: mode,
            computeAlternativeRoutes: false,
          };

          try {
            const response = await axios.post(
              "https://routes.googleapis.com/directions/v2:computeRoutes",
              requestBody,
              {
                headers: {
                  "Content-Type": "application/json",
                  "X-Goog-Api-Key": googleMapsApiKey,
                  "X-Goog-FieldMask": "routes.polyline,routes.distanceMeters,routes.duration",
                },
              }
            );
            const routeData = response.data.routes[0];
            if (routeData) {
              const encodedPolyline = routeData.polyline?.encodedPolyline;
              if (encodedPolyline) {
                return { mode, path: decodePolyline(routeData.polyline.encodedPolyline), ...routeData };
              }
            }
            return null;
          } catch (error) {
            console.error(`Error fetching ${mode} route:`, error);
            return null;
          }
        });
        const results = await Promise.all(routeRequests);
        const validRoutes = results.filter((route) => route !== null);
        const newRoutes = {};
        const newRouteInfo = {};
        validRoutes.forEach((route) => {
          newRoutes[route.mode] = route.path;
          if (route.mode === "DRIVE") {
            newRouteInfo.driveDistance = route.distanceMeters;
            newRouteInfo.driveDuration = parseInt(route.duration.replace(/[^\d]/g, ''));
          } else if (route.mode === "WALK") {
            newRouteInfo.walkDistance = route.distanceMeters;
            newRouteInfo.walkDuration = parseInt(route.duration.replace(/[^\d]/g, ''));
          } else if (route.mode === "TRANSIT") {
            newRouteInfo.transitDistance = route.distanceMeters;
            newRouteInfo.transitDuration = parseInt(route.duration.replace(/[^\d]/g, ''));
          }
        });

        setRoutes(newRoutes);
        setRouteInfo(newRouteInfo);
      } catch (error) {
        console.error("Error fetching multiple routes:", error);
      }
    };
    fetchRoutes();
  }, [start, end]);
  
  useEffect(() => {
    if (!isLoaded || !startCoords || !endCoords || !mapRef.current || !window.google?.maps?.marker) return;
    const { AdvancedMarkerElement } = window.google.maps.marker;

    
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
    console.log("Drive Score: ", driveScore);
    console.log("drive duration", routeInfo.driveDuration, "drive distance", routeInfo.driveDistance)

    const walkScore = routeInfo.walkDistance && routeInfo.walkDuration 
    ? (weightDistance * routeInfo.walkDistance) + (weightTime * routeInfo.walkDuration)
    : 0;
    console.log("walk duration", routeInfo.walkDuration, "walk distance", routeInfo.walkDistance)
    console.log("walk score: ", walkScore);
    const transitScore = routeInfo.transitDistance && routeInfo.transitDuration
    ? ((weightDistance * routeInfo.transitDistance) + (weightTime * routeInfo.transitDuration))
    : 0;
    console.log("transit score: ", transitScore)
    
    const scores = { 'DRIVE': driveScore, 'WALK': walkScore, 'TRANSIT': transitScore};

    const best = Object.keys(scores).reduce((a, b) => {
      if (scores[a] === scores[b]) {
        return a === "WALK" ? a : b;
      }
      return scores[a] < scores[b] ? a : b;
    });
    setBestRoute(best);

  }, [routeInfo]);
 
  

  const getRouteText = () => {
    if (bestRoute === 'DRIVE') {
      return "Driving is your best bet. If you're willing to spend the extra buck on an Uber or Lyft, arrival is the most efficient this way."
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
            zoom={20}
            options={{ mapId: 'c0ef02cf970fc687'}}
            onLoad={(map) => (mapRef.current = map)}
          >
            <Route routes={routes} />
          </GoogleMap>
        )}
      </div>
      <div className="sidebar-overlay">
        <h1>Start: {start}</h1>
        <h1>Destination: {end}</h1>
        <h1>Best way to travel: {bestRoute}</h1>
        <p>{getRouteText()}</p>
        <p>Drive: {parseFloat(routeInfo.driveDistance / 1609).toFixed(2)} mi. {parseFloat(routeInfo.driveDuration / 60).toFixed(2)} min.</p>
        <p>Estimated Uber Price: ~${parseFloat(routeInfo.driveDistance / 1609 * 2.5 + 7.5).toFixed(2)}</p>
        <p>Walk: {parseFloat(routeInfo.walkDistance / 1609).toFixed(2)} mi. {parseFloat(routeInfo.walkDuration / 60).toFixed(2)} min.</p>
        <p>Transit: {parseFloat(routeInfo.transitDistance / 1609).toFixed(2)} mi. {parseFloat(routeInfo.transitDuration / 60).toFixed(2)} min.</p>
      </div>
    </div>
  );
}

export default Results;

// 16.98 from 900 w belden to soundbar 2.8mi 14min
// estimated 11.95

// 35.91 from 900 w belden to 8517 skokive blvd 13.5mi 37min
// estimated 25.04
