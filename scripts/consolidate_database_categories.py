import json
import os
import sys
import re

# Ensure UTF-8 output for console
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

PROJECT_ROOT = r"d:\Aman\_________Projects\A1-B1_German"

CATEGORIES = [
    'Person, Familie & Beziehungen',
    'Gefühle, Charakter & Meinung',
    'Wohnen, Haus & Haushalt',
    'Gesundheit, Körper & Pflege',
    'Natur, Umwelt & Tiere',
    'Reise, Verkehr & Mobilität',
    'Essen, Kochen & Restaurant',
    'Einkaufen, Geld & Konsum',
    'Ausbildung, Schule & Studium',
    'Arbeit, Beruf & Karriere',
    'Freizeit, Hobbys & Unterhaltung',
    'Kommunikation, Medien & Sprache',
    'Staat, Gesellschaft & Dokumente',
    'Grammatik, Pronomen & Struktur',
    'Zahlen, Maße & Mengen',
    'Uhrzeit, Datum & Kalender',
    'Allgemeine Aktivitäten & Verben',
    'Eigenschaften & Adjektive',
    'Basiswortschatz & Floskeln'
]

# Strict grammatical, structural, and temporal lists (exact matches)
grammar_exact_de = {
    'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mein', 'dein', 'sein', 'unser', 'euer', 'ihre', 'ihrer', 'ihres',
    'in', 'an', 'auf', 'bei', 'mit', 'zu', 'von', 'nach', 'aus', 'für', 'fuer', 'gegen', 'ohne', 'um', 'durch', 'über', 'ueber', 'unter', 'vor', 'hinter', 'neben', 'zwischen',
    'und', 'oder', 'aber', 'weil', 'dass', 'wenn', 'denn', 'als', 'da', 'der', 'die', 'das', 'ein', 'eine', 'einen', 'einem', 'eines', 'einer',
    'welche', 'welcher', 'welches', 'dieser', 'diese', 'dieses', 'wer', 'was', 'wie', 'wo', 'wann', 'warum', 'weshalb', 'deshalb', 'trotzdem', 'obwohl',
    'nicht', 'nichts', 'nur', 'kein', 'keine', 'doch', 'gar', 'etwas', 'jemand', 'niemand', 'man', 'sich', 'mich', 'dich', 'uns', 'euch', 'ihnen', 'ihm', 'ihn'
}

numbers_exact_de = {
    'null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'fuenf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
    'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig',
    'dreißig', 'dreissig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig', 'hundert', 'tausend', 'million', 'milliarde',
    'erste', 'zweite', 'dritte', 'vierte', 'hälfte', 'haelfte', 'viertel', 'wenig', 'viel', 'mehr', 'manch', 'einige', 'all', 'ganz', 'beide', 'beides'
}

time_exact_de = {
    'uhr', 'jahr', 'monat', 'woche', 'tag', 'sekunde', 'minute', 'stunde', 'quartal', 'zeitraum', 'saison', 'dauer',
    'spät', 'spaet', 'früh', 'frueh', 'jetzt', 'dann', 'danach', 'heute', 'gestern', 'morgen', 'bald', 'sofort', 'später', 'spaeter', 'pünktlich', 'puenktlich',
    'immer', 'nie', 'oft', 'selten', 'manchmal', 'damals', 'generation', 'mal', 'einmal', 'zweimal', 'dreimal', 'oftmals', 'stündlich', 'stuendlich',
    'täglich', 'taeglich', 'wöchentlich', 'woechentlich', 'monatlich', 'jährlich', 'jaehrlich', 'frühling', 'sommer', 'herbst', 'winter',
    'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag', 'wochenende',
    'januar', 'februar', 'märz', 'maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember',
    'alltag', 'alltäglich', 'alltaeglich', 'zeit', 'uhrzeit', 'datum', 'kalender'
}

