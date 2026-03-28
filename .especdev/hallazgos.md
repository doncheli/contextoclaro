# Hallazgos

## 2026-03-28
- Wikipedia bloquea hotlinking de imágenes (429 Too Many Requests). Usar Unsplash como alternativa.
- Google News RSS no provee contenido real, solo links HTML. Necesita fetch adicional con og:description y og:image.
- Gemini en preview a veces no devuelve JSON válido. Parser debe ser robusto con fallback.
- Contexto político debe actualizarse manualmente en el prompt (ej: cambio de presidente VE).
- Imágenes de googleusercontent.com son thumbnails de baja calidad, filtrarlas.
