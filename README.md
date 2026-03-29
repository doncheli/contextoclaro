<p align="center">
  <img src="public/logo.png" alt="Contexto Claro" width="400" />
</p>

<h3 align="center">Filtramos el ruido. Entregamos la verdad.</h3>

<p align="center">
  Plataforma open source de verificación de noticias con IA para Latinoamérica.
</p>

<p align="center">
  <a href="https://www.contextoclaro.com">🌐 contextoclaro.com</a> ·
  <a href="https://www.youtube.com/@doncheli">📺 YouTube</a> ·
  <a href="https://x.com/don_cheli">𝕏 Twitter</a> ·
  <a href="https://instagram.com/doncheli.tv">📸 Instagram</a> ·
  <a href="https://tiktok.com/@doncheli.tv">🎵 TikTok</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-live-brightgreen" alt="Status" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/IA-Gemini-orange" alt="AI" />
  <img src="https://img.shields.io/badge/stack-React%20%2B%20Supabase%20%2B%20Vite-purple" alt="Stack" />
</p>

---

## ¿Qué es Contexto Claro?

Contexto Claro es una plataforma que analiza noticias de Venezuela, Colombia y tecnología mundial usando inteligencia artificial. Cada noticia es evaluada automáticamente para determinar su **veracidad**, **sesgo político**, **diversidad de fuentes** y si es **contenido patrocinado disfrazado de periodismo**.

