# somoscantera.es

Web pública de Somos Cantera. HTML, CSS y JavaScript sin dependencias ni paso de compilación.
Se publica en Vercel desde la rama `main`.

| Archivo | Qué es |
|---|---|
| `index.html` | Página principal |
| `privacidad.html`, `aviso-legal.html` | Páginas legales |
| `css/site.css` | Estilos |
| `js/site.js` | Envío del formulario a Supabase |
| `assets/` | Logotipos y foto |
| `vercel.json` | Redirecciones de la web antigua y cabeceras de seguridad |

## Formulario de contacto

Las solicitudes se guardan en el proyecto de Supabase **Somos Cantera**, tabla `public.solicitudes`.
Se consultan en el panel de Supabase: *Table Editor → solicitudes*. Las columnas `estado` y `notas` sirven para el seguimiento.

La clave de `js/site.js` es la publicable: con ella solo se pueden **insertar** solicitudes.
La tabla tiene RLS y la web no puede leer, modificar ni borrar datos.

## Aviso importante

En el plan gratuito, Supabase pausa los proyectos tras una semana sin actividad. Si eso ocurre,
el formulario deja de guardar solicitudes hasta que se reactive el proyecto desde el panel.
