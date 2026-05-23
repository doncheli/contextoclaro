// supabase/functions/enrich-news/index.ts
// Enriquecimiento masivo de noticias sin imagen:
//   - Asigna imagen hero por categoría/título usando librería Unsplash curada
//   - (No descarga ni reprocesa; solo apunta la URL)
// Invocable manualmente o vía cron.
//
// Query params:
//   ?limit=50        (default 50, max 200)
//   ?dry_run=1

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ══════════════════════════════════════════════════════════
// LIBRERÍA DE IMÁGENES POR KEYWORD
// ══════════════════════════════════════════════════════════
// Espejo de src/lib/categoryImages.js — manténgalos sincronizados.

// ══════════════════════════════════════════════════════════
// LIBRERÍA DE FOTOS DE PERSONAS (Wikimedia Commons)
// ══════════════════════════════════════════════════════════
// Matchea por keyword en el título. Prioridad MÁXIMA: si una
// persona conocida aparece mencionada, su foto reemplaza al
// fallback de categoría.

const PEOPLE_PHOTOS: Record<string, string> = {
  "abalos": "https://upload.wikimedia.org/wikipedia/commons/e/ea/Jos%C3%A9_Luis_%C3%81balos_2020_%28cropped%29.jpg",
  "alex saab": "https://upload.wikimedia.org/wikipedia/commons/2/25/Alex_Saab_mugshot.jpg",
  "alvaro uribe": "https://upload.wikimedia.org/wikipedia/commons/2/24/%C3%81lvaro_Uribe_%28cropped%29.jpg",
  "amlo": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/01.10.2024_-_Cerim%C3%B4nia_de_transmiss%C3%A3o_do_Poder_Executivo_Federal_%2854036093388%29_%28cropped%29.jpg/960px-01.10.2024_-_Cerim%C3%B4nia_de_transmiss%C3%A3o_do_Poder_Executivo_Federal_%2854036093388%29_%28cropped%29.jpg",
  "bachelet": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Portrait_Michelle_Bachelet.jpg/960px-Portrait_Michelle_Bachelet.jpg",
  "bezos": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Jeff_Bezos_talking.jpg/960px-Jeff_Bezos_talking.jpg",
  "boluarte": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/President_Dina_Boluarte.jpg/960px-President_Dina_Boluarte.jpg",
  "boric": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Retrato_Oficial_Presidente_Boric_Font.jpg/960px-Retrato_Oficial_Presidente_Boric_Font.jpg",
  "bukele": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Presidente_Nayib_Bukele_%28cropped%29.jpg/960px-Presidente_Nayib_Bukele_%28cropped%29.jpg",
  "cilia flores": "https://upload.wikimedia.org/wikipedia/commons/a/a6/Cilia_Flores_2025_%28cropped%29.jpg",
  "delcy rodriguez": "https://upload.wikimedia.org/wikipedia/commons/9/93/Delcy_Rodr%C3%ADguez_%2826-01-2026%29_%28cropped%29.jpg",
  "delcy rodr\u00edguez": "https://upload.wikimedia.org/wikipedia/commons/9/93/Delcy_Rodr%C3%ADguez_%2826-01-2026%29_%28cropped%29.jpg",
  "diosdado cabello": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Diosdado_Cabello_2025.jpg/960px-Diosdado_Cabello_2025.jpg",
  "donald trump": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Official_Presidential_Portrait_of_President_Donald_J._Trump_%282025%29.jpg/960px-Official_Presidential_Portrait_of_President_Donald_J._Trump_%282025%29.jpg",
  "el aissami": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Tareck_El_Aissami_Portrait.jpg/960px-Tareck_El_Aissami_Portrait.jpg",
  "elon musk": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Elon_Musk_%2854816836217%29_%28cropped_2%29_%28b%29.jpg/960px-Elon_Musk_%2854816836217%29_%28cropped_2%29_%28b%29.jpg",
  "evo morales": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Evo_Morales_Ayma_%28cropped_3%29.jpg/960px-Evo_Morales_Ayma_%28cropped_3%29.jpg",
  "federico guti\u00e9rrez": "https://upload.wikimedia.org/wikipedia/commons/9/9c/Federico_Guti%C3%A9rrez.jpg",
  "feijoo": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/ALBERTO_N%C3%9A%C3%91EZ_FEIJ%C3%93O.jpg/960px-ALBERTO_N%C3%9A%C3%91EZ_FEIJ%C3%93O.jpg",
  "feij\u00f3o": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/ALBERTO_N%C3%9A%C3%91EZ_FEIJ%C3%93O.jpg/960px-ALBERTO_N%C3%9A%C3%91EZ_FEIJ%C3%93O.jpg",
  "fico guti\u00e9rrez": "https://upload.wikimedia.org/wikipedia/commons/9/9c/Federico_Guti%C3%A9rrez.jpg",
  "francia marquez": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Vicepresidenta_Francia_M%C3%A1rquez_en_su_despacho.jpg/960px-Vicepresidenta_Francia_M%C3%A1rquez_en_su_despacho.jpg",
  "francia m\u00e1rquez": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Vicepresidenta_Francia_M%C3%A1rquez_en_su_despacho.jpg/960px-Vicepresidenta_Francia_M%C3%A1rquez_en_su_despacho.jpg",
  "francisco": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Pope_Francis_Korea_Haemi_Castle_19_%284x5_cropped%29.jpg/960px-Pope_Francis_Korea_Haemi_Castle_19_%284x5_cropped%29.jpg",
  "freddy bernal": "https://upload.wikimedia.org/wikipedia/commons/c/c9/Freddy_Bernal_%28cropped%29.png",
  "gustavo petro": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Foto_Oficial_Presidente_Gustavo_Petro_%283x4_cropped%29.jpg/960px-Foto_Oficial_Presidente_Gustavo_Petro_%283x4_cropped%29.jpg",
  "guterres": "https://upload.wikimedia.org/wikipedia/commons/d/dd/Antonio_Guterres_2025_headshot.jpg",
  "henrique capriles": "https://upload.wikimedia.org/wikipedia/commons/e/e3/Henrique_Capriles_2022.jpg",
  "ivan duque": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Iv%C3%A1n_Duque%2C_oct_2021_1.1.jpg/960px-Iv%C3%A1n_Duque%2C_oct_2021_1.1.jpg",
  "iv\u00e1n duque": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Iv%C3%A1n_Duque%2C_oct_2021_1.1.jpg/960px-Iv%C3%A1n_Duque%2C_oct_2021_1.1.jpg",
  "javier milei": "https://upload.wikimedia.org/wikipedia/commons/2/25/Retrato_oficial_Presidente_Milei.png",
  "joe biden": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Joe_Biden_presidential_portrait.jpg/960px-Joe_Biden_presidential_portrait.jpg",
  "juan guaid\u00f3": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Juan_Guaid%C3%B3_2019_portrait.jpg/960px-Juan_Guaid%C3%B3_2019_portrait.jpg",
  "juan manuel santos": "https://upload.wikimedia.org/wikipedia/commons/3/37/Juan_Manuel_Santos_and_Lula_%28cropped%29.jpg",
  "kamala harris": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Kamala_Harris_Vice_Presidential_Portrait.jpg/960px-Kamala_Harris_Vice_Presidential_Portrait.jpg",
  "leon xiv": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Pope_Leo_XIV_3_%283x4_cropped%29.png/960px-Pope_Leo_XIV_3_%283x4_cropped%29.png",
  "leopoldo l\u00f3pez": "https://upload.wikimedia.org/wikipedia/commons/4/48/Leopoldo_Lopez_1.JPG",
  "lula": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Foto_oficial_de_Luiz_In%C3%A1cio_Lula_da_Silva_%28estreita%29.jpg/960px-Foto_oficial_de_Luiz_In%C3%A1cio_Lula_da_Silva_%28estreita%29.jpg",
  "lula da silva": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Foto_oficial_de_Luiz_In%C3%A1cio_Lula_da_Silva_%28estreita%29.jpg/960px-Foto_oficial_de_Luiz_In%C3%A1cio_Lula_da_Silva_%28estreita%29.jpg",
  "macron": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Emmanuel_Macron_2025_%28cropped%29.jpg/960px-Emmanuel_Macron_2025_%28cropped%29.jpg",
  "maduro": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Nicolas_Maduro_on_December_31%2C_2025_%28cropped2%29.jpg/960px-Nicolas_Maduro_on_December_31%2C_2025_%28cropped2%29.jpg",
  "marco rubio": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Official_portrait_of_Secretary_Marco_Rubio%2C_January_2025.jpg/960px-Official_portrait_of_Secretary_Marco_Rubio%2C_January_2025.jpg",
  "maria corina": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Mar%C3%ADa_Corina_Machado_in_Oslo_%28cropped%29.jpg/960px-Mar%C3%ADa_Corina_Machado_in_Oslo_%28cropped%29.jpg",
  "mariano rajoy": "https://upload.wikimedia.org/wikipedia/commons/d/d7/Mariano_Rajoy_in_2018.jpg",
  "mar\u00eda corina machado": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Mar%C3%ADa_Corina_Machado_in_Oslo_%28cropped%29.jpg/960px-Mar%C3%ADa_Corina_Machado_in_Oslo_%28cropped%29.jpg",
  "meloni": "https://upload.wikimedia.org/wikipedia/commons/9/96/Giorgia_Meloni_Official_2024_%28cropped%29.jpg",
  "michelle bachelet": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Portrait_Michelle_Bachelet.jpg/960px-Portrait_Michelle_Bachelet.jpg",
  "michelo": "https://upload.wikimedia.org/wikipedia/commons/b/b3/Michelo_%28cropped%29.jpg",
  "milei": "https://upload.wikimedia.org/wikipedia/commons/2/25/Retrato_oficial_Presidente_Milei.png",
  "musk": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Elon_Musk_%2854816836217%29_%28cropped_2%29_%28b%29.jpg/960px-Elon_Musk_%2854816836217%29_%28cropped_2%29_%28b%29.jpg",
  "noboa": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/President_Daniel_Noboa_May_2025.jpg/960px-President_Daniel_Noboa_May_2025.jpg",
  "n\u00fa\u00f1ez feij\u00f3o": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/ALBERTO_N%C3%9A%C3%91EZ_FEIJ%C3%93O.jpg/960px-ALBERTO_N%C3%9A%C3%91EZ_FEIJ%C3%93O.jpg",
  "ortega": "https://upload.wikimedia.org/wikipedia/commons/a/a5/Daniel_Ortega_on_July_20%2C_2024_%282%29.jpg",
  "padrino l\u00f3pez": "https://upload.wikimedia.org/wikipedia/commons/6/68/Vladimir_Padrino_L%C3%B3pez_%282018-04-03%29_2.jpg",
  "papa francisco": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Pope_Francis_Korea_Haemi_Castle_19_%284x5_cropped%29.jpg/960px-Pope_Francis_Korea_Haemi_Castle_19_%284x5_cropped%29.jpg",
  "papa le\u00f3n": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Pope_Leo_XIV_3_%283x4_cropped%29.png/960px-Pope_Leo_XIV_3_%283x4_cropped%29.png",
  "pedro sanchez": "https://upload.wikimedia.org/wikipedia/commons/4/4a/Pedro_S%C3%A1nchez_in_2026.jpg",
  "pedro s\u00e1nchez": "https://upload.wikimedia.org/wikipedia/commons/4/4a/Pedro_S%C3%A1nchez_in_2026.jpg",
  "petro": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Foto_Oficial_Presidente_Gustavo_Petro_%283x4_cropped%29.jpg/960px-Foto_Oficial_Presidente_Gustavo_Petro_%283x4_cropped%29.jpg",
  "putin": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/%D0%92%D0%BB%D0%B0%D0%B4%D0%B8%D0%BC%D0%B8%D1%80_%D0%9F%D1%83%D1%82%D0%B8%D0%BD_%2808-03-2024%29_%28cropped%29_%28higher_res%29_2.jpg/960px-%D0%92%D0%BB%D0%B0%D0%B4%D0%B8%D0%BC%D0%B8%D1%80_%D0%9F%D1%83%D1%82%D0%B8%D0%BD_%2808-03-2024%29_%28cropped%29_%28higher_res%29_2.jpg",
  "santiago abascal": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Santiago_Abascal_%2854349274173%29_%28cropped%29.jpg/960px-Santiago_Abascal_%2854349274173%29_%28cropped%29.jpg",
  "sergio fajardo": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/SergioFajardo.jpg/960px-SergioFajardo.jpg",
  "sheinbaum": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Claudia_Sheinbaum_in_2025_%283x4_cropped%29.jpg/960px-Claudia_Sheinbaum_in_2025_%283x4_cropped%29.jpg",
  "tareck el aissami": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Tareck_El_Aissami_Portrait.jpg/960px-Tareck_El_Aissami_Portrait.jpg",
  "trump": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Official_Presidential_Portrait_of_President_Donald_J._Trump_%282025%29.jpg/960px-Official_Presidential_Portrait_of_President_Donald_J._Trump_%282025%29.jpg",
  "vicky davila": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Vicky_D%C3%A1vila%2C_precandidata_presidencial.jpg/960px-Vicky_D%C3%A1vila%2C_precandidata_presidencial.jpg",
  "vicky d\u00e1vila": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Vicky_D%C3%A1vila%2C_precandidata_presidencial.jpg/960px-Vicky_D%C3%A1vila%2C_precandidata_presidencial.jpg",
  "vladimir padrino": "https://upload.wikimedia.org/wikipedia/commons/6/68/Vladimir_Padrino_L%C3%B3pez_%282018-04-03%29_2.jpg",
  "von der leyen": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Ursula_von_der_Leyen_2024.jpg/960px-Ursula_von_der_Leyen_2024.jpg",
  "xi jinping": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Xi_Jinping_meets_Keir_Starmer_Jan_2026.jpg/960px-Xi_Jinping_meets_Keir_Starmer_Jan_2026.jpg",
  "yolanda d\u00edaz": "https://upload.wikimedia.org/wikipedia/commons/4/41/A90Q3891.jpg_%28cropped%29.jpg",
  "zapatero": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Jos%C3%A9_Luis_Rodr%C3%ADguez_Zapatero_en_el_III_Foro_Mundial_de_Derechos_Humanos_2023_%28cropped%29.jpg/960px-Jos%C3%A9_Luis_Rodr%C3%ADguez_Zapatero_en_el_III_Foro_Mundial_de_Derechos_Humanos_2023_%28cropped%29.jpg",
  "zelensky": "https://upload.wikimedia.org/wikipedia/commons/d/d3/Volodymyr_Zelensky_2022_official_portrait_%28cropped%29.jpg",
  "zuckerberg": "https://upload.wikimedia.org/wikipedia/commons/2/21/Mark_Zuckerberg_in_September_2025_%28cropped%29.jpg",
  "\u00e1balos": "https://upload.wikimedia.org/wikipedia/commons/e/ea/Jos%C3%A9_Luis_%C3%81balos_2020_%28cropped%29.jpg",
  "\u00e1lvaro uribe": "https://upload.wikimedia.org/wikipedia/commons/2/24/%C3%81lvaro_Uribe_%28cropped%29.jpg",
};

