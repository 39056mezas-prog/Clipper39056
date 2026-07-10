// lib/time.js
//
// Vercel corre las funciones en UTC. Ensenada usa America/Tijuana, que sí
// tiene horario de verano (a diferencia de la mayor parte de México desde
// 2022) — así que un offset fijo tipo "UTC-8" se rompe la mitad del año.
// Por eso todo el manejo de fechas pasa por luxon con la zona explícita en
// vez de construir Date() a mano.

const { DateTime } = require('luxon');

const TIMEZONE = 'America/Tijuana';

const HOURS = {
  0: { open: 10, close: 17 }, // domingo
  1: { open: 9, close: 19 },
  2: { open: 9, close: 19 },
  3: { open: 9, close: 19 },
  4: { open: 9, close: 19 },
  5: { open: 9, close: 19 },
  6: { open: 9, close: 19 },
};

// Duración asumida por cita — no viene especificada por servicio en el
// brief, así que se aplica pareja por ahora. Fácil de partir por servicio
// después (ver comentario en api/availability.js).
const DEFAULT_DURATION_MINUTES = 45;

/** 'YYYY-MM-DD' + 'H:MM' → DateTime en America/Tijuana */
function toZoned(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return DateTime.fromObject(
    { year: y, month: m, day: d, hour: hh, minute: mm },
    { zone: TIMEZONE }
  );
}

/** Rango [inicio, fin) de una cita, como Date de JS en UTC (listos para la API de Google) */
function slotRangeUTC(dateStr, timeStr, durationMinutes) {
  const start = toZoned(dateStr, timeStr);
  const end = start.plus({ minutes: durationMinutes || DEFAULT_DURATION_MINUTES });
  return [start.toUTC().toJSDate(), end.toUTC().toJSDate()];
}

/** Ventana [apertura, cierre) del día completo, como ISO en UTC — para la consulta freebusy */
function dayWindowUTC(dateStr) {
  const weekday = toZoned(dateStr, '0:00').weekday % 7; // luxon: 1=lunes..7=domingo → normaliza a 0=domingo
  const hours = HOURS[weekday];
  const open = toZoned(dateStr, hours.open + ':00');
  const close = toZoned(dateStr, hours.close + ':00');
  return { hours: hours, timeMin: open.toUTC().toISO(), timeMax: close.toUTC().toISO() };
}

module.exports = { TIMEZONE, HOURS, DEFAULT_DURATION_MINUTES, toZoned, slotRangeUTC, dayWindowUTC };
