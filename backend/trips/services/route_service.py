import requests
import math
import logging

logger = logging.getLogger(__name__)

# Known US city coordinate cache for instant fallback & offline stability
CITY_CACHE = {
    "dallas, tx": (32.7767, -96.7970, "Dallas, TX"),
    "dallas": (32.7767, -96.7970, "Dallas, TX"),
    "houston, tx": (29.7604, -95.3698, "Houston, TX"),
    "houston": (29.7604, -95.3698, "Houston, TX"),
    "atlanta, ga": (33.7490, -84.3880, "Atlanta, GA"),
    "atlanta": (33.7490, -84.3880, "Atlanta, GA"),
    "chicago, il": (41.8781, -87.6298, "Chicago, IL"),
    "chicago": (41.8781, -87.6298, "Chicago, IL"),
    "los angeles, ca": (34.0522, -118.2437, "Los Angeles, CA"),
    "los angeles": (34.0522, -118.2437, "Los Angeles, CA"),
    "new york, ny": (40.7128, -74.0060, "New York, NY"),
    "new york": (40.7128, -74.0060, "New York, NY"),
    "phoenix, az": (33.4484, -112.0740, "Phoenix, AZ"),
    "denver, co": (39.7392, -104.9903, "Denver, CO"),
    "seattle, wa": (47.6062, -122.3321, "Seattle, WA"),
    "miami, fl": (25.7617, -80.1918, "Miami, FL"),
    "st. louis, mo": (38.6270, -90.1994, "St. Louis, MO"),
    "saint louis, mo": (38.6270, -90.1994, "St. Louis, MO"),
    "kansas city, mo": (39.0997, -94.5786, "Kansas City, MO"),
    "nashville, tn": (36.1627, -86.7816, "Nashville, TN"),
    "memphis, tn": (35.1495, -90.0490, "Memphis, TN"),
    "indianapolis, in": (39.7684, -86.1581, "Indianapolis, IN"),
}