const CATEGORY_IMAGES: Record<string, string> = {
  // Política
  politica: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200&q=80",
  gobierno: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200&q=80",
  elecciones: "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=1200&q=80",
  congreso: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200&q=80",
  asamblea: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200&q=80",
  presidente: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200&q=80",
  ministro: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200&q=80",

  // Economía
  economia: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80",
  finanzas: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80",
  mercado: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80",
  petroleo: "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=1200&q=80",
  inflacion: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80",
  bolivar: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80",
  dolar: "https://images.unsplash.com/photo-1554260570-83d0c6cdf04e?w=1200&q=80",
  banco: "https://images.unsplash.com/photo-1601597111158-2fceff292cdc?w=1200&q=80",

  // Seguridad / Crimen
  seguridad: "https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=1200&q=80",
  crimen: "https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=1200&q=80",
  policia: "https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=1200&q=80",
  militar: "https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=1200&q=80",
  defensa: "https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=1200&q=80",
  narcotrafico: "https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=1200&q=80",
  fiscalia: "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=1200&q=80",

  // Tecnología
  tecnologia: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80",
  digital: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80",
  inteligencia: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80",
  ciberseguridad: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&q=80",
  hackeo: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&q=80",
  filtracion: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&q=80",

  // Salud
  salud: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=1200&q=80",
  hospital: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=1200&q=80",
  vacuna: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=1200&q=80",
  medicina: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=1200&q=80",
  pandemia: "https://images.unsplash.com/photo-1584118624012-df056829fbd0?w=1200&q=80",

  // Deportes
  deporte: "https://images.unsplash.com/photo-1461896836934-bd45ba8fcf9b?w=1200&q=80",
  beisbol: "https://images.unsplash.com/photo-1529768167801-9173d94c2a42?w=1200&q=80",
  futbol: "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=1200&q=80",
  liga: "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=1200&q=80",
  mundial: "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=1200&q=80",

  // Educación
  educacion: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80",
  universidad: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80",
  escuela: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80",

  // Medio Ambiente
  ambiente: "https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=1200&q=80",
  clima: "https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=1200&q=80",
  amazonia: "https://images.unsplash.com/photo-1542039509-0489dc8c1e23?w=1200&q=80",

  // Energía
  energia: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=1200&q=80",
  mineria: "https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=1200&q=80",
  electricidad: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=1200&q=80",

  // Internacional
  internacional: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&q=80",
  eeuu: "https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=1200&q=80",
  trump: "https://images.unsplash.com/photo-1501466044931-62695aada8e9?w=1200&q=80",
  europa: "https://images.unsplash.com/photo-1473951574080-01fe45ec8643?w=1200&q=80",
  rusia: "https://images.unsplash.com/photo-1542903660-eedba2cda473?w=1200&q=80",

  // Justicia
  justicia: "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=1200&q=80",
  tribunal: "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=1200&q=80",
  juicio: "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=1200&q=80",
  corrupcion: "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=1200&q=80",
  investigacion: "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=1200&q=80",

  // Migración / Sociedad
  migracion: "https://images.unsplash.com/photo-1517760444937-f6397edcbbcd?w=1200&q=80",
  sociedad: "https://images.unsplash.com/photo-1517760444937-f6397edcbbcd?w=1200&q=80",
  protesta: "https://images.unsplash.com/photo-1561049501-e1f96bdd0f8d?w=1200&q=80",
  marcha: "https://images.unsplash.com/photo-1561049501-e1f96bdd0f8d?w=1200&q=80",

  // Entretenimiento
  cine: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&q=80",
  musica: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1200&q=80",
  cultura: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&q=80",
  espectaculos: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&q=80",

  // Países (último resort)
  venezuela: "https://images.unsplash.com/photo-1589519160732-57fc498494f8?w=1200&q=80",
  colombia: "https://images.unsplash.com/photo-1568632234157-ce7aecd03d0d?w=1200&q=80",
};

