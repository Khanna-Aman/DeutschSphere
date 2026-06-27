// js/search.js — Full-text search tokenization, regex indexing, and categorical taxonomies
import {
  state,
  elements,
  categoryTranslations,
  getSRSInfo,
  sortDeckBySRS,
  shuffleArray
} from './state.js';
import { renderCard } from './flashcards.js';
import { closeMobileSidebar } from './router.js';

// Module-level static collections
const canonicalCategories = [
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
];

// Strict grammatical structures list
const grammarExactDe = new Set([
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mein', 'dein', 'sein', 'unser', 'euer', 'ihre', 'ihrer', 'ihres',
  'in', 'an', 'auf', 'bei', 'mit', 'zu', 'von', 'nach', 'aus', 'für', 'fuer', 'gegen', 'ohne', 'um', 'durch', 'über', 'ueber', 'unter', 'vor', 'hinter', 'neben', 'zwischen',
  'und', 'oder', 'aber', 'weil', 'dass', 'wenn', 'denn', 'als', 'da', 'der', 'die', 'das', 'ein', 'eine', 'einen', 'einem', 'eines', 'einer',
  'welche', 'welcher', 'welches', 'dieser', 'diese', 'dieses', 'wer', 'was', 'wie', 'wo', 'wann', 'warum', 'weshalb', 'deshalb', 'trotzdem', 'obwohl',
  'nicht', 'nichts', 'nur', 'kein', 'keine', 'doch', 'gar', 'etwas', 'jemand', 'niemand', 'man', 'sich', 'mich', 'dich', 'uns', 'euch', 'ihnen', 'ihm', 'ihn'
]);

const numbersExactDe = new Set([
  'null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'fuenf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
  'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig',
  'dreißig', 'dreissig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig', 'hundert', 'tausend', 'million', 'milliarde',
  'erste', 'zweite', 'dritte', 'vierte', 'hälfte', 'haelfte', 'viertel', 'wenig', 'viel', 'mehr', 'manch', 'einige', 'all', 'ganz', 'beide', 'beides'
]);

const timeExactDe = new Set([
  'uhr', 'jahr', 'monat', 'woche', 'tag', 'sekunde', 'minute', 'stunde', 'quartal', 'zeitraum', 'saison', 'dauer',
  'spät', 'spaet', 'früh', 'frueh', 'jetzt', 'dann', 'danach', 'heute', 'gestern', 'morgen', 'bald', 'sofort', 'später', 'spaeter', 'pünktlich', 'puenktlich',
  'immer', 'nie', 'oft', 'selten', 'manchmal', 'damals', 'generation', 'mal', 'einmal', 'zweimal', 'dreimal', 'oftmals', 'stündlich', 'stuendlich',
  'täglich', 'taeglich', 'wöchentlich', 'woechentlich', 'monatlich', 'jährlich', 'jaehrlich', 'frühling', 'sommer', 'herbst', 'winter',
  'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag', 'wochenende',
  'januar', 'februar', 'märz', 'maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember',
  'alltag', 'alltäglich', 'alltaeglich', 'zeit', 'uhrzeit', 'datum', 'kalender'
]);

