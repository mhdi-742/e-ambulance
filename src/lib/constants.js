// Raiganj city center coordinates
export const CITY_CENTER = {
  lat: 25.6167,
  lng: 88.1167,
};

export const DEFAULT_ZOOM = 13;

// Booking status flow
export const BOOKING_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EN_ROUTE_PICKUP: 'en_route_pickup',
  ARRIVED_PICKUP: 'arrived_pickup',
  EN_ROUTE_HOSPITAL: 'en_route_hospital',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// User roles
export const ROLES = {
  USER: 'user',
  DRIVER: 'driver',
  ADMIN: 'admin',
};

// Status display labels
export const STATUS_LABELS = {
  [BOOKING_STATUS.PENDING]: 'Finding Ambulance...',
  [BOOKING_STATUS.ACCEPTED]: 'Driver Assigned',
  [BOOKING_STATUS.EN_ROUTE_PICKUP]: 'Ambulance On the Way',
  [BOOKING_STATUS.ARRIVED_PICKUP]: 'Ambulance Arrived',
  [BOOKING_STATUS.EN_ROUTE_HOSPITAL]: 'Heading to Hospital',
  [BOOKING_STATUS.COMPLETED]: 'Trip Completed',
  [BOOKING_STATUS.CANCELLED]: 'Cancelled',
};

// Location update interval (ms)
export const LOCATION_UPDATE_INTERVAL = 5000;

// Hospitals in Raiganj (seeded data)
export const HOSPITALS = [
  {
    id: '1',
    name: 'Raiganj Government Medical College & Hospital',
    address: 'Sudarshanpur, Raiganj, Uttar Dinajpur',
    lat: 25.6234,
    lng: 88.1289,
  },
  {
    id: '2',
    name: 'Raiganj Sub-Divisional Hospital',
    address: 'Station Road, Raiganj',
    lat: 25.6198,
    lng: 88.1201,
  },
  {
    id: '3',
    name: 'Uttar Dinajpur District Hospital',
    address: 'NH 34, Raiganj',
    lat: 25.6145,
    lng: 88.1150,
  },
  {
    id: '4',
    name: 'Islampur Sub-District Hospital',
    address: 'Islampur, Uttar Dinajpur',
    lat: 25.5990,
    lng: 88.1070,
  },
  {
    id: '5',
    name: 'Lifeline Nursing Home',
    address: 'College Para, Raiganj',
    lat: 25.6210,
    lng: 88.1230,
  },
];
