-- ══════════════════════════════════════════════════════════
-- LATAM INSIGHT — Seed Data (Venezuela & Colombia)
-- Ejecutar DESPUÉS de schema.sql en el SQL Editor de Supabase
-- ══════════════════════════════════════════════════════════

-- ── SCHEMA ADDITIONS ──

-- Add country_code column if not present
ALTER TABLE news ADD COLUMN IF NOT EXISTS country_code TEXT;
CREATE INDEX IF NOT EXISTS idx_news_country_code ON news (country_code);

-- Add Gemini validation fields
ALTER TABLE news ADD COLUMN IF NOT EXISTS gemini_validated BOOLEAN DEFAULT false;
ALTER TABLE news ADD COLUMN IF NOT EXISTS gemini_verdict TEXT CHECK (gemini_verdict IN ('real', 'misleading', 'fake', 'unverified'));
ALTER TABLE news ADD COLUMN IF NOT EXISTS gemini_confidence SMALLINT;
ALTER TABLE news ADD COLUMN IF NOT EXISTS gemini_reasoning TEXT;
ALTER TABLE news ADD COLUMN IF NOT EXISTS gemini_validated_at TIMESTAMPTZ;

-- ── HERO NEWS ──
INSERT INTO news (id, news_type, title, description, category, country, country_code, image, read_time, bias_left, bias_center, bias_right, bias_label, source_count, veracity, veracity_detail, score_factual, score_source_div, score_transparency, score_independence, published_at)
OVERRIDING SYSTEM VALUE
VALUES (
  1, 'hero',
  'Petro denuncia bombardeo desde Ecuador en frontera colombiana: "Hay 27 cuerpos calcinados"',
  'El presidente Petro denunció que Ecuador bombardeó territorio colombiano en Nariño, reportando 27 cuerpos calcinados y una bomba de 250 kg en Jardines de Sucumbíos. Noboa negó las acusaciones.',
  'COLOMBIA · RELACIONES INTERNACIONALES', '🇨🇴', 'CO',
  'https://images.unsplash.com/photo-1580752300992-559f8e0734e0?w=1200&q=80',
  '9 min de lectura',
  45, 20, 35, 'IZQUIERDA',
  18, 'parcialmente_falsa',
  'Petro aportó coordenadas GPS y foto de la bomba; Noboa negó la incursión. Registraduría y fuentes militares de ambos países se contradicen.',
  78, 85, 72, 80,
  '2026-03-17'
);

-- ── DAILY NEWS ──
INSERT INTO news (id, news_type, title, description, category, country, country_code, image, author, bias_left, bias_center, bias_right, bias_label, credibility, source_count, veracity, veracity_detail, score_factual, score_source_div, score_transparency, score_independence, published_at)
OVERRIDING SYSTEM VALUE
VALUES
(2, 'daily',
 'Elecciones legislativas 2026: Pacto Histórico emerge como primera fuerza con 62 curules',
 'Las elecciones legislativas del 8 de marzo consolidaron al Pacto Histórico de Gustavo Petro como la principal fuerza en el Congreso, obteniendo 62 curules en total. Centro Democrático también creció, reflejando una creciente polarización.',
 'COLOMBIA · POLÍTICA', '🇨🇴', 'CO',
 'https://images.unsplash.com/photo-1494172961521-33799ddd43a5?w=600&q=80',
 'El Tiempo / CNN en Español / La Silla Vacía',
 40, 30, 30, 'EQUILIBRADO', 'alta', 22,
 'verificada',
 'Confirmado por Registraduría Nacional, El Tiempo, CNN en Español y La Silla Vacía',
 96, 90, 94, 88,
 '2026-03-08'),

(3, 'daily',
 'Paloma Valencia arrasa en consulta de centro-derecha con más de 3,2 millones de votos',
 'La senadora del Centro Democrático arrasó en la consulta interpartidista del 8 de marzo, posicionándose como la principal contendiente conservadora de cara a las elecciones presidenciales de mayo de 2026.',
 'COLOMBIA · POLÍTICA', '🇨🇴', 'CO',
 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=600&q=80',
 'La República / Infobae / Blu Radio',
 25, 35, 40, 'CENTRO-DERECHA', 'alta', 15,
 'verificada',
 'Resultado oficial de consulta interpartidista del 8 de marzo, confirmado por Registraduría y múltiples medios',
 97, 82, 93, 86,
 '2026-03-08'),

(4, 'daily',
 'Petro ordena liquidar EPS en quiebra: más de 23 millones de pacientes en incertidumbre',
 'El presidente Gustavo Petro ordenó la liquidación de las EPS en estado de quiebra técnica, dejando a más de 23 millones de colombianos sin aseguradora de salud y generando una crisis en el sistema sanitario.',
 'COLOMBIA · SALUD', '🇨🇴', 'CO',
 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&q=80',
 'Infobae / Semana / Vanguardia',
 50, 20, 30, 'IZQUIERDA', 'alta', 14,
 'verificada',
 'Confirmado por Superintendencia Nacional de Salud, Infobae Colombia y Semana',
 90, 78, 85, 75,
 '2026-03-16'),