Nació durante un LIVE en el canal de YouTube de [@doncheli](https://youtube.com/@doncheli) y fue construido de forma abierta con la comunidad. El código es 100% open source porque creemos que **la lucha contra la desinformación no puede ser un negocio cerrado**.

### ¿Por qué existe?

En Latinoamérica, las noticias falsas no son un accidente — son una industria. Los medios responden a intereses políticos y económicos. Las redes sociales amplifican lo que genera clicks, no lo que es verdad. Contexto Claro existe para darte las herramientas que necesitas para informarte sin que nadie te manipule.

---

## Features

### Verificación con IA
Cada noticia pasa por **Google Gemini** que evalúa su veracidad y la clasifica como **Real**, **Engañosa** o **Falsa**, con un porcentaje de confianza y razonamiento detallado.

### Puntuación de Confiabilidad (0-100)
Cuatro métricas componen el score final:

| Métrica | Peso | Qué mide |
|---------|------|----------|
| Precisión factual | 35% | ¿La información es verificable? |
| Diversidad de fuentes | 25% | ¿Cuántos medios cubren la historia? |
| Transparencia | 25% | ¿La fuente es transparente con su autoría y financiamiento? |
| Independencia | 15% | ¿La cobertura es equilibrada políticamente? |

### Espectro de Sesgo Político
Cada noticia muestra la distribución de cobertura desde **izquierda**, **centro** y **derecha**. No te decimos qué pensar — te mostramos desde dónde te están informando.

### Coverage Meter
Visual que muestra cuántos medios cubren cada historia y desde qué perspectiva ideológica. Disponible como barra inline en cada card y como panel completo en el detalle.

### Noticias en Tríptico
La misma historia mostrada desde tres perspectivas: izquierda, centro y derecha. Cuando falta una perspectiva, te lo señalamos como **punto ciego informativo**.

### Blindspot LATAM
Noticias que Venezuela cubre pero Colombia ignora, y viceversa. **Ninguna otra plataforma en Latinoamérica ofrece esto.**

### Detección de Contenido Patrocinado
La IA identifica automáticamente noticias que parecen periodismo pero en realidad son propaganda, comunicados de prensa o publicidad disfrazada. Muestra quién se beneficia.

### Nutrition Label por Medio
Perfil detallado de cada outlet inspirado en las "etiquetas nutricionales" de NewsGuard:
- Score de confiabilidad (0-100)
- ¿Corrige errores públicamente?
- ¿Separa opinión de información?
- Transparencia de financiamiento
- Tendencia a titulares engañosos

### Base de Datos de Propiedad de Medios
¿Quién es dueño de cada medio en Venezuela y Colombia? Tipo de propiedad, grupo empresarial, afiliación política. **Esta base de datos no existe en ningún otro lugar para LATAM.**

### Dashboard "Mi Consumo"
Panel personal que analiza tu dieta informativa:
- Sesgo acumulado de lo que has leído
- Fuentes más consultadas
- Distribución por país y categoría
- Recomendaciones para equilibrar tu consumo

### Estadísticas en Tiempo Real
Dashboard público con métricas actualizadas automáticamente cada 5 minutos: noticias verificadas, falsas detectadas, engañosas, patrocinadas, distribución de sesgo.

### Tecnología Mundial
Categoría dedicada a noticias de tecnología de fuentes internacionales (The Verge, Ars Technica, TechCrunch, Wired, Xataka, Hipertextual), verificadas con el mismo rigor que las noticias regionales.

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (Vite + React)                │
│                                                          │
│  contextoclaro.com → Vercel                              │
│  ├── App.jsx (SPA con navigation state-based)            │
│  ├── NewsDetailModal.jsx (detalle + verificador)         │
│  ├── components/ (CoverageMeter, Triptych, Blindspot...) │
│  └── lib/newsService.js (Supabase client)                │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                  BACKEND (Supabase)                       │
│                                                          │
│  PostgreSQL                                              │
│  ├── news (noticias + scores + gemini verdicts)          │
│  ├── article_paragraphs (body por párrafo)               │
│  ├── news_sources (fuentes por noticia + sesgo)          │
│  └── media_outlets (nutrition labels + propiedad)        │
│                                                          │
│  Edge Functions                                          │
│  └── news-pipeline/ (Scrape → IA → Validate → Insert)   │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                  PIPELINE DE DATOS                        │
│                                                          │
│  1. Scraping RSS (16 feeds: VE + CO + Tech)              │
│  2. Deduplicación contra DB existente                    │
│  3. Fetch contenido completo (HTML → párrafos)           │
│  4. Validación interna (cross-reference + credibilidad)  │
│  5. Validación Gemini (veracidad + patrocinado)          │
│  6. Estimación de sesgo (izquierda/centro/derecha)       │
│  7. Inserción con scores calculados                      │
│                                                          │
│  Ejecuta cada 30 minutos via cron                        │
└──────────────────────────────────────────────────────────┘
```

---

## Fuentes de Noticias

### Venezuela 🇻🇪
| Medio | Sesgo | Credibilidad | Propietario |
|-------|-------|:---:|-------------|
| Efecto Cocuyo | Centro | 88 | Luz Mely Reyes (independiente) |
| El Nacional | Centro-derecha | 80 | Miguel Henrique Otero (privado) |
| La Patilla | Centro-derecha | 75 | Alberto Federico Ravell (privado) |
| Correo del Caroní | Centro | 85 | David Natera Febres (independiente) |
| Runrunes | Centro | 82 | Nelson Bocaranda (privado) |

### Colombia 🇨🇴
| Medio | Sesgo | Credibilidad | Propietario |
|-------|-------|:---:|-------------|
| El Tiempo | Centro | 88 | Sarmiento Angulo / Grupo Planeta |
| Infobae Colombia | Centro-derecha | 83 | Daniel Hadad (corporación) |
| Semana | Centro-derecha | 82 | Familia Gilinski (conglomerado) |
| El Espectador | Centro-izquierda | 85 | Hermanos Maristas / Grupo AVAL |
| La Silla Vacía | Centro | 92 | Juanita León (independiente) |

### Tecnología 🌐
| Medio | Sesgo | Credibilidad |
|-------|-------|:---:|
| The Verge | Centro | 88 |
| Ars Technica | Centro | 92 |
| TechCrunch | Centro | 85 |
| Wired | Centro-izquierda | 88 |
| Xataka | Centro | 84 |
| Hipertextual | Centro | 82 |

---

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS 4 |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| IA | Google Gemini (gemini-3.1-flash-lite-preview) |
| Hosting | Vercel |
| Analytics | Google Analytics 4 |
| Ads | Google AdSense |
| Iconos | Lucide React |
| Fuentes | Poppins + Inter (Google Fonts) |

---

## Instalación Local

```bash
# Clonar el repositorio
git clone https://github.com/doncheli/contextoclaro.git
cd contextoclaro

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus keys de Supabase

# Ejecutar en desarrollo
npm run dev
```

### Variables de Entorno

```env
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

Para el pipeline de datos (Edge Functions):
```env
SUPABASE_URL=tu_supabase_url
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
GEMINI_API_KEY=tu_gemini_api_key
```

---

## Estructura del Proyecto

```
contextoclaro/
├── public/
│   ├── logo.png              # Logo principal
│   ├── doncheli.png          # Foto del creador
│   ├── privacy.html          # Política de privacidad
│   └── robots.txt            # SEO
├── src/
│   ├── App.jsx               # Componente principal + routing
│   ├── NewsDetailModal.jsx   # Vista de detalle de artículo
│   ├── main.jsx              # Entry point
│   ├── index.css             # Estilos + temas
│   ├── components/
│   │   ├── AdBanner.jsx      # Banners de publicidad
│   │   ├── BlindspotLATAM.jsx # Puntos ciegos por país
│   │   ├── CoverageMeter.jsx # Medidor de cobertura
│   │   ├── MyConsumption.jsx # Dashboard personal de sesgo
│   │   ├── NewsTriptych.jsx  # Vista por perspectiva
│   │   └── NutritionLabel.jsx # Etiqueta nutricional de medios
│   ├── hooks/
│   │   └── useNews.js        # Hooks de datos
│   └── lib/
│       ├── analytics.js      # Google Analytics events
│       ├── categoryImages.js # Imágenes fallback por categoría
│       ├── consumptionTracker.js # Tracking local de consumo
│       ├── newsService.js    # Queries a Supabase
│       └── supabase.js       # Cliente Supabase
├── supabase/
│   ├── schema.sql            # Schema de la base de datos
│   ├── seed.sql              # Datos iniciales
│   └── functions/
│       ├── news-pipeline/    # Pipeline principal (scrape → IA → insert)
│       ├── scrape-news/      # Scraper independiente
│       ├── validate-news/    # Validador independiente
│       └── sitemap/          # Generador de sitemap dinámico
├── index.html                # HTML con SEO + Schema.org
├── vercel.json               # Config de deploy + rewrites
└── capacitor.config.json     # Config para app móvil (Android)
```

---

## Roadmap

### Implementado
- [x] Verificación con IA (Gemini)
- [x] Puntuación de confiabilidad (0-100)
- [x] Espectro de sesgo político
- [x] Detección de contenido patrocinado
- [x] Coverage Meter por noticia
- [x] Noticias en tríptico (izq/centro/der)
- [x] Blindspot LATAM
- [x] Nutrition Label por medio
- [x] Base de datos de propiedad de medios
- [x] Dashboard "Mi Consumo"
- [x] Categoría Tecnología mundial
- [x] Estadísticas en tiempo real (auto-refresh)
- [x] SEO completo (Schema.org, OG, Twitter Cards)
- [x] Permalinks con slugs descriptivos
- [x] Página de metodología con diagramas de flujo
- [x] Open source en GitHub

### En progreso
- [ ] Chatbot de WhatsApp para verificación
- [ ] Extensión de navegador
- [ ] Perfiles de figuras públicas con historial
- [ ] Verificación en tiempo real durante debates

### Futuro
- [ ] Detector de deepfakes
- [ ] Comunidad de verificación con gamificación
- [ ] API pública para investigadores
- [ ] Certificación IFCN
- [ ] App móvil (Android/iOS)

---

## Contribuir

Contexto Claro es open source porque creemos que la verificación de noticias debe ser transparente y accesible. Toda contribución es bienvenida.

```bash
# Fork del repositorio
# Crear branch: git checkout -b feature/mi-feature
# Commit: git commit -m "feat: descripción"
# Push: git push origin feature/mi-feature
# Crear Pull Request
```

### Áreas donde puedes contribuir:
- **Frontend**: Nuevos componentes, mejoras de UX, accesibilidad
- **Pipeline**: Agregar fuentes de noticias de otros países LATAM
- **IA**: Mejorar prompts de Gemini, agregar modelos alternativos
- **Datos**: Investigar propiedad de medios en tu país
- **Traducción**: Adaptar la plataforma a portugués (Brasil)
- **Fact-checking**: Reportar errores en verificaciones

---

## Licencia

MIT — Usa, modifica y distribuye libremente. Si construyes algo con este código, nos encantaría saberlo.

---

## Creador

<p align="center">
  <img src="public/doncheli.png" alt="DonCheli" width="120" style="border-radius: 16px" />
</p>

<p align="center">
  <strong>@doncheli</strong><br/>
  Desarrollador venezolano. Creador de contenido tech.<br/>
  Contexto Claro nació en un LIVE de YouTube y se construyó con la comunidad.
</p>

<p align="center">
  <a href="https://youtube.com/@doncheli">YouTube</a> ·
  <a href="https://x.com/don_cheli">X</a> ·
  <a href="https://instagram.com/doncheli.tv">Instagram</a> ·
  <a href="https://tiktok.com/@doncheli.tv">TikTok</a>
</p>

---

<p align="center">
  <strong>Filtramos el ruido. Entregamos la verdad.</strong><br/>
  <a href="https://www.contextoclaro.com">contextoclaro.com</a>
</p>
