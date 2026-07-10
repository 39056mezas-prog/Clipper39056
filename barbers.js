// lib/barbers.js
//
// Cada barbero = su propio Google Calendar. Google Calendar sigue siendo la
// única fuente de verdad — este archivo solo le dice al sistema qué
// calendarios existen y a quién pertenecen.
//
// Para agregar un barbero:
//   1. El barbero comparte SU calendario con el correo de la cuenta de
//      servicio (ver README, sección Google Calendar), con permiso
//      "Hacer cambios en eventos".
//   2. Copia su Calendar ID (Configuración del calendario → Integrar
//      calendario) y agrégalo abajo.
//   3. El "slug" es para las futuras páginas /barbers/[slug].
//
// Mientras esta lista esté vacía, el sistema opera en modo "un solo
// calendario" usando la variable de entorno GOOGLE_CALENDAR_ID. Así el
// backend funciona desde el día uno, sin bloquear todo hasta tener a cada
// barbero dado de alta.

const BARBERS = [
  // Los 5 barberos del estudio — descomenta cada línea en cuanto tengas su
  // Calendar ID (comparte su calendario con la cuenta de servicio primero).
  // { slug: 'lalo',     name: 'Lalo',     calendarId: '' },
  // { slug: 'fernando', name: 'Fernando', calendarId: '' },
  // { slug: 'nacho',    name: 'Nacho',    calendarId: '' },
  // { slug: 'ian',      name: 'Ian',      calendarId: '' },
  // { slug: 'giovanni', name: 'Giovanni', calendarId: '' },
];

function getBookableCalendars() {
  if (BARBERS.length > 0) return BARBERS;
  if (process.env.GOOGLE_CALENDAR_ID) {
    return [
      {
        slug: 'general',
        name: 'Clipper Barber Studio',
        calendarId: process.env.GOOGLE_CALENDAR_ID,
      },
    ];
  }
  return [];
}

module.exports = { BARBERS, getBookableCalendars };
