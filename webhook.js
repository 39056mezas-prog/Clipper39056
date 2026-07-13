// api/webhook.js
//
// Stripe llama aquí cuando el pago se completa. Este es el ÚNICO lugar
// donde se crea el evento en Google Calendar — así nunca hay una cita
// creada sin que se haya cobrado.
//
// Flujo: verifica la firma → vuelve a checar disponibilidad (por si el
// horario se ocupó entre el checkout y el pago) → crea el evento en el
// primer calendario libre → Google le manda la confirmación al cliente
// por correo automáticamente (sendUpdates:'all' en lib/googleCalendar.js).
//
// IMPORTANTE: Stripe necesita el cuerpo CRUDO (sin parsear) para poder
// verificar la firma. `config.api.bodyParser:false` es la forma en que
// esto se hace en funciones de Vercel — confírmalo contra la
// documentación vigente de Vercel al desplegar, por si cambió.
module.exports.config = { api: { bodyParser: false } };

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { getBusyBlocks, createEvent } = require('../lib/googleCalendar');
const { getBookableCalendars } = require('../lib/barbers');
const { slotRangeUTC } = require('../lib/time');

const SERVICE_NAMES = {
  corte: 'Corte',
  barba: 'Barba',
  corte_barba: 'Corte y Barba',
  facial: 'Facial',
  clipper: 'Servicio Clipper',
  grecas: 'Grecas o Diseño',
};

function buffer(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  var event;
  try {
    var rawBody = await buffer(req);
    var signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Firma de webhook inválida:', err.message);
    res.status(400).send('Webhook signature verification failed.');
    return;
  }

  if (event.type !== 'checkout.session.completed') {
    res.status(200).json({ received: true });
    return;
  }

  var session = event.data.object;
  var meta = session.metadata || {};
  var date = meta.date, time = meta.time, serviceId = meta.serviceId;
  var name = meta.name, phone = meta.phone, barberSlug = meta.barberSlug;
  var clientEmail = session.customer_details && session.customer_details.email;

  try {
    var range = slotRangeUTC(date, time);
    var startUTC = range[0], endUTC = range[1];

    var calendars = getBookableCalendars();
    if (barberSlug && barberSlug !== 'sin-preferencia') {
      calendars = calendars.filter(function (b) { return b.slug === barberSlug; });
    }

    var busyByCalendar = await getBusyBlocks(
      calendars.map(function (c) { return c.calendarId; }),
      startUTC.toISOString(),
      endUTC.toISOString()
    );
    var target = calendars.find(function (cal) {
      var busy = (busyByCalendar[cal.calendarId] && busyByCalendar[cal.calendarId].busy) || [];
      return busy.length === 0;
    });

    if (!target) {
      // Ya se pagó pero el horario se ocupó justo entre el checkout y la
      // confirmación (caso raro, pero posible con tráfico simultáneo).
      // TODO: reembolsar automáticamente —
      //   await stripe.refunds.create({ payment_intent: session.payment_intent });
      // y avisar al negocio (WhatsApp/email/Slack) para reagendar con el cliente.
      console.error('Sin disponibilidad al confirmar el pago. session:', session.id);
      res.status(200).json({ received: true, warning: 'no_availability' });
      return;
    }

    var serviceName = SERVICE_NAMES[serviceId] || serviceId;
    await createEvent(target.calendarId, {
      summary: serviceName + ' — ' + name,
      description: 'Reservado y pagado desde el sitio.\nTeléfono: ' + phone + '\nServicio: ' + serviceName,
      start: { dateTime: startUTC.toISOString() },
      end: { dateTime: endUTC.toISOString() },
      attendees: clientEmail ? [{ email: clientEmail }] : [],
    });

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('webhook error:', err);
    // status 500 → Stripe reintenta este webhook automáticamente
    res.status(500).json({ error: 'No se pudo crear el evento en Calendar.' });
  }
};