(5, 'daily',
 'Trump reconoce oficialmente a Delcy Rodríguez como única jefa de Estado de Venezuela',
 'La administración Trump emitió un comunicado formal reconociendo a Delcy Rodríguez como presidenta encargada de Venezuela, restableciendo relaciones diplomáticas y consulares entre ambos países.',
 'VENEZUELA · POLÍTICA', '🇻🇪', 'VE',
 'https://images.unsplash.com/photo-1589262804704-c5aa9e6def89?w=600&q=80',
 'CNN en Español / Infobae / Univision',
 30, 35, 35, 'EQUILIBRADO', 'alta', 12,
 'verificada',
 'Comunicado oficial de la Casa Blanca, confirmado por CNN en Español, Infobae y Univision',
 94, 85, 90, 82,
 '2026-03-12'),

(6, 'daily',
 'Posponen al 26 de marzo la audiencia judicial de Nicolás Maduro en Nueva York',
 'El tribunal federal del Distrito Sur de Nueva York aplazó la audiencia inicial de Nicolás Maduro al 26 de marzo, citando dificultades logísticas y la necesidad de tiempo adicional para la defensa.',
 'VENEZUELA · POLÍTICA', '🇻🇪', 'VE',
 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&q=80',
 'Infobae / El Tiempo / WBUR-NPR',
 35, 40, 25, 'CENTRO', 'alta', 10,
 'verificada',
 'Confirmado por tribunal federal de Nueva York y reportado por Infobae, El Tiempo y WBUR-NPR',
 92, 80, 88, 85,
 '2026-03-17'),

(7, 'daily',
 'Más de 7.700 ciudadanos recobran su libertad bajo la Ley de Amnistía en Venezuela',
 'Organizaciones de derechos humanos reportan que más de 7.700 ciudadanos venezolanos han recuperado su libertad al amparo de la Ley de Amnistía promulgada por la Asamblea Nacional, aunque señalan que el aparato represivo permanece activo.',
 'VENEZUELA · DERECHOS HUMANOS', '🇻🇪', 'VE',
 'https://images.unsplash.com/photo-1453873531674-2151bcd01707?w=600&q=80',
 'Foro Penal / CNN en Español / ONU-OHCHR',
 40, 30, 30, 'CENTRO-IZQUIERDA', 'alta', 16,
 'parcialmente_falsa',
 'Cifra de Foro Penal verificable; sin embargo, ONU-OHCHR advierte que el aparato represivo sigue operativo',
 75, 70, 68, 72,
 '2026-03-13');

-- ── BLINDSPOT NEWS ──
INSERT INTO news (id, news_type, title, category, country, country_code, veracity, veracity_detail, blindspot_side, blindspot_icon, blindspot_severity, blindspot_sources_missing, blindspot_detail, bias_left, bias_center, bias_right, score_factual, score_source_div, score_transparency, score_independence, published_at)
OVERRIDING SYSTEM VALUE
VALUES
(8, 'blindspot',
 'Misión de la ONU denuncia que maquinaria represiva de Venezuela sigue intacta bajo Rodríguez',
 'VENEZUELA · DERECHOS HUMANOS', '🇻🇪', 'VE',
 'verificada',
 'Informe oficial de la Misión Internacional de Determinación de los Hechos de la ONU, marzo 2026',
 'IZQUIERDA IGNORA', 'left', 'alta', 12,
 'Medios alineados al gobierno (VTV, RNV) no reportan el informe de la ONU sobre la persistencia de la maquinaria represiva. Solo medios independientes como Efecto Cocuyo y El Diario cubren la denuncia.',
 0, 0, 0,
 96, 50, 90, 88,
 '2026-03-12'),

(9, 'blindspot',
 'Crisis de salud en Colombia: 23 millones de pacientes sin EPS por liquidación ordenada por Petro',
 'COLOMBIA · SALUD', '🇨🇴', 'CO',
 'verificada',
 'Superintendencia Nacional de Salud y reportes de Semana e Infobae Colombia',
 'IZQUIERDA IGNORA', 'left', 'alta', 8,
 'Medios afines al gobierno de Petro minimizan el impacto de la liquidación de EPS. Solo medios independientes como Semana, Vanguardia y Blu Radio reportan el alcance real de la crisis.',
 0, 0, 0,
 88, 55, 82, 70,
 '2026-03-17'),

(10, 'blindspot',
 'Depreciación del bolívar: dólar BCV supera 448 Bs y paralelo roza 590 — silencio de medios oficialistas',
 'VENEZUELA · ECONOMÍA', '🇻🇪', 'VE',
 'verificada',
 'Datos del Banco Central de Venezuela y monitores de divisas independientes (DolarToday, Monitor Dólar)',
 'IZQUIERDA IGNORA', 'left', 'alta', 10,
 'VTV, Venezolana de Televisión y medios del circuito público no reportan la depreciación acelerada del bolívar. Solo Correo del Caroní, El Diario y monitores independientes publican los datos reales del tipo de cambio.',
 0, 0, 0,
 90, 55, 85, 72,
 '2026-03-17');

-- ── FEED NEWS ──
INSERT INTO news (id, news_type, title, category, country, country_code, source_label, credibility, time_label, bias_left, bias_center, bias_right, veracity, veracity_detail, sponsored_flag, score_factual, score_source_div, score_transparency, score_independence, published_at)
OVERRIDING SYSTEM VALUE
VALUES
(11, 'feed',
 'Paro de transportistas paraliza Caracas con 90% de acatamiento',
 'VENEZUELA · ECONOMÍA', '🇻🇪', 'VE', 'Efecto Cocuyo / Correo del Caroní', 'alta', 'Hace 2h',
 35, 30, 35, 'verificada', 'Confirmado por gremios de transporte y reportes en redes sociales verificadas', NULL,
 88, 70, 82, 78,
 '2026-03-17'),

