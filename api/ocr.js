export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing imageBase64' });
  }

  const ocrApiKey = process.env.OCR_SPACE_API_KEY;
  if (!ocrApiKey) {
    console.error('OCR_SPACE_API_KEY not configured');
    return res.status(500).json({ error: 'OCR API key not configured on server' });
  }

  // Ubah base64 menjadi buffer
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'upload.jpg');
  formData.append('apikey', ocrApiKey);
  formData.append('language', 'ind');
  formData.append('isTable', 'true');
  formData.append('OCREngine', '2');

  try {
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(15000) // timeout 15 detik
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OCR.space HTTP error:', data);
      return res.status(response.status).json({ error: data.ErrorMessage?.[0] || 'OCR service error' });
    }

    if (data.IsErroredOnProcessing || !data.ParsedResults || data.ParsedResults.length === 0) {
      const errorMsg = data.ErrorMessage?.[0] || 'No text could be extracted';
      return res.status(400).json({ error: errorMsg });
    }

    const extractedText = data.ParsedResults[0].ParsedText;
    return res.status(200).json({ text: extractedText });
  } catch (err) {
    console.error('OCR proxy error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
}