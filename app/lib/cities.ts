// app/lib/cities.ts
export type City = { name: string; lat: number; lon: number };

export const CITIES: City[] = [
  // Alabama
  { name: "Birmingham, AL", lat: 33.5186, lon: -86.8104 },

  // Alaska
  { name: "Anchorage, AK", lat: 61.2181, lon: -149.9003 },

  // Arizona
  { name: "Phoenix, AZ", lat: 33.4484, lon: -112.0740 },
  { name: "Tucson, AZ", lat: 32.2226, lon: -110.9747 },

  // Arkansas
  { name: "Little Rock, AR", lat: 34.7465, lon: -92.2896 },

  // California (multiple)
  { name: "Los Angeles, CA", lat: 34.0522, lon: -118.2437 },
  { name: "San Diego, CA", lat: 32.7157, lon: -117.1611 },
  { name: "San Jose, CA", lat: 37.3382, lon: -121.8863 },
  { name: "San Francisco, CA", lat: 37.7749, lon: -122.4194 },
  { name: "Sacramento, CA", lat: 38.5816, lon: -121.4944 },

  // Colorado
  { name: "Denver, CO", lat: 39.7392, lon: -104.9903 },
  { name: "Colorado Springs, CO", lat: 38.8339, lon: -104.8214 },

  // Connecticut
  { name: "Bridgeport, CT", lat: 41.1865, lon: -73.1952 },

  // Delaware
  { name: "Wilmington, DE", lat: 39.7391, lon: -75.5398 },

  // Florida (multiple)
  { name: "Miami, FL", lat: 25.7617, lon: -80.1918 },
  { name: "Orlando, FL", lat: 28.5383, lon: -81.3792 },
  { name: "Tampa, FL", lat: 27.9506, lon: -82.4572 },
  { name: "Jacksonville, FL", lat: 30.3322, lon: -81.6557 },

  // Georgia
  { name: "Atlanta, GA", lat: 33.7490, lon: -84.3880 },

  // Hawaii
  { name: "Honolulu, HI", lat: 21.3069, lon: -157.8583 },

  // Idaho
  { name: "Boise, ID", lat: 43.6150, lon: -116.2023 },

  // Illinois (multiple)
  { name: "Chicago, IL", lat: 41.8781, lon: -87.6298 },

  // Indiana
  { name: "Indianapolis, IN", lat: 39.7684, lon: -86.1581 },

  // Iowa
  { name: "Des Moines, IA", lat: 41.5868, lon: -93.6250 },

  // Kansas
  { name: "Wichita, KS", lat: 37.6872, lon: -97.3301 },

  // Kentucky
  { name: "Louisville, KY", lat: 38.2527, lon: -85.7585 },

  // Louisiana
  { name: "New Orleans, LA", lat: 29.9511, lon: -90.0715 },

  // Maine
  { name: "Portland, ME", lat: 43.6591, lon: -70.2568 },

  // Maryland
  { name: "Baltimore, MD", lat: 39.2904, lon: -76.6122 },

  // Massachusetts
  { name: "Boston, MA", lat: 42.3601, lon: -71.0589 },

  // Michigan
  { name: "Detroit, MI", lat: 42.3314, lon: -83.0458 },
  { name: "Grand Rapids, MI", lat: 42.9634, lon: -85.6681 },

  // Minnesota
  { name: "Minneapolis, MN", lat: 44.9778, lon: -93.2650 },

  // Mississippi
  { name: "Jackson, MS", lat: 32.2988, lon: -90.1848 },

  // Missouri
  { name: "St. Louis, MO", lat: 38.6270, lon: -90.1994 },
  { name: "Kansas City, MO", lat: 39.0997, lon: -94.5786 },

  // Montana
  { name: "Billings, MT", lat: 45.7833, lon: -108.5007 },

  // Nebraska
  { name: "Omaha, NE", lat: 41.2565, lon: -95.9345 },

  // Nevada
  { name: "Las Vegas, NV", lat: 36.1699, lon: -115.1398 },
  { name: "Reno, NV", lat: 39.5296, lon: -119.8138 },

  // New Hampshire
  { name: "Manchester, NH", lat: 42.9956, lon: -71.4548 },

  // New Jersey
  { name: "Newark, NJ", lat: 40.7357, lon: -74.1724 },
  { name: "Jersey City, NJ", lat: 40.7178, lon: -74.0431 },

  // New Mexico
  { name: "Albuquerque, NM", lat: 35.0844, lon: -106.6504 },

  // New York
  { name: "New York, NY", lat: 40.7128, lon: -74.0060 },
  { name: "Buffalo, NY", lat: 42.8864, lon: -78.8784 },
  { name: "Rochester, NY", lat: 43.1566, lon: -77.6088 },

  // North Carolina
  { name: "Charlotte, NC", lat: 35.2271, lon: -80.8431 },
  { name: "Raleigh, NC", lat: 35.7796, lon: -78.6382 },

  // North Dakota
  { name: "Fargo, ND", lat: 46.8772, lon: -96.7898 },

  // Ohio
  { name: "Columbus, OH", lat: 39.9612, lon: -82.9988 },
  { name: "Cleveland, OH", lat: 41.4993, lon: -81.6944 },

  // Oklahoma
  { name: "Oklahoma City, OK", lat: 35.4676, lon: -97.5164 },
  { name: "Tulsa, OK", lat: 36.1540, lon: -95.9928 },

  // Oregon
  { name: "Portland, OR", lat: 45.5152, lon: -122.6784 },

  // Pennsylvania
  { name: "Philadelphia, PA", lat: 39.9526, lon: -75.1652 },
  { name: "Pittsburgh, PA", lat: 40.4406, lon: -79.9959 },

  // Rhode Island
  { name: "Providence, RI", lat: 41.8240, lon: -71.4128 },

  // South Carolina
  { name: "Charleston, SC", lat: 32.7765, lon: -79.9311 },

  // South Dakota
  { name: "Sioux Falls, SD", lat: 43.5446, lon: -96.7311 },

  // Tennessee
  { name: "Nashville, TN", lat: 36.1627, lon: -86.7816 },
  { name: "Memphis, TN", lat: 35.1495, lon: -90.0490 },

  // Texas
  { name: "Houston, TX", lat: 29.7604, lon: -95.3698 },
  { name: "Dallas, TX", lat: 32.7767, lon: -96.7970 },
  { name: "Austin, TX", lat: 30.2672, lon: -97.7431 },
  { name: "San Antonio, TX", lat: 29.4241, lon: -98.4936 },

  // Utah
  { name: "Salt Lake City, UT", lat: 40.7608, lon: -111.8910 },

  // Vermont
  { name: "Burlington, VT", lat: 44.4759, lon: -73.2121 },

  // Virginia
  { name: "Virginia Beach, VA", lat: 36.8529, lon: -75.9780 },
  { name: "Richmond, VA", lat: 37.5407, lon: -77.4360 },

  // Washington (multiple)
  { name: "Seattle, WA", lat: 47.6062, lon: -122.3321 },
  { name: "Spokane, WA", lat: 47.6588, lon: -117.4260 },

  // ✅ Added
  { name: "Snoqualmie, WA", lat: 47.5287, lon: -121.8254 },
  { name: "Vashon, WA", lat: 47.4484, lon: -122.4590 },
  { name: "Jonny's NW Outpost", lat: 47.42316442230221, lon: -122.43188041634352 },
  { name: "Kathi's Bungalow", lat: 47.451596801664174, lon: -122.51064038791561 },
  { name: "Vanilla Lane", lat: 47.4482, lon: -122.4563 },

  // West Virginia
  { name: "Charleston, WV", lat: 38.3498, lon: -81.6326 },

  // Wisconsin
  { name: "Milwaukee, WI", lat: 43.0389, lon: -87.9065 },
  { name: "Madison, WI", lat: 43.0731, lon: -89.4012 },

  // Wyoming
  { name: "Casper, WY", lat: 42.8501, lon: -106.3252 },
];