# German Stems (prefix-boundary match, e.g. \bess matches essen, esszimmer)
food_de = ['ess', 'trink', 'küch', 'kuech', 'gemüs', 'gemues', 'obst', 'koch', 'restaur', 'gastro', 'speis', 'mahl', 'bäck', 'baeck', 'bier', 'fleisch', 'fisch', 'banan', 'wein', 'kaff', 'tee', 'supp', 'back', 'frühstück', 'fruehstück', 'salat', 'käse', 'kaese', 'wurst', 'milch', 'kartoffel', 'teller', 'gabel', 'messer', 'löffel', 'loeffel', 'becher', 'tasse', 'glas', 'speisekarte', 'zucker', 'salz', 'pfeffer', 'nudeln', 'reis', 'rind', 'schwein', 'braten']
health_de = ['gesund', 'körper', 'koerper', 'arzt', 'ärzt', 'aerzt', 'krank', 'apotheke', 'fieber', 'bad', 'pflege', 'medizin', 'schmerz', 'unfall', 'klinik', 'spital', 'husten', 'schnupfen', 'tablette', 'rezept', 'therapie', 'verletz', 'blut', 'auge', 'ohr', 'mund', 'zahn', 'kopf', 'bein', 'arm', 'hand', 'fuß', 'fuss', 'bauch', 'herz', 'patient', 'praxis', 'medikament', 'pflaster', 'verband', 'salbe', 'spritze', 'impfung', 'schwanger', 'geburt']
travel_de = ['reis', 'verkehr', 'bahn', 'zug', 'bus', 'flug', 'auto', 'fahrrad', 'schiff', 'ticket', 'fahrkart', 'hotel', 'touris', 'pension', 'urlaub', 'gepäck', 'gepaeck', 'koffer', 'bahnhof', 'flughafen', 'abfahrt', 'ankunft', 'stau', 'strass', 'straße', 'kreuzung', 'ampel', 'gleis', 'ausflug', 'landkart', 'plan', 'pass', 'visum', 'strand', 'ferien', 'meer', 'see', 'berge', 'wandern', 'camping', 'zelt', 'buchen', 'reservier', 'abflieg', 'landen', 'verspät', 'verspaet', 'linie', 'haltestell', 'umsteig', 'einsteig', 'aussteig', 'tanken', 'tankstell']
shop_de = ['einkauf', 'konsum', 'laden', 'geschäft', 'geschaeft', 'preis', 'bezahl', 'kauf', 'geld', 'euro', 'cent', 'billig', 'teuer', 'kosten', 'rabatt', 'angebot', 'supermarkt', 'markt', 'tasche', 'kleidung', 'kleid', 'hose', 'schuh', 'hemd', 'jacke', 'mantel', 'rock', 'anzug', 'material', 'stoff', 'leder', 'wolle', 'seide', 'baumwolle', 'plastik', 'metall', 'holz', 'glas', 'papier', 'verkäufer', 'verkaeufer', 'kunde', 'kassier', 'kasse', 'tüte', 'tuete', 'quittung', 'garantie', 'umtausch', 'reduzier']
work_de = ['arbeit', 'beruf', 'firma', 'job', 'karriere', 'kolleg', 'büro', 'buero', 'bewerb', 'chef', 'angestellt', 'meister', 'werkstatt', 'fabrik', 'gehalt', 'lohn', 'vertrag', 'kündig', 'kuendig', 'streik', 'arbeitsplatz', 'arbeitslos', 'überstunde', 'ueberstunde', 'lebenslauf', 'praktikum', 'leiter', 'direktor', 'kollegen']
education_de = ['schul', 'lern', 'ausbildung', 'stud', 'universität', 'universitaet', 'uni', 'klass', 'unterricht', 'sprache', 'buch', 'bücher', 'buecher', 'bucht', 'bildung', 'lehr', 'schüler', 'schueler', 'prüfung', 'pruefung', 'aufgabe', 'hausaufgabe', 'fehler', 'kurs', 'zeugnis', 'diplom', 'fach', 'mathemat', 'rechn', 'schreib', 'les', 'vokabel', 'wörterbuch', 'woerterbuch', 'lehrerin', 'lektion', 'semester', 'schularbeit', 'student', 'professor', 'zertifikat']
home_de = ['wohn', 'haus', 'zimmer', 'möbel', 'moebel', 'miet', 'einricht', 'haushalt', 'werkzeug', 'architekt', 'gebäude', 'gebaeude', 'tisch', 'stuhl', 'bett', 'schrank', 'regal', 'sofa', 'lampe', 'tür', 'tuer', 'fenster', 'schlüssel', 'schluessel', 'heizung', 'strom', 'wasser', 'nachbar', 'vermiet', 'einzieh', 'auszieg', 'umzieh', 'keller', 'dach', 'wand', 'boden', 'balkon', 'terrasse']
nature_de = ['natur', 'umwelt', 'wetter', 'klima', 'tier', 'pflanze', 'sauber', 'erde', 'garten', 'landschaft', 'wind', 'regen', 'schnee', 'sonne', 'temperatur', 'grad', 'himmel', 'stern', 'mond', 'wald', 'berg', 'see', 'meer', 'fluss', 'baum', 'blume', 'katze', 'hund', 'vogel', 'pferd', 'kuh', 'sauberkeit', 'schmutz', 'müll', 'muell', 'abfall', 'luft', 'umweltschutz', 'recycling', 'hitze', 'kälte', 'kaelte', 'gewitter', 'sturm', 'wolke', 'nebel']
leisure_de = ['freizeit', 'unterhalt', 'spiel', 'sport', 'hobby', 'musik', 'film', 'kino', 'museum', 'kunst', 'kultur', 'literatur', 'lesen', 'fest', 'feier', 'geburtstag', 'tanz', 'sing', 'theater', 'konzert', 'ausstellung', 'mal', 'foto', 'kamera', 'fernseher', 'radio', 'schach', 'fussball', 'fußball', 'schwimm', 'wandern', 'sportplatz', 'mannschaft', 'verein', 'turnier', 'gewinn', 'verlier', 'party', 'instrument', 'gitarre', 'klavier', 'fotografier']
family_de = ['person', 'familie', 'freund', 'kind', 'eltern', 'partner', 'beziehung', 'heirat', 'hochzeit', 'mann', 'frau', 'bruder', 'schwe', 'mutter', 'vater', 'sohn', 'tocht', 'onkel', 'tant', 'nich', 'nef', 'großel', 'grossel', 'oma', 'opa', 'enkel', 'baby', 'mensch', 'leute', 'mitglieder', 'geschwister', 'verwandte', 'ehe', 'scheidung', 'alleinerziehend']
emotion_de = ['charakter', 'gefühl', 'gefuehl', 'identität', 'identitaet', 'alter', 'aussehen', 'meinung', 'gedanke', 'denk', 'entscheid', 'lieb', 'hass', 'wut', 'angst', 'freud', 'glück', 'glueck', 'trau', 'streit', 'gespräch', 'gespraech', 'diskussion', 'traurig', 'froh', 'wütend', 'wuetend', 'ängstlich', 'aengstlich', 'stolz', 'schüchtern', 'schuechtern', 'höflich', 'hoeflich', 'nett', 'freundlich', 'sympathisch', 'böse', 'boese', 'dumm', 'klug', 'faul', 'fleißig', 'fleissig', 'ehrlich', 'geduldig', 'nervös', 'nervoes', 'zufrieden', 'unzufrieden', 'persönlichkeit', 'persoenlichkeit', 'hoffen', 'glauben', 'fühlen', 'fuehlen', 'weinen', 'lachen', 'lächeln', 'laecheln', 'meinen', 'empfehl']
communication_de = ['kommunikation', 'begrüß', 'begruess', 'sag', 'sprech', 'erzähl', 'erzaehl', 'frag', 'antwort', 'versteh', 'telefon', 'handy', 'computer', 'internet', 'e-mail', 'mail', 'anruf', 'brief', 'paket', 'nachricht', 'neuigkeit', 'mobiltelefon', 'netzwerk', 'smartphone', 'tastatur', 'bildschirm', 'datei', 'daten', 'online', 'web', 'apparat', 'tv', 'radio', 'kamera', 'video', 'cd', 'dvd', 'mp3', 'display', 'kabel', 'taste', 'drucker', 'kopier', 'speicher', 'programm', 'digital', 'techn', 'medien', 'anrufen', 'telefonieren', 'reden', 'diskutieren', 'erklären', 'erklaeren', 'vorlesen', 'buchstabieren', 'post', 'stempel', 'plakat', 'zettel', 'zeitung', 'zeitschrift', 'magazin', 'sender', 'empfänger', 'empfaenger', 'anrede', 'grüßen', 'gruessen', 'danken', 'bitten']
documents_de = ['amt', 'ämter', 'aemter', 'behörde', 'behoerde', 'polizei', 'telekom', 'bank', 'finanz', 'steuer', 'recht', 'politik', 'staat', 'gesellschaft', 'sicherheit', 'notfall', 'notfälle', 'notfaelle', 'feuerwehr', 'rathaus', 'konsulat', 'botschaft', 'ausweis', 'formular', 'unterschrift', 'gebühr', 'gebuehr', 'konto', 'überweisen', 'ueberweisen', 'anwalt', 'gericht', 'gesetz', 'versicherung', 'visum', 'pass', 'zertifikat', 'diplom', 'bestätigung', 'bestaetigung', 'bescheinigung', 'erlaubnis', 'vertrag', 'dokument', 'urkunde', 'antrag', 'anmeldung', 'abmeldung', 'registrier', 'genehmig', 'zoll', 'grenze', 'soldat', 'militär', 'militaer', 'krieg', 'frieden', 'richter', 'staatsanwalt', 'parlament', 'gesetzgeb', 'verfassung', 'partei', 'abgeordnet', 'minister', 'bürger', 'buerger', 'wahl', 'wähler', 'waehler', 'demokratie']

