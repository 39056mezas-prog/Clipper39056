// api/availability.js
//
// GET /api/availability?date=YYYY-MM-DD&barber=slug(opcional)
// → { taken: ["9:00", "9:30", ...] }
//
// "taken" son los horarios que YA NO están disponibles. Si se manda
// ?barber=, solo revisa ese calendario. Si no, revisa TODOS los
// calendarios bookeables y un horario cuenta como disponible si AL MENOS
// UN barbero está libre ahí (modo "sin preferencia" del brief).
//
// Esto es lo único que el frontend necesita saber; nunca ve calendarios ni
// credenciales, solo la lista de horarios ocupados del día.

const { getBusyBlocks } = require('../lib/googleCalendar');
const { getBookableCalendars } = require('../lib/barbers');
const { dayWindowUTC, slotRangeUTC } = require('../lib/time');

module.exports = async function handler(req, res) {
  try {
    const dateParam = req.query.date;
    const barberSlug = req.query.barber;

    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      res.status(400).json({ error: 'Falta o es inválido el parámetro date=YYYY-MM-DD' });
      return;
    }

    let calendars = getBookableCalendars();
    if (barberSlug && barberSlug !== 'sin-preferencia') {
      calendars = calendars.filter(function (b) { return b.slug === barberSlug; });
    }
    if (!calendars.length) {
      // Sin credenciales / sin calendarios configurados todavía — el
      // frontend sigue funcionando con su mock hasta que esto se despliegue.
      res.status(200).json({ taken: [], note: 'Sin calendarios configurados.' });
      return;
    }

    const { hours, timeMin, timeMax } = dayWindowUTC(dateParam);
    const busyByCalendar = await getBusyBlocks(
      calendars.map(function (c) { return c.calendarId; }),
      timeMin,
      timeMax
    );

    var slots = [];
    // la última cita puede arrancar justo a la hora de cierre
    for (var h = hours.open; h <= hours.close; h++) {
      slots.push(h + ':00');
      if (h < hours.close) slots.push(h + ':30');
    }

    function overlaps(aStart, aEnd, bStart, bEnd) {
      return aStart < bEnd && bStart < aEnd;
    }

    var taken = slots.filter(function (label) {
      var range = slotRangeUTC(dateParam, label);
      var slotStart = range[0], slotEnd = range[1];
      var freeSomewhere = calendars.some(function (cal) {
        var busy = (busyByCalendar[cal.calendarId] && busyByCalendar[cal.calendarId].busy) || [];
        return !busy.some(function (b) {
          return overlaps(slotStart, slotEnd, new Date(b.start), new Date(b.end));
        });
      });
      return !freeSomewhere;
    });

    res.status(200).json({ taken: taken });
  } catch (err) {
    console.error('availability error:', err);
    res.status(500).json({ error: 'No se pudo consultar disponibilidad.' });
  }
};
