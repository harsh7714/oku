import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { containsExplicitWord } from './explicitFilter.js';

/**
 * Inspects image, video, or audio file buffer using Gemini API for explicit / NSFW content.
 * Applies zero-tolerance safety settings and candidate safety rating inspection.
 * 
 * @param {Buffer} fileBuffer 
 * @param {string} mimeType 
 * @param {string} filename 
 * @returns {Promise<{ isExplicit: boolean, reason: string | null }>}
 */
export async function checkMediaExplicitWithGemini(fileBuffer, mimeType, filename = 'file') {
  console.log(`[Gemini Media Moderation] Analyzing file: "${filename}" (${mimeType}, ${fileBuffer ? fileBuffer.length : 0} bytes)`);

  // 1. Local fallback check on filename
  if (filename && containsExplicitWord(filename)) {
    console.log(`[Gemini Media Moderation] Flagged by filename rule: "${filename}"`);
    return {
      isExplicit: true,
      reason: 'Uploaded file name contains explicit or inappropriate terms.'
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('[Gemini Media Moderation] GEMINI_API_KEY is missing in environment.');
    return { isExplicit: false, reason: null };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a zero-tolerance explicit media content safety moderator for a public social network.
Analyze this uploaded image, video, or audio file with extreme care.
Determine if it contains ANY explicit, NSFW, pornographic, sexually suggestive, or adult content, including:
- Nudity or partial nudity
- Exposed breasts, nipples, cleavage, buttocks, or genitalia
- Lingerie, underwear, or sexually provocative poses
- Pornographic material, erotic art, or explicit adult themes
- Graphic violence, gore, or extreme hate material

If ANY of the above elements are detected, you MUST mark "isExplicit": true and state the reason.
Output valid JSON strictly in this exact format:
{
  "isExplicit": boolean,
  "reason": "explanation if explicit, else null"
}`;

    const base64Data = fileBuffer.toString('base64');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
          },
        ],
      },
    });

    // Check candidate finishReason or blockReason
    const candidate = response.candidates?.[0];
    if (candidate && candidate.finishReason === 'SAFETY') {
      console.log(`[Gemini Media Moderation] Flagged by Gemini safety finishReason: SAFETY`);
      return {
        isExplicit: true,
        reason: 'Media flagged and blocked by Gemini AI safety system (Sexually Explicit / NSFW Content).'
      };
    }

    // Inspect safetyRatings for high/medium/low sexually explicit probability
    if (candidate && candidate.safetyRatings) {
      for (const rating of candidate.safetyRatings) {
        if (
          rating.category === 'HARM_CATEGORY_SEXUALLY_EXPLICIT' &&
          ['HIGH', 'MEDIUM', 'LOW'].includes(rating.probability)
        ) {
          console.log(`[Gemini Media Moderation] Flagged by Gemini safetyRating: ${rating.probability}`);
          return {
            isExplicit: true,
            reason: `Media flagged by Gemini safety rating (${rating.probability} probability of explicit content).`
          };
        }
      }
    }

    const responseText = response.text || '';
    
    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.isExplicit) {
          console.log(`[Gemini Media Moderation] Flagged explicit by Gemini model response JSON:`, parsed.reason);
          return {
            isExplicit: true,
            reason: parsed.reason || 'Explicit content detected by Gemini AI safety moderation',
          };
        }
      } catch (e) {
        // Ignored
      }
    }

    // Check fallback keywords if response contains explicit flags
    if (/true|explicit|pornographic|nsfw|nude|nudity|breast|boob|buttock|genitalia|provocative|sexually|violent/i.test(responseText) && !responseText.includes('"isExplicit": false')) {
      console.log(`[Gemini Media Moderation] Flagged explicit by text fallback:`, responseText);
      return { isExplicit: true, reason: 'Media contains inappropriate or explicit content.' };
    }

    console.log(`[Gemini Media Moderation] Media passed moderation: "${filename}"`);
    return { isExplicit: false, reason: null };
  } catch (error) {
    console.error(`[Gemini Media Moderation Error] ${filename}:`, error.message);
    // If Gemini safety block triggered exception, flag as explicit
    if (
      error.message &&
      (error.message.includes('SAFETY') ||
       error.message.includes('BLOCKED') ||
       error.message.includes('block') ||
       error.message.includes('finishReason') ||
       error.message.includes('safety'))
    ) {
      return { isExplicit: true, reason: 'Media blocked by Gemini AI safety policy (Sexually Explicit / NSFW Content).' };
    }
    return { isExplicit: false, reason: null };
  }
}

export default checkMediaExplicitWithGemini;
