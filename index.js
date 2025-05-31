const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();
const OpenAI = require("openai");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const { createAssistant } = require("./openai.service");
app.use(cors());
app.use(bodyParser.json());

(async () => {
  const assistant = await createAssistant(openai);
  app.get("/start", async (req, res) => {
    const thread = await openai.beta.threads.create();
    return res.json({ thread_id: thread.id });
  });

  app.post("/chat", async (req, res) => {
    const assistantId = assistant.id;
    const threadId = req.body.thread_id;
    const message = req.body.message;
    if (!threadId) {
      return res.status(400).json({ error: "Missing thread_id" });
    }
    console.log(`Received message: ${message} for thread ID: ${threadId}`);

    // Create message in thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    // Get AI response
    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: assistantId,
    });
    const messages = await openai.beta.threads.messages.list(run.thread_id);
    const response = messages.data[0].content[0].text.value;

    // Extract email, phone, and name using regex
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
    const phoneRegex = /(?:\+\d{1,3}[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/;
    const nameRegex = /(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/;

    const emailMatch = message.match(emailRegex);
    const phoneMatch = message.match(phoneRegex);
    const nameMatch = message.match(nameRegex);

    const email = emailMatch ? emailMatch[0] : null;
    const phone = phoneMatch ? phoneMatch[0] : null;
    const name = nameMatch ? nameMatch[1].split(' ') : null;

    // Check if this is a brochure request (keywords that indicate brochure interest)
    const brochureKeywords = ['brochure', 'brochures', 'information', 'details', 'catalog', 'materials', 'send me', 'email me'];
    const isBrochureRequest = brochureKeywords.some(keyword => 
      message.toLowerCase().includes(keyword) || response.toLowerCase().includes(keyword)
    );

    // Send to make.com webhooks if email found
    if (email) {
      try {
        if (isBrochureRequest) {
          // Send to brochure webhook
          await fetch('https://hook.us2.make.com/grvjhbwp9vvdiru4hfrqibn6imhx7ata', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: email,
              brochureRequest: message,
              userInterest: message
            })
          });
        } else {
          // Send to general email webhook
          await fetch('https://hook.us2.make.com/538cd02cr66b2une4g4iex53viko01ec', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: email,
              intent: message
            })
          });
        }
      } catch (error) {
        console.error('Error sending to email webhook:', error);
      }
    }

    if (phone) {
      try {
        await fetch('https://hook.us2.make.com/azarrw5ga5ot6aghdced31deuncpveya', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phone: phone,
            firstName: name ? name[0] : null,
            lastName: name ? name[name.length - 1] : null,
            intent: message
          })
        });
      } catch (error) {
        console.error('Error sending to phone webhook:', error);
        console.log('Failed payload:', {
          phone: phone,
          firstName: name ? name[0] : null,
          lastName: name ? name[name.length - 1] : null,
          intent: message
        });
      }
    }

    return res.json({ response });
  });

  app.listen(8080, () => {
    console.log("Server running on port 8080");
  });
})();