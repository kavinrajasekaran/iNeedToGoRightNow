// static/script.js

let map;
let service;
let infowindow;
let bathroomMarkers = [];
let pagination = null;
let currentLocationMarker = null;
let loadedPlaceIds = new Set();
let lastSearchCenter = null;
let currentInfoWindow = null;
let bathroomSideViewOpen = false;
let currentOpenMarker = null;

// Cache for storing fetched codes
const codeCache = new Map();

// API key
const GOOGLE_MAPS_API_KEY = 'AIzaSyAz6i67o6smdKsuGkT7ZhwJY0EcI5pgjPk';

// Minimum zoom level to perform bathroom search
const MIN_ZOOM_LEVEL = 14;

// Thresholds set for minimal API usage
const MIN_DISTANCE_THRESHOLD = 500;
const SEARCH_RADIUS = 1000;

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

    // Add event listener to search for bathrooms when the map becomes idle after movement
    map.addListener("idle", handleMapIdle);
}

// Function to handle map's idle event
function handleMapIdle() {
    // Show or hide the bathrooms as needed
    hideShowBathrooms();
    // Update the sidebar with the closest bathrooms
    updateSidebar();

    const currentCenter = map.getCenter();
    if (lastSearchCenter) {
        const distance = computeDistance(
            lastSearchCenter.lat(),
            lastSearchCenter.lng(),
            currentCenter.lat(),
            currentCenter.lng()
        );
        if (distance < MIN_DISTANCE_THRESHOLD) {
            return; // Skip search if map hasn't moved significantly
        }
    }
    lastSearchCenter = currentCenter;
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
                <h3>You Are Here</h3>
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
        radius: SEARCH_RADIUS,
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

        // Avoid fetching the next page unless explicitly needed
        // if (paginationObj && paginationObj.hasNextPage) {
        //     pagination = paginationObj;
        //     // Add a timeout to fetch the next page of results
        //     setTimeout(() => {
        //         pagination.nextPage();
        //     }, 10);
        // }
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
        getTopCode(place.place_id).then(savedCode => {
            // Show info window with code information
            const content = infoWindowText(marker, savedCode);
            infowindow.setContent(content);
            infowindow.open(map, marker);
            currentInfoWindow = infowindow;

            google.maps.event.addListener(infowindow, "closeclick", () => {
                closeSideView();
            });

            openBathroomSideView(marker.title, marker.vicinity, marker.rating, marker.place_id);

            currentOpenMarker = marker;
        });
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
function updateSidebar() {
    hideShowBathrooms();

    if (bathroomSideViewOpen) {
        return;
    }

    const bathroomList = document.getElementById('bathroomList');
    bathroomList.innerHTML = ''; // Clear existing list

    // Gather bathroom data within current bounds
    const center = map.getCenter();
    const centerLat = center.lat();
    const centerLng = center.lng();

    // Create a list of visible bathrooms
    let visibleBathrooms = bathroomMarkers
        .filter(marker => marker.getVisible())
        .map(marker => {
            const distance = computeDistance(centerLat, centerLng, marker.getPosition().lat(), marker.getPosition().lng());
            return {
                marker: marker,
                name: marker.title,
                vicinity: marker.vicinity,
                rating: marker.rating,
                placeId: marker.place_id,
                distance: distance
            };
        });

    if (visibleBathrooms.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No bathrooms found within the current view.';
        bathroomList.appendChild(li);
        return;
    }

    // For each bathroom, fetch the code
    Promise.all(visibleBathrooms.map(bathroom => {
        return getTopCode(bathroom.placeId).then(code => {
            bathroom.code = code;
            return bathroom;
        });
    })).then(bathroomsWithCodes => {
        // Sort by distance
        bathroomsWithCodes.sort((a, b) => a.distance - b.distance);

        bathroomsWithCodes.forEach(bathroom => {
            const li = document.createElement('li');

            const name = document.createElement('h3');
            name.textContent = bathroom.name;

            const distance = document.createElement('p');
            distance.innerHTML = `<strong>Distance:</strong> ${bathroom.distance.toFixed(0)} meters`;

            const code = document.createElement('p');
            code.innerHTML = `<strong>Latest Code:</strong> ${bathroom.code}`;

            li.appendChild(name);
            li.appendChild(distance);
            li.appendChild(code);

            li.addEventListener('click', () => {
                currentOpenMarker = bathroom.marker;

                openBathroomSideView(bathroom.marker.title, bathroom.vicinity, bathroom.rating, bathroom.placeId);
                
                // Center the map on the marker
                map.setCenter(bathroom.marker.getPosition());
                map.setZoom(16);

                // Open the info window for the selected marker
                const content = infoWindowText(bathroom.marker, bathroom.code);
                infowindow.setContent(content);
                infowindow.open(map, bathroom.marker);
                currentInfoWindow = infowindow;

                google.maps.event.addListener(infowindow, "closeclick", () => {
                    closeSideView();
                });
            });

            bathroomList.appendChild(li);
        });
    }).catch(error => console.error('Error updating sidebar:', error));
}

// Function to get the top code for a given placeId
function getTopCode(placeId) {
    if (codeCache.has(placeId)) {
        return Promise.resolve(codeCache.get(placeId));
    }

    return fetch(`/get_top_code/${placeId}`)
        .then(response => response.json())
        .then(data => {
            const code = data.code || "Unknown";
            codeCache.set(placeId, code);
            return code;
        })
        .catch(error => {
            console.error('Error fetching top code:', error);
            return "Unknown";
        });
}

// Function to create the content for the info window
function infoWindowText(marker, savedCode) {
    let content = `
        <div class="info-window">
            <h3>${marker.title}</h3>
            <p><strong>Address:</strong> ${marker.vicinity}</p>
            ${marker.rating ? `<p><strong>Rating:</strong> ${marker.rating} ⭐</p>` : ''}
    `;

    if (savedCode) {
        content += `<p><strong>Latest Code:</strong> ${savedCode}</p></div>`;
    } else {
        content += `<p><strong>Latest Code:</strong> Unknown</p></div>`;
    }

    return content;
}

function closeSideView() {
    bathroomSideViewOpen = false;
    currentOpenMarker = null;
    // Fetch the rendered template from Flask
    fetch(`/sidebar`)
        .then(response => response.text())
        .then(html => {
            // Replace the content in a container element
            const container = document.getElementById('sidebar');
            container.innerHTML = html;
            updateSidebar();

            if (currentInfoWindow) {
                currentInfoWindow.close();
                currentInfoWindow = null;
            }
        })
        .catch(error => console.error('Error loading side view:', error));
}

// Function to open the bathroom side view
function openBathroomSideView(name, address, rating, placeId) {
    bathroomSideViewOpen = true;
    // Fetch the rendered template from Flask
    fetch(`/bathroom_side_view?name=${encodeURIComponent(name)}&address=${encodeURIComponent(address)}&rating=${encodeURIComponent(rating)}&placeId=${placeId}`)
        .then(response => response.text())
        .then(html => {
            // Replace the content in a container element
            const container = document.getElementById('sidebar');
            container.innerHTML = html;

            // Add event listeners for the close button
            document.getElementById('close-side-view').addEventListener('click', closeSideView);

            // Add event listeners for the add comment and add code forms
            const addCommentForm = document.getElementById('addCommentForm');
            if (addCommentForm) {
                addCommentForm.addEventListener('submit', function(event) {
                    event.preventDefault();
                    submitComment(placeId);
                });
            }

            const addCodeForm = document.getElementById('addCodeForm');
            if (addCodeForm) {
                addCodeForm.addEventListener('submit', function(event) {
                    event.preventDefault();
                    submitCode(placeId);
                });
            }

            // Add event listeners for delete buttons
            addDeleteButtonListeners();
        })
        .catch(error => console.error('Error loading side view:', error));
}

// Function to add event listeners for delete buttons
function addDeleteButtonListeners() {
    // Delete Comment Buttons
    const deleteCommentButtons = document.querySelectorAll('.delete-comment-button');
    deleteCommentButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent triggering parent click events
            const commentId = button.getAttribute('data-comment-id');
            if (confirm('Are you sure you want to delete this comment?')) {
                deleteComment(commentId);
            }
        });
    });

    // Delete Code Buttons
    const deleteCodeButtons = document.querySelectorAll('.delete-code-button');
    deleteCodeButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent triggering parent click events
            const codeId = button.getAttribute('data-code-id');
            if (confirm('Are you sure you want to delete this bathroom code?')) {
                deleteCode(codeId);
            }
        });
    });
}