const GENERIC_FALLBACK = "https://images.unsplash.com/photo-1504711434969-e33886168d5c?w=1200&q=80";

function pickImage(news: { category?: string | null; title?: string | null; country_code?: string | null }): { url: string; reason: string } {
  const title = (news.title || "").toLowerCase();
  const text = `${news.category || ""} ${title}`.toLowerCase();

  // 1. Prioridad: persona conocida mencionada en el TÍTULO
  // Buscar el match más largo (más específico)
  let bestKw: string | null = null;
  for (const kw of Object.keys(PEOPLE_PHOTOS)) {
    if (title.includes(kw) && (!bestKw || kw.length > bestKw.length)) {
      bestKw = kw;
    }
  }
  if (bestKw) return { url: PEOPLE_PHOTOS[bestKw], reason: `persona: ${bestKw}` };

  // 2. Fallback: categoría/keyword
  for (const [kw, url] of Object.entries(CATEGORY_IMAGES)) {
    if (text.includes(kw)) return { url, reason: `categoría: ${kw}` };
  }
  if (news.country_code === "VE" || text.includes("venezuela")) return { url: CATEGORY_IMAGES.venezuela, reason: "país: VE" };
  if (news.country_code === "CO" || text.includes("colombia")) return { url: CATEGORY_IMAGES.colombia, reason: "país: CO" };
  return { url: GENERIC_FALLBACK, reason: "genérico" };
}

