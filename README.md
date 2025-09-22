# Webhook de WhatsApp Business para Meta

Este proyecto expone un webhook en Node.js que cumple con los requisitos de verificación y entrega de eventos de Meta para WhatsApp Business Cloud API y reenvía los mensajes entrantes a un CRM externo o a una hoja de cálculo de Google Sheets.

## Requisitos previos

- Node.js 18 o superior.
- Una cuenta de Meta con acceso a WhatsApp Business Cloud API.
- URL de tu CRM o servicio interno que recibirá los mensajes (opcional si solo quieres inspeccionar los eventos).
- (Opcional) Una hoja de cálculo de Google y una cuenta de servicio para registrar los mensajes.

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
   - `GOOGLE_SHEETS_SPREADSHEET_ID`: identificador del Google Sheet donde se escribirán los mensajes (opcional).
   - `GOOGLE_SHEETS_RANGE`: rango en formato A1 donde se insertarán las filas (opcional, por defecto `Hoja 1!A2`).
   - `GOOGLE_SHEETS_CREDENTIALS`: credenciales del servicio de Google en formato JSON o en Base64 (opcional).

Puedes crear un archivo `.env` y cargarlo manualmente o exportar las variables antes de iniciar el servidor.

## Ejecución local

```bash
npm start
```

El servidor expondrá los endpoints:

- `GET /webhook`: usado por Meta para verificar el webhook.
- `POST /webhook`: recepción de eventos y reenvío al CRM o Google Sheets.

Para probar el webhook localmente puedes utilizar [ngrok](https://ngrok.com/) o una herramienta similar para crear un túnel HTTPS público hacia tu máquina.

## Registro del webhook en Meta

1. Inicia sesión en el [panel de desarrolladores de Meta](https://developers.facebook.com/).
2. Selecciona tu aplicación y ve a **WhatsApp > Configuración**.
3. En **Webhook**, agrega la URL pública de tu servidor (por ejemplo, la proporcionada por ngrok o Render) y el `META_VERIFY_TOKEN` que configuraste.
4. Suscribe los campos deseados (por ejemplo, `messages`).

## Integración opcional con Google Sheets

Si deseas que los mensajes se registren también en una hoja de cálculo de Google, sigue estos pasos:

1. En Google Cloud Console, crea un proyecto (o reutiliza uno existente) y habilita la **Google Sheets API**.
2. Crea una **cuenta de servicio** con rol mínimo "Editor" sobre el proyecto y descarga el archivo de credenciales en formato JSON.
3. Comparte el Google Sheet con el correo electrónico de la cuenta de servicio, otorgándole permiso de edición.
4. Copia el `spreadsheetId` (está en la URL de la hoja) y defínelo en `GOOGLE_SHEETS_SPREADSHEET_ID`.
5. Define `GOOGLE_SHEETS_RANGE` con el rango donde se insertarán las filas (por ejemplo `Registros!A2`).
6. Asigna el contenido del JSON de la cuenta de servicio a `GOOGLE_SHEETS_CREDENTIALS`. Puedes pegar el JSON completo o codificarlo en Base64 (por ejemplo `base64 < credenciales.json`) para facilitar su almacenamiento en Render.

Cada mensaje recibido añadirá una fila con la marca de tiempo de procesamiento, el número del remitente, nombre del perfil, tipo de mensaje, texto y los datos estructurados (botones, interacciones, ubicación y metadatos) en formato JSON.

## ¿Render o Google Apps Script?

- **Render**: es la opción recomendada. Permite desplegar directamente aplicaciones Node.js, maneja automáticamente la variable `PORT` y ofrece certificados HTTPS válidos. Solo debes crear un *Web Service*, conectar el repositorio y definir las variables de entorno (`META_VERIFY_TOKEN`, `CRM_WEBHOOK_URL`, `CRM_API_KEY`, `GOOGLE_SHEETS_*` si los utilizas). Render instalará dependencias y ejecutará `npm start` por defecto.
- **Google Apps Script**: no es adecuado para este proyecto porque no ejecuta aplicaciones Node.js ni permite un servidor Express persistente. Apps Script está orientado a scripts en Google Workspace y no cumple los requisitos de la API de Meta (no permite definir cabeceras personalizadas ni responder a las verificaciones de webhook de la manera esperada).

Por lo tanto, sube este proyecto a Render (u otra plataforma similar como Railway, Fly.io, etc.) y configura las variables de entorno allí. Una vez desplegado, copia la URL HTTPS que Render genere y configúrala en el panel de Meta.

## Despliegue en Render (resumen)

1. Crea un repositorio en GitHub/GitLab/Bitbucket con este proyecto. Mantén el archivo `.nvmrc` en la raíz para que Render detecte automáticamente la versión de Node 18.
2. En Render, crea un nuevo **Web Service** y conéctalo al repositorio.
3. Configura:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - Variables de entorno necesarias.
4. En la sección **Environment**, verifica que Render muestre `NODE_VERSION=18`. Si no aparece automáticamente, añade la variable con ese valor de forma manual y vuelve a desplegar.
5. Render desplegará el servicio y mostrará una URL pública (por ejemplo, `https://tu-servicio.onrender.com`).
6. Usa esa URL para registrar el webhook en Meta como se describe arriba.

Con esto tendrás el webhook listo para recibir mensajes de WhatsApp Business, reenviarlos a tu CRM y registrar los datos en Google Sheets si lo deseas.
