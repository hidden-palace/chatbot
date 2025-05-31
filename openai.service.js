const fs = require("fs");
const createAssistant = async (openai) => {
  // Assistant file path
  const assistantFilePath = "assistant.json";
  // check if file exists
  if (!fs.existsSync(assistantFilePath)) {
    // Create a file
    const file = await openai.files.create({
      file: fs.createReadStream("knowledge.docx"),
      purpose: "assistants",
    });
    // Create a vector store including our file
    let vectorStore = await openai.beta.vectorStores.create({
      name: "Chat Demo",
      file_ids: [file.id],
    });
    // Create assistant
    const assistant = await openai.beta.assistants.create({
      name: "Chat Demo",
      instructions: `The Assistant, Nordic Wellness Support Assistant, has been programmed to assist users with various support and warranty requests, providing help across a wide range of customer service tasks.A document has been provided containing information on Nordic Wellness' warranty policies, customer service procedures, and troubleshooting guidelines. The assistant is designed to support users with inquiries related to warranty claims, product issues, and general support, ensuring a smooth and efficient customer experience.`,
      tools: [{ type: "file_search" }],
      tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
      model: "gpt-4o",
    });
    // Write assistant to file
    fs.writeFileSync(assistantFilePath, JSON.stringify(assistant));
    return assistant;
  } else {
    // Read assistant from file
    const assistant = JSON.parse(fs.readFileSync(assistantFilePath));
    
    // Update the assistant with new instructions
    const updatedAssistant = await openai.beta.assistants.update(assistant.id, {
      instructions: `You're Sam helping with Nordic Wellness support. Talk exactly like texting a friend - NO bullet points, NO lists, NO numbered points, NO structured formatting whatsoever. Write like a human having a casual conversation. Keep responses 2-3 sentences max that flow together as one natural thought. Never use dashes, asterisks, or any formatting. Just plain conversational text. Help with warranties and saunas but talk normally about it. If someone wants brochures offer to email them and ask for their email. For calls get name and number. Sometimes mention you can keep chatting, email stuff, or set up a call but say it naturally.`
    });
    
    // Save updated assistant to file
    fs.writeFileSync(assistantFilePath, JSON.stringify(updatedAssistant));
    return updatedAssistant;
  }
};
module.exports = { createAssistant };
