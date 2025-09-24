const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;
const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'ReLead_Verify_Token';
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const crmWebhookUrl = 'https://script.google.com/macros/s/AKfycbzg0XHsW_fYiVhEcmp0WB3zmqQ9hV-usT0EDsnhwBlD8CSat3Gc_-lDOhMyGIUMjbcq/exec';
const crmApiKey = process.env.CRM_API_KEY;

if (crmWebhookUrl) {
  console.log(`CRM sync enabled using hardcoded URL: ${crmWebhookUrl}`);
} else {
  console.log('CRM sync disabled: set CRM_WEBHOOK_URL or API_URL to forward events.');
}

if (!accessToken || !phoneNumberId) {
  console.warn('WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing. Automated replies are disabled.');
}

app.use(express.json());

app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'WhatsApp Cloud API webhook is running' });
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified');
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  }

  return res.sendStatus(400);
});

app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (value) {
      const crmPayload = buildCrmPayload(value);
      await sendDataToCrm(crmPayload);
    }

    if (message) {
      console.log('Incoming message:', JSON.stringify(message, null, 2));

      if (message.type === 'text' && phoneNumberId && accessToken) {
        try {
          await sendWhatsAppText(message.from, `Recibí tu mensaje: ${message.text.body}`);
        } catch (error) {
          console.error('Error sending reply to WhatsApp:', error?.response?.data || error.message);
        }
      }
    }

    return res.sendStatus(200);
  }

  return res.sendStatus(404);
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

async function sendWhatsAppText(to, text) {
  if (!phoneNumberId || !accessToken) {
    console.warn('Cannot send message because phone number ID or access token is not set.');
    return;
  }

  const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text }
  };

  await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
}

function buildCrmPayload(value) {
  const contact = value?.contacts?.[0] || {};
  const messages = (value?.messages || []).map((msg) => buildCrmMessage(msg));
  const statuses = (value?.statuses || []).map((status) => ({
    id: status.id,
    status: status.status,
    timestamp: status.timestamp,
    recipientId: status.recipient_id,
    conversation: status.conversation,
    pricing: status.pricing,
    errors: status.errors
  }));
  const firstStatusRecipient = value?.statuses?.[0]?.recipient_id;

  return {
    contact: {
      waId: contact.wa_id || messages[0]?.from || firstStatusRecipient || null,
      profileName: contact.profile?.name || null
    },
    metadata: value?.metadata,
    messages,
    statuses
  };
}

function buildCrmMessage(msg = {}) {
  const base = {
    id: msg.id,
    from: msg.from,
    timestamp: msg.timestamp,
    type: msg.type
  };

  if (msg.text?.body) {
    base.text = msg.text.body;
  }

  if (msg.button?.text) {
    base.buttonText = msg.button.text;
  }

  if (msg.interactive) {
    base.interactive = {
      type: msg.interactive.type,
      buttonReply: msg.interactive.button_reply,
      listReply: msg.interactive.list_reply
    };
  }

  const media = extractMediaInfo(msg);
  if (media) {
    base.media = media;
  }

  if (msg.context) {
    base.context = {
      id: msg.context.id,
      from: msg.context.from
    };
  }

  return base;
}

function extractMediaInfo(msg = {}) {
  const mediaTypes = ['image', 'audio', 'document', 'video', 'sticker'];

  for (const type of mediaTypes) {
    if (msg[type]) {
      return {
        type,
        id: msg[type].id,
        mimeType: msg[type].mime_type,
        sha256: msg[type].sha256,
        caption: msg[type].caption
      };
    }
  }

  if (msg.location) {
    return {
      type: 'location',
      latitude: msg.location.latitude,
      longitude: msg.location.longitude,
      name: msg.location.name,
      address: msg.location.address
    };
  }

  return null;
}

async function sendDataToCrm(payload) {
  if (!payload) {
    return;
  }

  if (!crmWebhookUrl) {
    console.log('CRM webhook URL is not configured. Skipping CRM sync.');
    return;
  }

  const hasMessages = Array.isArray(payload.messages) && payload.messages.length > 0;
  const hasStatuses = Array.isArray(payload.statuses) && payload.statuses.length > 0;

  if (!hasMessages && !hasStatuses) {
    console.log('No CRM data to send.');
    return;
  }

  try {
    await axios.post(crmWebhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...(crmApiKey ? { Authorization: `Bearer ${crmApiKey}` } : {})
      }
    });
    console.log('CRM payload sent successfully');
  } catch (error) {
    console.error('Error sending data to CRM:', error?.response?.data || error.message);
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
