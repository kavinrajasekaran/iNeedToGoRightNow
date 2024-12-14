// static/script.js
let map;
let service;
let infowindow;
let restaurantMarkers = [];
let pagination = null;
let currentLocationMarker = null;
let loadedPlaceIds = new Set();

// API key
const GOOGLE_MAPS_API_KEY = 'AIzaSyDBNdOp0vtpueqn7jGnt5oKJaQaE5INf68';

// Minimum zoom level to perform restaurant search
const MIN_ZOOM_LEVEL = 13;

// Default Location (San Francisco Bay Area)
const DEFAULT_LOCATION = { lat: 37.7749, lng: -122.4194 };

// Search token to manage asynchronous search relevance
let searchToken = 0;

// Initialize and add the map
function initMap() {
    // Attempt to get the user's current location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                initializeMap(userLocation);
            },
            (error) => {
                console.warn(`Geolocation failed: ${error.message}. Using default location.`);
                initializeMap(DEFAULT_LOCATION);
            }
        );
    } else {
        // Browser doesn't support Geolocation
        alert('Error: Your browser doesn\'t support geolocation. Using default location.');
        initializeMap(DEFAULT_LOCATION);
    }
}

// Function to initialize the map with a given location
function initializeMap(location) {
    // Create the map centered on the specified location
    map = new google.maps.Map(document.getElementById("map"), {
        center: location,
        zoom: 14,
        streetViewControl: false, // Remove street view control
    });

    // Create an InfoWindow instance
    infowindow = new google.maps.InfoWindow();

    // Add a marker for the current location
    addCurrentLocationMarker(location);

    // Setup POI control buttons
    setupPOIControls();

    // Perform an initial restaurant search
    searchRestaurants();

    // Add event listener to search for restaurants when the map becomes idle after movement
    map.addListener("idle", handleMapIdle);
}

// Function to handle map's idle event
function handleMapIdle() {
    const currentZoom = map.getZoom();

    if (currentZoom >= MIN_ZOOM_LEVEL) {
        // Show all restaurant markers
        restaurantMarkers.forEach(marker => marker.setVisible(true));

        // Perform a restaurant search
        searchRestaurants();
    } else {
        // Hide all restaurant markers
        restaurantMarkers.forEach(marker => marker.setVisible(false));
    }
}

// Setup POI Control Buttons
function setupPOIControls() {
    const poiControlsDiv = document.getElementById("poiControls");
    // Event listener for the "My Location" button
    document.getElementById("myLocation").addEventListener("click", getMyLocation);
}

// Function to get the user's current location and center the map
function getMyLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                map.setCenter(userLocation);
                map.setZoom(14);

                // Update the current location marker
                addCurrentLocationMarker(userLocation);
            },
            (error) => {
                alert('Error: The Geolocation service failed or was denied.');
            }
        );
    } else {
        // Browser doesn't support Geolocation
        alert('Error: Your browser doesn\'t support geolocation.');
    }
}

// Function to add or update the current location marker
function addCurrentLocationMarker(location) {
    // Remove existing marker if it exists
    if (currentLocationMarker) {
        currentLocationMarker.setMap(null);
    }

    // Define the custom icon for current location
    const currentLocationIcon = {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#4285F4',
        fillOpacity: 0.4,
        scale: 10,
        strokeColor: '#4285F4',
        strokeWeight: 2
    };

    // Add a marker for the current location
    currentLocationMarker = new google.maps.Marker({
        position: location,
        map: map,
        title: "My Location",
        icon: currentLocationIcon
    });

    // Optional: Add a pulsating effect using an additional circle
    const pulsatingCircle = new google.maps.Circle({
        strokeColor: '#4285F4',
        strokeOpacity: 0.4,
        strokeWeight: 2,
        fillColor: '#4285F4',
        fillOpacity: 0.15,
        map,
        center: location,
        radius: 30 // Adjust the radius as needed
    });

    // Remove the pulsating circle when the marker is removed
    currentLocationMarker.addListener("position_changed", () => {
        pulsatingCircle.setCenter(currentLocationMarker.getPosition());
    });

    currentLocationMarker.addListener("map_changed", () => {
        if (!currentLocationMarker.getMap()) {
            pulsatingCircle.setMap(null);
        }
    });

    // Add an info window for the current location marker
    currentLocationMarker.addListener("click", () => {
        const content = `
            <div class="info-window">
                <h3>My Location</h3>
            </div>`;
        infowindow.setContent(content);
        infowindow.open(map, currentLocationMarker);
    });
}

