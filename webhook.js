const express = require("express");
const app = express();

app.use(express.json());

// Ruta para verificación de webhook de Meta
app.get("/webhook", (req, res) => {
  const verify_token = "TU_TOKEN_DE_VERIFICACION_UNICO";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === verify_token) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Ruta para recibir eventos de Meta
app.post("/webhook", (req, res) => {
  console.log("Evento recibido:", JSON.stringify(req.body, null, 2));
  // Aquí procesas los eventos que te envía Meta (mensajes, cambios, etc.)
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook corriendo en puerto ${PORT}`));