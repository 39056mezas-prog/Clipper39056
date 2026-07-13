# Clipper Barber Studio — Backend de reservas

Flujo: el cliente reserva en el sitio → paga con tarjeta (Stripe) → **solo si el pago se confirma**, se crea la cita en el Google Calendar del estudio.

El `index.html` ya está conectado a esto — llama a `/api/availability` para mostrar horarios ocupados, y a `/api/checkout` al dar clic en "Pagar y confirmar". Mientras este backend no esté desplegado, el sitio sigue funcionando con datos de muestra (para que no se vea roto); en cuanto lo despliegues, usa datos reales sin tocar nada del frontend.

## Ya está configurado
- **Google Calendar**: tu cuenta de servicio (`clipperstudio@clipper-studio-502219.iam.gserviceaccount.com`) ya tiene permiso de "Hacer cambios en eventos" sobre `clipperstudio646@gmail.com`.
- **Stripe**: conectado en modo sandbox/prueba (las tarjetas reales no se cobran — usa tarjetas de prueba de Stripe como `4242 4242 4242 4242` para probar el flujo completo).
- Todo esto ya vive en el archivo `.env` de esta carpeta.

## Lo único que falta: el Webhook Secret
Stripe necesita saber a qué URL avisarte cuando alguien paga — y esa URL solo existe una vez que el sitio esté desplegado. Por eso este es el único paso pendiente:

1. Despliega esta carpeta + el sitio (ver "Desplegar" abajo).
2. En el Dashboard de Stripe → **Desarrolladores → Webhooks → Agregar endpoint**.
3. URL del endpoint: `https://tu-dominio.vercel.app/api/webhook`
4. Evento a escuchar: `checkout.session.completed`.
5. Copia el **Signing secret** (empieza con `whsec_...`) y pégalo en `STRIPE_WEBHOOK_SECRET` — tanto en tu `.env` local como en Vercel → Settings → Environment Variables.

Sin este paso, el pago se procesa pero la cita nunca se crea (Stripe no puede avisarle al sitio que ya cobró). Es la última pieza.

## Qué hace cada endpoint
- `GET /api/availability?date=YYYY-MM-DD` — el frontend la llama cada vez que eliges un día, para saber qué horarios ya están ocupados.
- `POST /api/checkout` — se llama al dar clic en "Pagar y confirmar". Crea una sesión de pago en Stripe y regresa la URL a la que el sitio redirige. **No toca el calendario todavía.**
- `POST /api/webhook` — Stripe llama aquí cuando el pago se completa. Aquí (y solo aquí) se crea el evento en Google Calendar, después de volver a checar que el horario siga libre.

## Desplegar
Sube esta carpeta AL MISMO repositorio donde ya está `index.html` (las funciones van en `/api`, quedan junto al sitio):

```
tu-repo/
  index.html
  clipperlogo.png
  clipper-hero.webp
  clipper-interior.webp
  api/
    availability.js
    checkout.js
    webhook.js
  lib/
    barbers.js
    googleCalendar.js
    time.js
  package.json
```

Luego, en vercel.com, conecta el repositorio. Vercel detecta `/api/*.js` automáticamente como funciones — no necesitas configurar nada extra, solo pega las variables de entorno (todas están ya en tu `.env`, cópialas a Vercel → Settings → Environment Variables) y agrega `SITE_URL` con el dominio real una vez que Vercel te lo asigne.

## ⚠️ Seguridad — antes de subir a GitHub
- El archivo `.env` **tiene credenciales reales** (la llave privada de Google y tu llave secreta de Stripe). `.gitignore` ya lo excluye, pero verifica que nunca aparezca en `git status` antes de hacer commit.
- Nunca pegues `STRIPE_SECRET_KEY` ni `GOOGLE_SERVICE_ACCOUNT_JSON` en ningún archivo que vaya al navegador (`index.html`, o cualquier `.js` fuera de `/api` y `/lib`). Ya verifiqué que no hay ninguna referencia ahí.
- Cuando quieras cobrar de verdad, cambias `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` por las versiones "live" (no "test") desde el mismo Dashboard de Stripe, con el toggle "Test mode" apagado.

## Cuando quieras un calendario por barbero
Por ahora todo el estudio comparte un solo calendario (`GOOGLE_CALENDAR_ID`). Cuando quieras que cada barbero (Lalo, Fernando, Nacho, Ian, Giovanni) tenga el suyo: comparte su calendario personal con la misma cuenta de servicio, copia su Calendar ID, y agrégalo en `lib/barbers.js`. En cuanto haya uno ahí, el sistema deja de usar el calendario general automáticamente.

## Pendientes conocidos
- **Duración de la cita**: 45 minutos parejo para todos los servicios (`DEFAULT_DURATION_MINUTES` en `lib/time.js`). Dime si algunos servicios necesitan más/menos tiempo y lo ajusto por servicio.
- **Sin disponibilidad al momento de pagar** (caso raro: alguien más agarró el horario entre el checkout y el pago): por ahora solo se registra en el log del servidor. Hay un TODO marcado en `webhook.js` para reembolsar automáticamente y avisar al negocio — dime si lo quieres activo.
- **Elegir barbero específico**: el backend ya soporta `barberSlug`, pero el frontend todavía reserva "sin preferencia". Puedo agregar ese paso cuando quieras.
