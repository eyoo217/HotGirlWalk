import express, { response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';

// Load environment variables from .env
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Google Maps API key from .env
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
console.log(googleMapsApiKey)

// Middleware to parse JSON bodies
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route to geocode an address
app.get('/api/geocode', async (req, res) => {
  console.log("received geocode request", req.query.address);
  console.log(googleMapsApiKey)
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'Address is required' });

  // Construct the Google Maps API URL
  const googleMapsUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${googleMapsApiKey}`;
  console.log(googleMapsUrl);
  try {
    // Make the API request to Google Maps
    const response = await axios.get(googleMapsUrl);
    console.log("Google API response:", response.data);

    // If results are found, return the location data
    if (response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      res.json(location);
    } else {
      res.status(404).json({ error: 'No results found' });
    }
  } catch (error) {
    console.error('Error geocoding address:', error);
    res.status(500).json({ error: 'Error geocoding address' });
  }
});

app.post('/api/get-routes', async (req, res) => {
  const { start, end } = req.body;
  const travelModes = ["DRIVE", "TRANSIT", "WALK"];
  if (!start || !end) {
    return res.status(400).json({ error: 'Start and end locations are required' });
  }
  let routesData = {};
  console.log(start, end)
  console.log(start.lat, start.lng, end.lat, end.lng)
  const startLatitude = start.lat;
  const startLongitude = start.lng;
  const endLatitude = end.lat;
  const endLongitude = end.lng;
  for (let mode of travelModes) {
    const requestBody = {
      origin: { location: { latLng: { latitude: startLatitude, longitude: startLongitude } } },
      destination: { location: { latLng: { latitude: endLatitude, longitude: endLongitude } } },
      travelMode: mode,
      computeAlternativeRoutes: false,
    };

    try {
      const response = await axios.post(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': googleMapsApiKey,
            'X-Goog-Fieldmask': "routes.polyline,routes.distanceMeters,routes.duration",
          },
        }
      );

      if (response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0]; // Taking the first route
        routesData[mode] = {
          polyline: route.polyline,
          distanceMeters: route.distanceMeters,
          duration: route.duration ? parseInt(route.duration.replace(/[^\d]/g, '')) : 0,
        };
      } else {
        routesData[mode] = null;
      }
    } catch (error) {
      console.error(`Error fetching ${mode} route:`, error.response?.data || error.message);
      routesData[mode] = null;
    }
  }
  res.json(routesData);
});

// Helper function to decode polyline (if using Google Maps API)
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

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
