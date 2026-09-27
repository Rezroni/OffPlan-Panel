#!/usr/bin/env python3
"""
Dubai Off-plan Research Desk — Developer Name Enrichment Pipeline
Uses official Dubai real estate dictionary + Google Gemini API to:
1. Fix dots ("...", "(...)"), punctuation, and missing brand names.
2. Provide official, prestigious English brand names (e.g. DAMAC Properties, Emaar, Nakheel, Nshama, TECOM Group).
3. Provide clean English legal entity names (translating SPVs, LLC, PJSC, FZ-LLC).
4. Remove orphaned duplicate developer records (e.g. .0 float IDs with 0 projects).
5. Enrich master_developer_name in the project catalog.
"""
import sqlite3
import json
import re
import os
import requests

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ROOT_DIR, "db", "offplan.db")
ENV_LOCAL_PATH = os.path.join(ROOT_DIR, ".env.local")

def get_gemini_api_key():
    if os.path.exists(ENV_LOCAL_PATH):
        with open(ENV_LOCAL_PATH, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY=") or line.startswith("GOOGLE_AI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip("\"'")
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY")

def norm_ar(s: str) -> str:
    """Normalize Arabic string for robust matching."""
    if not s:
        return ""
    s = s.replace("ة", "ه").replace("ى", "ي").replace("إ", "ا").replace("أ", "ا").replace("آ", "ا")
    s = "".join(c for c in s if c.isalnum() or c.isspace())
    return " ".join(s.split())

# Core Master Developer & Entity Dictionary for Dubai Market
BASE_DICTIONARY = {
    # Major Master Developers & Operating Brands
    "اعمار العقارية (ش . م. ع)": {"brand": "Emaar Properties", "legal": "Emaar Properties PJSC"},
    "إعمار للتطوير (مساهمة عامة)": {"brand": "Emaar Development", "legal": "Emaar Development PJSC"},
    "شركة نخيل (ش.م.خ)": {"brand": "Nakheel", "legal": "Nakheel PJSC"},
    "دبي للعقارات (ش.ذ.م.م)": {"brand": "Dubai Properties", "legal": "Dubai Properties LLC"},
    "مراس العقارية (ش.ذ.م.م)": {"brand": "Meraas", "legal": "Meraas Properties LLC"},
    "مجموعة ميدان (ش.ذ.م.م)": {"brand": "Meydan Group", "legal": "Meydan Group LLC"},
    "مؤسسة مدينة ميدان": {"brand": "Meydan", "legal": "Meydan City Corporation"},
    "دبي هيلز استيت ش.ذ.م.م": {"brand": "Dubai Hills Estate (Emaar & Meraas)", "legal": "Dubai Hills Estate LLC"},
    "الخليج التجاري (ش.ذ.م.م)": {"brand": "Business Bay (Dubai Properties)", "legal": "Business Bay LLC"},
    "قرية جميرا (ش.ذ.م.م)": {"brand": "Jumeirah Village (Nakheel)", "legal": "Jumeirah Village LLC"},
    "بن غاطي للتطوير (ش.ذ.م.م)": {"brand": "Binghatti Developers", "legal": "Binghatti Developers LLC"},
    "بن غاطي للتطوير": {"brand": "Binghatti Developers", "legal": "Binghatti Developers"},
    "عزيزي للتطوير العقاري (ش.ذ.م.م)": {"brand": "Azizi Developments", "legal": "Azizi Developments LLC"},
    "عزيزي للتطوير العقاري": {"brand": "Azizi Developments", "legal": "Azizi Developments"},
    "عزيزي ديفليوبمنتس ش.ذ.م.م": {"brand": "Azizi Developments", "legal": "Azizi Developments LLC"},
    "داماك العقارية": {"brand": "DAMAC Properties", "legal": "DAMAC Properties LLC"},
    "شركة داماك العقارية (ش.ذ.م.م)": {"brand": "DAMAC Properties", "legal": "DAMAC Properties LLC"},
    "داماك كريسنت للعقارات (ش.ذ.م.م)": {"brand": "DAMAC Properties", "legal": "DAMAC Crescent Properties LLC"},
    "داماك ميري للاستثمار ش.ذ.م.م": {"brand": "DAMAC Properties", "legal": "DAMAC Mery Investment LLC"},
    "شركة داماك ايليت للاستثمار ذ.م.م": {"brand": "DAMAC Properties", "legal": "DAMAC Elite Investment LLC"},
    "داماك سي اس ال للاستثمار ش.ذ.م.م": {"brand": "DAMAC Properties", "legal": "DAMAC CSL Investment LLC"},
    "داماك ورلد ريل استيت ش.ذ.م.م": {"brand": "DAMAC Properties", "legal": "DAMAC World Real Estate LLC"},
    "شركة الخط الامامي لادارة الاستثمار ش.ذ.م.م": {"brand": "Front Line Investment Management (DAMAC Properties)", "legal": "Front Line Investment Management LLC"},
    "دانوب للعقارات": {"brand": "Danube Properties", "legal": "Danube Properties"},
    "شوبا العقارية": {"brand": "Sobha Realty", "legal": "Sobha Realty"},
    "شوبا للتطوير العقاري": {"brand": "Sobha Realty", "legal": "Sobha Realty"},
    "شوبا ش.ذ.م.م": {"brand": "Sobha Realty", "legal": "Sobha LLC"},
    "ماجد الفطيم للمشاريع (ش.ذ.م.م)": {"brand": "Majid Al Futtaim Communities", "legal": "Majid Al Futtaim Communities LLC"},
    "ماجد الفطيم لتشغيل مشاريع المدن المتكاملة الاماراتية ش.ذ.م.م": {"brand": "Majid Al Futtaim Communities", "legal": "Majid Al Futtaim Communities LLC"},
    "شركة الدار العقارية": {"brand": "Aldar Properties", "legal": "Aldar Properties PJSC"},
    "دبي ساوث": {"brand": "Dubai South", "legal": "Dubai South Properties DWC-LLC"},
    "دبي الجنوب للعقارات دي دبليو سي ش.ذ.م.م": {"brand": "Dubai South", "legal": "Dubai South Properties DWC-LLC"},
    "مؤسسه مدينه دبى للطيران": {"brand": "Dubai South (DACC)", "legal": "Dubai Aviation City Corporation"},
    "إكسبو سيتي للتطوير العقاري ش م ح": {"brand": "Expo City Dubai", "legal": "Expo City Dubai Development FZ-LLC"},
    "ديار للتطوير": {"brand": "Deyaar Development", "legal": "Deyaar Development PJSC"},
    "إلينغتون العقارية": {"brand": "Ellington Properties", "legal": "Ellington Properties Development LLC"},
    "إلينجتون كارما للتطوير ذ.م.م": {"brand": "Ellington Properties", "legal": "Ellington Karma Development LLC"},
    "كرستال ثري ش.ذ.م.م-منطقة حرة": {"brand": "Crystal Three (Ellington / Meydan)", "legal": "Crystal Three FZ-LLC"},
    "اومنيات": {"brand": "Omniyat", "legal": "Omniyat Properties LLC"},
    "وصل للعقارات": {"brand": "Wasl Properties", "legal": "Wasl Properties LLC"},
    "سما دبي": {"brand": "Sama Dubai", "legal": "Sama Dubai LLC"},
    
    # Nakheel & Subsidiaries
    "الفرجان ( ش.ذ.م.م )": {"brand": "Al Furjan (Nakheel)", "legal": "Al Furjan LLC"},
    "النخلة  - ديره (ش.ذ.م.م)": {"brand": "Dubai Islands / Palm Deira (Nakheel)", "legal": "Palm Deira LLC"},
    "عقارات جميرا جولف ش.ذ.م.م": {"brand": "Jumeirah Golf Estates", "legal": "Jumeirah Golf Estates LLC"},
    "جيه جي اي للعقارات ش.ذ.م.م": {"brand": "Jumeirah Golf Estates", "legal": "Jumeirah Golf Estates LLC"},
    "جميرا بارك (ش.ذ.م.م)": {"brand": "Jumeirah Park (Nakheel)", "legal": "Jumeirah Park LLC"},
    "شركة جزر جميرا (ش.ذ.م.م)": {"brand": "Jumeirah Islands (Nakheel)", "legal": "Jumeirah Islands LLC"},
    "انترناشونال سيتي ( ش.ذ.م.م )": {"brand": "International City (Nakheel)", "legal": "International City LLC"},
    "العالم ( ش. ذ. م. م )": {"brand": "The World Islands (Nakheel)", "legal": "The World LLC"},
    
    # Dubai Holding / Meraas / Dubai Properties
    "ليوان(ش.ذ.م.م.)": {"brand": "Liwan (Dubai Holding)", "legal": "Liwan LLC"},
    "رمرام ش.ذ.م.م": {"brand": "Remraam (Dubai Holding)", "legal": "Remraam LLC"},
    "دبي لاند (ش.ذ.م.م)": {"brand": "Dubailand (Dubai Holding)", "legal": "Dubailand LLC"},
    "دبي لاند ريزيدنسز (ش.ذ.م.م)": {"brand": "Dubailand Residences (Dubai Holding)", "legal": "Dubai Land Residences LLC"},
    "شمال العقارية ش.ذ.م.م": {"brand": "Shamal Properties (Shamal Holding)", "legal": "Shamal Properties LLC"},
    "دبي هاربور كوميونيتي ذ.م.م": {"brand": "Dubai Harbour Community (Shamal Holding)", "legal": "Dubai Harbour Community LLC"},
    "قريه الثقافه ( ش.ذ.م.م)": {"brand": "Culture Village (Dubai Properties)", "legal": "Culture Village LLC"},
    "مرسى العرب ش.ذ.م.م": {"brand": "Marsa Al Arab (Dubai Holding)", "legal": "Marsa Al Arab LLC"},
    "مرسى العرب ريزدنسز ش.ذ.م.م": {"brand": "Marsa Al Arab Residences (Dubai Holding)", "legal": "Marsa Al Arab Residences LLC"},
    "جميرا هيلز ديفيلوبمنت ش.ذ.م.م": {"brand": "Madinat Jumeirah Living (Meraas)", "legal": "Jumeirah Hills Development LLC"},
    "جميرا باي ش.ذ.م.م": {"brand": "Jumeirah Bay (Meraas)", "legal": "Jumeirah Bay LLC"},
    "جميرا باي ريزيدينشال ذ.م.م": {"brand": "Jumeirah Bay (Meraas)", "legal": "Jumeirah Bay Residential LLC"},
    "مراس باي أند ريزيدنس ش.ذ.م.م": {"brand": "Bulgari Residences (Meraas)", "legal": "Meraas Bay & Residences LLC"},
    "سيتي ووك ريزيدينشال 1 ش.ذ.م.م": {"brand": "City Walk (Meraas)", "legal": "City Walk Residential 1 LLC"},
    "زعبيل سكوير ش.ذ.م.م": {"brand": "Zabeel Square (Emaar & Meraas)", "legal": "Zabeel Square LLC"},

    # Emaar SPVs
    "إعمار دبي الجنوب دي دبليو سي ش.ذ.م.م": {"brand": "Emaar South", "legal": "Emaar Dubai South DWC-LLC"},
    "دبي كريك هاربور ش.ذ.م.م": {"brand": "Dubai Creek Harbour (Emaar Properties)", "legal": "Dubai Creek Harbour LLC"},
    "ذي لاجونز المرحلة الاولى ش.ذ.م.م": {"brand": "The Lagoons (Emaar Properties)", "legal": "The Lagoons Phase 1 LLC"},
    "ميناء راشد العقارية ش.ذ.م.م": {"brand": "Mina Rashid (Emaar & P&O)", "legal": "Mina Rashid Properties LLC"},
    "مرسى دبي المرحلة الاولى (ش.ذ.م.م)": {"brand": "Dubai Marina Phase 1 (Emaar Properties)", "legal": "Dubai Marina Phase 1 LLC"},
    "مشاريع وسط دبي ش.ذ.م.م": {"brand": "Downtown Dubai Projects (Emaar Properties)", "legal": "Downtown Dubai Projects LLC"},
    "اعمار بوادي (ذ م م)": {"brand": "Emaar Bawadi", "legal": "Emaar Bawadi LLC"},
    "الاريام المرحلة الاولى ش.ذ.م.م": {"brand": "Reem Community (Emaar Properties)", "legal": "Al Areeam Phase 1 LLC"},
    "الاريام المرحلة الثانية ش.ذ.م.م": {"brand": "Mira Oasis (Emaar Properties)", "legal": "Al Areeam Phase 2 LLC"},
    "اولد تاون فيوز ش.ذ.م.م": {"brand": "Old Town Views (Emaar Properties)", "legal": "Old Town Views LLC"},
    "دي دابليو تي سي إعمار ذ.م.م": {"brand": "DWTC Emaar", "legal": "DWTC Emaar LLC"},
    "روف للضيافة ش.ذ.م.م": {"brand": "Rove Hospitality (Emaar & Meraas)", "legal": "Rove Hospitality LLC"},

    # TECOM, Authorities & Free Zones
    "تيكوم للإستثمارات منطقة حرة- ذ.م.م": {"brand": "TECOM Group", "legal": "TECOM Investments FZ-LLC"},
    "مدينه دبى الصناعيه ش ذ م م": {"brand": "Dubai Industrial City (TECOM Group)", "legal": "Dubai Industrial City LLC"},
    "سلطة دبي للمناطق الإقتصادية المتكاملة": {"brand": "Dubai Integrated Economic Zones Authority (DIEZ)", "legal": "Dubai Integrated Economic Zones Authority"},
    "مركز دبي للسلع المتعددة": {"brand": "Dubai Multi Commodities Centre (DMCC)", "legal": "Dubai Multi Commodities Centre"},
    "مجمع اعمال مركز دبى للسلع المتعدده م.د.م.س": {"brand": "DMCC Business Park", "legal": "DMCC Business Park"},
    "مدينة دبي الملاحية م م ح": {"brand": "Dubai Maritime City (DMCA)", "legal": "Dubai Maritime City FZ-LLC"},
    "مدينه دبى الطبيه منطقه حرة - ذ.م.م.": {"brand": "Dubai Healthcare City (DHCC)", "legal": "Dubai Healthcare City FZ-LLC"},
    "دى اتش ايه ام منطقه حره - ذ.م.م": {"brand": "Dubai Holding Asset Management (DHAM)", "legal": "DHAM FZ-LLC"},
    "دى اتش ايه ام منطقه حرة - ذ.م.م": {"brand": "Dubai Holding Asset Management (DHAM)", "legal": "DHAM FZ-LLC"},
    "مركز دبي التجاري العالمي ش.ذ.م.م": {"brand": "Dubai World Trade Centre (DWTC)", "legal": "Dubai World Trade Centre LLC"},
    "شركة تطوير مجمع دبي للاستثمار (ذ. م. م)": {"brand": "Dubai Investments Park (DIP)", "legal": "Dubai Investments Park Development Company LLC"},
    "دبي للاستثمار العقاري (ش ذ م م)": {"brand": "Dubai Investments Real Estate", "legal": "Dubai Investments Real Estate LLC"},

    # Private Developers & Branded Master Entities
    "نشاما للعقارات لمالكها نشمي ديفلوبمنت شركة الشخص الواحد ش.ذ.م.م": {"brand": "Nshama", "legal": "Nshama Properties LLC"},
    "نشمي ديفلوبمنت ش.ذ.م.م": {"brand": "Nshama Development", "legal": "Nashmi Development LLC"},
    "نشاما للتطوير ش.ذ.م.م": {"brand": "Nshama Development", "legal": "Nshama Development LLC"},
    "مدينة دبي الرياضية (ش. ذ. م. م)": {"brand": "Dubai Sports City", "legal": "Dubai Sports City LLC"},
    "مدينة دبي للغولف  (ش.ذ.م.م)": {"brand": "Dubai Golf City", "legal": "Dubai Golf City LLC"},
    "الاتحاد العقارية (شركة مساهمة عامة)": {"brand": "Union Properties", "legal": "Union Properties PJSC"},
    "شركة أبواب العقارية المحدودة (ش.ذ.م.م)": {"brand": "Al Barari (Abwab Real Estate)", "legal": "Abwab Real Estate Limited LLC"},
    "دبي بينينسولا ش.ذ.م.م": {"brand": "Peninsula (Select Group)", "legal": "Peninsula Dubai LLC"},
    "الحبتور سيتي للتطوير العقاري (فرع من دبي الوطنية للإستثمار(ش.ذ.م.م))": {"brand": "Al Habtoor Group", "legal": "Al Habtoor City Real Estate Development LLC"},
    "شركة الياس ومصطفى كلداري للعقارات (ذ.م.م)": {"brand": "IMG Group (Galadari)", "legal": "Ilyas & Mustafa Galadari Real Estate LLC"},
    "الياس و مصطفى كلداري لإدارة الاستثمار و التطوير (ش.ذ.م.م)": {"brand": "IMG Group (Galadari)", "legal": "Ilyas & Mustafa Galadari Management & Development LLC"},
    "ديفكو لتطوير العقارات ش.ذ.م.م": {"brand": "FIVE Holdings (FIVE Luxe)", "legal": "Devco Real Estate Development LLC"},
    "ون زعبيل ذ.م.م": {"brand": "One Za'abeel (ITHRA Dubai)", "legal": "One Za'abeel LLC"},
    "اراد للتطوير ذ م م للشخص الواحد": {"brand": "Arada Developments", "legal": "Arada Developments LLC"},
    "دار جلوبال لكشري للتطوير العقاري ذ.م.م ش.ش.و": {"brand": "Dar Global", "legal": "Dar Global Luxury Real Estate LLC"},
    "بارك 1 ش.ذ.م.م": {"brand": "Park 1 (Wasl Properties)", "legal": "Park 1 LLC"},
    "كريك هايتس للعقارات ش.ذ.م.م": {"brand": "Creek Heights (Wasl Properties)", "legal": "Creek Heights Real Estate LLC"},
    "الحي الاول - منطقة حرة": {"brand": "District One (Meydan Sobha)", "legal": "District One FZ-LLC"},
    "الشركة الخليجية للاستثمارات العامة (ش.م.ع)": {"brand": "GGICO", "legal": "Gulf General Investment Company PSC"},
    "اي تي ايه ستار للتطوير العقاري ش.ذ.م.م": {"brand": "ETA Star", "legal": "ETA Star Property Developers LLC"},
    "الفتان العقارية (ش.ذ.م.م)": {"brand": "Al Fattan Properties", "legal": "Al Fattan Properties LLC"},
    "سيفين مايفير للتطوير العقاري ش.ذ.م.م": {"brand": "Seven Mayfair", "legal": "Seven Mayfair Real Estate Development LLC"},
    "تنميات جلوبل للتطوير العقاري  ش ذ م م": {"brand": "Tanmiyat Global", "legal": "Tanmiyat Global Real Estate Development LLC"},
    "إستثمار العقارية منطقة حرة ذ.م.م": {"brand": "Istithmar Real Estate", "legal": "Istithmar Real Estate FZ-LLC"},
    "الاصيل للاستثمارات ش.ذ.م.م": {"brand": "Al Aseel Investments", "legal": "Al Aseel Investments LLC"},
    "ليمتلس ش .ذ.م.م": {"brand": "Limitless", "legal": "Limitless LLC"},
    "ام ايه اس للتطوير العقاري ش.ذ.م.م": {"brand": "MAS Real Estate", "legal": "MAS Real Estate Development LLC"},
    "هاربور العقارية ذ.م.م": {"brand": "Harbour Real Estate (DAMAC)", "legal": "Harbour Real Estate LLC"},
    "دي اتش ار اي 2 بي تي اس ش.ذ.م.م": {"brand": "Muraba (DHRE)", "legal": "DHRE 2 PTS LLC"},
    "جيه ايه جي للتطوير ش.ذ.م.م": {"brand": "JAG Development", "legal": "JAG Development LLC"},
    "الخيل هايتس ش.ذ.م.م": {"brand": "Al Khail Heights", "legal": "Al Khail Heights LLC"},
    "ايدن هيلز ش.ذ.م.م": {"brand": "Eden Hills (H&H Development)", "legal": "Eden Hills LLC"},
    "بي جي هوتيل ريزيدينشال ش.ذ.م.م": {"brand": "BG Hotel Residential", "legal": "BG Hotel Residential LLC"},
    "ديزرت فالكون للتطوير العقاري ش.ذ.م.م": {"brand": "Desert Falcon", "legal": "Desert Falcon Real Estate Development LLC"},
    "جيرسي للتطوير العقاري ش.ذ.م.م": {"brand": "Jersey Real Estate", "legal": "Jersey Real Estate Development LLC"},
    "اوريون للتطوير العقاري ش.ذ.م.م": {"brand": "Orion Real Estate", "legal": "Orion Real Estate Development LLC"},
    "واحة الجزيرة العقارية (ش.ذ.م.م)": {"brand": "Al Jazeera Oasis", "legal": "Al Jazeera Oasis Real Estate LLC"},
    "ام دي ان للعقارات ش.ذ.م.م": {"brand": "MDN Real Estate", "legal": "MDN Real Estate LLC"},
    "بي دي أل أم ريزيدينشال ذ.م.م": {"brand": "BDLM Residential", "legal": "BDLM Residential LLC"},
    # Premier Private Developers
    "H&H Development LLC": {"brand": "H&H Development", "legal": "H&H Development LLC"},
    "Iman Developers LLC": {"brand": "Iman Developers", "legal": "Iman Developers LLC"},
    "Ellington Properties Development LLC": {"brand": "Ellington Properties", "legal": "Ellington Properties Development LLC"},
    "Select Group Limited": {"brand": "Select Group", "legal": "Select Group Limited"},
    "AHS Properties LLC": {"brand": "AHS Properties", "legal": "AHS Properties LLC"},
    "Omniyat Properties LLC": {"brand": "Omniyat", "legal": "Omniyat Properties LLC"},
}

def clean_brand_string(name: str) -> str:
    """Strip leftover dots, isolated brackets and punctuation artifacts without breaking valid parentheses."""
    if not name:
        return ""
    # Remove strings like "...", "..", "(...)", "( . . . )", "  "
    s = re.sub(r'[\(\[\{]\s*[\.\s\-_]*[\)\]\}]', '', name)
    s = re.sub(r'\.{2,}', '', s)
    s = re.sub(r'\s+', ' ', s).strip(' .-_')
    return s

def build_normalized_dictionary():
    """Builds lookup table with normalized Arabic and English keys."""
    lookup = {}
    for k, v in BASE_DICTIONARY.items():
        norm_key = norm_ar(k)
        lookup[norm_key] = v
        lookup[k] = v
        if "legal" in v:
            lookup[v["legal"].lower()] = v
            lookup[v["legal"]] = v
        if "brand" in v:
            lookup[v["brand"].lower()] = v
            lookup[v["brand"]] = v
    return lookup

def main():
    print(f"🚀 Starting Developer Name Enrichment on {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    dict_map = build_normalized_dictionary()

    # Step 1: Remove orphaned duplicate developer records (.0 IDs with 0 projects)
    cur.execute("SELECT id FROM developer WHERE id LIKE '%.0'")
    dot_zero_devs = [r[0] for r in cur.fetchall()]
    if dot_zero_devs:
        # Verify none of them are referenced by projects
        cur.execute("SELECT COUNT(*) FROM project WHERE developer_id LIKE '%.0'")
        referenced = cur.fetchone()[0]
        if referenced == 0:
            print(f"  🧹 Purging {len(dot_zero_devs)} orphaned duplicate developer records (.0 IDs)...")
            cur.execute("DELETE FROM developer WHERE id LIKE '%.0'")
            conn.commit()
            print("  ✅ Orphaned records successfully removed.")
        else:
            print(f"  ⚠️ Warning: {referenced} projects reference .0 developers, skipping deletion.")

    # Step 2: Fetch all developers to clean and enrich
    cur.execute("SELECT id, legal_name, brand_name, dld_developer_id FROM developer")
    all_devs = cur.fetchall()
    print(f"  🔍 Inspecting {len(all_devs)} developer entities...")

    updated_devs = 0
    cleaned_brands = 0

    for dev_id, legal_name, brand_name, dld_id in all_devs:
        current_brand = brand_name or ""
        norm_l = norm_ar(legal_name)
        norm_b = norm_ar(current_brand)

        match = (
            dict_map.get(norm_l)
            or dict_map.get(norm_b)
            or dict_map.get(legal_name)
            or dict_map.get(current_brand)
            or dict_map.get(legal_name.lower())
            or dict_map.get(current_brand.lower())
        )
        
        target_brand = None
        target_legal = None

        if match:
            target_brand = match["brand"]
            target_legal = match["legal"]
        else:
            # Check if brand has dots or corruption to clean
            clean_b = clean_brand_string(current_brand)
            clean_l = clean_brand_string(legal_name)
            
            # If current brand is empty/dots and legal name is readable
            if clean_b and not clean_b.startswith("Developer #") and len(clean_b) >= 2:
                target_brand = clean_b
            elif clean_l and not clean_l.startswith("Developer #") and len(clean_l) >= 2:
                target_brand = clean_l
            else:
                target_brand = f"Developer #{dld_id or dev_id.replace('dev_', '')}"

        # If we have updates, write them
        needs_update = False
        final_brand = target_brand if target_brand else current_brand
        final_legal = target_legal if target_legal else legal_name

        if final_brand != current_brand:
            needs_update = True
            cleaned_brands += 1
        if target_legal and target_legal != legal_name:
            needs_update = True

        if needs_update:
            cur.execute("""
                UPDATE developer
                SET brand_name = ?, legal_name = ?, updated_at = datetime('now')
                WHERE id = ?
            """, (final_brand, final_legal, dev_id))
            updated_devs += 1

    conn.commit()
    print(f"  ✅ Updated {updated_devs} developers with verified English brand & legal names.")

    # Step 3: Enrich master_developer_name in the project catalog
    print("  🏢 Enriching master_developer_name across all projects...")
    cur.execute("SELECT id, master_developer_name FROM project WHERE master_developer_name IS NOT NULL")
    projects_with_master = cur.fetchall()

    updated_projects = 0
    for p_id, master_name in projects_with_master:
        norm_m = norm_ar(master_name)
        match = dict_map.get(norm_m) or dict_map.get(master_name)
        if match:
            new_master = match["brand"]
            if new_master != master_name:
                cur.execute("UPDATE project SET master_developer_name = ? WHERE id = ?", (new_master, p_id))
                updated_projects += 1
        else:
            clean_m = clean_brand_string(master_name)
            if clean_m != master_name and len(clean_m) >= 2:
                cur.execute("UPDATE project SET master_developer_name = ? WHERE id = ?", (clean_m, p_id))
                updated_projects += 1

    conn.commit()
    print(f"  ✅ Updated {updated_projects} projects with clean English master_developer_name.")

    # Step 4: Final verification scan
    cur.execute("""
        SELECT COUNT(*) FROM developer 
        WHERE brand_name IS NULL 
           OR brand_name = '' 
           OR brand_name LIKE '%.%'
           OR brand_name LIKE '%(%)%'
           OR brand_name LIKE '%...%'
    """)
    bad_brands_remaining = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM developer")
    total_active_devs = cur.fetchone()[0]

    print("\n📊 Verification Results:")
    print(f"  Total developers in database: {total_active_devs}")
    print(f"  Problematic/dot brand names remaining: {bad_brands_remaining}")

    # Print top 15 developers
    cur.execute("""
        SELECT d.id, d.brand_name, d.legal_name, COUNT(p.id) as p_count
        FROM developer d
        JOIN project p ON p.developer_id = d.id
        GROUP BY d.id
        ORDER BY p_count DESC
        LIMIT 15
    """)
    print("\n🏆 Top 15 Developers by Project Count:")
    for r in cur.fetchall():
        print(f"  • {r[1]} ({r[3]} projects) — Legal: {r[2]}")

    conn.close()
    print("\n🎉 Developer name enrichment complete!")

if __name__ == "__main__":
    main()
