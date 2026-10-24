/* Somos Cantera — ficha del club (/club).
   Envía a /api/ficha, que valida y guarda la ficha en la hoja de Google
   (pestaña «Fichas») y el escudo en Google Drive. Lo escrito se guarda en
   este navegador (localStorage) para poder terminarla más tarde. */
(function () {
  "use strict";

  var form = document.getElementById("ficha");
  if (!form) return;
  var estado = document.getElementById("estado");
  var boton = form.querySelector('button[type="submit"]');
  var lista = document.getElementById("equipos");
  var plantilla = document.getElementById("fila-equipo");
  var total = document.getElementById("total-equipos");
  var CLAVE = "sc-ficha-club";
  var MAX_ESCUDO = 3 * 1024 * 1024;
  var inicio = Date.now();

  function aviso(texto, tipo) {
    estado.textContent = texto;
    estado.className = "formulario__estado" + (tipo ? " " + tipo : "");
  }

  // ---------- Equipos ----------
  function anadirEquipo(datos) {
    var fila = plantilla.content.firstElementChild.cloneNode(true);
    if (datos) {
      fila.querySelector(".eq-cat").value = datos.categoria || "";
      fila.querySelector(".eq-letra").value = datos.equipo || "";
      fila.querySelector(".eq-jug").value = datos.jugadores || "";
      fila.querySelector(".eq-ent").value = datos.entrenadores != null ? datos.entrenadores : 2;
    }
    lista.appendChild(fila);
    recalcular();
    return fila;
  }

  function equipos() {
    return Array.prototype.map.call(lista.children, function (li) {
      return {
        categoria: li.querySelector(".eq-cat").value,
        equipo: li.querySelector(".eq-letra").value.trim(),
        jugadores: parseInt(li.querySelector(".eq-jug").value, 10) || 0,
        entrenadores: parseInt(li.querySelector(".eq-ent").value, 10) || 0
      };
    });
  }

  function recalcular() {
    var eq = equipos();
    var jug = 0, ent = 0;
    eq.forEach(function (e) { jug += e.jugadores; ent += e.entrenadores; });
    var conEnt = form.querySelector('input[name="cromo_entrenadores"]:checked');
    var cromos = jug + (conEnt && conEnt.value === "No" ? 0 : ent);
    total.textContent = eq.length
      ? eq.length + (eq.length === 1 ? " equipo · " : " equipos · ") + jug + " jugadores · " + ent + " entrenadores · unos " + cromos + " cromos distintos"
      : "";
  }

  lista.addEventListener("click", function (e) {
    if (e.target.classList.contains("equipo__quitar")) {
      e.target.closest(".equipo").remove();
      if (!lista.children.length) anadirEquipo();
      recalcular(); guardar();
    }
  });
  document.getElementById("anadir-equipo").addEventListener("click", function () {
    var fila = anadirEquipo();
    fila.querySelector(".eq-cat").focus();
  });

  // ---------- Guardado local ----------
  function valores() {
    var d = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === "file" || el.name === "web") return;
      if (el.type === "checkbox") {
        if (el.name === "datos_cromo" || el.name === "paginas") {
          d[el.name] = d[el.name] || [];
          if (el.checked) d[el.name].push(el.value);
        } else d[el.name] = el.checked;
      } else if (el.type === "radio") {
        if (el.checked) d[el.name] = el.value;
      } else d[el.name] = el.value.trim();
    });
    d.equipos = equipos();
    return d;
  }

  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(valores())); } catch (e) { /* sin almacenamiento */ }
  }

  function restaurar() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { d = null; }
    if (!d) { anadirEquipo(); return; }
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === "file" || !(el.name in d)) return;
      var v = d[el.name];
      if (el.type === "checkbox") el.checked = Array.isArray(v) ? v.indexOf(el.value) !== -1 : !!v;
      else if (el.type === "radio") el.checked = el.value === v;
      else el.value = v;
    });
    (d.equipos && d.equipos.length ? d.equipos : [null]).forEach(anadirEquipo);
  }

  form.addEventListener("input", function () { recalcular(); guardar(); });
  form.addEventListener("change", function () { recalcular(); guardar(); });

  // ---------- Validación ----------
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function marcar(el) { el.setAttribute("aria-invalid", "true"); return el; }

  function validar() {
    form.querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
    var errores = [];
    form.querySelectorAll("[required]").forEach(function (el) {
      if (el.closest("template")) return;
      var ok;
      if (el.type === "radio") ok = !!form.querySelector('input[name="' + el.name + '"]:checked');
      else if (el.type === "checkbox") ok = el.checked;
      else ok = el.value.trim() !== "";
      if (!ok && errores.indexOf(el) === -1) errores.push(marcar(el));
    });
    var email = form.elements.contacto_email;
    if (email.value && !EMAIL.test(email.value.trim())) errores.push(marcar(email));
    var archivo = form.elements.escudo.files[0];
    if (archivo && archivo.size > MAX_ESCUDO) errores.push(marcar(form.elements.escudo));
    return errores;
  }

  function nombreCampo(el) {
    var etiqueta = el.closest(".equipo") ? "los equipos (categoría y jugadores)" : null;
    if (etiqueta) return etiqueta;
    var fs = el.closest("fieldset.campo");
    var lab = fs ? fs.querySelector("legend") : form.querySelector('label[for="' + el.id + '"]');
    if (!lab && el.closest("label")) return "la casilla de confirmación";
    return lab ? "«" + lab.textContent.replace(/\(.*\)/, "").trim() + "»" : "un campo obligatorio";
  }

  // ---------- Envío ----------
  function leerArchivo(archivo) {
    return new Promise(function (resolver, rechazar) {
      var r = new FileReader();
      r.onload = function () { resolver(String(r.result).split(",")[1] || ""); };
      r.onerror = rechazar;
      r.readAsDataURL(archivo);
    });
  }

  form.addEventListener("submit", function (evento) {
    evento.preventDefault();
    if (form.elements.web.value || Date.now() - inicio < 5000) {
      aviso("Ficha enviada. ¡Gracias!", "ok");
      return;
    }
    var errores = validar();
    if (errores.length) {
      var el = errores[0];
      if (el === form.elements.escudo) aviso("El escudo pesa más de 3 MB. Probad con un archivo más ligero o enviádnoslo después.", "error");
      else if (el === form.elements.contacto_email) aviso("Revisad el email de contacto, por ejemplo nombre@club.es.", "error");
      else aviso("Falta por completar " + nombreCampo(el) + ".", "error");
      el.focus();
      return;
    }

    var datos = valores();
    var archivo = form.elements.escudo.files[0];
    boton.disabled = true;
    aviso(archivo ? "Subiendo el escudo y enviando la ficha…" : "Enviando la ficha…");

    (archivo ? leerArchivo(archivo) : Promise.resolve(null))
      .then(function (contenido) {
        if (contenido) datos.escudo = { nombre: archivo.name, tipo: archivo.type || "application/octet-stream", contenido: contenido };
        return fetch("/api/ficha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(datos)
        });
      })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ }
        form.reset();
        lista.innerHTML = "";
        anadirEquipo();
        aviso("¡Ficha enviada! Nos pondremos en contacto con vosotros en los próximos días.", "ok");
        estado.scrollIntoView({ behavior: "smooth", block: "center" });
      })
      .catch(function () {
        aviso("No se ha podido enviar. Lo que habéis escrito sigue guardado: revisad la conexión y volved a intentarlo en unos minutos.", "error");
      })
      .finally(function () { boton.disabled = false; });
  });

  restaurar();
  recalcular();
})();
