// api/book.js
//
// POST /api/book
// body: { date:'YYYY-MM-DD', time:'H:MM', serviceId, name, phone, barberSlug? }
// → { ok:true, eventId, barber } | 409 si el horario ya se ocupó | 400/500 en error
//
// Sin cobro por ahora — reserva directa. Antes de crear el evento, vuelve a
// checar disponibilidad (protege contra dos personas mandando el mismo
// horario casi al mismo tiempo). El precio y el nombre del servicio se
// definen aquí, no se confía en lo que mande el navegador.

const { getBusyBlocks, createEvent } = require('../lib/googleCalendar');
const { getBookableCalendars } = require('../lib/barbers');
const { slotRangeUTC } = require('../lib/time');

const SERVICES = {
  corte: 'Corte',
  barba: 'Barba',
  corte_barba: 'Corte y Barba',
  facial: 'Facial',
  clipper: 'Servicio Clipper',
  grecas: 'Grecas o Diseño',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const date = body.date, time = body.time, serviceId = body.serviceId;
    const name = body.name, phone = body.phone, barberSlug = body.barberSlug;

    if (!date || !time || !serviceId || !name || !phone) {
      res.status(400).json({ error: 'Faltan datos de la reserva.' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Fecha inválida.' });
      return;
    }

    const [startUTC, endUTC] = slotRangeUTC(date, time);

    let calendars = getBookableCalendars();
    if (!calendars.length) {
      res.status(500).json({ error: 'El calendario todavía no está configurado (falta GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_CALENDAR_ID).' });
      return;
    }
    if (barberSlug && barberSlug !== 'sin-preferencia') {
      calendars = calendars.filter(function (b) { return b.slug === barberSlug; });
    }

    // vuelve a checar disponibilidad justo antes de crear el evento
    const busyByCalendar = await getBusyBlocks(
      calendars.map(function (c) { return c.calendarId; }),
      startUTC.toISOString(),
      endUTC.toISOString()
    );
    const target = calendars.find(function (cal) {
      const busy = (busyByCalendar[cal.calendarId] && busyByCalendar[cal.calendarId].busy) || [];
      return busy.length === 0;
    });

    if (!target) {
      res.status(409).json({ error: 'Ese horario ya no está disponible.' });
      return;
    }

    const serviceName = SERVICES[serviceId] || serviceId;
    const event = await createEvent(target.calendarId, {
      summary: serviceName + ' — ' + name,
      description: 'Reservado desde el sitio.\nTeléfono: ' + phone + '\nServicio: ' + serviceName,
      start: { dateTime: startUTC.toISOString() },
      end: { dateTime: endUTC.toISOString() },
    });

    res.status(200).json({ ok: true, eventId: event.id, barber: target.name });
  } catch (err) {
    console.error('book error:', err);
    res.status(500).json({ error: 'No se pudo crear la reserva. Intenta de nuevo.' });
  }
};