// Detecta URLs claramente inválidas para una foto: .mp4, vacías, etc.
function isInvalidImageUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  const u = url.toLowerCase();
  if (u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov") || u.endsWith(".m4v")) return true;
  if (u.includes("googleusercontent")) return true;
  return false;
}

// ══════════════════════════════════════════════════════════
// HANDLER
// ══════════════════════════════════════════════════════════

serve(async (req: Request) => {
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
  const dryRun = url.searchParams.get("dry_run") === "1";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Selecciona noticias con imagen ausente, vacía o inválida (.mp4, etc.)
  // O recientes (mejorar las nuevas con foto de persona si aplica)
  const reprocess = url.searchParams.get("reprocess") === "1";
  let query = supabase
    .from("news")
    .select("id, title, category, country_code, image")
    .in("country_code", ["VE", "CO", "TECH"])
    .order("published_at", { ascending: false })
    .limit(limit);

  if (!reprocess) {
    query = query.or("image.is.null,image.eq.,image.ilike.*.mp4,image.ilike.*.webm,image.ilike.*.mov");
  }

  const { data: rows, error: selectErr } = await query;

  if (selectErr) {
    return new Response(JSON.stringify({ ok: false, error: selectErr.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0, message: "No hay noticias para enriquecer" }), { headers: { "Content-Type": "application/json" } });
  }

  let updated = 0;
  const results: Array<{ id: number; image: string; reason: string }> = [];

  for (const news of rows) {
    // Si NO es reprocess y ya tiene una imagen válida, skip
    if (!reprocess && !isInvalidImageUrl(news.image)) continue;

    const pick = pickImage(news);
    results.push({ id: news.id, image: pick.url, reason: pick.reason });

    if (!dryRun) {
      const { error: updErr } = await supabase
        .from("news")
        .update({ image: pick.url })
        .eq("id", news.id);
      if (!updErr) updated++;
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    dryRun,
    processed: rows.length,
    updated,
    results: results.slice(0, 10),
  }, null, 2), { headers: { "Content-Type": "application/json" } });
});
