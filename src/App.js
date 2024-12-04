import React, { useState } from 'react';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import './App.css';

function App() {
  const [restaurants, setRestaurants] = useState([]);
  const [position, setPosition] = useState(null);

  return (
    <div className="App">
      <MapView setRestaurants={setRestaurants} setPosition={setPosition} />
      <Sidebar restaurants={restaurants} userPosition={position} />
    </div>
  );
}

export default App;
