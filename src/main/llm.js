/**
 * LLM Client Module
 * 
 * Primary: LM Studio (local, OpenAI-compatible API)
 * 
 * Future integration points marked with: // FUTURE: [provider]
 * - OpenAI API (cloud)
 * - Ollama (local)
 * - llama.cpp standalone
 */

const http = require('http');

// LM Studio default endpoint (OpenAI-compatible)
const LM_STUDIO_HOST = 'localhost';
const LM_STUDIO_PORT = 1234;

// FUTURE: OpenAI - const OPENAI_BASE_URL = 'https://api.openai.com/v1';
// FUTURE: Ollama - const OLLAMA_BASE_URL = 'http://localhost:11434/api';

/**
 * Make HTTP request (promisified)
 */
function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Check if LM Studio is running and get model info
 */
async function checkHealth() {
  try {
    const data = await httpRequest({
      hostname: LM_STUDIO_HOST,
      port: LM_STUDIO_PORT,
      path: '/v1/models',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const model = data.data?.[0]?.id || 'unknown';
    return { status: 'ready', model };
  } catch (err) {
    // FUTURE: OpenAI - check OPENAI_API_KEY env var and test connection
    // FUTURE: Ollama - try OLLAMA_BASE_URL/api/tags
    console.error('LLM health check failed:', err.message);
    return { status: 'offline', error: 'LM Studio not running. Start LM Studio and load a model.' };
  }
}

/**
 * Send a chat completion request to LM Studio
 */
async function chatCompletion(messages, options = {}) {
  const {
    temperature = 0.3,
    maxTokens = 1024,
  } = options;

  // FUTURE: OpenAI - add Authorization header with Bearer token
  // FUTURE: Ollama - use different endpoint format (/api/chat)
  
  const data = await httpRequest({
    hostname: LM_STUDIO_HOST,
    port: LM_STUDIO_PORT,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
  });

  return data.choices?.[0]?.message?.content || '';
}

/**
 * Extract entities from transcript text
 */
async function extractEntities(transcriptText) {
  const systemPrompt = `You are analyzing a tabletop RPG (D&D) game transcript. Extract named entities mentioned.

Return ONLY a JSON array with this exact format (no markdown, no explanation):
[
  {"name": "EntityName", "type": "character|monster|place|item", "description": "brief description"}
]

Rules:
- Only include proper nouns (specific named things)
- Skip generic terms like "the party", "the dungeon", "a sword"
- Types: character (PCs, NPCs, named people), monster (creatures, beasts), place (locations, buildings), item (artifacts, named objects)
- Keep descriptions brief (under 10 words)
- If no entities found, return empty array: []`;

  const userPrompt = `Extract entities from this transcript:
---
${transcriptText}
---`;

  try {
    const response = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // Parse JSON from response
    // Handle potential markdown code blocks
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const entities = JSON.parse(jsonStr);
    
    // Validate structure
    if (!Array.isArray(entities)) {
      console.error('LLM returned non-array:', response);
      return [];
    }

    // Filter and validate each entity
    return entities.filter(e => 
      e.name && 
      typeof e.name === 'string' &&
      ['character', 'monster', 'place', 'item'].includes(e.type)
    ).map(e => ({
      name: e.name.trim(),
      type: e.type,
      description: e.description || '',
    }));

  } catch (err) {
    console.error('Entity extraction failed:', err);
    return [];
  }
}

/**
 * Generate an image prompt for an entity
 */
async function generateImagePrompt(entity) {
  const systemPrompt = `You generate image prompts for a fantasy RPG image generator.
Given an entity, create a vivid, detailed prompt for generating its portrait/depiction.
Keep prompts under 50 words. Focus on visual details.
Style: fantasy art, detailed, dramatic lighting`;

  const userPrompt = `Generate an image prompt for:
Name: ${entity.name}
Type: ${entity.type}
Description: ${entity.description}`;

  try {
    const response = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.7 });

    return response.trim();
  } catch (err) {
    console.error('Image prompt generation failed:', err);
    // Fallback to simple prompt
    return `Fantasy ${entity.type}: ${entity.name}, ${entity.description}, detailed fantasy art`;
  }
}

/**
 * Generate an image prompt from a scene/transcript chunk
 */
async function generateScenePrompt(sceneText) {
  const systemPrompt = `You generate image prompts for a fantasy RPG scene image generator.
Given a transcript snippet from a tabletop RPG session, create a vivid image prompt capturing the scene.
Focus on the most visual/dramatic moment described.
Keep prompts under 60 words. Focus on visual details, atmosphere, lighting.
Style: fantasy art, cinematic, detailed
Return ONLY the prompt, no explanation.`;

  const userPrompt = `Generate an image prompt for this scene:
---
${sceneText}
---`;

  try {
    const response = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.7 });

    return response.trim();
  } catch (err) {
    console.error('Scene prompt generation failed:', err);
    return `Fantasy RPG scene: ${sceneText.slice(0, 100)}, dramatic lighting, detailed fantasy art`;
  }
}

module.exports = {
  checkHealth,
  chatCompletion,
  extractEntities,
  generateImagePrompt,
  generateScenePrompt,
};
