# WhatsApp Cloud API Webhook

Servidor Express listo para desplegar en [Render](https://render.com) que expone un Webhook compatible con la [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api).

## Configuración

1. Crea un archivo `.env` (opcional en local) o variables de entorno en Render con los siguientes valores:
   - `PORT`: Puerto en el que se ejecutará el servidor (Render lo define automáticamente).
   - `WHATSAPP_VERIFY_TOKEN`: Token de verificación que configuraste en Meta para validar el Webhook.
   - `WHATSAPP_ACCESS_TOKEN`: Token de acceso a la API de WhatsApp Cloud.
   - `WHATSAPP_PHONE_NUMBER_ID`: ID del número de teléfono de WhatsApp Cloud.

2. Instala dependencias:

   ```bash
   npm install
   ```

3. Ejecuta en local:

   ```bash
   npm start
   ```

## Rutas

- `GET /` devuelve un mensaje de estado.
- `GET /webhook` gestiona la verificación de Meta (necesario para conectar el Webhook).
- `POST /webhook` recibe mensajes entrantes y, si hay credenciales configuradas, responde con un mensaje de eco.

## Despliegue en Render

1. Crea un nuevo servicio Web en Render y vincula este repositorio.
2. Establece el comando de inicio en `npm start` (Render usará `render-start` automáticamente si está definido).
3. Configura las variables de entorno descritas anteriormente.
4. Conecta la URL pública que te entrega Render como URL del Webhook en Meta Developer.

La aplicación devolverá código 200 a las peticiones válidas de Meta y registrará en consola los mensajes entrantes para que puedas extender la lógica según tus necesidades.
