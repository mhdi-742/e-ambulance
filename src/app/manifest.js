export default function manifest() {
  return {
    name: 'E-Ambulance Raiganj',
    short_name: 'E-Ambulance',
    description: 'Rapid Emergency Ambulance Dispatch & Live Tracking in Raiganj',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#dc2626',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
  };
}
