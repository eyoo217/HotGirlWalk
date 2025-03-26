import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Results from './pages/Results';

// ...import other components...

function App() {
  const [routeInfo, setRouteInfo] = useState({
      driveDuration: null,
      driveDistance: null,
      transitDuration: null,
      transitDistance: null,
      walkDuration: null,
      walkDistance: null,
  });


  return (
    <Router basename="/HotGirlWalk/">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </Router>

  );
}

export default App;
