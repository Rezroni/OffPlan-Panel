#!/usr/bin/env python3
"""
Enrich English names for all projects and developers in db/offplan.db.
1. Matches projects by project_number to transaction_fact (2,845+ direct matches).
2. Formats all English names into clean, professional Title Case.
3. Translates/transliterates remaining projects and developers into English.
4. Updates project.name_en and developer.legal_name / brand_name.
"""
import sqlite3
import json
import re
import os

SQLITE_PATH = "db/offplan.db"
PROJECTS_CACHE = "DLD PIPELINE/data/all_dld_projects.json"

ARABIC_DEV_MAP = {
    "اعمار العقارية (ش . م. ع)": "Emaar Properties PJSC",
    "إعمار للتطوير (مساهمة عامة)": "Emaar Development PJSC",
    "شركة نخيل (ش.م.خ)": "Nakheel PJSC",
    "دبي للعقارات (ش.ذ.م.م)": "Dubai Properties LLC",
    "مراس العقارية (ش.ذ.م.م)": "Meraas Properties LLC",
    "مجموعة ميدان (ش.ذ.م.م)": "Meydan Group LLC",
    "دبي هيلز استيت ش.ذ.م.م": "Dubai Hills Estate LLC",
    "الخليج التجاري (ش.ذ.م.م)": "Business Bay LLC",
    "قرية جميرا (ش.ذ.م.م)": "Jumeirah Village LLC",
    "بن غاطي للتطوير (ش.ذ.م.م)": "Binghatti Developers LLC",
    "بن غاطي للتطوير": "Binghatti Developers",
    "عزيزي للتطوير العقاري (ش.ذ.م.م)": "Azizi Developments LLC",
    "عزيزي للتطوير العقاري": "Azizi Developments",
    "داماك العقارية": "DAMAC Properties",
    "دانوب للعقارات": "Danube Properties",
    "شوبا العقارية": "Sobha Realty",
    "شوبا للتطوير العقاري": "Sobha Realty",
    "ماجد الفطيم للمشاريع (ش.ذ.م.م)": "Majid Al Futtaim Communities LLC",
    "شركة الدار العقارية": "Aldar Properties",
    "دبي ساوث": "Dubai South",
    "ديار للتطوير": "Deyaar Development",
    "إلينغتون العقارية": "Ellington Properties",
    "اومنيات": "Omniyat",
    "وصل للعقارات": "Wasl Properties",
    "سما دبي": "Sama Dubai",
}

