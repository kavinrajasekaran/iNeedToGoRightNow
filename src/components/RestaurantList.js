import React, { useState } from 'react';
import AddCodeForm from './AddCodeForm';

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) *
      Math.cos(φ2) *
      Math.sin(Δλ / 2) *
      Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c; // in metres
  return d;
}

function RestaurantList({ restaurants, userPosition }) {
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const codes = JSON.parse(localStorage.getItem('codes')) || {};

  if (!userPosition) return null;

  const sortedRestaurants = restaurants
    .map((r) => {
      const distance = calculateDistance(
        userPosition.lat,
        userPosition.lng,
        r.position.lat(),
        r.position.lng()
      );
      return { ...r, distance };
    })
    .sort((a, b) => a.distance - b.distance);

  return (
    <div>
      <ul>
        {sortedRestaurants.map((r) => (
          <li key={r.id}>
            <h3>{r.name}</h3>
            <p>Distance: {(r.distance / 1000).toFixed(2)} km</p>
            {codes[r.id] && <p>Restroom Code: {codes[r.id]}</p>}
            <button onClick={() => setSelectedRestaurant(r)}>
              Add Code
            </button>
          </li>
        ))}
      </ul>
      {selectedRestaurant && (
        <AddCodeForm
          restaurant={selectedRestaurant}
          onClose={() => setSelectedRestaurant(null)}
        />
      )}
    </div>
  );
}

export default RestaurantList;
