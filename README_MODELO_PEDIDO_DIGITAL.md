# Modelo de pedido digital primero

- Nueva página `pedido.html` para enviar a grupos de padres o usar desde la web.
- El pedido inicial es de cromo digital.
- No se pide tamaño físico ni dirección postal.
- El cliente elige tipo de cromo.
- Si elige Especial, puede elegir temática.
- El formulario envía directamente a `/api/pedido`, crea el pedido en Neon y abre pago Stripe.
- Tras revisión, el cromo digital se envía por email.
- La versión física se ofrece después de ver el resultado.

Precios actuales en `pedido.html`:
- Básico: 2 €
- Tiquitaca: 3 €
- Jugón: 4 €
- Especial: 6 €

Para cambiarlos, edita los atributos `data-precio` de los botones de tipo de cromo.


Actualización de pedido.html:
- Deporte pasa a desplegable: Fútbol, Baloncesto, Tenis, Hockey, Rugby, Pádel, Otro.
- Si elige Otro, aparece campo para escribir deporte.
- Habilidades pasan a botones; exige exactamente 3.
- Especial incluye opción Otro.
- Si Especial = Otro, la vista previa muestra el texto de indicaciones y se exige describir temática.
- "Indicaciones opcionales" pasa a "Indicaciones especiales".