// Structural lists & stems
const foodDe = ['ess', 'trink', 'küch', 'kuech', 'gemüs', 'gemues', 'obst', 'koch', 'restaur', 'gastro', 'speis', 'mahl', 'bäck', 'baeck', 'bier', 'fleisch', 'fisch', 'banan', 'wein', 'kaff', 'tee', 'supp', 'back', 'frühstück', 'fruehstück', 'salat', 'käse', 'kaese', 'wurst', 'milch', 'kartoffel', 'teller', 'gabel', 'messer', 'löffel', 'loeffel', 'becher', 'tasse', 'glas', 'speisekarte', 'zucker', 'salz', 'pfeffer', 'nudeln', 'reis', 'rind', 'schwein', 'braten'];
const healthDe = ['gesund', 'körper', 'koerper', 'arzt', 'ärzt', 'aerzt', 'krank', 'apotheke', 'fieber', 'bad', 'pflege', 'medizin', 'schmerz', 'unfall', 'klinik', 'spital', 'husten', 'schnupfen', 'tablette', 'rezept', 'therapie', 'verletz', 'blut', 'auge', 'ohr', 'mund', 'zahn', 'kopf', 'bein', 'arm', 'hand', 'fuß', 'fuss', 'bauch', 'herz', 'patient', 'praxis', 'medikament', 'pflaster', 'verband', 'salbe', 'spritze', 'impfung', 'schwanger', 'geburt'];
const travelDe = ['reis', 'verkehr', 'bahn', 'zug', 'bus', 'flug', 'auto', 'fahrrad', 'schiff', 'ticket', 'fahrkart', 'hotel', 'touris', 'pension', 'urlaub', 'gepäck', 'gepaeck', 'koffer', 'bahnhof', 'flughafen', 'abfahrt', 'ankunft', 'stau', 'strass', 'straße', 'kreuzung', 'ampel', 'gleis', 'ausflug', 'landkart', 'plan', 'pass', 'visum', 'strand', 'ferien', 'meer', 'see', 'berge', 'wandern', 'camping', 'zelt', 'buchen', 'reservier', 'abflieg', 'landen', 'verspät', 'verspaet', 'linie', 'haltestell', 'umsteig', 'einsteig', 'aussteig', 'tanken', 'tankstell'];
const shopDe = ['einkauf', 'konsum', 'laden', 'geschäft', 'geschaeft', 'preis', 'bezahl', 'kauf', 'geld', 'euro', 'cent', 'billig', 'teuer', 'kosten', 'rabatt', 'angebot', 'supermarkt', 'markt', 'tasche', 'kleidung', 'kleid', 'hose', 'schuh', 'hemd', 'jacke', 'mantel', 'rock', 'anzug', 'material', 'stoff', 'leder', 'wolle', 'seide', 'baumwolle', 'plastik', 'metall', 'holz', 'glas', 'papier', 'verkäufer', 'verkaeufer', 'kunde', 'kassier', 'kasse', 'tüte', 'tuete', 'quittung', 'garantie', 'umtausch', 'reduzier'];
const workDe = ['arbeit', 'beruf', 'firma', 'job', 'karriere', 'kolleg', 'büro', 'buero', 'bewerb', 'chef', 'angestellt', 'meister', 'werkstatt', 'fabrik', 'gehalt', 'lohn', 'vertrag', 'kündig', 'kuendig', 'streik', 'arbeitsplatz', 'arbeitslos', 'überstunde', 'ueberstunde', 'lebenslauf', 'praktikum', 'leiter', 'direktor', 'kollegen'];
const educationDe = ['schul', 'lern', 'ausbildung', 'stud', 'universität', 'universitaet', 'uni', 'klass', 'unterricht', 'sprache', 'buch', 'bücher', 'buecher', 'bucht', 'bildung', 'lehr', 'schüler', 'schueler', 'prüfung', 'pruefung', 'aufgabe', 'hausaufgabe', 'fehler', 'kurs', 'zeugnis', 'diplom', 'fach', 'mathemat', 'rechn', 'schreib', 'les', 'vokabel', 'wörterbuch', 'woerterbuch', 'lehrerin', 'lektion', 'semester', 'schularbeit', 'student', 'professor', 'zertifikat'];
const homeDe = ['wohn', 'haus', 'zimmer', 'möbel', 'moebel', 'miet', 'einricht', 'haushalt', 'werkzeug', 'architekt', 'gebäude', 'gebaeude', 'tisch', 'stuhl', 'bett', 'schrank', 'regal', 'sofa', 'lampe', 'tür', 'tuer', 'fenster', 'schlüssel', 'schluessel', 'heizung', 'strom', 'wasser', 'nachbar', 'vermiet', 'einzieh', 'auszieg', 'umzieh', 'keller', 'dach', 'wand', 'boden', 'balkon', 'terrasse'];
const natureDe = ['natur', 'umwelt', 'wetter', 'klima', 'tier', 'pflanze', 'sauber', 'erde', 'garten', 'landschaft', 'wind', 'regen', 'schnee', 'sonne', 'temperatur', 'grad', 'himmel', 'stern', 'mond', 'wald', 'berg', 'see', 'meer', 'fluss', 'baum', 'blume', 'katze', 'hund', 'vogel', 'pferd', 'kuh', 'sauberkeit', 'schmutz', 'müll', 'muell', 'abfall', 'luft', 'umweltschutz', 'recycling', 'hitze', 'kälte', 'kaelte', 'gewitter', 'sturm', 'wolke', 'nebel'];
const leisureDe = ['freizeit', 'unterhalt', 'spiel', 'sport', 'hobby', 'musik', 'film', 'kino', 'museum', 'kunst', 'kultur', 'literatur', 'lesen', 'fest', 'feier', 'geburtstag', 'tanz', 'sing', 'theater', 'konzert', 'ausstellung', 'mal', 'foto', 'kamera', 'fernseher', 'radio', 'schach', 'fussball', 'fußball', 'schwimm', 'wandern', 'sportplatz', 'mannschaft', 'verein', 'turnier', 'gewinn', 'verlier', 'party', 'instrument', 'gitarre', 'klavier', 'fotografier'];
const familyDe = ['person', 'familie', 'freund', 'kind', 'eltern', 'partner', 'beziehung', 'heirat', 'hochzeit', 'mann', 'frau', 'bruder', 'schwe', 'mutter', 'vater', 'sohn', 'tocht', 'onkel', 'tant', 'nich', 'nef', 'großel', 'grossel', 'oma', 'opa', 'enkel', 'baby', 'mensch', 'leute', 'mitglieder', 'geschwister', 'verwandte', 'ehe', 'scheidung', 'alleinerziehend'];
const emotionDe = ['charakter', 'gefühl', 'gefuehl', 'identität', 'identitaet', 'alter', 'aussehen', 'meinung', 'gedanke', 'denk', 'entscheid', 'lieb', 'hass', 'wut', 'angst', 'freud', 'glück', 'glueck', 'trau', 'streit', 'gespräch', 'gespraech', 'diskussion', 'traurig', 'froh', 'wütend', 'wuetend', 'ängstlich', 'aengstlich', 'stolz', 'schüchtern', 'schuechtern', 'höflich', 'hoeflich', 'nett', 'freundlich', 'sympathisch', 'böse', 'boese', 'dumm', 'klug', 'faul', 'fleißig', 'fleissig', 'ehrlich', 'geduldig', 'nervös', 'nervoes', 'zufrieden', 'unzufrieden', 'persönlichkeit', 'persoenlichkeit', 'hoffen', 'glauben', 'fühlen', 'fuehlen', 'weinen', 'lachen', 'lächeln', 'laecheln', 'meinen', 'empfehl'];
const communicationDe = ['kommunikation', 'begrüß', 'begruess', 'sag', 'sprech', 'erzähl', 'erzaehl', 'frag', 'antwort', 'versteh', 'telefon', 'handy', 'computer', 'internet', 'e-mail', 'mail', 'anruf', 'brief', 'paket', 'nachricht', 'neuigkeit', 'mobiltelefon', 'netzwerk', 'smartphone', 'tastatur', 'bildschirm', 'datei', 'daten', 'online', 'web', 'apparat', 'tv', 'radio', 'kamera', 'video', 'cd', 'dvd', 'mp3', 'display', 'kabel', 'taste', 'drucker', 'kopier', 'speicher', 'programm', 'digital', 'techn', 'medien', 'anrufen', 'telefonieren', 'reden', 'diskutieren', 'erklären', 'erklaeren', 'vorlesen', 'buchstabieren', 'post', 'stempel', 'plakat', 'zettel', 'zeitung', 'zeitschrift', 'magazin', 'sender', 'empfänger', 'empfaenger', 'anrede', 'grüßen', 'gruessen', 'danken', 'bitten'];
const documentsDe = ['amt', 'ämter', 'aemter', 'behörde', 'behoerde', 'polizei', 'telekom', 'bank', 'finanz', 'steuer', 'recht', 'politik', 'staat', 'gesellschaft', 'sicherheit', 'notfall', 'notfälle', 'notfaelle', 'feuerwehr', 'rathaus', 'konsulat', 'botschaft', 'ausweis', 'formular', 'unterschrift', 'gebühr', 'gebuehr', 'konto', 'überweisen', 'ueberweisen', 'anwalt', 'gericht', 'gesetz', 'versicherung', 'visum', 'pass', 'zertifikat', 'diplom', 'bestätigung', 'bestaetigung', 'bescheinigung', 'erlaubnis', 'vertrag', 'dokument', 'urkunde', 'antrag', 'anmeldung', 'abmeldung', 'registrier', 'genehmig', 'zoll', 'grenze', 'soldat', 'militär', 'militaer', 'krieg', 'frieden', 'richter', 'staatsanwalt', 'parlament', 'gesetzgeb', 'verfassung', 'partei', 'abgeordnet', 'minister', 'bürger', 'buerger', 'wahl', 'wähler', 'waehler', 'demokratie'];

