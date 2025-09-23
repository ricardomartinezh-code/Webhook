const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;
const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'ReLead_Verify_Token';
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