// Function to submit a new comment via AJAX
function submitComment(placeId) {
    const commentInput = document.getElementById('comment');
    const content = commentInput.value.trim();

    if (!content) {
        alert('Comment cannot be empty.');
        return;
    }

    fetch('/add_comment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ place_id: placeId, content: content })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Reload the side view to show the new comment
            openBathroomSideView(currentOpenMarker.title, currentOpenMarker.vicinity, currentOpenMarker.rating, currentOpenMarker.place_id);
        } else {
            alert(data.message);
        }
    })
    .catch(error => console.error('Error submitting comment:', error));
}

// Function to submit a new bathroom code via AJAX
function submitCode(placeId) {
    const codeInput = document.getElementById('code');

    const code = codeInput.value.trim();

    if (!code) {
        alert('Code cannot be empty.');
        return;
    }

    fetch('/add_code', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ place_id: placeId, code: code })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update the codeCache with the new code
            codeCache.set(placeId, code);

            // Reload the side view to show the new code
            openBathroomSideView(currentOpenMarker.title, currentOpenMarker.vicinity, currentOpenMarker.rating, currentOpenMarker.place_id);

            // Update the sidebar to reflect the new code
            updateSidebar();

            // Update the info window if it's open for this marker
            if (currentInfoWindow && currentOpenMarker && currentOpenMarker.place_id === placeId) {
                const content = infoWindowText(currentOpenMarker, code);
                infowindow.setContent(content);
            }

        } else {
            alert(data.message);
        }
    })
    .catch(error => console.error('Error submitting bathroom code:', error));
}

// Function to delete a comment via AJAX
function deleteComment(commentId) {
    fetch('/delete_comment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comment_id: commentId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Remove the comment from the DOM
            const commentElement = document.getElementById(`comment-${commentId}`);
            if (commentElement) {
                commentElement.remove();
            }
        } else {
            alert(data.message);
        }
    })
    .catch(error => console.error('Error deleting comment:', error));
}

// Function to delete a bathroom code via AJAX
function deleteCode(codeId) {
    fetch('/delete_code', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code_id: codeId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Remove the code from the DOM
            const codeElement = document.getElementById(`code-${codeId}`);
            if (codeElement) {
                codeElement.remove();
            }

            // Update the codeCache if necessary
            // Optionally, you might want to fetch the latest code again
            // For simplicity, we'll set it to "Unknown" here
            const placeId = currentOpenMarker.place_id;
            codeCache.set(placeId, "Unknown");

            // Update the info window if it's open for this marker
            if (currentInfoWindow && currentOpenMarker && currentOpenMarker.place_id === placeId) {
                const content = infoWindowText(currentOpenMarker, "Unknown");
                infowindow.setContent(content);
            }

            // Update the sidebar to reflect the deletion
            updateSidebar();
        } else {
            alert(data.message);
        }
    })
    .catch(error => console.error('Error deleting bathroom code:', error));
}