(12, 'feed',
 'Tren de Valles del Tuy se descarrila en La Rinconada',
 'VENEZUELA · SOCIEDAD', '🇻🇪', 'VE', 'El Diario VE / La Gran Aldea', 'media', 'Hace 4h',
 40, 40, 20, 'verificada', 'Confirmado por IFE (Instituto de Ferrocarriles del Estado) y testigos en redes sociales', NULL,
 82, 65, 78, 72,
 '2026-03-17'),

(13, 'feed',
 'Venezuela vence a Italia 4-2 en semifinal del Clásico Mundial de Béisbol',
 'VENEZUELA · DEPORTES', '🇻🇪', 'VE', 'ESPN / LVBP Oficial', 'alta', 'Hace 6h',
 30, 50, 20, 'verificada', 'Resultado oficial del World Baseball Classic, confirmado por MLB y ESPN', NULL,
 99, 90, 98, 95,
 '2026-03-17'),

(14, 'feed',
 'FMI recorta proyección de crecimiento de Colombia a 2,3% para 2026',
 'COLOMBIA · ECONOMÍA', '🇨🇴', 'CO', 'FMI / Bloomberg Línea', 'alta', 'Hace 3h',
 30, 40, 30, 'verificada', 'Publicado en el informe de perspectivas del FMI, confirmado por Bloomberg Línea', NULL,
 95, 80, 90, 85,
 '2026-03-17'),

(15, 'feed',
 'Colombia registra intensa actividad sísmica: sismo de 5.2 sacude el Eje Cafetero',
 'COLOMBIA · SOCIEDAD', '🇨🇴', 'CO', 'SGC / Caracol Radio', 'alta', 'Hace 5h',
 20, 60, 20, 'verificada', 'Confirmado por Servicio Geológico Colombiano (SGC), sin reporte de víctimas', NULL,
 97, 75, 95, 90,
 '2026-03-17'),

(16, 'feed',
 'Guerra comercial Colombia-Ecuador: Noboa eleva arancel a productos colombianos al 50%',
 'COLOMBIA · ECONOMÍA', '🇨🇴', 'CO', 'Portafolio / El Tiempo / Reuters', 'alta', 'Hace 7h',
 35, 35, 30, 'verificada', 'Decreto oficial del gobierno ecuatoriano, confirmado por Reuters y medios colombianos', NULL,
 92, 82, 88, 80,
 '2026-03-17'),

(17, 'feed',
 'Petro se reúne con bancada del Pacto Histórico para definir agenda legislativa del nuevo Congreso',
 'COLOMBIA · POLÍTICA', '🇨🇴', 'CO', 'La Silla Vacía / Blu Radio', 'alta', 'Hace 8h',
 55, 25, 20, 'verificada', 'Confirmado por comunicado de la Presidencia de la República y La Silla Vacía', NULL,
 88, 72, 84, 78,
 '2026-03-17'),

(18, 'feed',
 'Bolívar se deprecia: dólar BCV supera 448 bolívares en jornada de alta demanda',
 'VENEZUELA · ECONOMÍA', '🇻🇪', 'VE', 'DolarToday / Correo del Caroní', 'media', 'Hace 1h',
 25, 35, 40, 'verificada', 'Datos del BCV y monitores independientes DolarToday y Monitor Dólar Venezuela', NULL,
 90, 60, 85, 72,
 '2026-03-17');

-- ══════════════════════════════════════════════════════════
-- NEWS SOURCES (para el modal de detalle)
-- ══════════════════════════════════════════════════════════

-- Sources para noticia 1 (Petro bombardeo Ecuador)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(1, 'El Tiempo', 'centro', 88, 'Reportaje con coordenadas GPS y declaraciones del gobierno colombiano', 1),
(1, 'Semana', 'centro-derecha', 82, 'Cuestiona la versión de Petro, pide verificación independiente', 2),
(1, 'Telesur', 'izquierda', 58, 'Reproduce la versión de Petro sin cuestionamiento', 3),
(1, 'El Universo (EC)', 'centro-derecha', 80, 'Reproduce la negación de Noboa', 4),
(1, 'Infobae', 'centro-derecha', 84, 'Análisis de la crisis diplomática bilateral', 5),
(1, 'CNN en Español', 'centro', 90, 'Contrasta versiones de ambos gobiernos', 6),
(1, 'Ministerio de Relaciones Exteriores CO', 'centro', 85, 'Comunicado oficial colombiano', 7),
(1, 'Gobierno de Ecuador', 'centro-derecha', 80, 'Negación oficial ecuatoriana', 8);

-- Sources para noticia 2 (Pacto Histórico elecciones)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(2, 'Registraduría Nacional', 'centro', 98, 'Fuente oficial de resultados electorales', 1),
(2, 'El Tiempo', 'centro', 88, 'Cobertura amplia de la jornada electoral', 2),
(2, 'CNN en Español', 'centro', 90, 'Perspectiva internacional equilibrada', 3),
(2, 'La Silla Vacía', 'centro-izquierda', 92, 'Análisis político detallado de las curules', 4),
(2, 'Blu Radio', 'centro', 82, 'Cobertura en vivo de resultados', 5),
(2, 'Bloomberg Línea', 'centro', 90, 'Reacción de mercados y peso colombiano', 6);

