/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Simple in-memory cache helper to avoid redundant drive lookups if necessary
const dbCache = new Map<string, { spreadsheetId: string; sheetName: string }>();

// Helper function to call Google APIs
async function googleFetch(url: string, token: string, options: RequestInit = {}) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google API error (${response.status}): ${text}`);
  }
  return response.json();
}

// Helper to construct base64url encoded raw email for Gmail API
function createEmailRaw(to: string, subject: string, bodyHtml: string) {
  const messageParts = [
    `From: me`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(bodyHtml).toString('base64'),
  ];
  
  const message = messageParts.join('\r\n');
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Convert markdown summary into clean and styled HTML for emails
function markdownToHtml(md: string): string {
  let html = md;
  // Replace headers
  html = html.replace(/^### (.*$)/gim, '<h3 style="color: #0f172a; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; margin-top: 18px; margin-bottom: 8px;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="color: #0f172a; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="color: #0f172a; font-family: Arial, sans-serif; font-size: 22px; font-weight: bold; margin-top: 24px; margin-bottom: 12px;">$1</h1>');
  
  // Replace bold text
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Process bullet lists and paragraph blocks
  const lines = html.split('\n');
  let inList = false;
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.substring(2);
      let prefix = '';
      if (!inList) {
        inList = true;
        prefix = '<ul style="margin-top: 8px; margin-bottom: 8px; padding-left: 20px; color: #334155;">';
      }
      return `${prefix}<li style="margin-bottom: 6px; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5;">${content}</li>`;
    } else {
      let suffix = '';
      if (inList) {
        inList = false;
        suffix = '</ul>';
      }
      if (trimmed === '') {
        return suffix;
      }
      if (!trimmed.startsWith('<h') && !trimmed.startsWith('<ul') && !trimmed.startsWith('<li')) {
        return `${suffix}<p style="margin-top: 0; margin-bottom: 12px; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #334155;">${trimmed}</p>`;
      }
      return suffix + line;
    }
  });
  
  if (inList) {
    processedLines.push('</ul>');
  }
  html = processedLines.join('\n');
  
  return `
    <div style="background-color: #f8fafc; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 24px;">
          <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #10b981;">Speech to Text Summarizer</span>
          <h1 style="color: #0f172a; font-size: 20px; font-weight: 800; margin: 8px 0 0 0;">Recorded Conversation Summary</h1>
        </div>
        <div>
          ${html}
        </div>
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
          Sent automatically from your Speech to Text Summarizer mobile app.
        </div>
      </div>
    </div>
  `;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route - Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Route - Set Up Drive folder & Sheet Database
  app.post('/api/setup-db', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
      }
      const token = authHeader.split(' ')[1];

      // Check cache first to speed up subsequent requests
      if (dbCache.has(token)) {
        return res.json(dbCache.get(token));
      }

      console.log('Setting up Google Sheets database in Google Drive...');

      // 1. Check if 'speech_to_text' folder exists
      const folderQuery = encodeURIComponent("name = 'speech_to_text' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
      const folderSearch = await googleFetch(`https://www.googleapis.com/drive/v3/files?q=${folderQuery}`, token);
      
      let folderId = '';
      if (folderSearch.files && folderSearch.files.length > 0) {
        folderId = folderSearch.files[0].id;
        console.log(`Found existing folder 'speech_to_text' with ID: ${folderId}`);
      } else {
        // Create the folder
        const createFolderRes = await googleFetch('https://www.googleapis.com/drive/v3/files', token, {
          method: 'POST',
          body: JSON.stringify({
            name: 'speech_to_text',
            mimeType: 'application/vnd.google-apps.folder',
          }),
        });
        folderId = createFolderRes.id;
        console.log(`Created folder 'speech_to_text' with ID: ${folderId}`);
      }

      // 2. Check if 'SpeechToTextDB' spreadsheet exists inside folder
      const fileQuery = encodeURIComponent(`name = 'SpeechToTextDB' and mimeType = 'application/vnd.google-apps.spreadsheet' and '${folderId}' in parents and trashed = false`);
      const fileSearch = await googleFetch(`https://www.googleapis.com/drive/v3/files?q=${fileQuery}`, token);
      
      let spreadsheetId = '';
      if (fileSearch.files && fileSearch.files.length > 0) {
        spreadsheetId = fileSearch.files[0].id;
        console.log(`Found existing spreadsheet 'SpeechToTextDB' with ID: ${spreadsheetId}`);
      } else {
        // Create the spreadsheet
        const createSheetRes = await googleFetch('https://www.googleapis.com/drive/v3/files', token, {
          method: 'POST',
          body: JSON.stringify({
            name: 'SpeechToTextDB',
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents: [folderId],
          }),
        });
        spreadsheetId = createSheetRes.id;
        console.log(`Created spreadsheet 'SpeechToTextDB' with ID: ${spreadsheetId}`);
      }

      // 3. Fetch sheet details to get primary tab name
      const spreadsheetMeta = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, token);
      const sheetName = spreadsheetMeta.sheets[0].properties.title || 'Sheet1';

      // 4. Initialize headers if sheet is empty
      const checkHeaders = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:H1`, token).catch(() => ({ values: [] }));
      
      if (!checkHeaders.values || checkHeaders.values.length === 0) {
        console.log('Sheet is empty, creating headers...');
        await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:H1?valueInputOption=USER_ENTERED`, token, {
          method: 'PUT',
          body: JSON.stringify({
            values: [
              ['ID', 'Date', 'Email Subject', 'Short Title', 'Description', 'Full Text', 'Structured Summary', 'Status']
            ]
          }),
        });
      }

      const result = { spreadsheetId, sheetName };
      dbCache.set(token, result);
      return res.json(result);
    } catch (error: any) {
      console.error('Error in setup-db:', error);
      return res.status(500).json({ error: error.message || 'Failed to set up Google Sheet database' });
    }
  });

  // API Route - Get all recordings
  app.post('/api/recordings', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
      }
      const token = authHeader.split(' ')[1];
      const { spreadsheetId, sheetName } = req.body;

      if (!spreadsheetId || !sheetName) {
        return res.status(400).json({ error: 'Missing spreadsheetId or sheetName' });
      }

      console.log('Fetching recordings from Google Sheet...');
      const sheetValues = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A2:H1000`, token).catch(() => ({ values: [] }));
      
      const recordings = (sheetValues.values || []).map((row: any[]) => {
        return {
          id: row[0] || '',
          date: row[1] || '',
          emailSubject: row[2] || '',
          shortTitle: row[3] || '',
          description: row[4] || '',
          fullText: row[5] || '',
          structuredSummary: row[6] || '',
          status: row[7] || 'Active',
        };
      }).filter((rec: any) => rec.id !== ''); // Filter out empty rows

      return res.json({ recordings });
    } catch (error: any) {
      console.error('Error fetching recordings:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch recordings' });
    }
  });

  // API Route - Create Recording, summarize with Gemini, write to sheet, and send email via Gmail API
  app.post('/api/recordings/create', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
      }
      const token = authHeader.split(' ')[1];
      const { spreadsheetId, sheetName, fullText, language } = req.body;

      if (!spreadsheetId || !sheetName || !fullText) {
        return res.status(400).json({ error: 'Missing required parameters: spreadsheetId, sheetName, or fullText' });
      }

      const targetLanguage = language === 'nl' ? 'Dutch (Nederlands)' : 'English';
      console.log(`Generating structured summary with Gemini in ${targetLanguage}...`);
      
      // 1. Lazy check and initialization of Gemini API Key
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured on the server. Please add it to your secrets.');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `You are a professional scribe and summarization assistant. Analyze the following transcription of a spoken message and generate a structured summary.
  
