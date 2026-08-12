import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Lazy Gemini AI initialization helper
  const getGenAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // API Health Endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // AI Nutrition Assistant Endpoint
  app.post('/api/nutrition-assistant', async (req, res) => {
    try {
      const { message, history, userProfile } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
      }

      const ai = getGenAI();

      if (!ai) {
        // Fallback response if GEMINI_API_KEY is not configured yet
        return res.json({
          reply: `[Mode Simulasi Pakar Gizi] Terima kasih atas pertanyaan Anda mengenai "${message}". Untuk rekomendasi nutrisi paling akurat, pastikan Anda mengonsumsi makanan gizi seimbang (Karbohidrat Kompleks 45-55%, Protein berkualitas 20-30%, Lemak Sehat 20-30%) dan minum air putih 2-2.5 liter per hari. Untuk sesi analisis mendalam 1-on-1, silakan klik tombol 'Mulai Konsultasi' di atas!`,
        });
      }

      const systemInstruction = `Anda adalah Asisten Pakar Gizi & Nutrisi dari Vitality Nutrition (Ahli Gizi Terregistrasi Dr. Amanda Setiawan, M.Gizi).
Tugas Anda adalah memberikan jawaban yang ramah, ilmiah, mudah dipahami, dan langsung berguna dalam Bahasa Indonesia yang santun.
Jika user membagikan profil (seperti BB, TB, atau target), sesuaikan saran untuk mereka.
Selalu sertakan pesan edukasi bahwa konsultasi 1-on-1 dengan ahli gizi Vitality Nutrition tersedia untuk rencana nutrisi medis atau kustom yang dipersonalisasi penuh.`;

      const promptContext = userProfile
        ? `[Profil Pengguna: Usia ${userProfile.age || '-'}, BB ${userProfile.weight || '-'} kg, TB ${userProfile.height || '-'} cm, Tujuan: ${userProfile.goal || '-'}]\n\nPertanyaan User: ${message}`
        : message;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: promptContext,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const replyText = response.text || 'Maaf, saya tidak dapat memproses jawaban saat ini. Silakan coba lagi.';
      return res.json({ reply: replyText });
    } catch (error: any) {
      console.error('Error in nutrition assistant API:', error);
      return res.status(500).json({
        error: 'Terjadi kesalahan saat memproses konsultasi AI.',
        details: error.message,
      });
    }
  });

  // Vite middleware in dev, static files in production
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
    console.log(`Vitality Nutrition server running on http://localhost:${PORT}`);
  });
}

startServer();