const foodEn = ['food', 'drink', 'eat', 'cook', 'kitchen', 'vegetable', 'fruit', 'restaurant', 'bakery', 'beer', 'meat', 'fish', 'banana', 'wine', 'coffee', 'tea', 'soup', 'bake', 'breakfast', 'lunch', 'dinner', 'salad', 'cheese', 'sausage', 'milk', 'potato', 'plate', 'fork', 'knife', 'spoon', 'cup', 'glass', 'menu', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'meal', 'pasta', 'rice', 'beef', 'pork', 'chicken', 'bill', 'receipt'];
const healthEn = ['health', 'body', 'doctor', 'ill', 'sick', 'pharmacy', 'fever', 'bath', 'care', 'medicine', 'pain', 'accident', 'clinic', 'hospital', 'cough', 'cold', 'pill', 'prescription', 'recipe', 'therapy', 'injur', 'blood', 'eye', 'ear', 'mouth', 'tooth', 'teeth', 'head', 'leg', 'arm', 'hand', 'foot', 'feet', 'stomach', 'heart', 'patient', 'practice', 'medication', 'plaster', 'bandage', 'ointment', 'injection', 'vaccin', 'pregnant', 'birth', 'die', 'dead', 'death'];
const travelEn = ['travel', 'traffic', 'train', 'bus', 'flight', 'fly', 'car', 'bicycle', 'bike', 'ship', 'boat', 'ticket', 'hotel', 'touris', 'pension', 'holiday', 'vacation', 'luggage', 'baggage', 'suitcas', 'station', 'airport', 'depart', 'arriv', 'stau', 'jam', 'street', 'road', 'crossing', 'intersection', 'light', 'platform', 'excursion', 'map', 'passport', 'visa', 'beach', 'sea', 'mountain', 'hike', 'hiking', 'camp', 'tent', 'book', 'reserv', 'delay', 'punctual', 'on time', 'schedule', 'timetable', 'line', 'stop', 'change', 'get in', 'get off', 'fuel', 'gas station'];
const shopEn = ['shop', 'consum', 'store', 'price', 'pay', 'buy', 'money', 'euro', 'cent', 'cheap', 'expensive', 'cost', 'discount', 'offer', 'supermarket', 'market', 'bag', 'cloth', 'dress', 'pant', 'shoe', 'shirt', 'jacket', 'coat', 'skirt', 'suit', 'material', 'fabric', 'leather', 'wool', 'silk', 'cotton', 'plastic', 'metal', 'wood', 'glass', 'paper', 'seller', 'customer', 'cashier', 'cash register', 'bill', 'receipt', 'guarantee', 'exchange', 'reduced', 'special offer'];
const workEn = ['work', 'job', 'profession', 'career', 'colleague', 'office', 'apply', 'application', 'boss', 'employee', 'employer', 'master', 'workshop', 'factory', 'salary', 'wage', 'contract', 'resign', 'dismiss', 'strike', 'workplace', 'unemploy', 'overtime', 'resume', 'cv', 'internship', 'manager', 'director', 'lead'];
const educationEn = ['school', 'learn', 'educat', 'stud', 'universit', 'college', 'class', 'teach', 'student', 'pupil', 'exam', 'test', 'task', 'exercise', 'homework', 'mistake', 'error', 'course', 'certificate', 'diploma', 'subject', 'math', 'calculat', 'write', 'read', 'vocab', 'dictionar', 'lesson', 'semester', 'term', 'professor', 'grade', 'mark'];
const homeEn = ['live', 'house', 'room', 'furnitur', 'rent', 'household', 'tool', 'architect', 'build', 'table', 'chair', 'bed', 'cabinet', 'cupboard', 'shelf', 'shelves', 'sofa', 'couch', 'lamp', 'door', 'window', 'key', 'heat', 'electric', 'power', 'water', 'neighbor', 'landlord', 'flat', 'apartment', 'kitchen', 'bathroom', 'balcony', 'terrace', 'cellar', 'basement', 'roof', 'wall', 'floor', 'move in', 'move out', 'move house'];
const natureEn = ['natur', 'environ', 'weather', 'climat', 'animal', 'plant', 'clean', 'earth', 'garden', 'landscap', 'wind', 'rain', 'snow', 'sun', 'temperatur', 'degree', 'sky', 'star', 'moon', 'forest', 'wood', 'mountain', 'lake', 'sea', 'ocean', 'river', 'tree', 'flower', 'cat', 'dog', 'bird', 'horse', 'cow', 'dirt', 'garbage', 'trash', 'waste', 'pollution', 'recycl', 'heat', 'cold', 'thunder', 'storm', 'cloud', 'fog'];
const leisureEn = ['leisure', 'entertain', 'game', 'play', 'sport', 'hobby', 'music', 'film', 'movie', 'cinema', 'museum', 'art', 'cultur', 'literatur', 'read', 'festival', 'party', 'celebrat', 'birthday', 'dance', 'sing', 'theat', 'concert', 'exhibit', 'paint', 'photo', 'camera', 'tv', 'television', 'radio', 'chess', 'soccer', 'football', 'swim', 'hike', 'stadium', 'team', 'club', 'tournament', 'win', 'lose', 'instrument', 'guitar', 'piano'];
const familyEn = ['person', 'family', 'friend', 'child', 'parent', 'partner', 'relation', 'marry', 'marriag', 'wedding', 'man', 'men', 'woman', 'women', 'brother', 'sister', 'mother', 'father', 'son', 'daughter', 'uncle', 'tante', 'niece', 'nephew', 'grandparent', 'grandma', 'grandpa', 'grandson', 'granddaught', 'baby', 'human', 'people', 'member', 'sibling', 'relative', 'divorce'];
const emotionEn = ['charact', 'feel', 'emotion', 'identit', 'age', 'look', 'opinion', 'thought', 'think', 'decid', 'decision', 'love', 'hate', 'anger', 'angry', 'fear', 'afraid', 'joy', 'happy', 'happine', 'sad', 'grief', 'quarrel', 'argu', 'fight', 'discuss', 'proud', 'shy', 'polite', 'nice', 'kind', 'friendly', 'sympathetic', 'bad', 'stupid', 'clever', 'smart', 'lazy', 'diligent', 'honest', 'patient', 'nervous', 'satisfied', 'disappointed', 'personality', 'hope', 'believe', 'cry', 'laugh', 'smile', 'mean', 'recommend'];
const communicationEn = ['communicat', 'greet', 'say', 'speak', 'talk', 'tell', 'ask', 'answer', 'reply', 'understand', 'conversation', 'telephone', 'phone', 'cell phone', 'mobile', 'computer', 'laptop', 'internet', 'e-mail', 'email', 'mail', 'call', 'letter', 'parcel', 'package', 'message', 'news', 'network', 'smartphone', 'keyboard', 'screen', 'monitor', 'file', 'data', 'online', 'web', 'device', 'tv', 'radio', 'camera', 'video', 'cd', 'dvd', 'mp3', 'display', 'kabel', 'taste', 'drucker', 'kopier', 'speicher', 'programm', 'digital', 'techn', 'medien', 'post', 'stamp', 'poster', 'note', 'newspaper', 'journal', 'magazin', 'broadcast', 'sender', 'receiver', 'salutation', 'thank', 'please'];
const documentsEn = ['office', 'authorit', 'police', 'post', 'telecom', 'bank', 'financ', 'tax', 'law', 'legal', 'polit', 'state', 'societ', 'security', 'emergenc', 'fire brigade', 'city hall', 'rathaus', 'consulat', 'embassy', 'id card', 'identification', 'form', 'sign', 'signature', 'fee', 'account', 'transfer', 'card', 'lawyer', 'attorney', 'court', 'insur', 'visa', 'passport', 'certificat', 'diploma', 'confirm', 'contract', 'document', 'deed', 'request', 'register', 'zoll', 'custom', 'border', 'soldier', 'militar', 'war', 'peace', 'judge', 'parliament', 'constitut', 'party', 'minister', 'citizen', 'vote', 'voter', 'democrac'];

