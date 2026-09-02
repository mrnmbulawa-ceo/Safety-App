import { TrustedContact } from '../types';

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function fireAlert(contacts: TrustedContact[], lat: number, lng: number) {
  const mapLink = `https://www.google.com/maps?q=${lat},${lng}`;
  const message = `This is an emergency alert from UBE Safety. My current location: ${mapLink}`;
  const encodedMessage = encodeURIComponent(message);

  let emailsToAlert: string[] = [];
  
  for (const contact of contacts) {
    if (contact.phone) {
      const waUrl = `https://wa.me/${contact.phone}?text=${encodedMessage}`;
      // Browsers might block multiple window.open, but we try. Usually user triggers it so it's a user gesture.
      window.open(waUrl, '_blank');
    }
    if (contact.email) {
      emailsToAlert.push(contact.email);
    }
  }

  if (emailsToAlert.length > 0) {
    try {
      await fetch('/api/alert-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: emailsToAlert, message, mapLink, lat, lng })
      });
    } catch (e) {
      console.error('Failed to send email alerts:', e);
    }
  }
}
