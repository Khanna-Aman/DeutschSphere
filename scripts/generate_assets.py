import os
import json
import re
import requests

import sys

# Determine workspace paths relative to script location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Get target level from command line arguments (default to 'a2')
LEVEL = "a2"
if len(sys.argv) > 1:
    arg = sys.argv[1].lower().strip()
    if arg in ["a1", "a2", "b1"]:
        LEVEL = arg
    else:
        print(f"Warning: Unknown level '{arg}'. Defaulting to 'a2'.")

BASE_DIR = os.path.join(PROJECT_ROOT, LEVEL)
JSON_PATH = os.path.join(BASE_DIR, "wordlist.json")
IMAGES_DIR = os.path.join(BASE_DIR, "images")
CACHE_DIR = os.path.join(PROJECT_ROOT, "twemoji_cache")  # Unified cache at project root level

# Create directories
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

# DIRECT_WORD_MAP: exact German word → Twemoji codepoint mapping.
# Highest priority in map_word_to_codepoint(). Hand-curated per word.
# Key: german word (lowercase), Value: twemoji hex codepoint
# This is populated by level-specific mapping files imported below.
DIRECT_WORD_MAP = {}

# Import level-specific word maps if they exist
import importlib
for _map_module in ['word_map_a1', 'word_map_a2', 'word_map_b1']:
    try:
        _mod = importlib.import_module(_map_module)
        if hasattr(_mod, 'WORD_MAP'):
            DIRECT_WORD_MAP.update(_mod.WORD_MAP)
            print(f"  Loaded {len(_mod.WORD_MAP)} entries from {_map_module}")
    except (ImportError, SyntaxError):
        pass  # Level map file doesn't exist yet or is still being written