Transcription:
"""
${fullText}
"""

You MUST output your response in the following language: ${targetLanguage}.

You must output a JSON object containing exactly three fields:
1. "shortTitle": A concise, engaging, and professional title summarizing the speech (max 6 words), in ${targetLanguage}.
2. "description": A very brief, high-level summary of the main point (max 20 words), in ${targetLanguage}.
3. "structuredSummary": A comprehensive, beautifully styled markdown summary of the transcription, in ${targetLanguage}. It must include:
   - A brief overview section.
   - Bullet points of the main topics and key insights discussed.
   - A clear section for decisions or action items, if any.
   Use headers (e.g. ### Overview / Overzicht), bolding, and bullet points to ensure perfect readability.

Return ONLY the JSON object, with no markdown code block surrounding it, or return valid JSON.`;

      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = geminiResponse.text?.trim() || '';
      console.log('Gemini generated response:', responseText);

      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse Gemini output as JSON, attempting cleanup...', responseText);
        // Fallback simple parsing if Gemini returned markdown block
        const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedData = JSON.parse(cleanedText);
      }

      const { shortTitle, description, structuredSummary } = parsedData;

      if (!shortTitle || !structuredSummary) {
        throw new Error('Invalid summary format generated by Gemini');
      }

      const id = `STT_${Date.now()}`;
      const date = new Date().toISOString().split('T')[0];
      const emailSubject = `[${date}] - ${shortTitle}`;

      console.log('Logging recording to Google Sheet...');
      // 2. Append row to Google Sheet
      await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:H:append?valueInputOption=USER_ENTERED`, token, {
        method: 'POST',
        body: JSON.stringify({
          values: [[ id, date, emailSubject, shortTitle, description, fullText, structuredSummary, 'Active' ]]
        }),
      });

      console.log('Sending email summary to ikbennietchristophe@gmail.com...');
      // 3. Send email on behalf of user using Gmail API
      const emailHtmlBody = markdownToHtml(structuredSummary);
      const rawEmail = createEmailRaw('ikbennietchristophe@gmail.com', emailSubject, emailHtmlBody);

      await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', token, {
        method: 'POST',
        body: JSON.stringify({
          raw: rawEmail
        }),
      });

      console.log('Summary workflow completed successfully!');

      const newRecording = {
        id,
        date,
        emailSubject,
        shortTitle,
        description,
        fullText,
        structuredSummary,
        status: 'Active' as const,
      };

      return res.json({ success: true, recording: newRecording });
    } catch (error: any) {
      console.error('Error during recording process:', error);
      return res.status(500).json({ error: error.message || 'An error occurred while creating the summary' });
    }
  });

  // API Route - Update Recording, re-summarize, write to sheet, and send updated email
  app.post('/api/recordings/update', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
      }
      const token = authHeader.split(' ')[1];
      const { spreadsheetId, sheetName, id, fullText, language } = req.body;

      if (!spreadsheetId || !sheetName || !id || !fullText) {
        return res.status(400).json({ error: 'Missing required parameters: spreadsheetId, sheetName, id, or fullText' });
      }

      console.log(`Updating recording ${id} with new transcription text...`);

      // 1. Find existing row index and retrieve its values
      const sheetValues = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:H1000`, token);
      const rows = sheetValues.values || [];
      
      let rowIndex = -1;
      let existingRow: any[] = [];
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === id) {
          rowIndex = i + 1; // Sheets is 1-indexed
          existingRow = rows[i];
          break;
        }
      }

      if (rowIndex === -1) {
        return res.status(404).json({ error: `Recording with ID ${id} not found in sheet` });
      }

      const targetLanguage = language === 'nl' ? 'Dutch (Nederlands)' : 'English';
      console.log(`Generating updated structured summary with Gemini in ${targetLanguage}...`);
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured on the server. Please add it to your secrets.');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `You are a professional scribe and summarization assistant. Analyze the following transcription of an UPDATED spoken message and generate an updated structured summary.
  