-- Sources para noticia 3 (Paloma Valencia consulta)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(3, 'Registraduría Nacional', 'centro', 98, 'Resultado oficial de la consulta', 1),
(3, 'La República', 'centro-derecha', 82, 'Análisis del resultado y su impacto electoral', 2),
(3, 'Infobae', 'centro-derecha', 84, 'Cobertura amplia de la consulta', 3),
(3, 'Blu Radio', 'centro', 82, 'Entrevista con Valencia tras el resultado', 4),
(3, 'Semana', 'centro-derecha', 84, 'Análisis del futuro electoral de derecha', 5);

-- Sources para noticia 4 (EPS liquidación)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(4, 'Superintendencia Nacional de Salud', 'centro', 92, 'Resolución oficial de liquidación', 1),
(4, 'Infobae Colombia', 'centro-derecha', 84, 'Cifras de pacientes afectados', 2),
(4, 'Semana', 'centro-derecha', 84, 'Análisis del impacto en el sistema de salud', 3),
(4, 'Vanguardia', 'centro', 78, 'Testimonios de pacientes afectados', 4),
(4, 'El Tiempo', 'centro', 88, 'Cobertura de la crisis sanitaria', 5);

-- Sources para noticia 5 (Trump reconoce Delcy)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(5, 'Casa Blanca (comunicado)', 'centro-derecha', 92, 'Comunicado oficial del gobierno de EE.UU.', 1),
(5, 'CNN en Español', 'centro', 90, 'Cobertura equilibrada del reconocimiento', 2),
(5, 'Infobae', 'centro-derecha', 84, 'Análisis del impacto diplomático', 3),
(5, 'Univision', 'centro', 86, 'Perspectiva de la diáspora venezolana', 4),
(5, 'Efecto Cocuyo', 'centro', 88, 'Medio independiente venezolano', 5);

-- Sources para noticia 6 (Audiencia Maduro)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(6, 'Tribunal Federal SDNY', 'centro', 98, 'Fuente judicial oficial', 1),
(6, 'Infobae', 'centro-derecha', 84, 'Reporte del aplazamiento judicial', 2),
(6, 'El Tiempo', 'centro', 88, 'Cobertura del proceso legal', 3),
(6, 'WBUR-NPR', 'centro-izquierda', 90, 'Contexto jurídico del caso', 4),
(6, 'El País (España)', 'centro-izquierda', 91, 'Perspectiva internacional', 5);

-- Sources para noticia 7 (Ley de Amnistía Venezuela)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(7, 'Foro Penal', 'centro', 90, 'ONG que documenta presos políticos en Venezuela', 1),
(7, 'CNN en Español', 'centro', 90, 'Cobertura del proceso de liberaciones', 2),
(7, 'ONU-OHCHR', 'centro', 96, 'Informe oficial de derechos humanos de la ONU', 3),
(7, 'Efecto Cocuyo', 'centro', 88, 'Medio independiente con seguimiento detallado', 4),
(7, 'Human Rights Watch', 'centro-izquierda', 92, 'Verificación independiente de casos', 5);

-- Sources para noticia 8 (ONU maquinaria represiva Venezuela)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(8, 'ONU - Misión de Determinación de los Hechos', 'centro', 97, 'Informe oficial de la misión de la ONU', 1),
(8, 'Efecto Cocuyo', 'centro', 88, 'Cobertura independiente del informe', 2),
(8, 'El Diario (VE)', 'centro-izquierda', 80, 'Análisis del alcance del informe', 3),
(8, 'Human Rights Watch', 'centro-izquierda', 92, 'Respaldo de la documentación de la ONU', 4);

-- Sources para noticia 9 (Crisis salud Colombia blindspot)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(9, 'Superintendencia Nacional de Salud', 'centro', 92, 'Datos oficiales de liquidación de EPS', 1),
(9, 'Semana', 'centro-derecha', 84, 'Reportaje sobre el alcance de la crisis', 2),
(9, 'Vanguardia', 'centro', 78, 'Testimonios de pacientes sin aseguradora', 3),
(9, 'Blu Radio', 'centro', 82, 'Cobertura de la crisis sanitaria', 4);

-- Sources para noticia 10 (Dólar Venezuela blindspot)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(10, 'Banco Central de Venezuela', 'centro', 75, 'Fuente oficial del tipo de cambio BCV', 1),
(10, 'DolarToday', 'centro', 80, 'Monitor independiente del dólar paralelo', 2),
(10, 'Correo del Caroní', 'centro', 85, 'Medio independiente con seguimiento cambiario', 3),
(10, 'Monitor Dólar Venezuela', 'centro', 78, 'Plataforma de seguimiento del dólar paralelo', 4);

-- Sources para noticia 11 (Paro transportistas Caracas)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(11, 'Efecto Cocuyo', 'centro', 88, 'Reporte en tiempo real del paro', 1),
(11, 'Correo del Caroní', 'centro', 85, 'Cobertura de impacto en ciudades', 2),
(11, 'Fedecámaras (declaración)', 'centro-derecha', 80, 'Posición del sector empresarial', 3);

-- Sources para noticia 12 (Tren descarrilado Venezuela)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(12, 'IFE (Instituto de Ferrocarriles del Estado)', 'centro', 82, 'Fuente oficial del incidente ferroviario', 1),
(12, 'El Diario VE', 'centro-izquierda', 80, 'Cobertura del incidente', 2),
(12, 'La Gran Aldea', 'centro', 82, 'Análisis del estado de infraestructura ferroviaria', 3);

-- Sources para noticia 13 (Venezuela béisbol)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(13, 'MLB (World Baseball Classic)', 'centro', 99, 'Fuente oficial del torneo', 1),
(13, 'ESPN', 'centro', 92, 'Cobertura deportiva internacional', 2),
(13, 'LVBP Oficial', 'centro', 90, 'Liga Venezolana de Béisbol Profesional', 3);

