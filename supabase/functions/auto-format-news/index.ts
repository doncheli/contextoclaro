// supabase/functions/auto-format-news/index.ts
// Aplica formato editorial estilo Plus Ultra a noticias:
//   1. Detecta protagonistas mencionados en título/descripción
//   2. Inserta fotos de Wikipedia como párrafos media intercalados
//   3. Marca la noticia como formateada (existencia de media_url en sus paragraphs)
//
// Query params:
//   ?limit=20        — cuántas procesar (default 20, max 100)
//   ?dry_run=1       — no hace inserts, solo simula
//   ?news_id=N       — forzar una sola noticia

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

const PEOPLE_LABELS: Record<string, string> = {
  "abalos": "Jos\u00e9 Luis \u00c1balos",
  "alex saab": "Alex Saab",
  "alvaro uribe": "\u00c1lvaro Uribe",
  "amlo": "Andr\u00e9s Manuel L\u00f3pez Obrador",
  "bachelet": "Michelle Bachelet",
  "bezos": "Jeff Bezos",
  "boluarte": "Dina Boluarte",
  "boric": "Gabriel Boric",
  "bukele": "Nayib Bukele",
  "cilia flores": "Cilia Flores",
  "delcy rodriguez": "Delcy Rodr\u00edguez",
  "delcy rodr\u00edguez": "Delcy Rodr\u00edguez",
  "diosdado cabello": "Diosdado Cabello",
  "donald trump": "Donald Trump",
  "el aissami": "Tareck El Aissami",
  "elon musk": "Elon Musk",
  "evo morales": "Evo Morales",
  "federico guti\u00e9rrez": "Federico Guti\u00e9rrez",
  "feijoo": "Alberto N\u00fa\u00f1ez Feij\u00f3o",
  "feij\u00f3o": "Alberto N\u00fa\u00f1ez Feij\u00f3o",
  "fico guti\u00e9rrez": "Federico Guti\u00e9rrez",
  "francia marquez": "Francia M\u00e1rquez",
  "francia m\u00e1rquez": "Francia M\u00e1rquez",
  "francisco": "Papa Francisco",
  "freddy bernal": "Freddy Bernal",
  "gustavo petro": "Gustavo Petro",
  "guterres": "Ant\u00f3nio Guterres",
  "henrique capriles": "Henrique Capriles",
  "ivan duque": "Iv\u00e1n Duque",
  "iv\u00e1n duque": "Iv\u00e1n Duque",
  "javier milei": "Javier Milei",
  "joe biden": "Joe Biden",
  "juan guaid\u00f3": "Juan Guaid\u00f3",
  "juan manuel santos": "Juan Manuel Santos",
  "kamala harris": "Kamala Harris",
  "leon xiv": "Papa Le\u00f3n XIV",
  "leopoldo l\u00f3pez": "Leopoldo L\u00f3pez",
  "lula": "Lula da Silva",
  "lula da silva": "Luiz In\u00e1cio Lula da Silva",
  "macron": "Emmanuel Macron",
  "maduro": "Nicol\u00e1s Maduro",
  "marco rubio": "Marco Rubio",
  "maria corina": "Mar\u00eda Corina Machado",
  "mariano rajoy": "Mariano Rajoy",
  "mar\u00eda corina machado": "Mar\u00eda Corina Machado",
  "meloni": "Giorgia Meloni",
  "michelle bachelet": "Michelle Bachelet",
  "michelo": "Michelo (Diego Omar Su\u00e1rez)",
  "milei": "Javier Milei",
  "musk": "Elon Musk",
  "noboa": "Daniel Noboa",
  "n\u00fa\u00f1ez feij\u00f3o": "Alberto N\u00fa\u00f1ez Feij\u00f3o",
  "ortega": "Daniel Ortega",
  "padrino l\u00f3pez": "Vladimir Padrino L\u00f3pez",
  "papa francisco": "Papa Francisco",
  "papa le\u00f3n": "Papa Le\u00f3n XIV",
  "pedro sanchez": "Pedro S\u00e1nchez",
  "pedro s\u00e1nchez": "Pedro S\u00e1nchez",
  "petro": "Gustavo Petro",
  "putin": "Vladimir Putin",
  "santiago abascal": "Santiago Abascal",
  "sergio fajardo": "Sergio Fajardo",
  "sheinbaum": "Claudia Sheinbaum",
  "tareck el aissami": "Tareck El Aissami",
  "trump": "Donald Trump",
  "vicky davila": "Vicky D\u00e1vila",
  "vicky d\u00e1vila": "Vicky D\u00e1vila",
  "vladimir padrino": "Vladimir Padrino L\u00f3pez",
  "von der leyen": "Ursula von der Leyen",
  "xi jinping": "Xi Jinping",
  "yolanda d\u00edaz": "Yolanda D\u00edaz",
  "zapatero": "Jos\u00e9 Luis Rodr\u00edguez Zapatero",
  "zelensky": "Volodymyr Zelenskyy",
  "zuckerberg": "Mark Zuckerberg",
  "\u00e1balos": "Jos\u00e9 Luis \u00c1balos",
  "\u00e1lvaro uribe": "\u00c1lvaro Uribe",
};


