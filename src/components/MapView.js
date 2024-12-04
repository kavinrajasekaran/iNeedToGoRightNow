import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, InfoWindow, useLoadScript } from '@react-google-maps/api';
import axios from 'axios';

function MapView({ setRestaurants, setPosition }) {
  const [position, setLocalPosition] = useState(null);
  const [restaurants, setLocalRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const codes = JSON.parse(localStorage.getItem('codes')) || {};

  // Google Maps libraries to load
  const libraries = ['places'];
  const mapContainerStyle = {
    height: '100vh',
    width: '100%',
  };

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: 'AIzaSyDO0kA88KZUIAuPBlgSV76v1OG2FlFmLYg', // Replace with your API key
    libraries,
  });

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLocalPosition(coords);
      setPosition(coords);
    });
  }, [setPosition]);

  useEffect(() => {
    if (position) {
      const service = new window.google.maps.places.PlacesService(document.createElement('div'));
      const request = {
        location: position,
        radius: 1000,
        type: ['restaurant'],
      };

      service.nearbySearch(request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          const restaurantData = results.map((place) => ({
            id: place.place_id,
            name: place.name,
            position: place.geometry.location,
          }));
          setLocalRestaurants(restaurantData);
          setRestaurants(restaurantData);
        }
      });
    }
  }, [position, setRestaurants]);

  const handleMarkerClick = (restaurant) => {
    setSelectedRestaurant(restaurant);
  };

  if (loadError) return 'Error loading maps';
  if (!isLoaded) return 'Loading Maps';

  return (
    <div id="map">
      {position && (
        <GoogleMap mapContainerStyle={mapContainerStyle} zoom={15} center={position}>
          <Marker position={position} />

          {restaurants.map((restaurant) => (
            <Marker
              key={restaurant.id}
              position={restaurant.position}
              onClick={() => handleMarkerClick(restaurant)}
            />
          ))}

          {selectedRestaurant && (
            <InfoWindow
              position={selectedRestaurant.position}
              onCloseClick={() => setSelectedRestaurant(null)}
            >
              <div>
                <h3>{selectedRestaurant.name}</h3>
                {codes[selectedRestaurant.id] ? (
                  <p>Restroom Code: {codes[selectedRestaurant.id]}</p>
                ) : (
                  <p>No code available</p>
                )}
                <button
                  onClick={() => {
                    const code = prompt('Enter restroom code:');
                    if (code) {
                      codes[selectedRestaurant.id] = code;
                      localStorage.setItem('codes', JSON.stringify(codes));
                      setSelectedRestaurant(null);
                    }
                  }}
                >
                  Add/Edit Code
                </button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      )}
    </div>
  );
}

export default MapView;
