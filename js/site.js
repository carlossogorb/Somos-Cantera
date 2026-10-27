/* Somos Cantera — formulario de solicitud.
   Envía a /api/solicitud (función de Vercel), que valida los datos y los guarda
   en la hoja de Google de solicitudes. El navegador no tiene acceso a la hoja. */
(function () {
  "use strict";

  var form = document.getElementById("formulario");
  if (!form) return;
  var estado = document.getElementById("estado");
  var boton = form.querySelector('button[type="submit"]');
  var inicio = Date.now();

  // El número de entrenadores solo se pide si van a tener cromo.
  var campoEnt = document.getElementById("campo-entrenadores");
  var inputEnt = form.elements.entrenadores;
  function conEntrenadores() {
    var marcado = form.querySelector('input[name="entrenadores_cromo"]:checked');
    return !!marcado && marcado.value === "Sí";
  }
  function actualizarEntrenadores() {
    var si = conEntrenadores();
    campoEnt.hidden = !si;
    inputEnt.required = si;
    if (!si) inputEnt.value = "";
  }
  Array.prototype.forEach.call(form.querySelectorAll('input[name="entrenadores_cromo"]'), function (r) {
    r.addEventListener("change", actualizarEntrenadores);
  });

  var MENSAJES = {
    nombre: "Escribe tu nombre.",
    club: "Escribe el nombre del club.",
    email: "Escribe un email válido, por ejemplo nombre@club.es.",
    localidad: "Escribe la localidad del club.",
    rol: "Elige tu papel en el club.",
    jugadores: "Indica cuántos jugadores tiene el club (un número aproximado vale).",
    equipos: "Indica cuántos equipos tiene el club.",
    entrenadores_cromo: "Dinos si los entrenadores también tendrán cromo.",
    entrenadores: "Indica cuántos entrenadores tendrán cromo.",
    formato: "Elige el formato del álbum (o «Aconsejadnos»).",
    privacidad: "Tienes que aceptar la política de privacidad para enviar la solicitud."
  };

  function aviso(texto, tipo) {
    estado.textContent = texto;
    estado.className = "formulario__estado" + (tipo ? " " + tipo : "");
  }

  // Misma regla que la validación de /api/solicitud.
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function limpio(valor) {
    var v = (valor || "").trim();
    return v === "" ? null : v;
  }

  function validar() {
    var primero = null;
    form.querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
    var campos = ["nombre", "club", "email", "localidad", "rol", "jugadores", "equipos", "entrenadores_cromo"];
    if (conEntrenadores()) campos.push("entrenadores");
    campos.push("formato", "privacidad");
    campos.forEach(function (nombre) {
      var campo = form.elements[nombre];
      var nodo = campo.length && !campo.tagName ? campo[0] : campo;
      var valido = campo.length && !campo.tagName
        ? Array.prototype.some.call(campo, function (r) { return r.checked; })
        : (nodo.type === "checkbox" ? nodo.checked
          : nodo.type === "number" ? nodo.value.trim() !== "" && nodo.checkValidity()
          : nodo.value.trim().length >= (nombre === "rol" ? 1 : 2) && nodo.checkValidity());
      if (valido && nombre === "email") valido = EMAIL.test(nodo.value.trim());
      if (!valido) {
        nodo.setAttribute("aria-invalid", "true");
        if (!primero) primero = { nodo: nodo, nombre: nombre };
      }
    });
    return primero;
  }

  form.addEventListener("submit", function (evento) {
    evento.preventDefault();

    // Trampa para bots: campo oculto relleno o envío en menos de 3 segundos.
    if (form.elements.web.value || Date.now() - inicio < 3000) {
      aviso("Solicitud enviada. Te escribiremos lo antes posible.", "ok");
      form.reset();
      return;
    }

    var error = validar();
    if (error) {
      aviso(MENSAJES[error.nombre], "error");
      error.nodo.focus();
      return;
    }

    var datos = {
      nombre: form.elements.nombre.value.trim(),
      club: form.elements.club.value.trim(),
      email: form.elements.email.value.trim(),
      telefono: limpio(form.elements.telefono.value),
      localidad: form.elements.localidad.value.trim(),
      rol: form.elements.rol.value,
      jugadores: parseInt(form.elements.jugadores.value, 10),
      equipos: parseInt(form.elements.equipos.value, 10),
      entrenadores_cromo: form.querySelector('input[name="entrenadores_cromo"]:checked').value,
      entrenadores: conEntrenadores() ? parseInt(inputEnt.value, 10) : 0,
      formato: form.querySelector('input[name="formato"]:checked').value,
      mensaje: limpio(form.elements.mensaje.value),
      acepta_privacidad: true
    };

    boton.disabled = true;
    aviso("Enviando…");

    fetch("/api/solicitud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    })
      .then(function (respuesta) {
        if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
        form.reset();
        actualizarEntrenadores();
        aviso("Solicitud enviada. Te escribiremos a " + datos.email + " lo antes posible.", "ok");
      })
      .catch(function () {
        aviso("No se ha podido enviar. Revisa tu conexión y vuelve a intentarlo en unos minutos.", "error");
      })
      .finally(function () {
        boton.disabled = false;
      });
  });
})();
