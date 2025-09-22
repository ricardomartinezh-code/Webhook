const express = require("express");
const axios = require("axios");

const app = express();

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL;
const CRM_API_KEY = process.env.CRM_API_KEY;
const PORT = process.env.PORT || 3000;

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
    forwardMessagesToCrm(messages).catch((error) => {
      console.error("Error inesperado al reenviar mensajes al CRM:", error);
    });
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
