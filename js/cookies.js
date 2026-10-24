/* Somos Cantera — aviso de cookies y Google Analytics.
   Analytics solo se carga si el visitante pulsa «Aceptar». Si rechaza (o no
   contesta) no se carga nada de Google. La elección se guarda en este navegador
   y se puede cambiar desde el enlace «Cookies» del pie. */
(function () {
  "use strict";

  var ID = "G-S6B3RERDET";
  var CLAVE = "sc-cookies"; // "si" | "no"
  var cargado = false;

  function leer() { try { return localStorage.getItem(CLAVE); } catch (e) { return null; } }
  function guardar(v) { try { localStorage.setItem(CLAVE, v); } catch (e) { /* sin almacenamiento */ } }

  function cargarAnalytics() {
    if (cargado) return;
    cargado = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", ID);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
    document.head.appendChild(s);
  }

  // Al rechazar después de haber aceptado: borra las cookies de Analytics.
  function borrarCookiesGA() {
    var dominios = ["", location.hostname, "." + location.hostname.replace(/^www\./, "")];
    document.cookie.split(";").forEach(function (c) {
      var nombre = c.split("=")[0].trim();
      if (!/^_ga/.test(nombre)) return;
      dominios.forEach(function (d) {
        document.cookie = nombre + "=; Max-Age=0; path=/" + (d ? "; domain=" + d : "");
      });
    });
  }

  var aviso;
  function mostrarAviso() {
    if (aviso) { aviso.hidden = false; aviso.querySelector("button").focus(); return; }
    aviso = document.createElement("div");
    aviso.className = "aviso-cookies";
    aviso.setAttribute("role", "dialog");
    aviso.setAttribute("aria-label", "Cookies");
    var p = document.createElement("p");
    p.appendChild(document.createTextNode("Usamos cookies de Google Analytics para saber cuántas personas visitan la web y qué secciones les interesan. Solo se activan si las aceptas. "));
    var a = document.createElement("a");
    a.href = "/privacidad.html#cookies";
    a.textContent = "Más información";
    p.appendChild(a);
    var botones = document.createElement("div");
    botones.className = "aviso-cookies__botones";
    [["Rechazar", "no", "boton boton--oscuro"], ["Aceptar", "si", "boton boton--oscuro"]].forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = b[2];
      btn.textContent = b[0];
      btn.addEventListener("click", function () { decidir(b[1]); });
      botones.appendChild(btn);
    });
    aviso.appendChild(p);
    aviso.appendChild(botones);
    document.body.appendChild(aviso);
  }

  function decidir(v) {
    var antes = leer();
    guardar(v);
    if (aviso) aviso.hidden = true;
    if (v === "si") cargarAnalytics();
    else if (antes === "si") { borrarCookiesGA(); location.reload(); }
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-cookies]");
    if (t) { e.preventDefault(); mostrarAviso(); }
  });

  var eleccion = leer();
  if (eleccion === "si") cargarAnalytics();
  else if (eleccion !== "no") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mostrarAviso);
    else mostrarAviso();
  }
})();