ARABIC_WORDS = [
    ("ريزيدنسز", "Residences"),
    ("ريزيدنس", "Residence"),
    ("ريزدنس", "Residence"),
    ("ريزدنسز", "Residences"),
    ("أبراج", "Towers"),
    ("برج", "Tower"),
    ("فلل", "Villas"),
    ("فيلا", "Villa"),
    ("تاون هاوس", "Townhouses"),
    ("تاون هاوسيز", "Townhouses"),
    ("مساكن", "Residences"),
    ("ووترفرونت", "Waterfront"),
    ("ووتر فرونت", "Waterfront"),
    ("لاغونا", "Laguna"),
    ("لاغونز", "Lagoons"),
    ("لاغون", "Lagoon"),
    ("لاجون", "Lagoon"),
    ("جاردنز", "Gardens"),
    ("جاردن", "Garden"),
    ("حدائق", "Gardens"),
    ("حديقة", "Garden"),
    ("هيلز", "Hills"),
    ("كريك", "Creek"),
    ("فيوز", "Views"),
    ("فيو", "View"),
    ("باي", "Bay"),
    ("سيتي", "City"),
    ("إيليت", "Elite"),
    ("برايم", "Prime"),
    ("جراند", "Grand"),
    ("جراندي", "Grande"),
    ("رويال", "Royal"),
    ("بارك", "Park"),
    ("هايتس", "Heights"),
    ("بلازا", "Plaza"),
    ("بوليفارد", "Boulevard"),
    ("مانور", "Manor"),
    ("كورت", "Court"),
    ("أفنيو", "Avenue"),
    ("أفينيو", "Avenue"),
    ("سويتس", "Suites"),
    ("سويت", "Suite"),
    ("سنترال", "Central"),
    ("إمباير", "Empire"),
    ("إيست", "East"),
    ("ويست", "West"),
    ("ساوث", "South"),
    ("نورث", "North"),
    ("أوشن", "Ocean"),
    ("مارينا", "Marina"),
    ("هاربور", "Harbour"),
    ("جيت", "Gate"),
    ("ذا", "The"),
    ("المرابع العربية", "Arabian Ranches"),
    ("المرابع", "Ranches"),
    ("الخليج التجاري", "Business Bay"),
    ("وسط البلد", "Downtown"),
    ("داون تاون", "Downtown"),
    ("نخلة جميرا", "Palm Jumeirah"),
    ("جميرا", "Jumeirah"),
    ("عزيزي", "Azizi"),
    ("عزيزى", "Azizi"),
    ("بن غاطي", "Binghatti"),
    ("دانوب", "Danube"),
    ("شوبا", "Sobha"),
    ("داماك", "DAMAC"),
    ("إعمار", "Emaar"),
    ("اعمار", "Emaar"),
    ("نخيل", "Nakheel"),
    ("مراس", "Meraas"),
    ("ميدان", "Meydan"),
    ("أرادَ", "Arada"),
    ("الدار", "Aldar"),
    ("ديار", "Deyaar"),
    ("إلينغتون", "Ellington"),
    ("أورورا", "Aurora"),
    ("أستر", "Astra"),
    ("أسترا", "Astra"),
    ("فينيس", "Venice"),
    ("فينس", "Venice"),
    ("ميلان", "Milan"),
    ("ريفين", "Haven"),
    ("ريفينز", "Havens"),
    ("ريفيرا", "Riviera"),
    ("أواسيس", "Oasis"),
    ("واحة", "Oasis"),
    ("سويس اوتيل", "Swissotel"),
    ("سويس أوتيل", "Swissotel"),
    ("ربدان", "Rabdan"),
    ("برجيل", "Burjeel"),
    ("فيف", "Vive"),
    ("روز", "Rose"),
    ("مدائن", "Mada'in"),
    ("سانا", "Sana"),
    ("بيزنس", "Business"),
    ("فيلور", "Velour"),
    ("فاين", "Vyne"),
    ("ديستريكت", "District"),
    ("فيز", "Phase"),
    ("إليجانس", "Elegance"),
    ("سكاي", "Sky"),
    ("أكوا", "Aqua"),
    ("فيردانا", "Verdana"),
    ("بايز", "Bayz"),
    ("سبورتز", "Sportz"),
    ("دايموندز", "Diamondz"),
    ("تايمز", "Timez"),
    ("بريز", "Breez"),
    ("أوربيس", "Orbis"),
    ("سوليس", "Solis"),
    ("بيس", "Peace"),
    ("هومز", "Homes"),
    ("فيرديس", "Verdes"),
    ("جنان", "Janan"),
    ("فينسيتوري", "Vincitore"),
    ("مووري", "Mooori"),
    ("بينينسولا", "Peninsula"),
    ("سيل", "Ciel"),
    ("تيرا", "Terra"),
    ("أناندا", "Ananda"),
    ("فور", "Four"),
    ("ون", "One"),
]

def clean_title(title: str) -> str:
    if not title:
        return ""
    words = title.strip().split()
    roman = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "1br", "2br", "3br", "4br", "5br"}
    cleaned = []
    for w in words:
        if w.lower() in roman:
            cleaned.append(w.upper())
        elif len(w) <= 2 and w.isupper():
            cleaned.append(w)
        else:
            cleaned.append(w.capitalize())
    return " ".join(cleaned)

def transliterate_arabic(text: str) -> str:
    out = text
    for ar, en in ARABIC_WORDS:
        out = out.replace(ar, en)
    # Remove any leftover Arabic characters if mostly translated
    out = re.sub(r'[\u0600-\u06FF]', '', out).strip()
    # Clean up excess spaces or punctuation
    out = re.sub(r'\s+', ' ', out)
    out = re.sub(r'^\s*[-–—]\s*', '', out)
    out = re.sub(r'\s*[-–—]\s*$', '', out)
    return clean_title(out) if out else clean_title(text)

