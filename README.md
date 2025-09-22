# Webhook de WhatsApp Business para Meta

Este proyecto expone un webhook en Node.js que cumple con los requisitos de verificación y entrega de eventos de Meta para WhatsApp Business Cloud API y reenvía los mensajes entrantes a un CRM externo.

## Requisitos previos

- Node.js 18 o superior.
- Una cuenta de Meta con acceso a WhatsApp Business Cloud API.
- URL de tu CRM o servicio interno que recibirá los mensajes (opcional si solo quieres inspeccionar los eventos).

## Configuración

1. Clona el repositorio y entra en la carpeta del proyecto.
2. Instala las dependencias.

   ```bash
   npm install
   ```

3. Configura las variables de entorno necesarias:

   - `META_VERIFY_TOKEN`: token que definirás también en el panel de desarrolladores de Meta para verificar el webhook.
   - `CRM_WEBHOOK_URL`: URL HTTP(S) a la que se reenviarán los mensajes normalizados.
   - `CRM_API_KEY`: token opcional que se incluirá como encabezado `Authorization` en las peticiones al CRM.
   - `PORT`: puerto en el que se ejecutará el servidor (por defecto `3000`). Render y otras plataformas asignan automáticamente esta variable.

Puedes crear un archivo `.env` y cargarlo manualmente o exportar las variables antes de iniciar el servidor.

## Ejecución local

```bash
npm start
```

El servidor expondrá los endpoints:

- `GET /webhook`: usado por Meta para verificar el webhook.
- `POST /webhook`: recepción de eventos y reenvío al CRM.

Para probar el webhook localmente puedes utilizar [ngrok](https://ngrok.com/) o una herramienta similar para crear un túnel HTTPS público hacia tu máquina.

## Registro del webhook en Meta

1. Inicia sesión en el [panel de desarrolladores de Meta](https://developers.facebook.com/).
2. Selecciona tu aplicación y ve a **WhatsApp > Configuración**.
3. En **Webhook**, agrega la URL pública de tu servidor (por ejemplo, la proporcionada por ngrok o Render) y el `META_VERIFY_TOKEN` que configuraste.
4. Suscribe los campos deseados (por ejemplo, `messages`).

## ¿Render o Google Apps Script?

- **Render**: es la opción recomendada. Permite desplegar directamente aplicaciones Node.js, maneja automáticamente la variable `PORT` y ofrece certificados HTTPS válidos. Solo debes crear un *Web Service*, conectar el repositorio y definir las variables de entorno (`META_VERIFY_TOKEN`, `CRM_WEBHOOK_URL`, `CRM_API_KEY`). Render instalará dependencias y ejecutará `npm start` por defecto.
- **Google Apps Script**: no es adecuado para este proyecto porque no ejecuta aplicaciones Node.js ni permite un servidor Express persistente. Apps Script está orientado a scripts en JavaScript orientados a G Suite y no cumple los requisitos de la API de Meta (no permite definir cabeceras personalizadas ni responder a las verificaciones de webhook de la manera esperada).

Por lo tanto, sube este proyecto a Render (u otra plataforma similar como Railway, Fly.io, etc.) y configura las variables de entorno allí. Una vez desplegado, copia la URL HTTPS que Render genere y configúrala en el panel de Meta.

## Despliegue en Render (resumen)

1. Crea un repositorio en GitHub/GitLab/Bitbucket con este proyecto.
2. En Render, crea un nuevo **Web Service** y conéctalo al repositorio.
3. Configura:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - Variables de entorno necesarias.
4. Render desplegará el servicio y mostrará una URL pública (por ejemplo, `https://tu-servicio.onrender.com`).
5. Usa esa URL para registrar el webhook en Meta como se describe arriba.

Con esto tendrás el webhook listo para recibir mensajes de WhatsApp Business y reenviarlos a tu CRM.