// Function to search for restaurants using PlacesService
function searchRestaurants() {
    // Check if the current zoom level is sufficient
    if (map.getZoom() < MIN_ZOOM_LEVEL) {
        // Do not perform search if zoomed out too far
        return;
    }

    // Increment the search token for each new search
    const currentSearchToken = ++searchToken;

    const request = {
        location: map.getCenter(),
        radius: '5000', // Increased radius to 5000 meters
        type: ['restaurant']
    };

    service = new google.maps.places.PlacesService(map);
    service.nearbySearch(request, (results, status, paginationObj) => {
        callback(results, status, paginationObj, currentSearchToken);
    });
}

// Callback function for PlacesService.nearbySearch
function callback(results, status, paginationObj, token) {
    // Verify if the search token matches the current token
    if (token !== searchToken) {
        // Outdated search, ignore the results
        return;
    }

    if (status === google.maps.places.PlacesServiceStatus.OK) {
        for (let i = 0; i < results.length; i++) {
            createRestaurantMarker(results[i]);
        }

        if (paginationObj && paginationObj.hasNextPage) {
            pagination = paginationObj;
            // Add a timeout to fetch the next page of results
            setTimeout(() => {
                if (token === searchToken) { // Ensure token is still valid
                    pagination.nextPage();
                }
            }, 2000);
        }
    } else if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        // Only alert for actual errors, not for zero results
        console.error('Places service was not successful for the following reason: ' + status);
    }
}

// Function to create a marker for a restaurant
function createRestaurantMarker(place) {
    if (!place.geometry || !place.geometry.location) return;

    // Check if the place has already been loaded
    if (loadedPlaceIds.has(place.place_id)) {
        return; // Skip if already loaded
    }

    // Add the place_id to the set to prevent duplicates
    loadedPlaceIds.add(place.place_id);

    const marker = new google.maps.Marker({
        map,
        position: place.geometry.location,
        title: place.name,
        icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
        }
    });

    // Initially set the marker's visibility based on current zoom level
    marker.setVisible(map.getZoom() >= MIN_ZOOM_LEVEL);

    // Create an info window for each marker
    marker.addListener("click", () => {
        const placeId = place.place_id;
        const savedCode = localStorage.getItem(`code_${placeId}`);

        if (savedCode) {
            // If a code exists, display it
            const content = `
                <div class="info-window">
                    <h3>${place.name}</h3>
                    <p>${place.vicinity}</p>
                    ${place.rating ? `<p>Rating: ${place.rating} ⭐</p>` : ''}
                    <a href="${place.url}" target="_blank">More Info</a>
                    <hr>
                    <p><strong>Code:</strong> ${savedCode}</p>
                </div>
            `;
            infowindow.setContent(content);
            infowindow.open(map, marker);
        } else {
            // If no code, show input form
            const contentDiv = document.createElement('div');
            contentDiv.className = 'info-window';
            contentDiv.innerHTML = `
                <h3>${place.name}</h3>
                <p>${place.vicinity}</p>
                ${place.rating ? `<p>Rating: ${place.rating} ⭐</p>` : ''}
                <a href="${place.url}" target="_blank">More Info</a>
                <hr>
                <label for="codeInput">Enter Code:</label><br>
                <input type="text" id="codeInput" placeholder="Enter code here"><br>
                <button id="saveCodeButton">Save Code</button>
            `;

            infowindow.setContent(contentDiv);
            infowindow.open(map, marker);

            // Add event listener for the save button
            // Use a timeout to ensure the DOM is updated
            setTimeout(() => {
                const saveButton = document.getElementById('saveCodeButton');
                if (saveButton) {
                    saveButton.addEventListener('click', () => {
                        const code = document.getElementById('codeInput').value.trim();
                        if (code) {
                            localStorage.setItem(`code_${placeId}`, code);
                            // Update the info window to display the code
                            const updatedContent = `
                                <div class="info-window">
                                    <h3>${place.name}</h3>
                                    <p>${place.vicinity}</p>
                                    ${place.rating ? `<p>Rating: ${place.rating} ⭐</p>` : ''}
                                    <a href="${place.url}" target="_blank">More Info</a>
                                    <hr>
                                    <p><strong>Code:</strong> ${code}</p>
                                </div>
                            `;
                            infowindow.setContent(updatedContent);
                        } else {
                            alert('Please enter a code.');
                        }
                    });
                }
            }, 100);
        }
    });

    restaurantMarkers.push(marker);
}

// Function to clear all restaurant markers from the map
function clearRestaurantMarkers() {
    for (let i = 0; i < restaurantMarkers.length; i++) {
        restaurantMarkers[i].setMap(null);
    }
    restaurantMarkers = [];
    loadedPlaceIds.clear();
}

// Function to dynamically load the Google Maps API script
function loadGoogleMapsScript() {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

// Assign the initMap function to the global window object
window.initMap = initMap;

// Load the Google Maps script after defining initMap
loadGoogleMapsScript();