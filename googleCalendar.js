// lib/googleCalendar.js
//
// Toda la comunicación con Google Calendar pasa por aquí: consultar qué
// horarios están ocupados (freebusy) y crear el evento cuando el pago se
// confirma. Nada más en el proyecto debería llamar a la API de Google
// directamente — así, si un día cambia el método de auth, solo se toca
// este archivo.

const { google } = require('googleapis');

function getAuth() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_JSON en las variables de entorno.');
  }
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/calendar']
  );
}

/**
 * Regresa los bloques ocupados de cada calendario en el rango dado.
 * @param {string[]} calendarIds
 * @param {string} timeMinISO
 * @param {string} timeMaxISO
 * @returns {Promise<Object>} { [calendarId]: { busy: [{start, end}, ...] } }
 */
async function getBusyBlocks(calendarIds, timeMinISO, timeMaxISO) {
  if (!calendarIds.length) return {};
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      items: calendarIds.map(function (id) { return { id: id }; }),
    },
  });
  return res.data.calendars || {};
}

/**
 * Crea el evento en el calendario del barbero. sendUpdates:'all' hace que
 * Google le mande automáticamente la invitación/confirmación por correo al
 * cliente si se le agregó como attendee — así resolvemos "recibe
 * confirmación" sin necesitar un proveedor de email aparte.
 */
async function createEvent(calendarId, event) {
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.insert({
    calendarId: calendarId,
    sendUpdates: 'all',
    requestBody: event,
  });
  return res.data;
}

module.exports = { getBusyBlocks, createEvent };
