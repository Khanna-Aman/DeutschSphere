import json
import os
import sys

# Ensure UTF-8 output for console
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

PROJECT_ROOT = r"d:\Aman\_________Projects\A1-B1_German"

CATEGORIES = [
    "Person & Familie",
    "Wohnen & Haushalt",
    "Gesundheit & Körper",
    "Natur & Umwelt",
    "Reise & Verkehr",
    "Essen & Trinken",
    "Einkaufen & Konsum",
    "Dienstleistungen & Behörden",
    "Ausbildung & Lernen",
    "Arbeit & Beruf",
    "Freizeit & Unterhaltung",
    "Zeit, Maße & Basiswortschatz"
]

def clean_umlauts(text):
    if not text:
        return ""
    # Standardize common encoding corruptions
    replacements = {
        "Krper": "Körper",
        "Krperpflege": "Körperpflege",
        "Gefhl": "Gefühl",
        "Gefhle": "Gefühle",
        "Bro": "Büro",
        "Fhigkeiten": "Fähigkeiten",
        "notflle": "Notfälle",
        "notfaelle": "Notfälle",
        "pruefung": "Prüfung",
        "schueler": "Schüler",
        "begruess": "Begrüß",
        "gefaellt": "gefällt",
        "Geschft": "Geschäft",
        "Aktivitten": "Aktivitäten"
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text

def map_word_to_category(item):
    raw_theme = item.get("theme", "") or item.get("category", "") or item.get("group", "") or "Allgemein"
    raw_theme = clean_umlauts(raw_theme)
    word = item.get("german", "") or item.get("word", "") or ""
    meaning = item.get("english", "") or item.get("meaning", "") or ""
    word_class = item.get("word_class", "") or ""

    t = raw_theme.lower().strip()
    w = word.lower().strip()
    m = meaning.lower().strip()
    wc = word_class.lower().strip()

    # Define keyword lists
    food_keywords = ['essen', 'trink', 'küche', 'gemüse', 'obst', 'kochen', 'restaurant', 'gastronomie', 'ernährung', 'nahrung', 'speise', 'mahlzeit', 'bäckerei', 'bier', 'fleisch', 'fisch', 'banane', 'gemuese', 'wein', 'kaffee', 'tee', 'frühstück', 'mittagessen', 'abendessen', 'lecker', 'hung', 'durst', 'broth', 'kuchen', 'suppe', 'backen', 'fruehstueck']
    health_keywords = ['gesund', 'körper', 'arzt', 'ärzt', 'krank', 'apotheke', 'fieber', 'bad', 'pflege', 'medizin', 'schmerz', 'unfall', 'klinik', 'spital', 'husten', 'schnupfen', 'tablette', 'rezept', 'therapie', 'verletz', 'blut', 'auge', 'ohr', 'mund', 'zahn', 'kopf', 'bein', 'arm', 'hand', 'fuß', 'bauch', 'herz', 'körperpflege', 'koerperpflege', 'koerper', 'aerzt']
    travel_keywords = ['reisen', 'reise', 'verkehr', 'bahn', 'zug', 'bus', 'flug', 'auto', 'fahrrad', 'schiff', 'ticket', 'fahrkarte', 'hotel', 'touris', 'pension', 'urlaub', 'gepäck', 'koffer', 'bahnhof', 'flughafen', 'abfahrt', 'ankunft', 'stau', 'strasse', 'straße', 'kreuzung', 'ampel', 'gleis', 'reisebüro', 'ausflug', 'landkarte', 'plan', 'pass', 'visum', 'gepaeck', 'reisebuero']
    shop_keywords = ['einkauf', 'konsum', 'laden', 'geschäft', 'preis', 'bezahl', 'kauf', 'geld', 'euro', 'cent', 'billig', 'teuer', 'kosten', 'rabatt', 'angebot', 'supermarkt', 'markt', 'tasche', 'kleidung', 'kleid', 'hose', 'schuh', 'hemd', 'jacke', 'mantel', 'rock', 'anzug', 'material', 'stoff', 'leder', 'wolle', 'seide', 'baumwolle', 'plastik', 'metall', 'holz', 'glas', 'papier', 'geschaeft', 'einkaufen']
    work_keywords = ['arbeit', 'beruf', 'firma', 'job', 'karriere', 'kollege', 'büro', 'bewerb', 'chef', 'angestellte', 'meister', 'kolleg', 'werkstatt', 'fabrik', 'gehalt', 'lohn', 'vertrag', 'kündig', 'streik', 'arbeitsplatz', 'arbeitslos', 'überstunde', 'lebenslauf', 'praktikum', 'berufstätig', 'buero', 'kollegin', 'berufstaetig', 'arbeitgeber', 'arbeitnehmer']
    education_keywords = ['schule', 'lernen', 'ausbildung', 'stud', 'universität', 'uni', 'klasse', 'unterricht', 'sprache', 'buch', 'bücher', 'bucht', 'bildung', 'lehrer', 'schüler', 'schueler', 'prüfung', 'pruefung', 'aufgabe', 'hausaufgabe', 'fehler', 'kurs', 'zeugnis', 'diplom', 'fach', 'mathematik', 'rechnen', 'schreiben', 'lesen', 'vokabel', 'wörterbuch', 'buecher', 'lehrerin', 'pruefungen']
    home_keywords = ['wohn', 'haus', 'zimmer', 'möbel', 'miete', 'einricht', 'haushalt', 'werkzeug', 'architekt', 'gebäude', 'gebaeude', 'küche', 'bad', 'balkon', 'garten', 'tisch', 'stuhl', 'bett', 'schrank', 'regal', 'sofa', 'lampe', 'tür', 'fenster', 'schlüssel', 'heizung', 'strom', 'wasser', 'nachbar', 'vermieter', 'moebel', 'tuer', 'schluessel']
    nature_keywords = ['natur', 'umwelt', 'wetter', 'klima', 'tier', 'pflanze', 'sauber', 'erde', 'garten', 'landschaft', 'wind', 'regen', 'schnee', 'sonne', 'temperatur', 'grad', 'himmel', 'stern', 'mond', 'wald', 'berg', 'see', 'meer', 'fluss', 'baum', 'blume', 'katze', 'hund', 'vogel', 'pferd', 'kuh', 'sauberkeit', 'schmutz', 'müll', 'abfall', 'muell', 'flüsse']
    leisure_keywords = ['freizeit', 'unterhalt', 'spiel', 'sport', 'hobby', 'musik', 'film', 'kino', 'museum', 'kunst', 'kultur', 'literatur', 'lesen', 'fest', 'feier', 'geburtstag', 'tanzen', 'singen', 'theater', 'konzert', 'ausstellung', 'malen', 'foto', 'kamera', 'fernseher', 'radio', 'schach', 'fussball', 'fußball', 'schwimmen', 'wandern', 'ausflug']
    services_keywords = ['dienst', 'behörde', 'amt', 'ämter', 'polizei', 'post', 'telekom', 'bank', 'finanz', 'steuer', 'recht', 'politik', 'staat', 'gesellschaft', 'sicherheit', 'notfall', 'notfälle', 'notfaelle', 'feuerwehr', 'rathaus', 'konsulat', 'botschaft', 'ausweis', 'formular', 'unterschrift', 'gebühr', 'konto', 'überweisen', 'karte', 'brief', 'paket', 'stempel', 'telefon', 'handy', 'internet', 'computer', 'e-mail', 'mail', 'anwalt', 'gericht', 'gesetz', 'versicherung', 'aemter', 'gebuehr', 'ueberweisen']
    family_keywords = ['person', 'familie', 'freund', 'kind', 'eltern', 'partner', 'beziehung', 'charakter', 'gefühl', 'gefuehl', 'identität', 'alter', 'aussehen', 'kommunikation', 'begrüß', 'begruess', 'meinung', 'gedanke', 'denken', 'entscheid', 'heirat', 'hochzeit', 'mann', 'frau', 'bruder', 'schwester', 'mutter', 'vater', 'sohn', 'tochter', 'onkel', 'tante', 'nichte', 'neffe', 'großeltern', 'oma', 'opa', 'enkel', 'geburt', 'tod', 'sterben', 'leben', 'liebe', 'hass', 'wut', 'angst', 'freude', 'glück', 'trauer', 'streit', 'gespräch', 'diskussion', 'sagen', 'sprechen', 'erzählen', 'fragen', 'antworten', 'verstehen', 'identitaet', 'grosseltern', 'glueck', 'gespraech', 'erzaehlen', 'begruessung']

    # Exact matching blocks for themes
    if any(x in t for x in ['essen', 'trink', 'koche', 'gemüse', 'obst', 'restaurant', 'küche', 'bäckerei', 'speise', 'mahlzeit']):
        return 'Essen & Trinken'
    if any(x in t for x in ['gesund', 'körper', 'arzt', 'krank', 'apotheke', 'pflege', 'schmerz', 'bad', 'klinik', 'unfall', 'medizin']):
        return 'Gesundheit & Körper'
    if any(x in t for x in ['reise', 'verkehr', 'hotel', 'flug', 'zug', 'bahn', 'auto', 'fahrrad', 'schiff', 'ticket', 'touris', 'urlaub', 'koffer', 'gepäck']):
        return 'Reise & Verkehr'
    if any(x in t for x in ['einkauf', 'laden', 'geschäft', 'preis', 'bezahl', 'kleidung', 'kleid', 'hose', 'schuh', 'ware', 'teuer', 'billig', 'konsum']):
        return 'Einkaufen & Konsum'
    if any(x in t for x in ['arbeit', 'beruf', 'job', 'firma', 'kolleg', 'büro', 'gehalt', 'lohn', 'bewerb', 'career', 'work']):
        return 'Arbeit & Beruf'
    if any(x in t for x in ['schule', 'lernen', 'ausbildung', 'stud', 'uni', 'klasse', 'unterricht', 'bildung', 'sprache', 'prüfung', 'lehrer', 'schüler', 'vokabel']):
        return 'Ausbildung & Lernen'
    if any(x in t for x in ['wohn', 'haus', 'zimmer', 'möbel', 'miete', 'haushalt', 'werkzeug', 'gebäude', 'einricht', 'balkon', 'tisch', 'stuhl', 'regal', 'bett', 'schrank']):
        return 'Wohnen & Haushalt'
    if any(x in t for x in ['natur', 'umwelt', 'wetter', 'klima', 'tier', 'pflanze', 'garten', 'sauber', 'landschaft', 'wind', 'regen', 'schnee', 'sonne', 'wald', 'see', 'meer']):
        return 'Natur & Umwelt'
    if any(x in t for x in ['freizeit', 'unterhalt', 'spiel', 'sport', 'hobby', 'musik', 'film', 'kino', 'kunst', 'kultur', 'fest', 'literatur', 'lesen', 'tanzen', 'singen', 'feier']):
        return 'Freizeit & Unterhaltung'
    if any(x in t for x in ['amt', 'ämter', 'behörde', 'polizei', 'post', 'telekom', 'bank', 'finanz', 'steuer', 'recht', 'politik', 'dienst', 'sicherheit', 'notfall', 'ausweis', 'formular', 'unterschrift', 'versicherung', 'gesetz', 'staat', 'gesellschaft']):
        return 'Dienstleistungen & Behörden'
    if any(x in t for x in ['person', 'familie', 'kind', 'eltern', 'partner', 'beziehung', 'charakter', 'gefühl', 'kommunikation', 'meinung', 'gedanke', 'denken', 'freund', 'heirat', 'hochzeit', 'bruder', 'schwester', 'mutter', 'vater', 'sohn', 'tochter', 'oma', 'opa', 'enkel']):
        return 'Person & Familie'

    if any(x in t for x in ['geld', 'bank', 'finanz', 'bezahl', 'preis']):
        if 'bank' in t or 'finanz' in t:
            return 'Dienstleistungen & Behörden'
        return 'Einkaufen & Konsum'

    if any(x in t for x in ['zeit', 'datum', 'uhr', 'zahl', 'maß', 'menge', 'kalender', 'woche', 'monat', 'jahr', 'tageszeit', 'jahreszeit']):
        if 'freizeit' in t:
            return 'Freizeit & Unterhaltung'
        return 'Zeit, Maße & Basiswortschatz'

    # Keyword check in word/meaning/wordClass
    search_terms = [w, m]
    
    def match_any(keyword_list):
        return any(any(kw in term for kw in keyword_list) for term in search_terms)

    if match_any(food_keywords): return 'Essen & Trinken'
    if match_any(health_keywords): return 'Gesundheit & Körper'
    if match_any(travel_keywords): return 'Reise & Verkehr'
    if match_any(shop_keywords): return 'Einkaufen & Konsum'
    if match_any(work_keywords): return 'Arbeit & Beruf'
    if match_any(education_keywords): return 'Ausbildung & Lernen'
    if match_any(home_keywords): return 'Wohnen & Haushalt'
    if match_any(nature_keywords): return 'Natur & Umwelt'
    if match_any(leisure_keywords): return 'Freizeit & Unterhaltung'
    if match_any(services_keywords): return 'Dienstleistungen & Behörden'
    if match_any(family_keywords): return 'Person & Familie'

    # Base fallback categories based on word characteristics (Time, Numbers, Grammar / Basic Vocab)
    numbers = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig', 'hundert', 'tausend', 'million', 'milliarde', 'erste', 'zweite', 'dritte', 'vierte']
    dates_time = ['januar', 'februar', 'märz', 'maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag', 'wochenende', 'uhr', 'minute', 'sekunde', 'stunde', 'jahr', 'monat', 'woche', 'tag', 'morgen', 'vormittag', 'mittag', 'nachmittag', 'abend', 'nacht', 'heute', 'gestern', 'morgen', 'früh', 'spät', 'datum', 'zeit']

    if wc == 'number' or any(num == w for num in numbers) or 'number' in m or 'numeral' in m:
        return 'Zeit, Maße & Basiswortschatz'
    if any(dt in w or dt in m for dt in dates_time) or 'zeit' in t or 'datum' in t:
        return 'Zeit, Maße & Basiswortschatz'
    if wc in ['pronoun', 'preposition', 'conjunction', 'article', 'adverb']:
        return 'Zeit, Maße & Basiswortschatz'

    return 'Zeit, Maße & Basiswortschatz'

def consolidate_level(level):
    path = os.path.join(PROJECT_ROOT, level, "wordlist.json")
    if not os.path.exists(path):
        print(f"Error: Wordlist not found for level {level} at {path}")
        return

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"--- Consolidating Level {level.upper()} ({len(data)} words) ---")
    
    modified_count = 0
    counts = {cat: 0 for cat in CATEGORIES}

    for item in data:
        old_theme = item.get("theme", "None")
        new_category = map_word_to_category(item)
        
        # We physically update the "theme" field in the database card
        if old_theme != new_category:
            item["theme"] = new_category
            modified_count += 1
        else:
            item["theme"] = new_category  # ensure correct key is populated

        counts[new_category] = counts.get(new_category, 0) + 1

    # Save changes back
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Done! Physically modified {modified_count} word themes.")
    print("New theme distribution:")
    for cat in CATEGORIES:
        print(f"  - {cat}: {counts[cat]} words")
    print()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_level = sys.argv[1].lower()
        if target_level in ["a1", "a2", "b1"]:
            consolidate_level(target_level)
        else:
            print(f"Unknown level: {target_level}")
    else:
        # If no arguments, consolidate all sequentially
        for lvl in ["a1", "a2", "b1"]:
            consolidate_level(lvl)
