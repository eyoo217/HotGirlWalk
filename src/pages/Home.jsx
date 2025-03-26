import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJsApiLoader } from "@react-google-maps/api";
import useGeolocation from "../hooks/Location";
import Autocomplete from "react-google-autocomplete";

const googleMapsApiKey = import.meta.env.REACT_GOOGLE_MAPS_API_KEY;
const libraries = ["places", "marker"];

function Home() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const navigate = useNavigate();
  const { address, isGeolocationAvailable, isGeolocationEnabled } = useGeolocation();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey,
    libraries
  });

  const handleSearch = () => {
    if (!start || !end) {
      alert("Please enter a start and end location");
    }
    else{
      navigate(`/results?start=${start}&end=${end}`);
    }
  };

  const handleGetLocation = () => {
    if (address) {
      setStart(address);
    } else if (!isGeolocationAvailable) {
      alert("Your browser does not support Geolocation");
    } else if (!isGeolocationEnabled) {
      alert("Geolocation is not enabled");
    }
  };

  if (!isLoaded) return <div>Loading..</div>

  return (
    <div className="home">
      <h1 className="title">Hot Girl Walk</h1>
      <p className="subtitle">Travel Optimizer for After the Pregame</p>
      
      <Autocomplete class="location-input" placeholder="Enter Location"
        apiKey={googleMapsApiKey}
        onPlaceSelected={(place) => {
          setStart(place.formatted_address);
        }}
        options={{
          types: ["address"],
          componentRestrictions: { country: "us" }
        }}
      />

      <button className="current-location" onClick={handleGetLocation}>
        <img src="./assets/location.png" alt="Get Location"></img>
      </button>

      <Autocomplete class="destination-input" placeholder="Enter Destination"
        apiKey={googleMapsApiKey}
        onPlaceSelected={(place) => {
          setEnd(place.formatted_address);
        }}
        options={{
          types: ["establishment"],
          componentRestrictions: { country: "us" }
        }}
      />

      <button className="find-route-button" onClick={handleSearch}>Find Route</button>
    </div>
  );
}

export default Home;
