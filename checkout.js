// api/checkout.js
//
// POST /api/checkout
// body: { date, time, serviceId, name, phone, barberSlug? }
// → { url: "https://checkout.stripe.com/..." }  (el frontend redirige aquí)
//
// No se toca Google Calendar en este paso — el evento SOLO se crea cuando
// Stripe confirma el pago (ver api/webhook.js). Así nunca hay una cita en
// el calendario que no esté pagada.
//
// Los precios y nombres viven aquí (servidor), no se confía en lo que
// mande el navegador — así nadie puede pagar $1 por un "Servicio Clipper"
// editando el request.

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const SERVICES = {
  corte: { name: 'Corte', price: 220 },
  barba: { name: 'Barba', price: 180 },
  corte_barba: { name: 'Corte y Barba', price: 350 },
  facial: { name: 'Facial', price: 300 },
  clipper: { name: 'Servicio Clipper', price: 580 },
  grecas: { name: 'Grecas o Diseño', price: 100 },
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

    const service = SERVICES[serviceId];
    if (!date || !time || !service || !name || !phone) {
      res.status(400).json({ error: 'Faltan datos de la reserva.' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Fecha inválida.' });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: { name: service.name + ' — Clipper Barber Studio' },
            unit_amount: service.price * 100, // Stripe usa centavos
          },
          quantity: 1,
        },
      ],
      // Stripe Checkout ya pide el correo del cliente por default — lo
      // reusamos en el webhook para invitarlo al evento de Calendar y que
      // le llegue la confirmación sin necesitar un servicio de email aparte.
      metadata: {
        date: date,
        time: time,
        serviceId: serviceId,
        name: name,
        phone: phone,
        barberSlug: barberSlug || 'sin-preferencia',
      },
      success_url: (process.env.SITE_URL || '') + '/?booked=1',
      cancel_url: (process.env.SITE_URL || '') + '/?canceled=1',
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('checkout error:', err);
    res.status(500).json({ error: 'No se pudo iniciar el pago.' });
  }
};
