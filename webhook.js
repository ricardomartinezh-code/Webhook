const express = require("express");
const axios = require("axios");
const { google } = require("googleapis");

const app = express();

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL;
const CRM_API_KEY = process.env.CRM_API_KEY;
const PORT = process.env.PORT || 3000;
const GOOGLE_SHEETS_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const GOOGLE_SHEETS_RANGE = process.env.GOOGLE_SHEETS_RANGE || "Hoja 1!A2";
const GOOGLE_SHEETS_CREDENTIALS = process.env.GOOGLE_SHEETS_CREDENTIALS;

let sheetsServicePromise = null;

function isPromise(value) {
  return value && typeof value.then === "function" && typeof value.catch === "function";
}

app.use(express.json({ limit: "1mb" }));

/**
 * Extrae los mensajes individuales de la estructura que envía Meta.
 * Solo procesamos eventos provenientes de WhatsApp Business.
 * @param {object} body - Cuerpo completo recibido desde Meta.
 * @returns {Array<object>} Lista plana de mensajes.
 */
function extractWhatsAppMessages(body) {
  if (!body || body.object !== "whatsapp_business_account" || !Array.isArray(body.entry)) {
    return [];
  }

  const messages = [];

  body.entry.forEach((entry) => {
    const changes = entry.changes || [];

    changes.forEach((change) => {
      const value = change.value || {};
      const contacts = value.contacts || [];
      const waMessages = value.messages || [];

      waMessages.forEach((message) => {
        const contact = contacts.find((c) => c.wa_id === message.from) || contacts[0];

        messages.push({
          id: message.id,
          type: message.type,
          from: message.from,
          profileName: contact?.profile?.name,
          timestamp: message.timestamp,
          text: message.text?.body,
          interactive: message.interactive,
          location: message.location,
          image: message.image,
          audio: message.audio,
          video: message.video,
          button: message.button,
          metadata: value.metadata,
        });
      });
    });
  });

  return messages;
}

/**
 * Prepara el payload que se enviará al CRM para representar el mensaje.
 * @param {object} message - Mensaje normalizado.
 * @returns {object}
 */
function buildCrmPayload(message) {
  return {
    source: "whatsapp",
    externalMessageId: message.id,
    from: message.from,
    profileName: message.profileName || null,
    timestamp: message.timestamp ? Number(message.timestamp) * 1000 : Date.now(),
    type: message.type,
    content: {
      text: message.text,
      interactive: message.interactive,
      location: message.location,
      media: {
        image: message.image,
        audio: message.audio,
        video: message.video,
      },
      button: message.button,
    },
    metadata: message.metadata,
  };
}

/**
 * Envía los mensajes al CRM configurado.
 * @param {Array<object>} messages - Lista de mensajes normalizados.
 */
async function forwardMessagesToCrm(messages) {
  if (!CRM_WEBHOOK_URL) {
    console.warn("No se configuró CRM_WEBHOOK_URL. Los mensajes no se reenviarán.");
    return;
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (CRM_API_KEY) {
    headers.Authorization = `Bearer ${CRM_API_KEY}`;
  }

  const deliveries = messages.map(async (message) => {
    const payload = buildCrmPayload(message);

    try {
      await axios.post(CRM_WEBHOOK_URL, payload, { headers });
      console.log(`Mensaje reenviado al CRM: ${message.id}`);
    } catch (error) {
      const errorMessage =
        error.response?.data || error.message || "Error desconocido al comunicar con el CRM";
      console.error(`No se pudo reenviar el mensaje ${message.id} al CRM:`, errorMessage);
    }
  });

  await Promise.allSettled(deliveries);
}

function parseGoogleCredentials(rawCredentials) {
  if (!rawCredentials) {
    throw new Error("No se proporcionaron credenciales de Google");
  }

  const trimmed = rawCredentials.trim();

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    try {
      const decoded = Buffer.from(trimmed, "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch (nestedError) {
      throw new Error("Las credenciales de Google no tienen un formato JSON válido ni Base64");
    }
  }
}

async function getSheetsService() {
  if (!GOOGLE_SHEETS_SPREADSHEET_ID || !GOOGLE_SHEETS_CREDENTIALS) {
    return null;
  }

  if (!sheetsServicePromise) {
    sheetsServicePromise = (async () => {
      try {
        const credentials = parseGoogleCredentials(GOOGLE_SHEETS_CREDENTIALS);
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        const authClient = await auth.getClient();
        return google.sheets({ version: "v4", auth: authClient });
      } catch (error) {
        console.error("No se pudo inicializar el cliente de Google Sheets:", error.message || error);
        return null;
      }
    })();
  }

  return sheetsServicePromise;
}

async function appendMessagesToGoogleSheet(messages) {
  const sheets = await getSheetsService();

  if (!sheets) {
    return;
  }

  const values = messages.map((message) => [
    new Date().toISOString(),
    message.from,
    message.profileName || "",
    message.type,
    message.text || "",
    message.interactive ? JSON.stringify(message.interactive) : "",
    message.location ? JSON.stringify(message.location) : "",
    message.metadata ? JSON.stringify(message.metadata) : "",
  ]);

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEETS_SPREADSHEET_ID,
      range: GOOGLE_SHEETS_RANGE,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    console.log(`Se agregaron ${values.length} fila(s) a Google Sheets`);
  } catch (error) {
    const errorMessage = error.response?.data || error.message || "Error desconocido al escribir en Google Sheets";
    console.error("No se pudieron agregar los mensajes a Google Sheets:", errorMessage);
  }
}

// Ruta para verificación de webhook de Meta
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (!mode || !token) {
    return res.status(400).send("Solicitud inválida");
  }

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WEBHOOK_VERIFIED");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Ruta para recibir eventos de Meta
app.post("/webhook", async (req, res) => {
  const { body } = req;

  if (!body) {
    console.warn("Se recibió un cuerpo vacío en el webhook");
    return res.sendStatus(400);
  }

  const messages = extractWhatsAppMessages(body);

  if (messages.length > 0) {
    const crmPromise = forwardMessagesToCrm(messages);
    if (isPromise(crmPromise)) {
      crmPromise.catch((error) => {
        console.error("Error inesperado al reenviar mensajes al CRM:", error);
      });
    }

    const sheetsPromise = appendMessagesToGoogleSheet(messages);
    if (isPromise(sheetsPromise)) {
      sheetsPromise.catch((error) => {
        console.error("Error inesperado al agregar mensajes en Google Sheets:", error);
      });
    }
  } else {
    console.log("Evento recibido sin mensajes manejables:", JSON.stringify(body));
  }

  // Meta requiere responder rápidamente para considerar el evento entregado.
  return res.status(200).send("EVENT_RECEIVED");
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Render y otras plataformas detectan automáticamente el puerto desde la variable de entorno PORT.
app.listen(PORT, () => {
  console.log(`Servidor de webhook escuchando en el puerto ${PORT}`);
});