// Helper to precompile RegExp objects once upon module load
const makeRegExpDe = (stems) => stems.map(stem => ({
  stem,
  re: new RegExp('\\b' + stem.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
}));

const makeRegExpEn = (keywords) => keywords.map(kw => 
  new RegExp('\\b' + kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b')
);

// Pre-compiled regular expressions caches
const PRECOMPILED_DE = {
  communication: makeRegExpDe(communicationDe),
  documents: makeRegExpDe(documentsDe),
  emotion: makeRegExpDe(emotionDe),
  food: makeRegExpDe(foodDe),
  health: makeRegExpDe(healthDe),
  travel: makeRegExpDe(travelDe),
  shop: makeRegExpDe(shopDe),
  work: makeRegExpDe(workDe),
  education: makeRegExpDe(educationDe),
  home: makeRegExpDe(homeDe),
  nature: makeRegExpDe(natureDe),
  leisure: makeRegExpDe(leisureDe),
  family: makeRegExpDe(familyDe)
};

const PRECOMPILED_EN = {
  communication: makeRegExpEn(communicationEn),
  documents: makeRegExpEn(documentsEn),
  emotion: makeRegExpEn(emotionEn),
  food: makeRegExpEn(foodEn),
  health: makeRegExpEn(healthEn),
  travel: makeRegExpEn(travelEn),
  shop: makeRegExpEn(shopEn),
  work: makeRegExpEn(workEn),
  education: makeRegExpEn(educationEn),
  home: makeRegExpEn(homeEn),
  nature: makeRegExpEn(natureEn),
  leisure: makeRegExpEn(leisureEn),
  family: makeRegExpEn(familyEn)
};

// Search-bar RegExp compilation cache
let lastSearchQuery = '';
let lastCompiledRegex = null;

/**
 * Normalizes and groups raw themed tags into 12 canonical German language learning categories.
 */
export function getConsolidatedCategory(rawTheme, word, wordClass, meaning) {
  const t_raw = (rawTheme || '').trim();
  
  const exactMatch = canonicalCategories.find(cat => cat.toLowerCase() === t_raw.toLowerCase());
  if (exactMatch) {
    return exactMatch;
  }

  const t = t_raw.toLowerCase();
  const w = (word || '').toLowerCase().trim();
  const m = (meaning || '').toLowerCase().trim();
  const wc = (wordClass || '').toLowerCase().trim();

  // Clean articles and parenthesis for exact matching
  let w_clean = w.replace(/^(der|die|das)\s+/, '');
  w_clean = w_clean.replace(/\s*\(.*?\)\s*/g, '').trim();

  // 1. Grammatical check prioritizations
  if (['pronoun', 'preposition', 'conjunction', 'article', 'adverb'].includes(wc) || grammarExactDe.has(w_clean)) {
    return 'Grammatik, Pronomen & Struktur';
  }
  
  if (wc === 'number' || numbersExactDe.has(w_clean) || m.includes('number') || m.includes('numeral') || m.includes('measure') || m.includes('unit ') || m.includes('quantity') || ['grad', 'kilo', 'meter', 'liter', 'gramm', 'portion', 'paar', 'stück', 'teil', 'größe', 'prozent', 'tonne', 'gewicht', 'länge', 'breite', 'höhe', 'tiefe'].includes(w_clean)) {
    return 'Zahlen, Maße & Mengen';
  }
  
  if (timeExactDe.has(w_clean) || ['uhr', 'jahr', 'monat', 'woche', 'tag', 'sekunde', 'minute', 'stunde', 'quartal', 'zeitraum', 'spät', 'früh', 'jetzt', 'dann', 'danach', 'heute', 'gestern', 'morgen', 'bald', 'sofort', 'später', 'pünktlich', 'puenktlich', 'dauer'].includes(w_clean)) {
    return 'Uhrzeit, Datum & Kalender';
  }

  // Precompiled exact stem and keyword match utilities
  const matchDe = (precompiledList) => {
    for (const item of precompiledList) {
      if (item.stem === 'auto' && w_clean.startsWith('autor')) continue;
      if (item.stem === 'pass' && (w_clean.startsWith('passier') || w_clean.startsWith('passen') || w_clean.startsWith('passend'))) continue;
      if (item.re.test(w_clean)) return true;
    }
    return false;
  };

  const matchEn = (precompiledList) => {
    for (const re of precompiledList) {
      if (re.test(m)) return true;
    }
    return false;
  };

  // 2. Classify semantic categories with stem matching
  if (matchDe(PRECOMPILED_DE.communication) || matchEn(PRECOMPILED_EN.communication)) return 'Kommunikation, Medien & Sprache';
  if (matchDe(PRECOMPILED_DE.documents) || matchEn(PRECOMPILED_EN.documents)) return 'Staat, Gesellschaft & Dokumente';
  if (matchDe(PRECOMPILED_DE.emotion) || matchEn(PRECOMPILED_EN.emotion)) return 'Gefühle, Charakter & Meinung';
  if (matchDe(PRECOMPILED_DE.food) || matchEn(PRECOMPILED_EN.food)) return 'Essen, Kochen & Restaurant';
  if (matchDe(PRECOMPILED_DE.health) || matchEn(PRECOMPILED_EN.health)) return 'Gesundheit, Körper & Pflege';
  if (matchDe(PRECOMPILED_DE.travel) || matchEn(PRECOMPILED_EN.travel)) return 'Reise, Verkehr & Mobilität';
  if (matchDe(PRECOMPILED_DE.shop) || matchEn(PRECOMPILED_EN.shop)) return 'Einkaufen, Geld & Konsum';
  if (matchDe(PRECOMPILED_DE.work) || matchEn(PRECOMPILED_EN.work)) return 'Arbeit, Beruf & Karriere';
  if (matchDe(PRECOMPILED_DE.education) || matchEn(PRECOMPILED_EN.education)) return 'Ausbildung, Schule & Studium';
  if (matchDe(PRECOMPILED_DE.home) || matchEn(PRECOMPILED_EN.home)) return 'Wohnen, Haus & Haushalt';
  if (matchDe(PRECOMPILED_DE.nature) || matchEn(PRECOMPILED_EN.nature)) return 'Natur, Umwelt & Tiere';
  if (matchDe(PRECOMPILED_DE.leisure) || matchEn(PRECOMPILED_EN.leisure)) return 'Freizeit, Hobbys & Unterhaltung';
  if (matchDe(PRECOMPILED_DE.family) || matchEn(PRECOMPILED_EN.family)) return 'Person, Familie & Beziehungen';

  // 3. Fallback direct text mappings
  const tMapping = {
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
  };

  const mappedCat = tMapping[t];
  if (mappedCat) {
    return mappedCat;
  }

  // 4. Word Class direct assignments
  if (wc.includes('verb')) {
    return 'Allgemeine Aktivitäten & Verben';
  }
  if (wc.includes('adjektiv') || wc.includes('adj') || wc.includes('adjective')) {
    return 'Eigenschaften & Adjektive';
  }

  return 'Basiswortschatz & Floskeln';
}

/**
 * Compiles calculated categorical card ratios and updates sidebar list DOM elements
 */
export function renderSidebarCategories() {
  const counts = {};
  const learnedCounts = {};
  
  state.allCards.forEach(card => {
    counts[card.category] = (counts[card.category] || 0) + 1;
    if (state.learnedCards.has(Number(card.id))) {
      learnedCounts[card.category] = (learnedCounts[card.category] || 0) + 1;
    }
  });

  const uniqueCategories = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'de'));

  const allLearned = state.learnedCards.size;
  const allTotal = state.allCards.length;
  elements.categoriesContainer.innerHTML = `
    <div class="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Themen / Kategorien</div>
    <button data-category="All" class="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${state.activeCategory === 'All' ? 'sidebar-active text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}">
      <div class="flex items-start gap-2.5 min-w-0 flex-1 mr-2">
        <i class="fa-solid fa-list text-xs text-indigo-400 mt-1.5 flex-shrink-0"></i>
        <div class="flex flex-col min-w-0 flex-1">
          <span class="font-semibold truncate">Alle Kategorien</span>
          <span class="text-[10px] text-slate-500 font-medium truncate">All Categories</span>
        </div>
      </div>
      <span class="text-xs bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono flex-shrink-0">${allLearned} / ${allTotal}</span>
    </button>
  `;

  uniqueCategories.forEach(cat => {
    const total = counts[cat];
    const learned = learnedCounts[cat] || 0;
    const isActive = state.activeCategory === cat;
    const isCompleted = learned === total;
    const translation = categoryTranslations[cat] || cat;
    
    let badgeColorClass = isActive 
      ? 'bg-slate-900 border border-slate-800 text-slate-400' 
      : (isCompleted ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' : 'bg-slate-950 text-slate-500');

    const btn = document.createElement('button');
    btn.setAttribute('data-category', cat);
    btn.className = `w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${isActive ? 'sidebar-active text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`;
    btn.innerHTML = `
      <div class="flex items-start gap-2.5 min-w-0 flex-1 mr-2">
        <i class="fa-solid ${isCompleted ? 'fa-circle-check text-emerald-500/70 mt-1.5' : 'fa-folder text-indigo-400/70 mt-1.5'} text-xs flex-shrink-0"></i>
        <div class="flex flex-col min-w-0 flex-1">
          <span class="font-semibold truncate">${cat}</span>
          <span class="text-[10px] text-slate-500 font-medium truncate">${translation}</span>
        </div>
      </div>
      <span class="text-xs px-2 py-0.5 rounded-full font-mono flex-shrink-0 ${badgeColorClass}">${learned} / ${total}</span>
    `;
    elements.categoriesContainer.appendChild(btn);
  });
}

/**
 * Filter deck lists dynamically based on search tokens, regular expressions, or categorical states.
 */
export function filterDeck(preserveIndex = false) {
  let filtered = state.allCards;

  if (state.activeCategory !== 'All') {
    filtered = filtered.filter(card => card.category === state.activeCategory);
  }

  if (state.searchQuery) {
    const rawQuery = state.searchQuery.trim();
    
    // Check if RegExp search e.g. /regex/
    const rxMatch = rawQuery.match(/^\/(.*)\/([gimy]*)$/);
    if (rxMatch) {
      try {
        const pattern = rxMatch[1];
        const flags = rxMatch[2] || 'i';
        let regex;
        if (rawQuery === lastSearchQuery && lastCompiledRegex) {
          regex = lastCompiledRegex;
        } else {
          regex = new RegExp(pattern, flags);
          lastSearchQuery = rawQuery;
          lastCompiledRegex = regex;
        }
        
        filtered = filtered.filter(card => 
          regex.test(card.word) || 
          regex.test(card.meaning) ||
          (card.exampleDe && regex.test(card.exampleDe)) ||
          (card.exampleEn && regex.test(card.exampleEn))
        );
      } catch (err) {
        console.error("Invalid regular expression in search:", err);
        filtered = []; // Safe fallback on broken regex query
      }
    } else {
      // Tokenized multi-category filter search
      const tokens = rawQuery.toLowerCase().split(/\s+/);
      const plainTokens = [];
      const filters = {
        wordClass: [],
        gender: [],
        srs: [],
        theme: []
      };

      tokens.forEach(token => {
        if (token.includes(':')) {
          const [key, val] = token.split(':', 2);
          if (key === 'is') {
            if (val === 'noun' || val === 'nomen') filters.wordClass.push('nomen');
            else if (val === 'verb') filters.wordClass.push('verb');
            else if (val === 'adj' || val === 'adjective' || val === 'adjektiv') filters.wordClass.push('adjektiv');
            else if (val === 'adv' || val === 'adverb') filters.wordClass.push('adverb');
            else if (val === 'pronoun' || val === 'pronomen') filters.wordClass.push('pronomen');
            else if (val === 'preposition' || val === 'präposition') filters.wordClass.push('präposition');
            else if (val === 'conjunction' || val === 'konjunktion') filters.wordClass.push('konjunktion');
            else filters.wordClass.push(val);
          } else if (key === 'gender' || key === 'g') {
            filters.gender.push(val);
          } else if (key === 'srs') {
            filters.srs.push(val);
          } else if (key === 'theme' || key === 't' || key === 'cat' || key === 'category') {
            filters.theme.push(val);
          } else {
            plainTokens.push(token);
          }
        } else {
          plainTokens.push(token);
        }
      });

      // Filter by tags and token list values
      filtered = filtered.filter(card => {
        if (filters.wordClass.length > 0) {
          const cardClass = (card.wordClass || '').toLowerCase();
          if (!filters.wordClass.includes(cardClass)) return false;
        }

        if (filters.gender.length > 0) {
          const cardGender = (card.gender || '').toLowerCase();
          if (!filters.gender.includes(cardGender)) return false;
        }

        if (filters.srs.length > 0) {
          const srsInfo = getSRSInfo(card.id);
          const matchesSrs = filters.srs.some(val => {
            if (val === 'due') return srsInfo.isDue && !srsInfo.isNew;
            if (val === 'new') return srsInfo.isNew;
            if (val === 'learned' || val === 'review') return !srsInfo.isNew;
            return false;
          });
          if (!matchesSrs) return false;
        }

        if (filters.theme.length > 0) {
          const cardCat = (card.category || '').toLowerCase();
          const matchesTheme = filters.theme.some(val => cardCat.includes(val));
          if (!matchesTheme) return false;
        }

        if (plainTokens.length > 0) {
          const cardWord = card.word.toLowerCase();
          const cardMeaning = card.meaning.toLowerCase();
          const cardExDe = (card.exampleDe || '').toLowerCase();
          const cardExEn = (card.exampleEn || '').toLowerCase();

          return plainTokens.every(keyword => 
            cardWord.includes(keyword) || 
            cardMeaning.includes(keyword) ||
            cardExDe.includes(keyword) ||
            cardExEn.includes(keyword)
          );
        }

        return true;
      });
    }
  }

  if (state.hideLearned) {
    filtered = filtered.filter(card => !state.learnedCards.has(Number(card.id)));
  }

  state.filteredCards = filtered;
  
  if (!preserveIndex) {
    state.currentIndex = 0;
  } else {
    if (state.filteredCards.length === 0) {
      state.currentIndex = 0;
    } else if (state.currentIndex >= state.filteredCards.length) {
      state.currentIndex = state.filteredCards.length - 1;
    }
  }

  if (state.isShuffled) {
    state.currentDeck = shuffleArray([...state.filteredCards]);
  } else {
    state.currentDeck = sortDeckBySRS([...state.filteredCards]);
  }

  renderCard();
}