-- Sources para noticia 14 (FMI Colombia crecimiento)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(14, 'FMI (World Economic Outlook)', 'centro', 97, 'Informe oficial del FMI', 1),
(14, 'Bloomberg Línea', 'centro', 90, 'Análisis financiero del recorte', 2),
(14, 'Portafolio', 'centro', 86, 'Perspectiva económica colombiana', 3),
(14, 'Banco de la República', 'centro', 95, 'Proyecciones locales comparativas', 4);

-- Sources para noticia 15 (Sismo Colombia)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(15, 'SGC (Servicio Geológico Colombiano)', 'centro', 98, 'Fuente oficial de datos sísmicos', 1),
(15, 'Caracol Radio', 'centro', 82, 'Cobertura en vivo del sismo', 2),
(15, 'UNGRD', 'centro', 92, 'Unidad Nacional para la Gestión del Riesgo', 3);

-- Sources para noticia 16 (Guerra comercial Colombia-Ecuador)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(16, 'Gobierno de Ecuador (decreto)', 'centro-derecha', 82, 'Decreto arancelario oficial', 1),
(16, 'Reuters', 'centro', 94, 'Confirmación internacional', 2),
(16, 'Portafolio', 'centro', 86, 'Impacto en comercio exterior colombiano', 3),
(16, 'El Tiempo', 'centro', 88, 'Reacción del gobierno colombiano', 4);

-- Sources para noticia 17 (Petro Pacto Histórico)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(17, 'Presidencia de la República CO', 'centro-izquierda', 85, 'Comunicado oficial de la reunión', 1),
(17, 'La Silla Vacía', 'centro-izquierda', 92, 'Análisis de la agenda legislativa', 2),
(17, 'Blu Radio', 'centro', 82, 'Cobertura de la reunión', 3);

-- Sources para noticia 18 (Dólar BCV Venezuela)
INSERT INTO news_sources (news_id, name, bias, credibility, stance, sort_order) VALUES
(18, 'Banco Central de Venezuela', 'centro', 75, 'Tipo de cambio oficial BCV', 1),
(18, 'DolarToday', 'centro', 80, 'Seguimiento del dólar paralelo', 2),
(18, 'Correo del Caroní', 'centro', 85, 'Medio independiente con datos de divisas', 3);

-- ══════════════════════════════════════════════════════════
-- ARTICLE PARAGRAPHS (body del modal)
-- ══════════════════════════════════════════════════════════

-- Artículo 1 (Petro bombardeo Ecuador)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(1, 'El presidente Gustavo Petro denunció públicamente el 17 de marzo de 2026 que aeronaves ecuatorianas bombardearon territorio colombiano en el departamento de Nariño, específicamente en el sector de Jardines de Sucumbíos. Según Petro, el ataque dejó 27 cuerpos calcinados y en el lugar fue hallada una bomba de 250 kg de fabricación estadounidense, de las usadas por la Fuerza Aérea ecuatoriana.', 1),
(1, 'El mandatario colombiano publicó en redes sociales las coordenadas GPS del supuesto bombardeo y una fotografía de los restos de la bomba, exigiendo explicaciones al gobierno de Daniel Noboa. El incidente generó una crisis diplomática inmediata entre ambos países, con Colombia convocando al embajador ecuatoriano.', 2),
(1, 'El presidente de Ecuador, Daniel Noboa, negó tajantemente las acusaciones. El gobierno ecuatoriano emitió un comunicado señalando que sus Fuerzas Armadas no realizaron ninguna operación en territorio colombiano y calificó las declaraciones de Petro como "infundadas y destinadas a desviar la atención de la crisis interna colombiana".', 3),
(1, 'La situación se enmarca en un contexto de creciente tensión bilateral, agravada por la presencia de grupos armados en la zona fronteriza de Nariño y Sucumbíos. Organizaciones internacionales, incluyendo la OEA, pidieron que ambos gobiernos aporten pruebas verificables antes de escalar el conflicto diplomático. La veredicidad de los hechos sigue siendo objeto de disputa.', 4);

-- Artículo 2 (Pacto Histórico elecciones)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(2, 'Las elecciones legislativas del 8 de marzo de 2026 consolidaron al Pacto Histórico, la coalición progresista del presidente Gustavo Petro, como la primera fuerza política del Congreso colombiano. La coalición obtuvo 62 curules en total, aumentando significativamente su representación tanto en el Senado como en la Cámara de Representantes.', 1),
(2, 'La Registraduría Nacional confirmó los resultados oficiales, que reflejan una creciente polarización del electorado colombiano. A pesar del avance, el Pacto Histórico no alcanzó mayoría absoluta en el Senado, lo que obligará al gobierno a buscar alianzas para avanzar en las reformas pendientes de su agenda legislativa.', 2),
(2, 'Los mercados colombianos reaccionaron con moderación a los resultados. El peso colombiano mostró estabilidad frente al dólar, y analistas de Bloomberg Línea interpretaron el escenario fragmentado como señal de que ningún bloque puede implementar cambios radicales en la política económica.', 3),
(2, 'La jornada transcurrió sin incidentes mayores, aunque se reportaron alegaciones de intentos de voto irregular en zonas fronterizas con Venezuela. Los partidos de oposición anunciaron que acudirán a la Registraduría para solicitar auditorías en circunscripciones donde detectaron irregularidades.', 4);

