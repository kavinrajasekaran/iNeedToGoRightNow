// script.js
let map;
let service;
let infowindow;
let restaurantMarkers = [];

// Initialize and add the map
function initMap() {
    // Location of Uluru
    const uluru = { lat: -25.363, lng: 131.044 };

    // Create the map centered on Uluru
    map = new google.maps.Map(document.getElementById("map"), {
        center: uluru,
        zoom: 14,
    });

    // Create an InfoWindow instance
    infowindow = new google.maps.InfoWindow();

    // Add a marker for Uluru
    const uluruMarker = new google.maps.Marker({
        position: uluru,
        map: map,
        title: "Uluru",
        icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
        }
    });

    uluruMarker.addListener("click", () => {
        const content = `
            <div class="info-window">
                <h2>Uluru</h2>
                <p>
                    <b>Uluru</b>, also referred to as <b>Ayers Rock</b>, is a large
                    sandstone rock formation in the southern part of the
                    Northern Territory, central Australia. It lies 335&#160;km (208&#160;mi)
                    southwest of the nearest large town, Alice Springs; 450&#160;km
                    (280&#160;mi) by road. Kata Tjuta and Uluru are the two major
                    features of the Uluru-Kata Tjuta National Park. Uluru is
                    sacred to the Pitjantjatjara and Yankunytjatjara, the
                    Aboriginal people of the area. It has many springs, waterholes,
                    rock caves, and ancient paintings. Uluru is listed as a World
                    Heritage Site.
                </p>
                <p>
                    Attribution: Uluru,
                    <a href="https://en.wikipedia.org/wiki/Uluru" target="_blank">
                        https://en.wikipedia.org/wiki/Uluru
                    </a>
                    (last visited June 22, 2009).
                </p>
            </div>`;
        infowindow.setContent(content);
        infowindow.open(map, uluruMarker);
    });

    // Setup POI control button
    setupPOIControls();
}

// Setup POI Control Button
function setupPOIControls() {
    const poiControlsDiv = document.createElement("div");
    poiControlsDiv.id = "poiControls";
    poiControlsDiv.innerHTML = `
        <button id="searchRestaurants">Search Restaurants</button>
    `;
    document.body.appendChild(poiControlsDiv);

    // Add event listener for the button
    document.getElementById("searchRestaurants").addEventListener("click", searchRestaurants);
}

// Function to search for restaurants using PlacesService
function searchRestaurants() {
    // Show loading spinner
    showLoading(true);

    // Clear existing restaurant markers
    clearRestaurantMarkers();

    const request = {
        location: map.getCenter(),
        radius: '1500', // in meters
        type: ['restaurant']
    };

    service = new google.maps.places.PlacesService(map);
    service.nearbySearch(request, callback);
}

// Callback function for PlacesService.nearbySearch
function callback(results, status) {
    // Hide loading spinner
    showLoading(false);

    if (status === google.maps.places.PlacesServiceStatus.OK) {
        for (let i = 0; i < results.length; i++) {
            createRestaurantMarker(results[i]);
        }
    } else {
        alert('Places service was not successful for the following reason: ' + status);
    }
}

// Function to create a marker for a restaurant
function createRestaurantMarker(place) {
    if (!place.geometry || !place.geometry.location) return;

    const marker = new google.maps.Marker({
        map,
        position: place.geometry.location,
        title: place.name,
        icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
        }
    });

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
                document.getElementById('saveCodeButton').addEventListener('click', () => {
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
}

// Function to show or hide the loading spinner
function showLoading(isLoading) {
    let loadingDiv = document.getElementById("loading");
    if (!loadingDiv) {
        loadingDiv = document.createElement("div");
        loadingDiv.id = "loading";
        loadingDiv.innerHTML = `<div class="spinner"></div>`;
        document.body.appendChild(loadingDiv);
    }
    loadingDiv.style.display = isLoading ? "block" : "none";
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
