import React from 'react';
import RestaurantList from './RestaurantList';

function Sidebar({ restaurants, userPosition }) {
  return (
    <div className="sidebar">
      <h2>Nearby Restaurants</h2>
      <RestaurantList restaurants={restaurants} userPosition={userPosition} />
    </div>
  );
}

export default Sidebar;