-- Artículo 3 (Paloma Valencia consulta)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(3, 'La senadora Paloma Valencia del Centro Democrático arrasó en la consulta interpartidista del 8 de marzo de 2026, obteniendo más de 3,2 millones de votos y posicionándose como la candidata presidencial del centro-derecha para las elecciones de mayo. El resultado superó las expectativas de su propio partido.', 1),
(3, 'Valencia, conocida por sus posiciones de línea dura frente al gobierno de Petro y por su defensa de la seguridad y la inversión privada, se convirtió en la principal contendiente conservadora. El expresidente Álvaro Uribe, fundador del Centro Democrático, celebró el resultado como "una señal del descontento ciudadano con el rumbo del país".', 2),
(3, 'El volumen de participación en la consulta superó los 4 millones de votos en total, una cifra significativa para una consulta interpartidista. Analistas de La República y Blu Radio señalaron que el resultado anticipa un escenario presidencial de alta competencia entre Petro y un sucesor no oficialista.', 3);

-- Artículo 4 (EPS liquidación)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(4, 'El presidente Gustavo Petro emitió el 16 de marzo de 2026 una directiva ordenando a la Superintendencia Nacional de Salud liquidar las EPS (Entidades Promotoras de Salud) que se encuentran en estado de quiebra técnica, incluyendo algunas de las más grandes del país. La medida deja a más de 23 millones de colombianos sin aseguradora de salud vigente.', 1),
(4, 'La decisión se enmarca en la estrategia del gobierno de Petro de avanzar hacia un sistema de salud público unificado, luego del fracaso de la reforma a la salud en el Congreso. Desde el gobierno, el ministro de Salud señaló que el Estado garantizará la continuidad de los servicios a través de gestoras de servicios de salud.', 2),
(4, 'Sin embargo, médicos, hospitales y pacientes reportan caos y desinformación sobre cómo acceder a los servicios. La Asociación Colombiana de Hospitales y Clínicas advirtió sobre el riesgo de desabastecimiento de medicamentos y de interrupción de tratamientos oncológicos y de enfermedades crónicas.', 3),
(4, 'Medios como Semana y Vanguardia documentaron testimonios de pacientes con cáncer y enfermedades renales en incertidumbre sobre la continuidad de su tratamiento. La oposición calificó la medida como "imprudente" y anunció acciones legales para proteger a los afiliados.', 4);

-- Artículo 5 (Trump reconoce Delcy)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(5, 'La administración Trump emitió el 12 de marzo de 2026 un comunicado formal en el que reconoce a Delcy Rodríguez como la única jefa de Estado legítima de Venezuela, formalizando así el respaldo estadounidense a la presidenta encargada que asumió tras la detención de Nicolás Maduro en enero.', 1),
(5, 'El comunicado de la Casa Blanca señaló que el reconocimiento abre el camino para restablecer plenas relaciones diplomáticas y consulares entre ambos países, suspendidas durante años. El Departamento de Estado anunció que comenzarán negociaciones bilaterales sobre extradición, comercio de petróleo y flujos migratorios.', 2),
(5, 'En Venezuela, la medida fue recibida con división. El PSUV, partido de gobierno, celebró el reconocimiento como una "victoria de la estabilidad", mientras que sectores de la oposición liderados por María Corina Machado advirtieron que legitimar al PSUV sin elecciones libres es un error estratégico.', 3);

-- Artículo 6 (Audiencia Maduro aplazada)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(6, 'El Tribunal Federal del Distrito Sur de Nueva York (SDNY) decidió el 17 de marzo de 2026 aplazar al 26 de marzo la audiencia inicial de Nicolás Maduro, quien enfrenta cargos federales de narcotráfico y terrorismo desde su detención en enero.', 1),
(6, 'Según fuentes judiciales citadas por Infobae y WBUR-NPR, el aplazamiento se debió a dificultades logísticas relacionadas con la traslación y custodia del detenido, así como a la necesidad del equipo defensor de tiempo adicional para revisar los cargos formales presentados por la fiscalía.', 2),
(6, 'El caso Maduro es uno de los procesos judiciales más observados internacionalmente en 2026. El expresidente venezolano es señalado de liderar una red de narcotráfico conocida como los "Soles Cartel" y de cooperar con grupos terroristas. La próxima audiencia del 26 de marzo podría definir si Maduro acepta o rechaza los cargos.', 3),
(6, 'Organizaciones de derechos humanos siguen el proceso con atención, señalando que el juicio podría sentar precedente sobre la jurisdicción extraterritorial de EE.UU. frente a líderes de Estado acusados de crímenes transnacionales.', 4);

-- Artículo 7 (Ley de Amnistía Venezuela)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(7, 'Organizaciones venezolanas de derechos humanos, encabezadas por Foro Penal, reportaron el 13 de marzo de 2026 que más de 7.700 ciudadanos han recuperado su libertad al amparo de la Ley de Amnistía promulgada por la Asamblea Nacional en el contexto del cambio político iniciado tras la detención de Maduro.', 1),
(7, 'Sin embargo, la ONU-OHCHR y Human Rights Watch advirtieron que la cifra podría estar inflada y que el aparato represivo del Estado venezolano permanece activo. Según un informe de la Misión de Determinación de los Hechos de la ONU, las fuerzas del SEBIN y la DGCIM no han sido reformadas ni desmanteladas.', 2),
(7, 'La Ley de Amnistía fue presentada por la administración Rodríguez como un gesto de apertura democrática, pero organizaciones independientes señalan que muchos de los liberados son presos comunes y no necesariamente presos políticos documentados por Foro Penal. La cifra de 7.700 requiere verificación caso por caso.', 3);

