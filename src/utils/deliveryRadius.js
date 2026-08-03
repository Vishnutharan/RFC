// 5 km delivery radius from RFC Watford, 119 Courtlands Dr, Watford WD17 4HZ.
// WD17 4HZ centroid checked from public UK postcode data: 51.682366, -0.41867.
export const STORE_LOCATION = {
  lat: 51.682366,
  lng: -0.41867,
  address: '119 Courtlands Dr, Watford WD17 4HZ',
  postcode: 'WD17 4HZ'
};

export const MAX_RADIUS_KM = 5.0;

const OUTWARD_DISTANCE_ESTIMATES = {
  WD17: 0.2,
  WD24: 2.2,
  WD18: 3.4,
  WD25: 4.8,
  WD19: 5.0,
  WD3: 6.8,
  WD4: 7.4,
  WD5: 6.1,
  WD6: 10.5,
  WD7: 9.8,
  HA5: 7.5,
  HA6: 8.2,
  AL2: 11.0
};

const normalisePostcode = (postcode = '') => postcode.trim().toUpperCase().replace(/\s+/g, '');

const outwardCode = (clean) => (clean.length <= 4 ? clean : clean.slice(0, -3));

const toRadians = (degrees) => degrees * Math.PI / 180;

export const calculateDistanceKm = (lat, lng) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat - STORE_LOCATION.lat);
  const dLng = toRadians(lng - STORE_LOCATION.lng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(STORE_LOCATION.lat)) *
    Math.cos(toRadians(lat)) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusKm * c * 10) / 10;
};

const resultForDistance = (distanceKm, liveChecked = false) => {
  const isEligible = distanceKm <= MAX_RADIUS_KM;
  const suffix = liveChecked ? '' : ' Estimated from postcode area.';

  return {
    isEligible,
    isChecking: false,
    distanceKm,
    maxRadiusKm: MAX_RADIUS_KM,
    fee: isEligible ? 0 : null,
    reason: isEligible
      ? `${distanceKm.toFixed(1)} km from 119 Courtlands Dr - inside our 5 km delivery radius.${suffix}`
      : `Your address is about ${distanceKm.toFixed(1)} km from 119 Courtlands Dr, outside our 5 km delivery radius. Please select Store Collection.${suffix}`
  };
};

export function checkDeliveryEligibility(userPostcode) {
  if (!userPostcode || typeof userPostcode !== 'string') {
    return {
      isEligible: false,
      isChecking: false,
      distanceKm: 0,
      maxRadiusKm: MAX_RADIUS_KM,
      fee: 0,
      reason: 'Please enter a valid UK postcode.'
    };
  }

  const clean = normalisePostcode(userPostcode);
  if (clean.length < 3) {
    return {
      isEligible: false,
      isChecking: false,
      distanceKm: 0,
      maxRadiusKm: MAX_RADIUS_KM,
      fee: 0,
      reason: 'Please enter a complete postcode, for example WD24 6RU.'
    };
  }

  const distanceKm = OUTWARD_DISTANCE_ESTIMATES[outwardCode(clean)] ??
    (clean.startsWith('WD') ? 5.8 : 12.5);

  return resultForDistance(distanceKm, false);
}

export async function getDeliveryEligibility(userPostcode, { signal } = {}) {
  const fallback = checkDeliveryEligibility(userPostcode);
  const clean = normalisePostcode(userPostcode);
  if (!clean || clean.length < 5) return fallback;

  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`, { signal });
    if (response.status === 404) {
      return {
        ...fallback,
        isEligible: false,
        reason: 'Please enter a valid UK postcode.'
      };
    }

    if (!response.ok) return fallback;

    const payload = await response.json();
    const lat = payload?.result?.latitude;
    const lng = payload?.result?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') return fallback;

    return resultForDistance(calculateDistanceKm(lat, lng), true);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return fallback;
  }
}