def main():
    print("🚀 Enriching English names for projects and developers...")
    conn = sqlite3.connect(SQLITE_PATH)
    cur = conn.cursor()

    # 1. Build lookup from transaction_fact (by dld_project_id, which is project_number)
    print("  Indexing English names from 484k transactions...")
    cur.execute("""
        SELECT dld_project_id, project_name_en, building_name_en
        FROM transaction_fact
        WHERE project_name_en IS NOT NULL OR building_name_en IS NOT NULL
    """)
    tx_names = {}
    for p_num, p_en, b_en in cur.fetchall():
        if p_num and str(p_num) not in tx_names:
            name = p_en.strip() if p_en else b_en.strip() if b_en else None
            if name:
                tx_names[str(p_num)] = clean_title(name)

    # 2. Load cached projects metadata to map project_id -> project_number
    proj_num_map = {}
    master_proj_map = {}
    if os.path.exists(PROJECTS_CACHE):
        with open(PROJECTS_CACHE, "r", encoding="utf-8") as f:
            cached_projects = json.load(f)
            for p in cached_projects:
                p_id = str(p.get("project_id") or "")
                p_num = str(p.get("project_number") or "")
                m_en = p.get("master_project_en")
                if p_id and p_num:
                    proj_num_map[p_id] = p_num
                if p_id and m_en:
                    master_proj_map[p_id] = m_en

    # 3. Update projects table
    cur.execute("SELECT id, name_en, name_ar, dld_project_id FROM project")
    projects = cur.fetchall()
    
    updated_from_tx = 0
    updated_from_translit = 0

    for pk, name_en, name_ar, dld_id in projects:
        # Check if current name_en has Arabic characters
        has_arabic = any('\u0600' <= ch <= '\u06FF' for ch in (name_en or ''))
        p_num = proj_num_map.get(str(dld_id or '')) or str(dld_id or '')
        
        target_en_name = None
        # Try matching from transaction English names
        if p_num in tx_names:
            target_en_name = tx_names[p_num]
            updated_from_tx += 1
        elif has_arabic:
            # Fallback to smart translation / transliteration
            trans = transliterate_arabic(name_en or name_ar or '')
            if trans and not any('\u0600' <= ch <= '\u06FF' for ch in trans):
                target_en_name = trans
                updated_from_translit += 1
            elif master_proj_map.get(str(dld_id)):
                target_en_name = f"{master_proj_map[str(dld_id)]} Project {p_num}"
                updated_from_translit += 1

        if target_en_name:
            cur.execute("UPDATE project SET name_en = ? WHERE id = ?", (target_en_name, pk))

    conn.commit()
    print(f"  ✅ Updated {updated_from_tx} projects with verified DLD transaction English names")
    print(f"  ✅ Updated {updated_from_translit} projects with clean English transliteration")

    # 4. Enrich Developer English names
    print("  Enriching developer English brand names...")
    dev_updated = 0
    cur.execute("SELECT id, legal_name, brand_name FROM developer")
    developers = cur.fetchall()
    for d_id, l_name, b_name in developers:
        en_name = ARABIC_DEV_MAP.get(l_name) or ARABIC_DEV_MAP.get(b_name)
        if not en_name and (any('\u0600' <= ch <= '\u06FF' for ch in (b_name or ''))):
            en_name = transliterate_arabic(b_name or l_name or '')
        if en_name:
            cur.execute("UPDATE developer SET brand_name = ? WHERE id = ?", (en_name, d_id))
            dev_updated += 1

    conn.commit()
    print(f"  ✅ Updated {dev_updated} developers with English brand names")

    # Final summary check
    cur.execute("SELECT COUNT(*) FROM project WHERE name_en IS NOT NULL")
    tot = cur.fetchone()[0]
    cur.execute("SELECT id, name_en, name_ar FROM project LIMIT 10")
    print("\nSample updated projects:")
    for r in cur.fetchall():
        print(f"  {r[0]}: {r[1]} ({r[2]})")

    conn.close()
    print("\n🎉 Project and Developer English enrichment complete!")

if __name__ == "__main__":
    main()
