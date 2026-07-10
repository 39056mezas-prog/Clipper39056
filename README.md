# Clipper Barber Studio — Backend de reservas

Conecta el sitio directo a Google Calendar. Sin WhatsApp, sin cobro por
ahora — el cliente reserva en el sitio y la cita aparece en el calendario
del estudio al instante.

El `index.html` **ya está listo para esto** — llama a `/api/availability` y
`/api/book` automáticamente. Mientras este backend no esté desplegado seguirá
funcionando con datos de muestra (para que la demo no se vea rota); en cuanto
lo despliegues, empieza a usar datos reales sin tocar nada del frontend.

## Qué hace
- `GET /api/availability?date=YYYY-MM-DD` — el frontend la llama cada vez que
  eliges un día, para saber qué horarios ya están ocupados.
- `POST /api/book` — se llama al dar clic en "Confirmar reserva". Vuelve a
  checar que el horario siga libre y crea el evento en Google Calendar.

## 1. Google Calendar (el único paso obligatorio)
1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com).
2. Activa la **Google Calendar API** (Biblioteca de APIs → búscala → Habilitar).
3. Ve a *IAM y administración → Cuentas de servicio* → **Crear cuenta de servicio**.
4. Entra a la cuenta creada → pestaña *Claves* → **Agregar clave → Crear clave nueva → JSON**. Se descarga un archivo — su contenido completo es lo que va en `GOOGLE_SERVICE_ACCOUNT_JSON`.
5. Abre Google Calendar con la cuenta del estudio → *Configuración* del calendario que quieres usar → **Compartir con determinadas personas** → agrega el correo de la cuenta de servicio (algo como `xxx@tu-proyecto.iam.gserviceaccount.com`, lo encuentras en el JSON como `client_email`) → permiso **"Hacer cambios en eventos"**.
6. En el mismo menú de Configuración, copia el **ID del calendario** → pégalo en `GOOGLE_CALENDAR_ID`.

Con esto YA funciona — un solo calendario para todo el estudio.

### Cuando quieras un calendario por barbero
Repite el paso 5 y 6 con el calendario personal de cada barbero (Lalo,
Fernando, Nacho, Ian, Giovanni), y descomenta/llena sus líneas en
`lib/barbers.js` con su `calendarId`. En cuanto haya al menos uno ahí, el
sistema deja de usar `GOOGLE_CALENDAR_ID` y revisa los calendarios
individuales — no hay que tocar nada más.

## 2. Variables de entorno
Copia `.env.example` a `.env` y llena los valores para probar en local, o
agrégalas directo en Vercel → tu proyecto → Settings → Environment Variables.

## 3. Desplegar
Sube esta carpeta AL MISMO repositorio donde ya está `index.html` (las
funciones van en `/api`, quedan junto al sitio, no en un repo aparte):

```
tu-repo/
  index.html
  clipperlogo.png
  clipper-hero.webp
  clipper-interior.webp
  api/
    availability.js
    book.js
  lib/
    barbers.js
    googleCalendar.js
    time.js
  package.json
```

Luego, en [vercel.com](https://vercel.com), conecta el repositorio. Vercel
detecta `/api/*.js` como funciones automáticamente — no necesitas configurar
nada extra, solo las variables de entorno del paso 2.

## Pendientes conocidos
- **Duración de la cita**: asumí 45 minutos parejo para todos los servicios
  (`DEFAULT_DURATION_MINUTES` en `lib/time.js`). Si algunos servicios duran
  más o menos, dime y lo ajusto por servicio.
- **Zona horaria**: ya está resuelta con `America/Tijuana` explícito en
  `lib/time.js` (usa la librería `luxon`, no matemática de horario de verano
  a mano) — no debería dar problemas, pero es lo primero que probaría si
  algún horario se ve corrido.
- **Pago en línea**: no está conectado — se puede agregar Stripe después
  (checkout antes de crear el evento) si en algún momento lo quieren.
  Ahorita la reserva se crea directo, sin cobro.
- **Elegir barbero específico**: el backend ya soporta `?barber=slug` /
  `barberSlug`, pero el frontend todavía no tiene ese paso en el flujo de
  reserva — reserva "sin preferencia" y el sistema ofrece cualquier barbero
  libre. Puedo agregar el selector cuando quieras.
- **Confirmación al cliente**: como no se pide correo, el cliente no recibe
  invitación automática de Calendar. Si agregamos un campo de email, se
  puede activar (`attendees` en `lib/googleCalendar.js`) y le llega la
  confirmación solo.