-- Artículo 8 (ONU maquinaria represiva)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(8, 'La Misión Internacional Independiente de Determinación de los Hechos sobre Venezuela, creada por el Consejo de Derechos Humanos de la ONU, publicó en marzo de 2026 un informe actualizado en el que concluye que la maquinaria represiva del Estado venezolano permanece intacta bajo la administración de Delcy Rodríguez.', 1),
(8, 'El informe documenta que el SEBIN, la DGCIM y las colectivos armados afines al PSUV continúan operando sin reformas estructurales. La misión señala que la Ley de Amnistía, aunque permite algunas liberaciones, no desmantela los mecanismos institucionales de represión.', 2),
(8, 'Este informe es sistemáticamente ignorado por medios estatales venezolanos como VTV y RNV. Solo medios independientes como Efecto Cocuyo y El Diario han dado cobertura al documento. El punto ciego deja a amplios sectores de la audiencia venezolana sin acceso a la evaluación internacional del estado de los derechos humanos.', 3);

-- Artículo 9 (Crisis salud Colombia blindspot)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(9, 'La liquidación de las principales EPS colombianas en quiebra ordenada por el presidente Petro el 16 de marzo de 2026 generó una crisis sanitaria de proporciones históricas. Más de 23 millones de colombianos —casi la mitad de la población afiliada al sistema— quedaron en un limbo legal respecto a su cobertura de salud.', 1),
(9, 'La Superintendencia Nacional de Salud confirmó que la transición hacia las nuevas gestoras de servicios de salud tomará semanas, durante las cuales los pacientes con enfermedades crónicas, oncológicas y renales podrían enfrentar interrupciones en sus tratamientos.', 2),
(9, 'Medios afines al gobierno minimizan el alcance de la crisis, presentándola como una "transición ordenada". Sin embargo, Semana, Vanguardia y Blu Radio documentan testimonios de pacientes sin acceso a medicamentos y hospitales sin claridad sobre cómo facturar los servicios. Este punto ciego pone en riesgo la vida de miles de personas.', 3);

-- Artículo 10 (Dólar Venezuela blindspot)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(10, 'El tipo de cambio oficial del Banco Central de Venezuela (BCV) superó los 448 bolívares por dólar el 17 de marzo de 2026, mientras el mercado paralelo situaba la cotización rozando los 590 bolívares. La brecha cambiaria del 31% entre ambas tasas refleja la creciente presión sobre la moneda nacional.', 1),
(10, 'Monitores independientes como DolarToday y Monitor Dólar Venezuela registran la depreciación en tiempo real. Desde enero de 2026, el bolívar ha perdido más del 18% de su valor frente al dólar en el mercado oficial, una tendencia que impacta directamente el poder adquisitivo de los venezolanos.', 2),
(10, 'El punto ciego de esta noticia es que los medios oficialistas venezolanos —VTV, RNV y portales del gobierno— no publican los datos del dólar paralelo y minimizan la depreciación del bolívar oficial. Esta omisión impide que millones de venezolanos accedan a información cambiaria que afecta sus decisiones económicas cotidianas.', 3);

-- Artículo 11 (Paro transportistas Caracas)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(11, 'Un paro de transportistas públicos paralizó cerca del 90% del servicio de transporte en Caracas el 17 de marzo de 2026, según gremios del sector. El cese de actividades fue convocado en protesta por el aumento del precio del combustible y el deterioro de las unidades, sin acceso a repuestos.', 1),
(11, 'El paro afectó principalmente las rutas periféricas de la capital, donde la dependencia del transporte público es mayor. Efecto Cocuyo reportó largas filas en paraderos y ciudadanos que debieron caminar varios kilómetros hasta sus lugares de trabajo.', 2),
(11, 'El gobierno de Delcy Rodríguez no emitió un comunicado oficial sobre el paro hasta el mediodía. Fedecámaras expresó solidaridad con el sector y exigió una mesa de diálogo urgente para resolver el problema de los repuestos y el precio del gasoil.', 3);

-- Artículo 12 (Tren Venezuela)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(12, 'Un convoy del Tren de los Valles del Tuy sufrió un descarrilamiento en el sector de La Rinconada, en Caracas, el 17 de marzo de 2026. El Instituto de Ferrocarriles del Estado (IFE) confirmó el incidente y señaló que no se reportaron víctimas fatales, aunque varios pasajeros sufrieron heridas leves.', 1),
(12, 'El tren, que conecta Caracas con los valles del Tuy Medio en el estado Miranda, es uno de los pocos medios de transporte masivo funcionales en Venezuela. El incidente reavivó el debate sobre el estado de deterioro de la infraestructura ferroviaria nacional, que no ha recibido mantenimiento integral desde hace más de una década.', 2),
(12, 'La Gran Aldea reportó que el descarrilamiento se debió a fallas en la vía en una sección que lleva meses sin mantenimiento. El gobierno prometió una investigación técnica, pero no ofreció un cronograma de reparación ni de reanudación del servicio.', 3);

