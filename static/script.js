// static/script.js

let map;
let service;
let infowindow;
let bathroomMarkers = [];
let pagination = null;
let currentLocationMarker = null;
let loadedPlaceIds = new Set();
let selectedMarker = null; // Global variable to track the selected marker

// API key
const GOOGLE_MAPS_API_KEY = 'AIzaSyDBNdOp0vtpueqn7jGnt5oKJaQaE5INf68';

// Minimum zoom level to perform bathroom search
const MIN_ZOOM_LEVEL = 13;

// Default Location (San Francisco Bay Area)
const DEFAULT_LOCATION = { lat: 37.7749, lng: -122.4194 };

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

    // Perform an initial bathroom search
    searchBathrooms();

    // Add event listener to search for bathrooms when the map becomes idle after movement
    map.addListener("idle", handleMapIdle);
}

// Function to handle map's idle event
function handleMapIdle() {
    // Show or hide the bathrooms as needed
    hideShowBathrooms();
    // Update the sidebar with the closest bathrooms
    updateSidebar();
    // Perform a bathroom search
    searchBathrooms();
}

function hideShowBathrooms() {
    const currentZoom = map.getZoom();

    if (currentZoom >= MIN_ZOOM_LEVEL) {
        // Show all bathroom markers within the current bounds
        bathroomMarkers.forEach(marker => {
            if (isMarkerInBounds(marker)) {
                marker.setVisible(true);
            } else {
                marker.setVisible(false);
            }
        });
    } else {
        // Hide all bathroom markers
        bathroomMarkers.forEach(marker => marker.setVisible(false));
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

// Function to search for bathrooms using PlacesService
function searchBathrooms() {
    // Check if the current zoom level is sufficient
    if (map.getZoom() < MIN_ZOOM_LEVEL) {
        // Do not perform search if zoomed out too far
        return;
    }

    const request = {
        location: map.getCenter(),
        radius: '5000',
        type: 'establishment',
        keyword: 'bathroom'
    };

    service = new google.maps.places.PlacesService(map);
    service.nearbySearch(request, (results, status, paginationObj) => {
        callback(results, status, paginationObj);
    });
}

// Callback function for PlacesService.nearbySearch
function callback(results, status, paginationObj) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
        for (let i = 0; i < results.length; i++) {
            createBathroomMarker(results[i]);
        }

        if (paginationObj && paginationObj.hasNextPage) {
            pagination = paginationObj;
            // Add a timeout to fetch the next page of results
            setTimeout(() => {
                pagination.nextPage();
            }, 10);
        }
    } else if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        // Only log for actual errors, not for zero results
        console.error('Places service was not successful for the following reason: ' + status);
    }
    updateSidebar();
}

