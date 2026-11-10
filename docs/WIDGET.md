# Cromi Widget — guía de integración

Esta interfaz de chat flotante funciona en cualquier web moderna que admita módulos JavaScript. No requiere React, Vue, Angular, proveedores de IA ni servicios externos.

## 1. Probar la demo

Desde la raíz del repositorio:

    npm install
    npm run demo:widget

Abrir http://127.0.0.1:4173 . El ejemplo incluye personalización de nombre, colores, tema y ubicación; responde FAQs ficticias.

## 2. Instalarlo en un sitio propio

Copiá el directorio widget/ a un directorio público del sitio. Conservá juntos cromi-widget.js y cromi-widget.css. En tu HTML:

    <script type="module">
      import { mountCromiWidget } from "/widget/cromi-widget.js";

      const widget = mountCromiWidget({
        title: "Ayuda de mi empresa",
        subtitle: "Consultá la información disponible",
        welcome: "Hola. ¿Qué necesitás saber?",
        avatarUrl: "/images/mi-asistente.png", // opcional
        accentColor: "#2563eb",
        position: "right", // right | left
        theme: "auto", // auto | light | dark
        suggestions: ["Horarios", "Servicios", "Contacto"],
        respond: async ({ message, sessionId }) => ({
          text: "Conectá aquí tus propias respuestas."
        }),
      });
    </script>

El widget devuelve métodos open(), close(), send(message), isOpen() y destroy(). Todo el contenido de mensajes se muestra como texto; el HTML de la respuesta **no** se interpreta.

## 3. Dos modos de respuesta

### FAQ o motor local

Podés crear un núcleo con createCromi() y createFaqPlugin() e inyectar la función respond como en examples/widget.html. Para datos públicos estáticos no hace falta backend. No pongas allí datos privados.

### API propia

El backend debe recibir POST JSON y devolver JSON con al menos el campo text:

    { "message": "¿Cuáles son los horarios?", "sessionId": "..." }

    { "text": "Atendemos de lunes a viernes." }

Montaje:

    mountCromiWidget({
      apiEndpoint: "/api/asistente/chat",
      title: "Asistente",
    });

El endpoint pertenece a la aplicación integradora. Cromi Widget no crea rutas HTTP, autenticación ni información empresarial por sí mismo. Si usás una API de otro dominio, configurá CORS y autenticación apropiadamente. Nunca envíes credenciales secretas desde el navegador.

## 4. Personalización

- title, subtitle, welcome, placeholder, launcherLabel
- avatarUrl: imagen propia por URL HTTP(S); por defecto se usa un ícono genérico
- accentColor: color hexadecimal
- position: right o left
- theme: light, dark o auto
- suggestions: hasta cinco preguntas rápidas
- maxInputLength: 50–5000 caracteres
- target: elemento DOM que recibirá el widget

La interfaz utiliza Shadow DOM para evitar conflictos con los estilos de la página. Su CSS está separado y es libre de modificar. Podés cambiar por completo el diseño sin tocar el motor.

## 5. Limitaciones y privacidad

- No incluye imágenes, logos, identidades ni datos de terceros.
- No guarda un historial permanente; la conversación vive en el DOM y la memoria del motor de ejemplo es efímera.
- El sessionId se genera por instancia del widget.
- Las funciones respond() y API deben suministrar el contenido y controlar accesos.
- El adaptador local solo es adecuado para información pública. Los permisos de datos privados deben comprobarse en el servidor.
- Hay límites de longitud y bloqueo de envíos simultáneos; la aplicación deberá aplicar además cuotas y controles de abuso en backend.
- El widget no ejecuta compras, reservas ni escrituras por su cuenta.