# English Keywords (prefix-boundary match on English, e.g. \bfood matches food, foodie)
food_en = ['food', 'drink', 'eat', 'cook', 'kitchen', 'vegetable', 'fruit', 'restaurant', 'bakery', 'beer', 'meat', 'fish', 'banana', 'wine', 'coffee', 'tea', 'soup', 'bake', 'breakfast', 'lunch', 'dinner', 'salad', 'cheese', 'sausage', 'milk', 'potato', 'plate', 'fork', 'knife', 'spoon', 'cup', 'glass', 'menu', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'meal', 'pasta', 'rice', 'beef', 'pork', 'chicken', 'bill', 'receipt']
health_en = ['health', 'body', 'doctor', 'ill', 'sick', 'pharmacy', 'fever', 'bath', 'care', 'medicine', 'pain', 'accident', 'clinic', 'hospital', 'cough', 'cold', 'pill', 'prescription', 'recipe', 'therapy', 'injur', 'blood', 'eye', 'ear', 'mouth', 'tooth', 'teeth', 'head', 'leg', 'arm', 'hand', 'foot', 'feet', 'stomach', 'heart', 'patient', 'practice', 'medication', 'plaster', 'bandage', 'ointment', 'injection', 'vaccin', 'pregnant', 'birth', 'die', 'dead', 'death']
travel_en = ['travel', 'traffic', 'train', 'bus', 'flight', 'fly', 'car', 'bicycle', 'bike', 'ship', 'boat', 'ticket', 'hotel', 'touris', 'pension', 'holiday', 'vacation', 'luggage', 'baggage', 'suitcas', 'station', 'airport', 'depart', 'arriv', 'stau', 'jam', 'street', 'road', 'crossing', 'intersection', 'light', 'platform', 'excursion', 'map', 'passport', 'visa', 'beach', 'sea', 'mountain', 'hike', 'hiking', 'camp', 'tent', 'book', 'reserv', 'delay', 'punctual', 'on time', 'schedule', 'timetable', 'line', 'stop', 'change', 'get in', 'get off', 'fuel', 'gas station']
shop_en = ['shop', 'consum', 'store', 'price', 'pay', 'buy', 'money', 'euro', 'cent', 'cheap', 'expensive', 'cost', 'discount', 'offer', 'supermarket', 'market', 'bag', 'cloth', 'dress', 'pant', 'shoe', 'shirt', 'jacket', 'coat', 'skirt', 'suit', 'material', 'fabric', 'leather', 'wool', 'silk', 'cotton', 'plastic', 'metal', 'wood', 'glass', 'paper', 'seller', 'customer', 'cashier', 'cash register', 'bill', 'receipt', 'guarantee', 'exchange', 'reduced', 'special offer']
work_en = ['work', 'job', 'profession', 'career', 'colleague', 'office', 'apply', 'application', 'boss', 'employee', 'employer', 'master', 'workshop', 'factory', 'salary', 'wage', 'contract', 'resign', 'dismiss', 'strike', 'workplace', 'unemploy', 'overtime', 'resume', 'cv', 'internship', 'manager', 'director', 'lead']
education_en = ['school', 'learn', 'educat', 'stud', 'universit', 'college', 'class', 'teach', 'student', 'pupil', 'exam', 'test', 'task', 'exercise', 'homework', 'mistake', 'error', 'course', 'certificate', 'diploma', 'subject', 'math', 'calculat', 'write', 'read', 'vocab', 'dictionar', 'lesson', 'semester', 'term', 'professor', 'grade', 'mark']
home_en = ['live', 'house', 'room', 'furnitur', 'rent', 'household', 'tool', 'architect', 'build', 'table', 'chair', 'bed', 'cabinet', 'cupboard', 'shelf', 'shelves', 'sofa', 'couch', 'lamp', 'door', 'window', 'key', 'heat', 'electric', 'power', 'water', 'neighbor', 'landlord', 'flat', 'apartment', 'kitchen', 'bathroom', 'balcony', 'terrace', 'cellar', 'basement', 'roof', 'wall', 'floor', 'move in', 'move out', 'move house']
nature_en = ['natur', 'environ', 'weather', 'climat', 'animal', 'plant', 'clean', 'earth', 'garden', 'landscap', 'wind', 'rain', 'snow', 'sun', 'temperatur', 'degree', 'sky', 'star', 'moon', 'forest', 'wood', 'mountain', 'lake', 'sea', 'ocean', 'river', 'tree', 'flower', 'cat', 'dog', 'bird', 'horse', 'cow', 'dirt', 'garbage', 'trash', 'waste', 'pollution', 'recycl', 'heat', 'cold', 'thunder', 'storm', 'cloud', 'fog']
leisure_en = ['leisure', 'entertain', 'game', 'play', 'sport', 'hobby', 'music', 'film', 'movie', 'cinema', 'museum', 'art', 'cultur', 'literatur', 'read', 'festival', 'party', 'celebrat', 'birthday', 'dance', 'sing', 'theat', 'concert', 'exhibit', 'paint', 'photo', 'camera', 'tv', 'television', 'radio', 'chess', 'soccer', 'football', 'swim', 'hike', 'stadium', 'team', 'club', 'tournament', 'win', 'lose', 'instrument', 'guitar', 'piano']
family_en = ['person', 'family', 'friend', 'child', 'parent', 'partner', 'relation', 'marry', 'marriag', 'wedding', 'man', 'men', 'woman', 'women', 'brother', 'sister', 'mother', 'father', 'son', 'daughter', 'uncle', 'tante', 'niece', 'nephew', 'grandparent', 'grandma', 'grandpa', 'grandson', 'granddaught', 'baby', 'human', 'people', 'member', 'sibling', 'relative', 'divorce']
emotion_en = ['charact', 'feel', 'emotion', 'identit', 'age', 'look', 'opinion', 'thought', 'think', 'decid', 'decision', 'love', 'hate', 'anger', 'angry', 'fear', 'afraid', 'joy', 'happy', 'happine', 'sad', 'grief', 'quarrel', 'argu', 'fight', 'discuss', 'proud', 'shy', 'polite', 'nice', 'kind', 'friendly', 'sympathetic', 'bad', 'stupid', 'clever', 'smart', 'lazy', 'diligent', 'honest', 'patient', 'nervous', 'satisfied', 'disappointed', 'personality', 'hope', 'believe', 'cry', 'laugh', 'smile', 'mean', 'recommend']
communication_en = ['communicat', 'greet', 'say', 'speak', 'talk', 'tell', 'ask', 'answer', 'reply', 'understand', 'conversation', 'telephone', 'phone', 'cell phone', 'mobile', 'computer', 'laptop', 'internet', 'e-mail', 'email', 'mail', 'call', 'letter', 'parcel', 'package', 'message', 'news', 'network', 'smartphone', 'keyboard', 'screen', 'monitor', 'file', 'data', 'online', 'web', 'device', 'tv', 'radio', 'camera', 'video', 'cd', 'dvd', 'mp3', 'display', 'cable', 'button', 'key', 'printer', 'copi', 'memor', 'storag', 'program', 'digital', 'techn', 'media', 'post', 'stamp', 'poster', 'note', 'newspaper', 'journal', 'magazin', 'broadcast', 'sender', 'receiver', 'salutation', 'thank', 'please']
documents_en = ['office', 'authorit', 'police', 'post', 'telecom', 'bank', 'financ', 'tax', 'law', 'legal', 'polit', 'state', 'societ', 'security', 'emergenc', 'fire brigade', 'city hall', 'rathaus', 'consulat', 'embassy', 'id card', 'identification', 'form', 'sign', 'signature', 'fee', 'account', 'transfer', 'card', 'lawyer', 'attorney', 'court', 'insur', 'visa', 'passport', 'certificat', 'diploma', 'confirm', 'contract', 'document', 'deed', 'request', 'register', 'zoll', 'custom', 'border', 'soldier', 'militar', 'war', 'peace', 'judge', 'parliament', 'constitut', 'party', 'minister', 'citizen', 'vote', 'voter', 'democrac']