// Devuelve hasta 3 personas únicas mencionadas en el texto, ordenadas por
// posición de aparición (más temprano = más prominente).
function findPeople(text: string): Array<{ keyword: string; position: number }> {
  const lower = text.toLowerCase();
  const matches: Array<{ keyword: string; position: number }> = [];
  const seenUrls = new Set<string>();

  // Buscar todas las apariciones
  const candidates: Array<{ keyword: string; position: number; length: number }> = [];
  for (const kw of Object.keys(PEOPLE_PHOTOS)) {
    const idx = lower.indexOf(kw);
    if (idx >= 0) candidates.push({ keyword: kw, position: idx, length: kw.length });
  }

  // Sort by position ASC, then length DESC (longer match wins at same pos)
  candidates.sort((a, b) => a.position - b.position || b.length - a.length);

  for (const c of candidates) {
    const url = PEOPLE_PHOTOS[c.keyword];
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    matches.push({ keyword: c.keyword, position: c.position });
    if (matches.length >= 3) break;
  }

  return matches;
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
  const dryRun = url.searchParams.get("dry_run") === "1";
  const forcedNewsId = url.searchParams.get("news_id");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Selecciona noticias VE/CO sin ningún paragraph con media (no formateadas aún)
  let queryStr = supabase
    .from("news")
    .select("id, title, description, country_code, published_at")
    .in("country_code", ["VE", "CO"])
    .order("published_at", { ascending: false });

  if (forcedNewsId) {
    queryStr = queryStr.eq("id", forcedNewsId).limit(1);
  } else {
    queryStr = queryStr.limit(limit * 4); // sobre-fetch para filtrar las que ya tienen media
  }

  const { data: candidates, error: selectErr } = await queryStr;
  if (selectErr) {
    return new Response(JSON.stringify({ ok: false, error: selectErr.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  if (!candidates || candidates.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  // Filtra las que ya tienen al menos un paragraph con media
  const ids = candidates.map((n: any) => n.id);
  const { data: alreadyFormatted } = await supabase
    .from("article_paragraphs")
    .select("news_id")
    .in("news_id", ids)
    .not("media_url", "is", null);

  const formattedSet = new Set((alreadyFormatted || []).map((r: any) => r.news_id));
  const toProcess = candidates.filter((n: any) => !formattedSet.has(n.id)).slice(0, limit);

  const results: Array<{ id: number; people: string[]; inserted: number }> = [];
  let totalInserted = 0;

  for (const news of toProcess) {
    const text = `${news.title || ""} ${news.description || ""}`;
    const people = findPeople(text);

    if (people.length === 0) {
      results.push({ id: news.id, people: [], inserted: 0 });
      continue;
    }

    // Obtener el máximo sort_order actual de este artículo
    const { data: maxRow } = await supabase
      .from("article_paragraphs")
      .select("sort_order")
      .eq("news_id", news.id)
      .order("sort_order", { ascending: false })
      .limit(1);

    let nextSort = (maxRow?.[0]?.sort_order ?? -1) + 1;

    const inserts = people.map((p) => ({
      news_id: news.id,
      sort_order: nextSort++,
      content: null,
      media_type: "image",
      media_url: PEOPLE_PHOTOS[p.keyword],
      media_caption: `${PEOPLE_LABELS[p.keyword] || p.keyword}, mencionado en la noticia. Fuente: Wikimedia Commons.`,
      media_alt: `Foto de ${PEOPLE_LABELS[p.keyword] || p.keyword}`,
    }));

    if (!dryRun) {
      const { error: insErr } = await supabase
        .from("article_paragraphs")
        .insert(inserts);
      if (!insErr) totalInserted += inserts.length;
    }

    results.push({ id: news.id, people: people.map(p => PEOPLE_LABELS[p.keyword] || p.keyword), inserted: inserts.length });
  }

  return new Response(JSON.stringify({
    ok: true,
    dryRun,
    processed: toProcess.length,
    skipped: candidates.length - toProcess.length,
    totalInserted,
    results: results.slice(0, 15),
  }, null, 2), { headers: { "Content-Type": "application/json" } });
});
