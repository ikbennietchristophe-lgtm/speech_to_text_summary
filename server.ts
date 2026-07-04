import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Set generous body size limit to support rich base64 voice recordings
  app.use(express.json({ limit: '100mb' }));
  app.use(cors());

  // Initialize Gemini SDK with User-Agent header for telemetry
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // API endpoint to summarize recorded audio using Gemini
  app.post('/api/summarize', async (req, res) => {
    try {
      const { audioBase64, mimeType, language } = req.body;

      if (!audioBase64) {
        return res.status(400).json({ error: language === 'nl' ? 'Geen audiogegevens geleverd' : 'No audio data provided' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: language === 'nl' ? 'Gemini API-sleutel is niet geconfigureerd' : 'Gemini API key is not configured' });
      }

      // Clean mimeType: remove any codec parameters (e.g., 'audio/webm;codecs=opus' -> 'audio/webm')
      let cleanMimeType = mimeType || 'audio/webm';
      if (cleanMimeType.includes(';')) {
        cleanMimeType = cleanMimeType.split(';')[0].trim();
      }

      console.log(`Received audio summarization request. Original MIME: ${mimeType || 'audio/webm'}, Clean MIME: ${cleanMimeType}, Language: ${language}`);

      const audioPart = {
        inlineData: {
          mimeType: cleanMimeType,
          data: audioBase64,
        },
      };

      const targetLangPrompt = language === 'nl'
        ? 'Verstrek een nauwkeurige transcriptie en een overzichtelijke samenvatting in het Nederlands van deze audio.'
        : 'Provide an accurate transcription and a structured bulleted summary in English of this audio.';

      const systemInstruction = language === 'nl'
        ? 'Je bent een deskundige transcriptie- en samenvattingsassistent. Lever de output strikt in JSON-formaat met de velden "transcript" (volledige transcriptie) en "summary" (samenvatting met belangrijke punten).'
        : 'You are an expert transcription and summarization assistant. Deliver the output strictly in JSON format containing the fields "transcript" (full text transcription) and "summary" (bulleted key summary).';

      const prompt = `${targetLangPrompt} De output MOET een JSON-object zijn met exact deze structuur:
      {
        "transcript": "...",
        "summary": "..."
      }`;

      // Invoke Gemini model as specified in system instructions
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [audioPart, { text: prompt }],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const resultText = response.text?.trim() || '{}';
      console.log('Gemini model response obtained successfully.');

      let parsedResult;
      try {
        parsedResult = JSON.parse(resultText);
      } catch (parseError) {
        console.error('Failed to parse Gemini JSON response:', resultText);
        parsedResult = {
          transcript: resultText,
          summary: language === 'nl' ? 'Geen gestructureerde samenvatting gegenereerd.' : 'No structured summary generated.'
        };
      }

      res.json(parsedResult);
    } catch (error: any) {
      console.error('Error during summarization:', error);
      res.status(500).json({ error: error.message || 'Summarization failed' });
    }
  });

  // Serve static assets or mount Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    console.log('Loading Vite middleware in development mode...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer().catch((error) => {
  console.error('Error starting server:', error);
});
