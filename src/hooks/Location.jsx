import { useState, useEffect } from "react";
import { useGeolocated } from "react-geolocated";
import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';

const geocodingClient = mbxGeocoding({ accessToken: 'pk.eyJ1IjoiZXlvbzIxNyIsImEiOiJjbGQwaHY2Y2EwY3ZmNDBwOXEzc2FhMXV1In0.LSxvR3nvuRpwyJ1FpDHxrA' });

const useGeolocation = () => {
  const [address, setAddress] = useState(null);
  const { coords, isGeolocationAvailable, isGeolocationEnabled } = useGeolocated({
    positionOptions: {
      enableHighAccuracy: true,
    },
    userDecisionTimeout: 5000,
  });

  useEffect(() => {
    if (coords) {
      geocodingClient.reverseGeocode({
        query: [coords.longitude, coords.latitude],
        limit: 1
      })
      .send()
      .then(response => {
        const match = response.body;
        setAddress(match.features[0].place_name);
      });
    }
  }, [coords]);

  return { address, isGeolocationAvailable, isGeolocationEnabled };
};

export default useGeolocation;