Transcription:
"""
${fullText}
"""

You MUST output your response in the following language: ${targetLanguage}.

You must output a JSON object containing exactly three fields:
1. "shortTitle": A concise, engaging, and professional title summarizing the speech (max 6 words), in ${targetLanguage}.
2. "description": A very brief, high-level summary of the main point (max 20 words), in ${targetLanguage}.
3. "structuredSummary": A comprehensive, beautifully styled markdown summary of the transcription, in ${targetLanguage}. It must include:
   - A brief overview section.
   - Bullet points of the main topics and key insights discussed.
   - A clear section for decisions or action items, if any.
   Use headers (e.g. ### Overview / Overzicht), bolding, and bullet points to ensure perfect readability.

Return ONLY the JSON object, with no markdown code block surrounding it, or return valid JSON.`;

      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = geminiResponse.text?.trim() || '';
      console.log('Gemini generated updated response:', responseText);

      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse Gemini output as JSON, attempting cleanup...', responseText);
        const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedData = JSON.parse(cleanedText);
      }

      const { shortTitle, description, structuredSummary } = parsedData;

      if (!shortTitle || !structuredSummary) {
        throw new Error('Invalid summary format generated by Gemini');
      }

      const originalDate = existingRow[1] || new Date().toISOString().split('T')[0];
      const originalEmailSubject = existingRow[2] || `[${originalDate}] - ${existingRow[3] || 'Conversation'}`;
      
      // Ensure we append " [UPDATE]" if not already in subject
      let emailSubject = originalEmailSubject;
      if (!emailSubject.toUpperCase().includes('UPDATE')) {
        emailSubject = `${emailSubject} [UPDATE]`;
      }

      const status = existingRow[7] || 'Active';

      console.log(`Updating Google Sheets row ${rowIndex}...`);
      // Update row in Google Sheet
      await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A${rowIndex}:H${rowIndex}?valueInputOption=USER_ENTERED`, token, {
        method: 'PUT',
        body: JSON.stringify({
          values: [[ id, originalDate, emailSubject, shortTitle, description, fullText, structuredSummary, status ]]
        }),
      });

      console.log('Sending updated email summary to ikbennietchristophe@gmail.com...');
      const emailHtmlBody = markdownToHtml(structuredSummary);
      const rawEmail = createEmailRaw('ikbennietchristophe@gmail.com', emailSubject, emailHtmlBody);

      await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', token, {
        method: 'POST',
        body: JSON.stringify({
          raw: rawEmail
        }),
      });

      console.log('Update workflow completed successfully!');

      const updatedRecording = {
        id,
        date: originalDate,
        emailSubject,
        shortTitle,
        description,
        fullText,
        structuredSummary,
        status,
      };

      return res.json({ success: true, recording: updatedRecording });
    } catch (error: any) {
      console.error('Error during update process:', error);
      return res.status(500).json({ error: error.message || 'An error occurred while updating the summary' });
    }
  });

  // API Route - Archive Recording
  app.post('/api/recordings/archive', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
      }
      const token = authHeader.split(' ')[1];
      const { spreadsheetId, sheetName, id } = req.body;

      if (!spreadsheetId || !sheetName || !id) {
        return res.status(400).json({ error: 'Missing required parameters: spreadsheetId, sheetName, or id' });
      }

      console.log(`Archiving recording ${id}...`);

      // 1. Get all row values to find the matching row index
      const sheetValues = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:A1000`, token);
      const rows = sheetValues.values || [];
      
      let rowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === id) {
          rowIndex = i + 1; // Sheets is 1-indexed
          break;
        }
      }

      if (rowIndex === -1) {
        return res.status(444).json({ error: `Recording with ID ${id} not found in sheet` });
      }

      // 2. Update Column H (Status) at the matching rowIndex
      await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!H${rowIndex}?valueInputOption=USER_ENTERED`, token, {
        method: 'PUT',
        body: JSON.stringify({
          values: [['Archived']]
        }),
      });

      console.log(`Successfully archived recording ${id} in Google Sheets row ${rowIndex}`);
      return res.json({ success: true, id });
    } catch (error: any) {
      console.error('Error archiving recording:', error);
      return res.status(500).json({ error: error.message || 'Failed to archive recording' });
    }
  });

  // Vite middleware for development or serving index.html in production
  if (process.env.NODE_ENV !== 'production') {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