// Function to create a marker for a bathroom
function createBathroomMarker(place) {
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

    // Attach the place_id to the marker for later reference
    marker.place_id = place.place_id;
    marker.vicinity = place.vicinity || '';
    marker.rating = place.rating || null;
    marker.url = place.url || '';

    // Initially set the marker's visibility based on current zoom level
    marker.setVisible(map.getZoom() >= MIN_ZOOM_LEVEL);

    // Marker click event
    marker.addListener("click", () => {
        selectedMarker = marker; 
        updateSidebar(); // Refresh sidebar to show selected at top with expanded view

        // Show info window if code is known
        const placeId = marker.place_id;
        const savedCode = localStorage.getItem(`code_${placeId}`);

        let content = `
            <div class="info-window">
                <h3>${marker.title}</h3>
                <p>${marker.vicinity}</p>
                ${marker.rating ? `<p>Rating: ${marker.rating} ⭐</p>` : ''}
                ${marker.url ? `<a href="${marker.url}" target="_blank">More Info</a>` : ''}
                <hr>
        `;

        if (savedCode) {
            content += `<p><strong>Code:</strong> ${savedCode}</p></div>`;
        } else {
            content += `
                <label for="codeInput">Enter Code:</label><br>
                <input type="text" id="codeInput" placeholder="Enter code here"><br>
                <button id="saveCodeButton">Save Code</button>
            </div>`;
        }

        infowindow.setContent(content);
        infowindow.open(map, marker);

        // Add event listener for saving code in the info window
        setTimeout(() => {
            const saveButton = document.getElementById('saveCodeButton');
            if (saveButton) {
                saveButton.addEventListener('click', () => {
                    const code = document.getElementById('codeInput').value.trim();
                    if (code) {
                        localStorage.setItem(`code_${placeId}`, code);
                        // Update info window
                        const updatedContent = `
                            <div class="info-window">
                                <h3>${marker.title}</h3>
                                <p>${marker.vicinity}</p>
                                ${marker.rating ? `<p>Rating: ${marker.rating} ⭐</p>` : ''}
                                ${marker.url ? `<a href="${marker.url}" target="_blank">More Info</a>` : ''}
                                <hr>
                                <p><strong>Code:</strong> ${code}</p>
                            </div>
                        `;
                        infowindow.setContent(updatedContent);
                        updateSidebar(); // Update sidebar as well
                    } else {
                        alert('Please enter a code.');
                    }
                });
            }
        }, 100);
    });

    bathroomMarkers.push(marker);
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

// Function to compute the distance between two points in meters
function computeDistance(lat1, lng1, lat2, lng2) {
    function toRad(x) {
        return x * Math.PI / 180;
    }

    const R = 6378137; // Earth’s mean radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLong = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLong / 2) * Math.sin(dLong / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d; // returns the distance in meters
}

// Function to check if a marker is within the current map bounds
function isMarkerInBounds(marker) {
    return map.getBounds().contains(marker.getPosition());
}

// Function to update the sidebar with the closest bathrooms and their codes
// If a marker is selected, show it at the top with an expanded view allowing code editing
function updateSidebar() {
    hideShowBathrooms();
    const bathroomList = document.getElementById('bathroomList');
    bathroomList.innerHTML = ''; // Clear existing list

    // Gather bathroom data within current bounds
    const center = map.getCenter();
    const centerLat = center.lat();
    const centerLng = center.lng();

    // Create a list of visible bathrooms (excluding the selected one if it's visible, because we'll handle selected separately)
    let visibleBathrooms = bathroomMarkers
        .filter(marker => marker.getVisible() && marker !== selectedMarker)
        .map(marker => {
            const distance = computeDistance(centerLat, centerLng, marker.getPosition().lat(), marker.getPosition().lng());
            const code = localStorage.getItem(`code_${marker.place_id}`) || 'N/A';
            return {
                marker: marker,
                name: marker.title,
                code: code,
                distance: distance
            };
        });

    // Sort by distance
    visibleBathrooms.sort((a, b) => a.distance - b.distance);

    // If we have a selected marker, we will show it at the top
    if (selectedMarker) {
        const selectedCode = localStorage.getItem(`code_${selectedMarker.place_id}`);
        const selectedItem = document.createElement('li');
        selectedItem.classList.add('expanded-item'); // Add a class to style expanded section

        // Build the expanded HTML
        let expandedHTML = `
            <h3>${selectedMarker.title}</h3>
            <p><strong>Code:</strong> ${selectedCode ? selectedCode : 'N/A'}</p>
        `;

        if (selectedCode) {
            // Show current code and an Edit button
            expandedHTML += `
                <button class="edit-code-btn">Edit Code</button>
                <div class="edit-code-section" style="display:none;">
                    <label for="sidebarCodeInput">Enter New Code:</label><br>
                    <input type="text" id="sidebarCodeInput" placeholder="Enter code here"><br>
                    <button class="save-sidebar-code-btn">Save Code</button>
                </div>
            `;
        } else {
            // No code yet, show input directly
            expandedHTML += `
                <div class="edit-code-section">
                    <label for="sidebarCodeInput">Enter Code:</label><br>
                    <input type="text" id="sidebarCodeInput" placeholder="Enter code here"><br>
                    <button class="save-sidebar-code-btn">Save Code</button>
                </div>
            `;
        }

        selectedItem.innerHTML = expandedHTML;
        bathroomList.appendChild(selectedItem);

        // Add event listeners for editing/saving code in the sidebar
        const editBtn = selectedItem.querySelector('.edit-code-btn');
        const editSection = selectedItem.querySelector('.edit-code-section');
        const saveBtn = selectedItem.querySelector('.save-sidebar-code-btn');

        if (editBtn) {
            editBtn.addEventListener('click', () => {
                editSection.style.display = 'block';
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const newCode = selectedItem.querySelector('#sidebarCodeInput').value.trim();
                if (newCode) {
                    localStorage.setItem(`code_${selectedMarker.place_id}`, newCode);
                    // Update the displayed code
                    const updatedHTML = `
                        <h3>${selectedMarker.title}</h3>
                        <p><strong>Code:</strong> ${newCode}</p>
                        <button class="edit-code-btn">Edit Code</button>
                        <div class="edit-code-section" style="display:none;">
                            <label for="sidebarCodeInput">Enter New Code:</label><br>
                            <input type="text" id="sidebarCodeInput" placeholder="Enter code here"><br>
                            <button class="save-sidebar-code-btn">Save Code</button>
                        </div>
                    `;
                    selectedItem.innerHTML = updatedHTML;

                    // Re-attach event listeners after updating innerHTML
                    const newEditBtn = selectedItem.querySelector('.edit-code-btn');
                    const newEditSection = selectedItem.querySelector('.edit-code-section');
                    const newSaveBtn = selectedItem.querySelector('.save-sidebar-code-btn');

                    newEditBtn.addEventListener('click', () => {
                        newEditSection.style.display = 'block';
                    });

                    newSaveBtn.addEventListener('click', () => {
                        const newerCode = selectedItem.querySelector('#sidebarCodeInput').value.trim();
                        if (newerCode) {
                            localStorage.setItem(`code_${selectedMarker.place_id}`, newerCode);
                            // Update again
                            selectedItem.innerHTML = `
                                <h3>${selectedMarker.title}</h3>
                                <p><strong>Code:</strong> ${newerCode}</p>
                                <button class="edit-code-btn">Edit Code</button>
                                <div class="edit-code-section" style="display:none;">
                                    <label for="sidebarCodeInput">Enter New Code:</label><br>
                                    <input type="text" id="sidebarCodeInput" placeholder="Enter code here"><br>
                                    <button class="save-sidebar-code-btn">Save Code</button>
                                </div>
                            `;
                            // Re-bind if needed, but at this point we have a stable structure.
                            // In a real scenario, you might refactor to a function for DRYness.
                        } else {
                            alert('Please enter a code.');
                        }
                    });
                } else {
                    alert('Please enter a code.');
                }
            });
        }
    }

    // Add the rest of the bathrooms after the selected one (if any)
    if (visibleBathrooms.length === 0 && !selectedMarker) {
        const li = document.createElement('li');
        li.textContent = 'No bathrooms found within the current view.';
        bathroomList.appendChild(li);
        return;
    }

    visibleBathrooms.forEach(bathroom => {
        const li = document.createElement('li');
        const name = document.createElement('h3');
        name.textContent = bathroom.name;

        const code = document.createElement('p');
        code.innerHTML = `<strong>Code:</strong> <span class="code">${bathroom.code}</span>`;

        li.appendChild(name);
        li.appendChild(code);
        bathroomList.appendChild(li);
    });
}
