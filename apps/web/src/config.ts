// Studio details shown on the website. Values marked TODO need the owner's input
// (PRD v3.0 section 5.2). Empty values hide the related UI.
export const studio = {
  name: 'Unifit.hyd',
  city: 'Hyderabad',
  tagline: 'Train. Transform. Thrive.',
  whatsapp: '', // TODO owner: studio WhatsApp number in international format, e.g. 9198xxxxxxxx
  phone: '', // TODO owner
  email: '', // TODO owner: e.g. hello@unifithyd.com once the mailbox exists
  address: '', // TODO owner: studio address for the map and LocalBusiness data
  mapUrl: '', // TODO owner: Google Maps link
}

// Plans per PRD 7.2 and Q8 default. These move to the API (WEB-2) once it is live.
export const plans = [
  {
    id: 'kids',
    name: 'Kids Training',
    price: '₹3,000',
    per: 'a month',
    points: ['3 classes a week, 12 a month', 'Coach-led sessions for under-18s', 'Parent books, pays and tracks'],
    featured: false,
  },
  {
    id: 'adult',
    name: 'Adult Training',
    price: 'From ₹15,000',
    per: 'a month',
    points: ['Small-batch coaching', 'Includes Group Classes', 'Ask us for the right plan'],
    featured: true,
  },
  {
    id: 'group',
    name: 'Group Classes',
    price: '₹3,000',
    per: 'a month',
    points: ['High-energy group sessions', 'Studio and online', 'Book any group class'],
    featured: false,
  },
]