# Mapping database: (List of English keywords, List of German keywords, Twemoji hex codepoint)
# Emojis are selected specifically for Goethe-Institut/CEFR A2 curriculum themes
MAPPING_RULES = [
    # 1. Occupations & Roles (More specific & inclusive A2)
    (['teacher', 'professor', 'schoolmaster', 'instructor', 'lecture'], ['lehrer', 'lehrerin', 'unterricht', 'schule', 'klasse'], '1f468-200d-1f3eb'),
    (['doctor', 'physician', 'medical'], ['arzt', 'ärztin', 'medizin', 'doktor', 'doktorin'], '1f468-200d-2695-fe0f'),
    (['nurse'], ['krankenpfleger', 'krankenschwester'], '1f469-200d-2695-fe0f'),
    (['baker', 'bakery', 'bread', 'roll'], ['bäcker', 'bäckerin', 'brot', 'brötchen', 'backen'], '1f35e'),
    (['chef', 'cook'], ['koch', 'köchin', 'kochen'], '1f468-200d-1f373'),
    (['waiter', 'waitress', 'restaurant'], ['kellner', 'kellnerin', 'restaurant', 'café'], '1f37d-fe0f'),
    (['bus driver', 'taxi driver', 'chauffeur'], ['busfahrer', 'taxifahrer'], '1f68c'),
    (['driver', 'taxi', 'chauffeur'], ['fahrer', 'fahrerin'], '1f697'),
    (['police', 'officer', 'cop'], ['polizist', 'polizistin', 'polizei'], '1f46e'),
    (['apprentice', 'trainee'], ['auszubildende', 'auszubildender', 'lehre'], '1f393'),
    (['author', 'writer', 'book', 'dictionary'], ['autor', 'autorin', 'buch', 'bücher', 'wörterbuch', 'schreiben'], '1f4d6'),
    (['artist', 'painter', 'painting'], ['künstler', 'künstlerin', 'malen', 'bild', 'zeichnung'], '1f3a8'),
    (['hairdresser', 'barber'], ['friseur', 'friseurin', 'haare', 'frisur'], '1f487'),
    (['craftsman', 'tradesman', 'worker'], ['handwerker', 'handwerkerin', 'werkstatt'], '1f6e0-fe0f'),
    (['journalist', 'reporter', 'news'], ['journalist', 'journalistin', 'zeitung', 'presse', 'bericht'], '1f4f0'),
    (['businessman', 'merchant', 'store', 'shop'], ['kaufmann', 'kauffrau', 'verkauf', 'geschäft', 'laden'], '1f468-200d-1f4bc'),
    (['mechanic'], ['mechaniker', 'mechanikerin', 'reparatur', 'reifen'], '1f468-200d-1f527'),
    (['model'], ['model', 'mode', 'kleidung'], '1f483'),
    (['musician', 'singer', 'music', 'band', 'song', 'sing'], ['musiker', 'musikerin', 'musik', 'singen', 'lied', 'konzert', 'instrument', 'gesang'], '1f468-200d-1f3a4'),
    (['babysitter', 'nanny'], ['babysitter', 'babysitterin', 'kinderbetreuung'], '1f9d1-200d-1f37c'),
    (['employee', 'clerk', 'worker', 'job', 'boss', 'firm', 'office'], ['angestellte', 'angestellter', 'beruf', 'arbeit', 'stelle', 'chef', 'firma', 'büro'], '1f4bc'),

    # 2. Travel, Vehicles & Transport
    (['train', 'rail', 'railway', 'ice'], ['zug', 'bahn', 'bahnhof', 'gleis', 'ice', 's-bahn', 'u-bahn'], '1f686'),
    (['truck', 'lorry', 'lkw'], ['lkw', 'lastwagen', 'transporter'], '1f69a'),
    (['bus', 'coach'], ['bus', 'haltestelle', 'omnibus'], '1f68c'),
    (['car', 'auto', 'vehicle'], ['auto', 'pkw', 'wagen', 'fahrzeug'], '1f697'),
    (['airplane', 'plane', 'flight', 'airport'], ['flugzeug', 'fliegen', 'flughafen', 'flug'], '2708-fe0f'),
    (['bicycle', 'bike', 'cycle'], ['fahrrad', 'rad', 'radfahren', 'fahrradweg'], '1f6b2'),
    (['ship', 'boat', 'vessel', 'ferry'], ['schiff', 'boot', 'fähre', 'dampfer'], '1f6a2'),
    (['ticket', 'fare', 'pass'], ['ticket', 'fahrkarte', 'karte', 'eintrittskarte'], '1f3ab'),
    (['baggage', 'luggage', 'suitcase', 'bag'], ['gepäck', 'koffer', 'tasche', 'rucksack'], '1f9f3'),
    (['travel', 'trip', 'journey', 'holiday', 'vacation'], ['reisen', 'reise', 'urlaub', 'ferien', 'ausflug'], '1f9f3'),
    (['hotel', 'hostel', 'accommodation'], ['hotel', 'pension', 'unterkunft', 'jugendherberge'], '1f3e8'),
    (['station', 'stop', 'destination'], ['bahnhof', 'station', 'haltestelle', 'ziel'], '1f689'),
    (['passport', 'visa', 'id'], ['pass', 'ausweis', 'reisepass'], '1f4d4'),
    (['map', 'world map'], ['karte', 'landkarte', 'stadtplan'], '1f5fa-fe0f'),
    (['compass'], ['kompass'], '1f9ed'),

    # 3. Health & Body
    (['health', 'healthy', 'sick', 'ill', 'disease', 'fever', 'pain'], ['gesund', 'gesundheit', 'krank', 'krankheit', 'fieber', 'schmerz', 'weh'], '2764-fe0f'),
    (['hospital', 'clinic', 'practice'], ['krankenhaus', 'klinik', 'praxis', 'apotheke'], '1f3e5'),
    (['medicine', 'pill', 'drug', 'tablet'], ['medikament', 'tablette', 'pille', 'tropfen'], '1f48a'),
    (['accident', 'injury', 'wound'], ['unfall', 'verletzung', 'wunde'], '1f691'),
    (['body', 'leg', 'arm', 'hand', 'foot', 'head', 'eye', 'ear', 'mouth', 'hair', 'finger', 'back'], 
     ['körper', 'bein', 'arm', 'hand', 'fuß', 'kopf', 'auge', 'ohr', 'mund', 'haar', 'finger', 'rücken'], '1f9cd'),
    (['heart'], ['herz'], '2764-fe0f'),

    # 4. Media, Technology & Communication
    (['computer', 'pc', 'laptop', 'monitor'], ['pc', 'computer', 'laptop', 'rechner', 'bildschirm'], '1f4bb'),
    (['telephone', 'phone', 'smartphone', 'mobile'], ['telefon', 'handy', 'smartphone', 'anruf'], '1f4f1'),
    (['sms'], ['sms'], '1f4f2'),
    (['message', 'text'], ['message', 'text'], '1f4ac'),
    (['letter'], ['brief'], '2709-fe0f'),
    (['internet', 'online', 'web', 'website'], ['internet', 'online', 'website', 'netz', 'netzwerk'], '1f310'),
    (['email', 'mail'], ['email', 'e-mail', 'post'], '1f4e7'),
    (['television', 'tv', 'broadcast'], ['fernseher', 'fernsehen', 'tv', 'sendung'], '1f4fa'),
    (['radio'], ['radio', 'rundfunk', 'empfänger'], '1f4fb'),
    (['camera', 'photo', 'picture', 'photography'], ['kamera', 'foto', 'bild', 'fotografie'], '1f4f7'),
    (['video', 'film', 'movie'], ['video', 'film'], '1f3a5'),

    # 5. Shopping, Clothes & Money
    (['shop', 'store', 'supermarket', 'market'], ['geschäft', 'laden', 'kaufhaus', 'supermarkt', 'markt'], '1f3ea'),
    (['shopping', 'buy', 'purchase'], ['einkaufen', 'kaufen', 'einkauf', 'anschaffen'], '1f6d2'),
    (['money', 'cash', 'coin', 'banknote', 'euro'], ['geld', 'bargeld', 'münze', 'scheine', 'euro'], '1f4b6'),
    (['price', 'cost', 'expensive', 'cheap', 'discount'], ['preis', 'kosten', 'teuer', 'billig', 'günstig', 'rabatt'], '1f3f7-fe0f'),
    (['bill', 'receipt', 'invoice'], ['rechnung', 'quittung', 'kassenzettel'], '1f4c3'),
    (['credit card', 'card', 'bank card'], ['kreditkarte', 'karte', 'bankkarte'], '1f4b3'),
    (['bank'], ['bank', 'sparkasse'], '1f3e6'),
    (['clothing', 'clothes', 'suit', 'pullover', 't-shirt'], ['kleidung', 'kleider', 'anzug', 'pullover', 't-shirt'], '1f45a'),
    (['pants', 'trousers', 'jeans'], ['hose', 'jeans'], '1f456'),
    (['dress', 'skirt'], ['kleid', 'rock'], '1f457'),
    (['coat', 'jacket'], ['mantel', 'jacke'], '1f9e5'),
    (['shoes', 'shoe', 'boots'], ['schuh', 'schuhe', 'stiefel'], '1f45f'),
    (['hat', 'cap'], ['hut', 'mütze', 'kappe'], '1f9e2'),
    (['bag', 'handbag'], ['tasche', 'handtasche'], '1f45c'),
    (['glasses', 'spectacles'], ['brille'], '1f453'),

    # 6. Everyday Nouns / Objects / Furniture
    (['house', 'home', 'apartment', 'flat'], ['haus', 'wohnung', 'heim', 'gebäude'], '1f3e0'),
    (['room', 'chamber'], ['zimmer', 'raum', 'saal'], '1f6cf-fe0f'),
    (['door'], ['tür', 'eingang', 'ausgang'], '1f6aa'),
    (['window'], ['fenster'], '1fa9f'),
    (['table', 'desk'], ['tisch', 'schreibtisch'], '1fa91'),
    (['chair', 'seat', 'bench'], ['stuhl', 'sitz', 'bank', 'sessel'], '1fa91'),
    (['bed', 'sleep'], ['bett', 'schlafen', 'kissen'], '1f6cf-fe0f'),
    (['light', 'lamp', 'bulb'], ['licht', 'lampe', 'leuchte'], '1f4a1'),
    (['key'], ['schlüssel'], '1f511'),
    (['clock', 'watch', 'time', 'hour', 'minute', 'second'], ['uhr', 'uhrzeit', 'zeit', 'stunde', 'minute', 'sekunde'], '1f551'),
    (['calendar', 'date', 'year', 'month', 'week', 'day', 'schedule'], ['kalender', 'datum', 'jahr', 'monat', 'woche', 'tag', 'termin'], '1f4c5'),
    (['paper', 'document', 'form', 'contract'], ['papier', 'dokument', 'formular', 'zettel', 'vertrag'], '1f4c4'),
    (['pen', 'pencil', 'marker'], ['stift', 'bleistift', 'kugelschreiber', 'schreiben'], '270f-fe0f'),
    (['sofa', 'couch'], ['sofa', 'couch'], '1f6cb-fe0f'),
    (['box', 'suitcase', 'package'], ['kiste', 'schachtel', 'paket'], '1f4e6'),
    (['key', 'lock'], ['schloss'], '1f512'),
    (['mirror'], ['spiegel'], '1fa9e'),
    (['shower', 'bathtub'], ['dusche', 'badewanne'], '1f6bf'),

    # 7. Food & Drink
    (['food', 'meal', 'eat', 'dinner', 'breakfast', 'lunch'], ['essen', 'mahlzeit', 'speise', 'frühstück', 'mittagessen', 'abendessen'], '1f37d-fe0f'),
    (['beer'], ['bier'], '1f37a'),
    (['wine'], ['wein'], '1f377'),
    (['water', 'mineral water'], ['wasser', 'mineralwasser'], '1f4a7'),
    (['milk'], ['milch'], '1f95b'),
    (['coffee'], ['kaffee'], '2615'),
    (['tea'], ['tee'], '1f375'),
    (['juice'], ['saft'], '1f9c3'),
    (['drink', 'beverage', 'cup', 'glass'], ['trinken', 'getränk', 'tasse', 'glas'], '1f964'),
    (['bread', 'bakery', 'roll'], ['brot', 'brötchen', 'bäckerei'], '1f35e'),
    (['cake', 'pie', 'sweet'], ['kuchen', 'torte', 'gebäck'], '1f370'),
    (['chocolate'], ['schokolade'], '1f36b'),
    (['ice cream', 'ice'], ['eis', 'speiseeis'], '1f366'),
    (['pizza'], ['pizza'], '1f355'),
    (['cheese'], ['käse'], '1f9c0'),
    (['egg', 'eggs'], ['ei', 'eier'], '1f95a'),
    (['potato', 'potatoes'], ['kartoffel', 'kartoffeln'], '1f954'),
    (['vegetable', 'tomato', 'salad', 'carrot', 'onion'], ['gemüse', 'tomate', 'salat', 'karotte', 'zwiebel'], '1f955'),
    (['fruit', 'apple', 'banana', 'orange', 'strawberry', 'lemon'], ['obst', 'frucht', 'apfel', 'banane', 'erdbeere', 'zitrone'], '1f34e'),
    (['meat', 'fish', 'chicken', 'sausage', 'pork', 'beef'], ['fleisch', 'fisch', 'hähnchen', 'wurst', 'schwein', 'rind'], '1f969'),
    (['soup'], ['suppe'], '1f35c'),
    (['rice'], ['reis'], '1f35a'),
    (['butter'], ['butter'], '1f9c8'),

    # 8. Weather & Nature
    (['weather'], ['wetter'], '1f324-fe0f'),
    (['sun', 'sunny', 'hot', 'summer', 'warm'], ['sonne', 'sonnig', 'heiß', 'sommer', 'warm'], '2600-fe0f'),
    (['rain', 'rainy', 'wet', 'umbrella'], ['regen', 'regnerisch', 'nass', 'regenschirm'], '1f327-fe0f'),
    (['snow', 'snowy', 'cold', 'winter', 'ice'], ['schnee', 'kalt', 'winter', 'eis'], '2744-fe0f'),
    (['wind', 'windy', 'storm', 'breeze'], ['wind', 'windig', 'sturm', 'brise'], '1f4a8'),
    (['cloud', 'cloudy', 'fog', 'foggy'], ['wolke', 'bewölkt', 'nebel', 'neblig'], '2601-fe0f'),
    (['tree', 'forest', 'wood'], ['baum', 'wald', 'bäume'], '1f333'),
    (['flower', 'plant', 'garden'], ['blume', 'pflanze', 'garten', 'blumen'], '1f338'),
    (['star'], ['stern'], '2b50'),
    (['moon'], ['mond'], '1f319'),
    (['stone', 'rock'], ['stein'], '1faa8'),
    (['fire'], ['feuer'], '1f525'),

    # 9. Animals
    (['dog', 'puppy'], ['hund', 'hunde'], '1f415'),
    (['cat', 'kitten'], ['katze', 'katzen'], '1f408'),
    (['bird'], ['vogel', 'vögel'], '1f426'),
    (['horse'], ['pferd', 'pferde'], '1f40e'),
    (['cow'], ['kuh', 'kühe'], '1f404'),
    (['sheep'], ['schaf', 'schafe'], '1f411'),
    (['pig'], ['schwein', 'schweine'], '1f416'),
    (['animal', 'pet'], ['tier', 'tiere'], '1f436'),

    # 10. Family & Relationships
    (['mother', 'mom'], ['mutter', 'mama'], '1f469'),
    (['father', 'dad'], ['vater', 'papa'], '1f468'),
    (['brother'], ['bruder'], '1f466'),
    (['sister'], ['schwester'], '1f467'),
    (['son'], ['sohn'], '1f466'),
    (['daughter'], ['tochter'], '1f467'),
    (['child', 'children', 'kid'], ['kind', 'kinder'], '1f9d2'),
    (['baby'], ['baby'], '1f476'),
    (['grandfather', 'grandpa', 'grandparents'], ['großeltern', 'großvater', 'opa'], '1f474'),
    (['grandmother', 'grandma'], ['großmutter', 'oma'], '1f475'),
    (['family', 'parents'], ['familie', 'eltern'], '1f46a'),
    (['friend', 'partner', 'colleague'], ['freund', 'freundin', 'partner', 'partnerin', 'kollege', 'kollegin'], '1f91d'),
    (['man', 'husband'], ['mann', 'ehemann'], '1f468'),
    (['woman', 'wife'], ['frau', 'ehefrau'], '1f469'),
    (['cousin', 'relative'], ['cousin', 'cousine', 'verwandte', 'bekannte', 'geschwister', 'siblings'], '1f46a'),
    (['uncle'], ['onkel'], '1f468'),
    (['aunt'], ['tante'], '1f469'),
    (['single', 'unmarried'], ['ledig'], '1f9d1'),
    (['married'], ['verheiratet'], '1f492'),
    (['separated', 'divorced'], ['getrennt', 'geschieden'], '1f494'),

    # 11. Colors (Descriptive color representations)
    (['blue'], ['blau'], '1f535'),
    (['brown'], ['braun'], '1f7e4'),
    (['yellow'], ['gelb'], '1f7e1'),
    (['green'], ['grün'], '1f7e2'),
    (['purple', 'violet'], ['lila', 'violett'], '1f7e3'),
    (['orange'], ['orange'], '1f7e0'),
    (['red'], ['rot'], '1f534'),
    (['white'], ['weiß'], '26aa'),
    (['black'], ['schwarz'], '26ab'),
    (['gray', 'grey'], ['grau'], '26ab'),
    (['pink'], ['rosa'], '1f380'),

    # 12. Seasons, Months & Celebrations
    (['easter'], ['ostern'], '1f407'),
    (['christmas'], ['weihnachten'], '1f384'),
    (['carnival'], ['karneval'], '1f389'),
    (['january', 'winter'], ['januar'], '2744-fe0f'),
    (['february'], ['februar'], '1f496'),
    (['march', 'spring'], ['märz'], '1f340'),
    (['april'], ['april'], '1f331'),
    (['may'], ['mai'], '1f33f'),
    (['june', 'summer'], ['juni'], '1f31e'),
    (['july'], ['juli'], '1f3d6-fe0f'),
    (['august'], ['august'], '1f349'),
    (['september', 'autumn'], ['september'], '1f342'),
    (['october'], ['oktober'], '1f383'),
    (['november'], ['november'], '1f341'),
    (['december'], ['dezember'], '1f384'),

    # 13. Time, Numbers & Quantitative (Descriptive Keycaps/Icons)
    (['morning'], ['morgen', 'morgens'], '1f305'),
    (['afternoon'], ['nachmittag', 'nachmittags'], '1f31e'),
    (['evening'], ['abend', 'abends'], '1f307'),
    (['night'], ['nacht', 'nachts'], '1f303'),
    (['midday', 'noon'], ['mittag', 'mittags'], '1f31e'),
    (['past', 'after'], ['nach'], '27a1-fe0f'),
    (['before'], ['vor'], '2b05-fe0f'),
    (['zero'], ['null'], '30-20e3'),
    (['one'], ['eins'], '31-20e3'),
    (['two'], ['zwei'], '32-20e3'),
    (['three'], ['drei'], '33-20e3'),
    (['four'], ['vier'], '34-20e3'),
    (['five'], ['fünf'], '35-20e3'),
    (['six'], ['sechs'], '36-20e3'),
    (['seven'], ['sieben'], '37-20e3'),
    (['eight'], ['acht'], '38-20e3'),
    (['nine'], ['neun'], '39-20e3'),
    (['ten'], ['zehn'], '1f51f'),
    (['eleven'], ['elf'], '1f522'),
    (['twelve'], ['zwölf'], '1f522'),
    (['twenty'], ['zwanzig'], '1f522'),
    (['sixty'], ['sechzig'], '1f522'),
    (['million'], ['million'], '1f4b5'),
    (['hundred'], ['hundert'], '1f4af'),
    (['thousand'], ['tausend'], '1f522'),
    (['first', 'firstly'], ['erste', 'erstens'], '1f947'),
    (['second', 'secondly'], ['zweite', 'zweitens'], '1f948'),
    (['third', 'thirdly'], ['dritte', 'drittens'], '1f949'),
    (['once'], ['einmal'], '0031-fe0f-20e3'),
    (['pick up'], ['abholen'], '1f699'),
    (['idea', 'clue'], ['ahnung'], '1f4a1'),
    (['active'], ['aktiv'], '1f3c3'),
    (['alone'], ['allein'], '1f9d1'),
    (['old', 'age'], ['alt', 'alter'], '1f474'),
    (['offer'], ['anbieten'], '1f381'),
    (['change'], ['ändern'], '1f504'),
    (['fear'], ['angst'], '1f628'),
    (['arrive'], ['ankommen'], '1f6eb'),
    (['turn on'], ['anmachen'], '1f4a1'),
    (['register', 'sign up'], ['anmelden', 'anmeldung'], '1f4dd'),
    (['connection'], ['anschluss'], '1f517'),
    (['device'], ['apparat'], '1f4f1'),
    (['tidy up'], ['aufräumen'], '1f9f9'),
    (['get up', 'stand up'], ['aufstehen'], '1f9cd'),
    (['fill out', 'fill in'], ['ausfüllen'], '1f4dd'),
    (['turn off'], ['ausmachen'], '1f4f4'),
    (['unpack'], ['auspacken'], '1f4e6'),
    (['rest', 'relax'], ['ausruhen'], '1f6cb-fe0f'),
    (['exhibition'], ['ausstellung'], '1f3db-fe0f'),
    (['deliver'], ['austragen'], '1f4eb'),
    (['basketball'], ['basketball'], '1f3c0'),
    (['ball'], ['ball'], '26bd'),
    (['craft'], ['basteln'], '2702-fe0f'),
    (['build'], ['bauen'], '1f3d7-fe0f'),
    (['thank'], ['bedanken'], '1f91d'),
    (['hurry'], ['beeilen'], '1f3c3'),
    (['stay', 'remain'], ['bleiben'], '1f3e0'),
    (['known', 'famous'], ['bekannt', 'berühmt'], '1f31f'),
    (['use'], ['benutzen'], '1f6e0-fe0f'),
    (['advise'], ['beraten'], '1f468-200d-1f3eb'),
    (['mountain'], ['berg'], '26f0-fe0f'),
    (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'], '1f4c5'),

    # 14. Action Verbs & Operations
    (['speak', 'say', 'talk', 'conversation', 'discuss'], ['sprechen', 'sagen', 'reden', 'gespräch', 'diskutieren'], '1f5e3-fe0f'),
    (['write', 'type'], ['schreiben', 'tippen'], '270f-fe0f'),
    (['read', 'study'], ['lesen', 'vorlesen'], '1f4d6'),
    (['listen', 'hear', 'sound'], ['hören', 'anhören', 'geräusch'], '1f3a7'),
    (['see', 'look', 'watch', 'gaze'], ['sehen', 'schauen', 'ansehen', 'blicken'], '1f441-fe0f'),
    (['learn', 'study', 'course', 'class', 'exam', 'test'], ['lernen', 'studieren', 'kurs', 'klasse', 'unterricht', 'prüfung', 'test'], '1f393'),
    (['play', 'game', 'toy'], ['spielen', 'spiel', 'spielzeug'], '1f3ae'),
    (['work', 'operate', 'run'], ['arbeiten', 'bedienen', 'laufen'], '1f4bc'),
    (['help', 'assist', 'support', 'rescue'], ['helfen', 'hilfe', 'unterstützen', 'retten'], '1f91d'),
    (['ask', 'question', 'inquiry'], ['fragen', 'frage'], '2753'),
    (['answer', 'reply', 'solution'], ['antworten', 'antwort', 'lösung'], '1f5e3-fe0f'),
    (['search', 'find', 'seek'], ['suchen', 'finden'], '1f50d'),
    (['start', 'begin', 'open'], ['anfangen', 'beginnen', 'öffnen', 'starten'], '1f3c1'),
    (['stop', 'end', 'close'], ['aufhören', 'enden', 'schließen', 'stoppen'], '26d4'),
    (['go', 'walk', 'run', 'hike'], ['gehen', 'laufen', 'wandern', 'schreiten'], '1f463'),

    # 15. Feelings & Evaluatives
    (['happy', 'joy', 'smile', 'laugh', 'friendly'], ['glücklich', 'froh', 'lachen', 'freundlich'], '1f60a'),
    (['sad', 'unhappy', 'cry', 'sorrow'], ['traurig', 'weinen', 'kummer'], '1f641'),
    (['angry', 'mad', 'furious'], ['ärgerlich', 'wütend', 'zornig'], '1f620'),
    (['love', 'like', 'favorite', 'heart'], ['lieben', 'gern', 'lieblings-', 'herz'], '2764-fe0f'),
    (['good', 'nice', 'beautiful', 'wonderful', 'perfect'], ['gut', 'schön', 'nett', 'wunderbar', 'perfekt'], '1f44d'),
    (['bad', 'ugly', 'awful'], ['schlecht', 'hässlich', 'furchtbar'], '1f44e'),
    (['big', 'large', 'tall', 'huge'], ['groß', 'riesig'], '1f418'),
    (['small', 'little', 'short', 'tiny'], ['klein', 'winzig'], '1f401'),
]

def matches_keyword(kw, text, is_german=False):
    # Clean text and keyword
    kw = kw.lower().strip()
    text = text.lower().strip()
    
    # Strip "to " for English
    if not is_german:
        if kw.startswith("to "):
            kw = kw[3:].strip()
        if text.startswith("to "):
            text = text[3:].strip()
    
    # Direct match
    if kw == text:
        return True
        
    # Regex match with boundary and optional inflections
    if is_german:
        # German inflections
        # If keyword ends in 'en' (like verbs 'lernen', 'studieren')
        if kw.endswith('en') and len(kw) > 4:
            stem = kw[:-2]
            pattern = r'\b' + re.escape(stem) + r'(?:en|t|st|e|te|ten|tet|ung|ungen)?\b'
        elif kw.endswith('e') and len(kw) > 3:
            stem = kw[:-1]
            pattern = r'\b' + re.escape(stem) + r'(?:e|en|er|es|em|el|eln)?\b'
        else:
            pattern = r'\b' + re.escape(kw) + r'(?:in|innen|en|n|t|st|e|er|es|s)?\b'
    else:
        # English inflections
        if kw.endswith('y') and len(kw) > 3:
            stem = kw[:-1]
            pattern = r'\b' + re.escape(stem) + r'(?:y|ies|ied|ying|ier|iest)?\b'
        elif kw.endswith('e') and len(kw) > 3:
            stem = kw[:-1]
            pattern = r'\b' + re.escape(stem) + r'(?:e|es|ed|ing|er|est)?\b'
        else:
            pattern = r'\b' + re.escape(kw) + r'(?:s|es|ed|ing|er|est)?\b'
            
    return bool(re.search(pattern, text))

def map_word_to_codepoint(card):
    """
    Decide which Twemoji hex code to use based on English/German text matching.
    Priority order:
      0. DIRECT_WORD_MAP — exact per-word mapping (highest priority, hand-curated)
      1. MAPPING_RULES keyword match (word boundary)
      2. MAPPING_RULES substring match (>=4 chars)
      3. Returns None if no match found (strict policy — no random fallbacks)
    """
    english_lower = card.get('english', '').lower().strip()
    german_lower = card.get('german', '').lower().strip()

    # 0. Direct word map — highest priority, exact German word lookup
    if german_lower in DIRECT_WORD_MAP:
        return DIRECT_WORD_MAP[german_lower]

    # 1. Try keyword rules with enhanced flexible matching
    for eng_kws, ger_kws, codepoint in MAPPING_RULES:
        for kw in eng_kws:
            if matches_keyword(kw, english_lower, is_german=False):
                return codepoint
        for kw in ger_kws:
            if matches_keyword(kw, german_lower, is_german=True):
                return codepoint

    # 2. Try substring matching (longer keywords only) if word-boundary failed
    for eng_kws, ger_kws, codepoint in MAPPING_RULES:
        for kw in eng_kws:
            if len(kw) >= 4 and kw in english_lower:
                return codepoint
        for kw in ger_kws:
            if len(kw) >= 4 and kw in german_lower:
                return codepoint

    # 3. No match — return None (strict policy, no random fallbacks)
    return None

def get_twemoji_svg(codepoint):
    """
    Download raw Twemoji SVG from jsDelivr CDN and cache it locally.
    Supports defensive fallback trying both variant selector included and excluded code points.
    """
    cache_path = os.path.join(CACHE_DIR, f"{codepoint}.svg")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            return f.read()

    # Try standard codepoint download
    url = f"https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/{codepoint}.svg"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            svg_content = response.text
            with open(cache_path, "w", encoding="utf-8") as f:
                f.write(svg_content)
            return svg_content
        
        # If standard 404s, try stripping variant selector suffix '-fe0f'
        if "-fe0f" in codepoint:
            stripped = codepoint.replace("-fe0f", "")
            print(f"Fallback check: Retrying stripped codepoint '{stripped}'...")
            url_alt = f"https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/{stripped}.svg"
            response_alt = requests.get(url_alt, timeout=10)
            if response_alt.status_code == 200:
                svg_content = response_alt.text
                with open(cache_path, "w", encoding="utf-8") as f:
                    f.write(svg_content)
                return svg_content

        print(f"Warning: Failed to download codepoint '{codepoint}' (status {response.status_code}). Using package fallback.")
        return None
    except Exception as e:
        print(f"Warning: Connection error downloading codepoint '{codepoint}': {e}. Using fallback.")
        return None

def extract_svg_paths(svg_content):
    """
    Extract only the inner elements (paths, circles, polygons, etc.) from a raw Twemoji SVG.
    """
    first_gt = svg_content.find('>')
    last_lt = svg_content.rfind('</svg>')
    if first_gt != -1 and last_lt != -1:
        return svg_content[first_gt + 1:last_lt].strip()
    return ""

def generate_wrapped_svg(inner_paths):
    """
    Constructs a styled SVG template centered at 200x200 canvas.
    Scales the Twemoji native viewBox="0 0 36 36" content to fit a 140x140 area
    with a 30px safety padding margin around all sides.
    """
    custom_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <!-- Scaled and centered Twemoji flat illustration vector -->
  <g transform="translate(30, 30) scale(3.8888)">
    {inner_paths}
  </g>
</svg>"""
    return custom_svg

def run():
    print(f"Loading wordlist from {JSON_PATH}...")
    if not os.path.exists(JSON_PATH):
        print(f"Error: {JSON_PATH} not found!")
        return

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Processing {len(data)} items...")
    
    # Process cards
    successful_count = 0
    mapping_summary = {}

    for index, item in enumerate(data):
        card_id = item.get("id", index + 1)
        german_word = (item.get("german") or item.get("word") or "Unbekannt").strip()
        english_meaning = (item.get("english") or item.get("english_translation") or "No translation").strip()
        theme = (item.get("theme") or item.get("category") or "Default").strip()

        # Map to Twemoji codepoint
        card_details = {
            'german': german_word,
            'english': english_meaning,
            'theme': theme,
            'word_class': item.get("word_class", "")
        }
        codepoint = map_word_to_codepoint(card_details)

        output_filename = f"card_{card_id}.svg"
        output_path = os.path.join(IMAGES_DIR, output_filename)

        if codepoint:
            # Download or load icon
            svg_content = get_twemoji_svg(codepoint)
            if not svg_content:
                # If download failed, map to null and delete file if it exists
                item["image"] = None
                if os.path.exists(output_path):
                    try:
                        os.remove(output_path)
                    except Exception as e:
                        print(f"Error removing {output_path}: {e}")
                continue

            inner_paths = extract_svg_paths(svg_content)
            wrapped_svg = generate_wrapped_svg(inner_paths)

            with open(output_path, "w", encoding="utf-8") as f:
                f.write(wrapped_svg)

            successful_count += 1
            mapping_summary[codepoint] = mapping_summary.get(codepoint, 0) + 1
            item["image"] = f"images/{output_filename}"
        else:
            # Unmatched card: map to null and remove existing SVG if present
            item["image"] = None
            if os.path.exists(output_path):
                try:
                    os.remove(output_path)
                except Exception as e:
                    print(f"Error removing {output_path}: {e}")

        # Periodic log progress (every 100 cards)
        if (index + 1) % 100 == 0 or (index + 1) == len(data):
            print(f"Progress: Processed {index + 1}/{len(data)} items...")

    # Write updated list back to wordlist.json
    print(f"Writing updated wordlist back to {JSON_PATH}...")
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print("\nBatch generation complete!")
    print(f"Successfully generated {successful_count}/{len(data)} Twemoji visual assets in '{IMAGES_DIR}'.")
    print(f"Cleaned up and mapped {len(data) - successful_count} cards to null (text-only mode).")
    print("\nEmoji distribution summary (Top 15 codepoints):")
    for cp, count in sorted(mapping_summary.items(), key=lambda x: x[1], reverse=True)[:15]:
        print(f"  - {cp}: {count} cards")
    if len(mapping_summary) > 15:
        print(f"  - ... and {len(mapping_summary) - 15} more unique codepoints")

if __name__ == "__main__":
    run()
