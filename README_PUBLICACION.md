# Somos Cantera - web publicable orientada a clubes

Esta versión cambia el enfoque de la marca hacia el modelo más viable observado en el mercado:
álbumes oficiales para clubes, cromos, sobres, patrocinadores y financiación.

## Archivos principales
- `index.html`: home comercial.
- `clubes.html`: página específica para clubes.
- `contacto.html`: solicitud de propuesta.
- `pedido.html`: pedido individual con pago Stripe, conservado del archivo original.
- `api/`: endpoints existentes para pedidos, Stripe, admin y email.
- `css/site.css`: estilos de la nueva web.
- `js/site.js`: menú responsive.

## Modelo de negocio reflejado en la web
- Álbum oficial del club.
- Sobres de cromos.
- Cromos personalizados de jugadores y entrenadores.
- Cromos especiales: MVP, capitán, goleador, escudo, plantilla.
- Patrocinadores locales.
- Extras: calendarios, foto oficial, tarjetas, pósters y regalos.

## Precios orientativos incluidos
- Club completo: desde 0 € inicial, sujeto a volumen y condiciones.
- Pack familia: 12–18 €.
- Cromo individual digital: 4–6 €.

Ajusta estos precios antes de publicar según tus costes reales de impresión, diseño y logística.

## Publicación en Vercel
1. Sube todos los archivos a un repositorio.
2. Conecta el repositorio a Vercel.
3. Configura las variables de entorno que ya usaba el sistema original:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - variables de base de datos Neon
   - variables de Resend si usas email
4. Prueba primero Stripe en modo test.

## Importante
El formulario `contacto.html` usa `mailto:` como solución simple. Para producción real, mejor conectarlo a Formspree, Resend, Brevo o un endpoint propio.