class RouteService:
    @staticmethod
    def geocode(location_str: str) -> dict:
        """
        Geocode a location string into lat, lng, and display_name.
        Uses Nominatim API with fallback to local city dictionary.
        """
        clean_name = location_str.strip().lower()
        if clean_name in CITY_CACHE:
            lat, lng, name = CITY_CACHE[clean_name]
            return {"lat": lat, "lng": lng, "display_name": name}

        # Try Nominatim OSM API
        try:
            url = "https://nominatim.openstreetmap.org/search"
            headers = {"User-Agent": "ELD-Trip-Planner/1.0"}
            params = {"q": location_str, "format": "json", "limit": 1}
            res = requests.get(url, headers=headers, params=params, timeout=5)
            if res.status_code == 200 and res.json():
                item = res.json()[0]
                return {
                    "lat": float(item["lat"]),
                    "lng": float(item["lon"]),
                    "display_name": item.get("display_name", location_str)
                }
        except Exception as e:
            logger.warning(f"Geocoding failed for {location_str}: {e}")

        # Partial match fallback
        for key, val in CITY_CACHE.items():
            if key in clean_name or clean_name in key:
                lat, lng, name = val
                return {"lat": lat, "lng": lng, "display_name": location_str}

        # Last resort fallback if completely unknown string
        return {"lat": 39.8283, "lng": -98.5795, "display_name": location_str}

    @staticmethod
    def haversine_distance_miles(lat1, lon1, lat2, lon2):
        """Calculate straight-line distance in miles between two coordinates."""
        R = 3958.8  # Earth radius in miles
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lon2 - lon1)
        a = (math.sin(dLat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dLon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    @classmethod
    def point_at_distance(cls, geometry, target_miles, total_miles=None):
        """
        Interpolate the (lat, lng) at `target_miles` along a routed polyline.

        The HOS engine reasons in odometer miles, but the geometry is a list of
        coordinates whose own haversine length differs from the road distance
        (an OSRM route is longer than the straight-line sum of its vertices), so
        the target is rescaled onto the geometry before it is walked.

        Returns None when there is no geometry to place a point on.
        """
        if not geometry:
            return None
        if len(geometry) == 1:
            return (geometry[0][0], geometry[0][1])

        leg_lengths = []
        geometry_miles = 0.0
        for i in range(len(geometry) - 1):
            lat1, lon1 = geometry[i][0], geometry[i][1]
            lat2, lon2 = geometry[i + 1][0], geometry[i + 1][1]
            leg = cls.haversine_distance_miles(lat1, lon1, lat2, lon2)
            leg_lengths.append(leg)
            geometry_miles += leg

        if geometry_miles <= 0:
            return (geometry[0][0], geometry[0][1])

        effective = max(0.0, float(target_miles or 0.0))
        if total_miles and total_miles > 0:
            effective *= geometry_miles / float(total_miles)
        if effective >= geometry_miles:
            return (geometry[-1][0], geometry[-1][1])

        travelled = 0.0
        for i, leg in enumerate(leg_lengths):
            if leg <= 0:
                continue
            if travelled + leg >= effective:
                t = (effective - travelled) / leg
                lat1, lon1 = geometry[i][0], geometry[i][1]
                lat2, lon2 = geometry[i + 1][0], geometry[i + 1][1]
                return (lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t)
            travelled += leg

        return (geometry[-1][0], geometry[-1][1])

    @classmethod
    def get_route(cls, waypoints: list) -> dict:
        """
        Calculate route between multiple waypoints [(lat, lng, name), ...].
        Returns total distance (miles), driving time (hours), geometry points, and legs.
        """
        if len(waypoints) < 2:
            raise ValueError("At least 2 waypoints required for routing")

        # Try OSRM demo API
        try:
            coord_str = ";".join([f"{lon},{lat}" for lat, lon, name in waypoints])
            url = f"http://router.project-osrm.org/route/v1/driving/{coord_str}?overview=full&geometries=geojson&steps=true"
            headers = {"User-Agent": "ELD-Trip-Planner/1.0"}
            res = requests.get(url, headers=headers, timeout=6)
            if res.status_code == 200:
                data = res.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    route = data["routes"][0]
                    dist_meters = route["distance"]
                    duration_sec = route["duration"]
                    geometry = route["geometry"]["coordinates"]  # [[lon, lat], ...]

                    # Convert coordinates to [[lat, lon], ...]
                    polyline_coords = [[coord[1], coord[0]] for coord in geometry]
                    dist_miles = round(dist_meters * 0.000621371, 1)
                    driving_hours = round(duration_sec / 3600.0, 2)

                    return {
                        "total_distance_miles": dist_miles,
                        "total_driving_hours": driving_hours,
                        "average_speed_mph": round(dist_miles / max(0.1, driving_hours), 1),
                        "geometry": polyline_coords,
                        "source": "OSRM"
                    }
        except Exception as e:
            logger.warning(f"OSRM Routing failed: {e}. Falling back to highway simulation.")

        # Fallback highway distance estimation (Haversine * 1.25 road winding factor @ 55mph average truck speed)
        total_miles = 0.0
        geometry_points = []

        for i in range(len(waypoints) - 1):
            lat1, lon1, name1 = waypoints[i]
            lat2, lon2, name2 = waypoints[i + 1]

            straight_miles = cls.haversine_distance_miles(lat1, lon1, lat2, lon2)
            road_miles = straight_miles * 1.25  # Accounting for highway routes
            total_miles += road_miles

            # Generate intermediate polyline interpolation points
            steps = max(10, int(road_miles / 20))
            for s in range(steps + 1):
                t = s / steps
                curr_lat = lat1 + (lat2 - lat1) * t
                curr_lon = lon1 + (lon2 - lon1) * t
                geometry_points.append([round(curr_lat, 5), round(curr_lon, 5)])

        total_miles = round(total_miles, 1)
        driving_hours = round(total_miles / 55.0, 2)  # Average 55 mph truck speed

        return {
            "total_distance_miles": total_miles,
            "total_driving_hours": driving_hours,
            "average_speed_mph": 55.0,
            "geometry": geometry_points,
            "source": "HaversineHighwayModel"
        }