-- Artículo 13 (Venezuela béisbol)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(13, 'La selección venezolana de béisbol protagonizó una actuación histórica en el Clásico Mundial de Béisbol 2026, venciendo a Italia por 4-2 en las semifinales celebradas el 17 de marzo. El triunfo clasificó a Venezuela a la final del torneo por primera vez desde 2009.', 1),
(13, 'El partido fue dominado por la ofensiva venezolana desde el tercer inning. Los jonrones de Jesús Aguilar y Ronald Acuña Jr. fueron los momentos destacados del encuentro. ESPN calificó el rendimiento del equipo como "una de las mejores actuaciones venezolanas en la historia del Clásico".', 2),
(13, 'La victoria generó una ola de celebración en Venezuela y entre la diáspora venezolana en el mundo. Las redes sociales se inundaron de mensajes de apoyo, y el béisbol —deporte nacional venezolano— volvió a convertirse en un motivo de unión en un contexto político complejo.', 3);

-- Artículo 14 (FMI Colombia)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(14, 'El Fondo Monetario Internacional publicó su actualización de perspectivas económicas para América Latina, recortando la proyección de crecimiento de Colombia para 2026 de 2,8% a 2,3%. El FMI citó la incertidumbre política derivada de las elecciones legislativas y la crisis del sistema de salud como los principales factores del recorte.', 1),
(14, 'Bloomberg Línea señaló que el recorte del FMI contrasta con las expectativas del gobierno de Petro, que proyectaba un crecimiento del 3,1%. El Banco de la República de Colombia anunció que revisará sus propias proyecciones a la luz del informe del FMI.', 2),
(14, 'Analistas de Portafolio advirtieron que la incertidumbre sobre la reforma de salud, la liquidación de EPS y la tensión diplomática con Ecuador son factores que podrían presionar aún más el crecimiento si no se resuelven en el corto plazo.', 3);

-- Artículo 15 (Sismo Colombia)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(15, 'El Servicio Geológico Colombiano (SGC) registró el 17 de marzo de 2026 un sismo de magnitud 5.2 con epicentro en el municipio de Salento, Quindío, en el corazón del Eje Cafetero colombiano. El temblor fue sentido en Manizales, Armenia, Pereira y el norte del Valle del Cauca.', 1),
(15, 'Hasta el momento del reporte, no se han registrado víctimas fatales ni daños estructurales significativos. La UNGRD (Unidad Nacional para la Gestión del Riesgo de Desastres) activó los protocolos de evaluación en los municipios afectados.', 2),
(15, 'Caracol Radio transmitió testimonios de ciudadanos que reportaron el movimiento como "fuerte y prolongado". El SGC señaló que la actividad sísmica en la región es normal dado que el Eje Cafetero se ubica sobre el sistema de fallas del Romeral.', 3);

-- Artículo 16 (Guerra comercial Colombia-Ecuador)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(16, 'El gobierno de Ecuador, mediante decreto ejecutivo, elevó los aranceles a los productos colombianos al 50%, una medida que entra en vigencia de forma inmediata y que escaló la tensión comercial entre ambos países en el contexto de la denuncia de bombardeo hecha por el presidente Petro.', 1),
(16, 'Reuters confirmó la medida y señaló que afectará principalmente a productos agrícolas, textiles y manufacturas colombianas que ingresan a Ecuador. Colombia exporta aproximadamente 2.000 millones de dólares anuales a su vecino del sur.', 2),
(16, 'El Ministerio de Comercio de Colombia anunció que evaluará medidas de retaliación y presentará una queja formal ante la Organización Mundial del Comercio (OMC). Portafolio advirtió que el impacto será especialmente severo para los departamentos fronterizos como Nariño y Putumayo.', 3);

-- Artículo 17 (Petro Pacto Histórico agenda)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(17, 'El presidente Gustavo Petro sostuvo una reunión con la bancada del Pacto Histórico en el Congreso para definir la agenda legislativa prioritaria del nuevo periodo que se inicia tras las elecciones del 8 de marzo. La cita busca coordinar la estrategia para avanzar en las reformas pendientes.', 1),
(17, 'Según La Silla Vacía, los temas centrales de la reunión fueron la reforma a la salud —que deberá replantearse dado el nuevo mapa parlamentario—, la política de paz total y la gestión de la crisis diplomática con Ecuador.', 2),
(17, 'La bancada oficialista, fortalecida con las 62 curules obtenidas, busca avanzar en reformas que en el período anterior fueron bloqueadas por la oposición. Sin embargo, analistas señalan que Petro aún necesitará alianzas con partidos del centro para asegurar las mayorías necesarias.', 3);

-- Artículo 18 (Dólar Venezuela feed)
INSERT INTO article_paragraphs (news_id, content, sort_order) VALUES
(18, 'El tipo de cambio oficial del Banco Central de Venezuela (BCV) cerró el 17 de marzo de 2026 en 448,32 bolívares por dólar, mientras el mercado paralelo ubicó la cotización en 589 bolívares, según datos de DolarToday y Monitor Dólar Venezuela.', 1),
(18, 'La jornada estuvo marcada por una alta demanda de divisas en el mercado informal, impulsada por el paro de transportistas y la incertidumbre generada por el proceso judicial de Maduro en Nueva York. La brecha cambiaria del 31% es la más alta registrada en lo que va del año.', 2),
(18, 'Economistas independientes advierten que si la tendencia se mantiene, el bolívar podría superar los 500 por dólar en el BCV antes de fin de mes. El impacto en los precios de bienes básicos ya es perceptible en mercados caraqueños, donde los comerciantes ajustan precios a la tasa paralela.', 3);

-- ══════════════════════════════════════════════════════════
-- RESET SEQUENCE
-- ══════════════════════════════════════════════════════════
SELECT setval(pg_get_serial_sequence('news', 'id'), (SELECT MAX(id) FROM news));
