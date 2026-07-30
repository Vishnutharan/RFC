// 5 km Delivery Radius Calculator for RFC Watford (WD17 4HZ)

// Base coordinates for RFC Watford (119 Courtlands Drive, Watford WD17 4HZ)
const STORE_LOCATION = { lat: 51.6742, lng: -0.4085, postcode: 'WD17 4HZ' };

// Known postcode prefixes around Watford with estimated distance (in km) from store
const POSTCODE_DISTANCES = {
  // Within Watford (<= 5 km)
  'WD17': 0.8, // Town centre, Nascot Wood, Courtlands Drive (Store location)
  'WD24': 1.4, // North Watford, St Albans Road
  'WD18': 2.2, // West Watford, Holywell
  'WD25': 3.1, // Garston, Leavesden
  'WD19': 4.3, // Oxhey, South Watford

  // Border areas (> 5 km)
  'WD3': 6.5,  // Rickmansworth, Croxley Green
  'WD4': 7.2,  // Kings Langley
  'WD5': 5.8,  // Abbots Langley
  'WD6': 10.5, // Borehamwood
  'WD7': 9.8,  // Radlett
  'HA5': 7.5,  // Pinner
  'HA6': 8.2,  // Northwood
  'AL2': 11.0, // Bricket Wood / St Albans
};

/**
 * Calculates delivery eligibility and distance for a given UK postcode.
 * @param {string} userPostcode - The postcode entered by the customer.
 * @returns {object} { isEligible, distanceKm, maxRadiusKm: 5.0, fee: 0, reason: string }
 */
export function checkDeliveryEligibility(userPostcode) {
  if (!userPostcode || typeof userPostcode !== 'string') {
    return {
      isEligible: false,
      distanceKm: 0,
      maxRadiusKm: 5.0,
      fee: 0,
      reason: 'Please enter a valid UK postcode.'
    };
  }

  const clean = userPostcode.trim().toUpperCase().replace(/\s+/g, '');
  
  if (clean.length < 3) {
    return {
      isEligible: false,
      distanceKm: 0,
      maxRadiusKm: 5.0,
      fee: 0,
      reason: 'Please enter a complete postcode (e.g. WD24 6RU).'
    };
  }

  // Extract outward code (e.g. 'WD24' from 'WD246RU')
  let outward = clean.slice(0, clean.length - 3);
  if (clean.length <= 4) outward = clean;

  let distanceKm = POSTCODE_DISTANCES[outward];

  // If unknown non-WD postcode, estimate distance based on area prefix
  if (distanceKm === undefined) {
    if (clean.startsWith('WD')) {
      distanceKm = 5.8; // default outer WD
    } else {
      distanceKm = 12.5; // Non-Watford area (London/Herts)
    }
  }

  const maxRadiusKm = 5.0;
  const isEligible = distanceKm <= maxRadiusKm;

  if (isEligible) {
    return {
      isEligible: true,
      distanceKm,
      maxRadiusKm,
      fee: 0.00, // FREE DELIVERY within 5 km!
      reason: `📍 ${distanceKm.toFixed(1)} km from store — Eligible for FREE Delivery! 🎉`
    };
  } else {
    return {
      isEligible: false,
      distanceKm,
      maxRadiusKm,
      fee: null,
      reason: `⚠️ Your address (${distanceKm.toFixed(1)} km away) is outside our 5 km delivery radius. Delivery is unavailable. Please select Store Collection.`
    };
  }
}