def map_word_to_category(item):
    raw_theme = item.get("theme", "") or item.get("category", "") or item.get("group", "") or "Allgemein"
    word = item.get("german", "") or item.get("word", "") or ""
    meaning = item.get("english", "") or item.get("meaning", "") or ""
    word_class = item.get("word_class", "") or ""

    t = raw_theme.strip().lower()
    w = word.lower().strip()
    m = meaning.lower().strip()
    wc = word_class.lower().strip()

    # Clean articles and parenthesis for clean checks
    w_clean = re.sub(r'^(der|die|das)\s+', '', w)
    w_clean = re.sub(r'\s*\(.*?\)\s*', '', w_clean).strip()

    # 1. Structural & Grammatical checks FIRST (so they don't get swept into semantic categories accidentally)
    if wc in ['pronoun', 'preposition', 'conjunction', 'article', 'adverb'] or w_clean in grammar_exact_de:
        return 'Grammatik, Pronomen & Struktur'
    
    if wc == 'number' or w_clean in numbers_exact_de or 'number' in m or 'numeral' in m or any(x in m for x in ['measure', 'unit ', 'quantity']) or any(x == w_clean for x in ['grad', 'kilo', 'meter', 'liter', 'gramm', 'portion', 'paar', 'stück', 'teil', 'größe', 'prozent', 'tonne', 'gewicht', 'länge', 'breite', 'höhe', 'tiefe']):
        return 'Zahlen, Maße & Mengen'
    
    if w_clean in time_exact_de or any(x == w_clean for x in ['uhr', 'jahr', 'monat', 'woche', 'tag', 'sekunde', 'minute', 'stunde', 'quartal', 'zeitraum', 'spät', 'früh', 'jetzt', 'dann', 'danach', 'heute', 'gestern', 'morgen', 'bald', 'sofort', 'später', 'pünktlich', 'puenktlich', 'dauer']):
        return 'Uhrzeit, Datum & Kalender'

    # Helper match functions
    def match_de(stems):
        for stem in stems:
            # Exclude false positives for short German stems
            if stem == 'auto' and w_clean.startswith('autor'):
                continue
            if stem == 'pass' and (w_clean.startswith('passier') or w_clean.startswith('passen') or w_clean.startswith('passend')):
                continue
            if re.search(r'\b' + re.escape(stem), w_clean):
                return True
        return False

    def match_en(keywords):
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', m):
                return True
        return False

    # 2. Match Specific Themes/Keywords with high priority
    if match_de(communication_de) or match_en(communication_en):
        return 'Kommunikation, Medien & Sprache'
    
    if match_de(documents_de) or match_en(documents_en):
        return 'Staat, Gesellschaft & Dokumente'
    
    if match_de(emotion_de) or match_en(emotion_en):
        return 'Gefühle, Charakter & Meinung'

    if match_de(food_de) or match_en(food_en):
        return 'Essen, Kochen & Restaurant'
        
    if match_de(health_de) or match_en(health_en):
        return 'Gesundheit, Körper & Pflege'
        
    if match_de(travel_de) or match_en(travel_en):
        return 'Reise, Verkehr & Mobilität'
        
    if match_de(shop_de) or match_en(shop_en):
        return 'Einkaufen, Geld & Konsum'
        
    if match_de(work_de) or match_en(work_en):
        return 'Arbeit, Beruf & Karriere'
        
    if match_de(education_de) or match_en(education_en):
        return 'Ausbildung, Schule & Studium'
        
    if match_de(home_de) or match_en(home_en):
        return 'Wohnen, Haus & Haushalt'
        
    if match_de(nature_de) or match_en(nature_en):
        return 'Natur, Umwelt & Tiere'
        
    if match_de(leisure_de) or match_en(leisure_en):
        return 'Freizeit, Hobbys & Unterhaltung'
        
    if match_de(family_de) or match_en(family_en):
        return 'Person, Familie & Beziehungen'

    # 3. Direct Map Mapping based on raw themes
    t_mapping = {
        'person & familie': 'Person, Familie & Beziehungen',
        'person, familie & beziehungen': 'Person, Familie & Beziehungen',
        'gefühle, charakter & meinung': 'Gefühle, Charakter & Meinung',
        'wohnen & haushalt': 'Wohnen, Haus & Haushalt',
        'wohnen, haus & haushalt': 'Wohnen, Haus & Haushalt',
        'gesundheit & körper': 'Gesundheit, Körper & Pflege',
        'gesundheit, körper & pflege': 'Gesundheit, Körper & Pflege',
        'natur & umwelt': 'Natur, Umwelt & Tiere',
        'natur, umwelt & tiere': 'Natur, Umwelt & Tiere',
        'reise & verkehr': 'Reise, Verkehr & Mobilität',
        'reise, verkehr & mobilität': 'Reise, Verkehr & Mobilität',
        'essen & trinken': 'Essen, Kochen & Restaurant',
        'essen, kochen & restaurant': 'Essen, Kochen & Restaurant',
        'einkaufen & konsum': 'Einkaufen, Geld & Konsum',
        'einkaufen, geld & konsum': 'Einkaufen, Geld & Konsum',
        'dienstleistungen & behörden': 'Staat, Gesellschaft & Dokumente',
        'staat, gesellschaft & dokumente': 'Staat, Gesellschaft & Dokumente',
        'ausbildung & lernen': 'Ausbildung, Schule & Studium',
        'ausbildung, schule & studium': 'Ausbildung, Schule & Studium',
        'arbeit & beruf': 'Arbeit, Beruf & Karriere',
        'arbeit, beruf & karriere': 'Arbeit, Beruf & Karriere',
        'freizeit & unterhaltung': 'Freizeit, Hobbys & Unterhaltung',
        'freizeit, hobbys & unterhaltung': 'Freizeit, Hobbys & Unterhaltung',
        'medien, technik & digitales': 'Kommunikation, Medien & Sprache',
        'kommunikation, medien & sprache': 'Kommunikation, Medien & Sprache',
        'gesellschaft, recht & staat': 'Staat, Gesellschaft & Dokumente',
        'allgemeine aktivitäten & verben': 'Allgemeine Aktivitäten & Verben',
        'eigenschaften & adjektive': 'Eigenschaften & Adjektive',
        'basiswortschatz & floskeln': 'Basiswortschatz & Floskeln'
    }
    
    mapped_cat = t_mapping.get(t)
    if mapped_cat:
        return mapped_cat

    # 4. Falling back to Word Class
    if 'verb' in wc:
        return 'Allgemeine Aktivitäten & Verben'
    if 'adjektiv' in wc or 'adj' in wc or 'adjective' in wc:
        return 'Eigenschaften & Adjektive'

    return 'Basiswortschatz & Floskeln'


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
        print(f"  - {cat}: {counts.get(cat, 0)} words")
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
