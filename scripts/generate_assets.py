import os
import json
import re
import sys
import time
import argparse
from io import BytesIO
from PIL import Image, ImageDraw, ImageChops, ImageFilter

# Force UTF-8 encoding for stdout/stderr on Windows to support emojis cleanly
if sys.platform.startswith('win'):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

# Determine workspace paths relative to script location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Meta Dictionary of highly specific SOTA 3D metaphors for abstract / functional words
METAPHOR_MAP = {
    # Prepositions
    "an": "a cute 3D character sticking a vibrant sticky note onto a green wooden wall",
    "auf": "a cute 3D kitten sitting on top of a comfortable wooden stool",
    "in": "a bright red toy ball nestled inside a transparent glass jar",
    "unter": "a red toy ball sitting snugly directly under a rustic blue wooden box",
    "über": "a tiny toy plane flying over a cozy mountain peak",
    "neben": "a red toy ball resting right next to a small blue wooden box",
    "vor": "a friendly 3D character standing proudly in front of a rustic wooden door",
    "hinter": "a cute 3D character peeking out from behind a large green tree trunk",
    "zwischen": "a bright yellow ball sitting exactly between two tall blue wooden boxes",
    "bei": "a cozy small cottage sitting right beside a tall beautiful wooden tower",
    "mit": "a pair of red and blue socks folded snugly together",
    "ohne": "a cute coffee mug with a puzzle piece missing from its side",
    "nach": "a friendly toy train pointing forward along a tiny track towards a distant destination",
    "von": "a tiny envelope floating out from a small wooden mailbox",
    "zu": "a friendly character walking toward a bright shining golden star",
    "durch": "a small toy car driving happily through a green archway tunnel",
    "gegen": "two cute balls gently bumping against each other, action style",
    "um": "a small ring of colorful wooden toy blocks positioned around a tall red candle",
    "aus": "a cute, smiling 3D bird happily popping out of a beautiful rustic wooden cuckoo clock",
    "aus sein": "a cute 3D wall light switch in a pink frame, with the toggle flipped down to the off position, cartoon style",

    # Handcrafted A1 early cards (1 to 30)
    "abfliegen": "A magnificent, glossy 3D passenger airplane made of pristine white enamel, dramatically angled upwards as it climbs into the air, with glowing golden jet streams trailing behind its chrome engines, front-and-center",
    "abflug": "A stylized, premium 3D terminal departure gate sign in glossy blue enamel, with a glowing translucent glass board showing a glowing yellow airplane departure symbol, front-and-center",
    "an sein": "A sleek, glowing 3D light bulb with a glowing warm-yellow filament inside, shining brightly with subtle floating star sparkles, floating in mid-air, front-and-center",
    "ansage": "A classic retro 3D microphone made of polished chrome and gold, suspended in front of a giant glossy red radio speaker, emitting golden soundwaves, front-and-center",
    "anschluss": "Two stylized, high-gloss 3D puzzle pieces of contrasting colors, blue and pink, connecting perfectly together in mid-air, representing a seamless connection, front-and-center",
    "antwort": "A vibrant, ultra-glossy pink 3D speech bubble with a giant glowing golden checkmark inside, floating in mid-air, front-and-center",
    "antworten": "A cute 3D character happily writing a reply on a glowing translucent glass screen, with a tiny paper airplane letter flying off, front-and-center",
    "anzeige": "A stylish 3D billboard with a glossy colorful display showing a glowing red tag with a percentage symbol (%) and sparkling gold coins, representing a premium advertisement, front-and-center",
    "apartment": "A beautiful, miniature 3D modern high-rise apartment block with glowing warm windows and luxury green balcony gardens, floating in mid-air, front-and-center",
    "apfel": "A perfectly polished, vibrant red 3D apple with a tiny brown stem and a glossy green leaf, capturing 100% apple essence, front-and-center",
    "appetit": "A spectacular 3D silver cloche dome plate slightly opening to reveal delicious, mouth-watering gourmet dishes with cute steam swirls and floating pink hearts, representing a healthy appetite, front-and-center",
    "arbeit": "A professional, stylized arrangement of premium 3D glossy tools: a gleaming silver wrench, a blueprint roll, and a shiny gold compass, floating together, front-and-center",
    "arbeiten": "A cute 3D character sitting at a sleek modern desk, typing happily on a glowing translucent computer keyboard, with tiny sparkles of productivity, front-and-center",
    "arbeitslos": "A cute 3D character sitting thoughtfully on a comfy park bench next to a closed briefcase with a tiny growing green seedling, representing a fresh start and transition, front-and-center",
    "arbeitsplatz": "A modern, ultra-premium 3D desk setup with a sleek curved monitor displaying code, a designer lamp, and a small green succulent plant, floating in mid-air, front-and-center",
    "arm": "A stylized, athletic 3D arm mannequin with a glowing neon pink sweatband on the wrist, flexed in a strong, energetic pose, front-and-center",
    "arzt": "A stylized, premium 3D medical doctor's kit featuring a glowing red medical cross, a sleek stethoscope, and a shiny silver prescription clipboard, front-and-center",
    "auch": "A pair of beautiful, identical 3D golden star badges floating side-by-side in mid-air, representing addition and inclusion, front-and-center",
    "auf sein": "A majestic, minimalist 3D modern arched glass doorway with its double doors swung wide open, revealing a warm, welcoming glowing golden light inside, surrounded by floating star sparkles, with no buildings or signboards, front-and-center",
    "aufgabe": "A giant, beautifully illustrated 3D checklist scroll with a gleaming gold star sticker next to a completed checkmark, representing a task accomplished, front-and-center",
    "aufhören": "A classic, bold red 3D stop sign with a polished chrome border, floating in a dark studio void, representing stopping or ending, completely wordless, front-and-center",
    "aufstehen": "A cute, stylized 3D character waking up and stretching happily as they rise from a cozy wooden bed, surrounded by a smiling glowing yellow sun, front-and-center",
    "aufzug": "A high-tech, futuristic 3D elevator cabin made of translucent glowing glass and chrome, with green arrows pointing upward, floating suspended, front-and-center",
    "auge": "A stunning, stylized 3D model of a beautiful blue eye with realistic glossy reflections and long thick eyelashes, capturing 100% eye essence, front-and-center",

    # Conjunctions
    "weil": "two beautiful interlocking toy puzzle pieces or mechanical gears representing cause-and-effect",
    "und": "two friendly characters happily holding hands",
    "aber": "a small scale balance with a bright shiny diamond on one side and a heavy grey stone on the other side",
    "oder": "a wooden signpost with two arrows pointing in different left and right directions",
    "dass": "a small scroll containing a secret scroll message, cartoon style",
    "wenn": "a glowing golden key sitting next to a tiny locked chest, representing if-then condition",
    "ob": "a cute character scratching its head thoughtfully while looking at a question mark",

    # Pronouns & Greetings
    "ich": "a single cute character pointing smilingly at itself",
    "du": "a friendly character pointing forward in a warm greeting",
    "wir": "a small group of diverse friendly characters smiling and waving together",
    "ihr": "a group of characters standing together, looking friendly",
    "sie": "two friendly women waving",
    "es": "a small glowing abstract box representing an object, neon glow",
    "hallo": "a cheerful 3D character smiling and waving its hand high in the air",
    "tschüss": "a cute character smiling and waving goodbye as it walks away",
    
    # Hand-curated SOTA 3D inherently floating icons for Cards 31-55
    "ausflug": "a tiny cute 3D backpacker character happily hiking along a miniature mountain path, carrying a tiny blue backpack, cartoon style",
    "ausfüllen": "a cute 3D character smilingly holding a giant pencil, drawing a checkmark on a completely blank list with simple empty square outlines and absolutely zero text, cartoon style",
    "ausgang": "a minimalist bright-green rectangular board featuring only a simple white 3D silhouette of a running figure escaping through an open doorway next to a glowing green right-pointing arrow, completely wordless with absolutely no letters, characters, or words, front-and-center",
    "auskunft": "a stylized 3D desk booth with a large glowing golden letter 'i' above it, cartoon style",
    "ausland": "A spectacular glowing 3D holographic globe of planet Earth, floating in mid-air, surrounded by miniature colorful airplanes flying in glowing circular orbits, premium high-gloss SOTA 3D icon",
    "ausländer": "A cute, ultra-premium 3D explorer character floating happily in mid-air, wearing a beautiful high-gloss travel backpack and holding a glowing golden compass, surrounded by mini floating colorful passport stamps and clouds, front-facing, front-and-center",
    "ausländisch": "a pile of vibrant, colorful 3D toy bank notes and golden coins from different countries, cartoon style",
    "ausmachen": "A massive, ultra-glossy 3D power button icon, glowing with a soft pink power symbol, floating in mid-air, with a cute glossy 3D hand pressing it down. High-gloss translucent glass and metallic elements, front-facing, front-and-center",
    "aussage": "A massive, ultra-glossy vibrant pink 3D speech bubble containing a glowing neon-green 3D checkmark symbol, floating suspended in a pitch-black studio void, front-facing, front-and-center",
    "aussehen": "A spectacular, glossy 3D hand-held mirror with a beautiful golden metallic handle, floating in mid-air, reflecting a cute smiling 3D character face with sparkling stars around it, front-and-center, premium SOTA asset",
    "aussteigen": "A futuristic, glossy 3D train door made of translucent glowing glass, sliding open, with a cute stylized 3D shoe stepping out onto a tiny floating platform, front-facing, front-and-center",
    "ausweis": "A massive, ultra-premium 3D plastic identity card with a cute cartoon face photo, colorful metallic glowing security seals, and translucent glossy layers, floating suspended in mid-air, front-and-center",
    "auto": "A beautiful, compact, ultra-glossy red toy car with giant cute smiling headlights and silver wheels, floating slightly tilted in mid-air, front-and-center, 100% car essence",
    "autobahn": "A giant glowing green overhead highway sign with white arrows pointing forward, floating in mid-air above a tiny, curving high-gloss road segment, front-and-center, premium SOTA 3D icon",
    "automat": "A vibrant retro-futuristic red 3D ticket machine, with a high-gloss glowing screen, golden coins slot, and a colorful ticket half-slid out of its dispenser, floating in mid-air, front-and-center",
    "automatisch": "A series of three beautiful, interlocking mechanical gears made of glossy colorful plastic and glowing neon accents, turning automatically, floating in mid-air, front-and-center",
    "baby": "A giant, cute 3D baby pacifier made of translucent pink glossy silicone and a shining gold ring, with a cute glowing baby rattle floating next to it, front-and-center, 100% baby essence",
    "bad": "A sleek, glowing white 3D bathtub filled with high-gloss translucent water bubbles and a cute yellow rubber duck floating inside, floating in mid-air, front-and-center",
    "baden": "A cute 3D character wearing glossy red swimming goggles, splashing happily in a giant splash of translucent crystal-clear blue water drops, floating in mid-air, front-and-center",
    "bahn": "A highly polished, high-gloss red 3D bullet train cabin speeding forward out of a glowing tunnel arch, floating slightly tilted, front-and-center",
    "bahnhof": "A grand, ultra-futuristic 3D train station terminal with high-gloss arches, glowing glass floors, a tiny red train visible in the portal, and neon-rimmed clocks, floating in mid-air, front-and-center",
    "bahnsteig": "A sleek, high-gloss 3D railway platform segment, with yellow warning strips, a chrome and glass overhead canopy, and a glowing digital departures sign, floating suspended in mid-air, front-and-center",
    "bald": "A beautiful 3D hourglass made of glowing translucent glassmorphic material, filled with vibrant pink sand running down, with a golden wings motif representing time flying, floating in mid-air, front-and-center",
    "balkon": "A highly stylized 3D modern apartment balcony with white railings, lush green potted plants, and a cozy armchair, floating suspended in mid-air, front-and-center",
    "banane": "A single, vibrant yellow 3D banana, partially peeled to reveal glossy cream-white inside, suspended in mid-air, casting a subtle soft self-illuminating glow, front-and-center",
    "bank": "An ultra-glossy pink glass 3D piggy bank sitting on a polished wooden park bench, with a giant golden coin floating above it, capturing both bank and bench meanings, floating in mid-air, front-and-center",
    "bar": "A thick, neat stack of vibrant green 3D cash banknotes with glowing golden bands, and shiny golden coins spilling around them, floating suspended in mid-air, front-and-center",
    "bauch": "A stylized, cute 3D anatomical silhouette of a stomach, glowing with a warm pink internal energy, surrounded by floating golden sparkles, representing comfort and health, floating in mid-air, front-and-center",
    "baum": "A beautiful, miniature 3D bonsai-style oak tree with vibrant emerald-green leaves and a polished rustic brown trunk, floating suspended in mid-air, front-and-center",
    "beamte": "A stylized 3D stamp icon made of gold and chrome, stamping a giant official document with a shiny green wax seal, representing official duties, floating in mid-air, front-and-center",
    "bedeuten": "A large, glossy 3D golden question mark reflecting into a glowing lightbulb, with a shining equal sign (=) connecting them, representing meaning, floating in mid-air, front-and-center",
    "beginnen": "A prominent green 3D START race-track flag waving, with a bright red ribbon being sliced by gold scissors, representing beginning, floating in mid-air, front-and-center",
    "beide": "Two identical, high-gloss 3D smiling cherries attached to a single green stem, reflecting a glowing soft-touch pink and green aesthetic, representing both, floating in mid-air, front-and-center",
    "bein": "A sleek, stylized 3D sports leg mannequin wearing a glowing neon pink running shoe, taking a powerful stride, floating in mid-air, front-and-center",
    "beispiel": "A giant 3D glossy chalk blackboard displaying a simple, beautifully rendered math equation like 1 + 1 = 2 with a golden star sticker, representing an example, floating in mid-air, front-and-center",
    "bekannt": "A spectacular, highly-polished 3D golden star reflecting glowing spotlights from below, completely wordless, representing fame, floating in mid-air, front-and-center",
    "bekommen": "A cute, high-gloss 3D present gift box wrapped in a pink ribbon, with a pair of happy hands reaching up to receive it, floating in mid-air, front-and-center",
    "benutzen": "A beautiful 3D glossy hand using a giant silver key to unlock a high-tech glowing electronic lock, representing active use, floating in mid-air, front-and-center",
    "beruf": "A professional collage of three elegant 3D glossy tools: a chef's hat, a stethoscope, and a hard hat, beautifully arranged and floating together, representing job and profession, floating in mid-air, front-and-center",
    "besetzt": "A stylized, glossy 3D toilet door lock with the indicator showing a bold, bright red locked icon, completely wordless, with a small brass key, floating in mid-air, front-and-center",
    "besichtigen": "A cute 3D tourist character looking through large, high-gloss 3D binoculars, with a mini glowing 3D Eiffel Tower visible inside the reflection of the lenses, floating in mid-air, front-and-center",
    "besser": "A shiny 3D bar graph with three bars, the last bar being green, tall, and capped with a glossy smiling face emoji, with a golden thumbs-up next to it, representing feeling better, floating in mid-air, front-and-center",
    "best": "A towering, highly-polished 3D golden trophy cup with a sparkling blue diamond embedded, surrounded by golden confetti, representing the best, floating in mid-air, front-and-center",
    "bestellen": "A sleek 3D smartphone displaying a large floating shopping cart icon made of glowing gold, with a giant friendly 3D hand tapping a big blank glossy orange button containing a simple white arrow icon, completely wordless, representing ordering, floating in mid-air, front-and-center",
    "besuchen": "A friendly 3D character ringing a shiny brass doorbell of a warm, welcoming house with a glowing window, representing visiting a friend, floating in mid-air, front-and-center",
    "bett": "A luxurious and ultra-comfy 3D bed with a fluffy pink duvet, fluffy white pillows, and a polished warm wooden frame, floating slightly tilted, 100% bed essence, front-and-center",
    "bezahlen": "A sleek, high-gloss 3D wireless payment terminal (POS machine) with a vibrant blue credit card hovering above it, displaying golden electromagnetic waves, representing payment, floating in mid-air, front-and-center",
    "bier": "A giant, highly polished 3D glass mug overflowing with golden amber beer and rich, creamy white foam spilling down the sides, floating in mid-air, front-and-center, 100% beer essence",
    "bild": "An exquisite, ornate golden 3D picture frame containing a beautiful vibrant sunset landscape painting, floating suspended in mid-air, front-and-center",
    "billig": "A bright yellow 3D price tag showing a large percentage symbol (%), next to a giant pile of sparkling golden coins, completely wordless, representing cheap price, floating in mid-air, front-and-center",
    "birne": "A beautiful, highly detailed 3D green pear with a glossy surface and a tiny brown stem with a single emerald-green leaf, floating suspended in mid-air, front-and-center",
    "bis": "A winding 3D road segment ending abruptly at a glowing, transparent red barrier wall, representing a boundary or endpoint, floating in mid-air, front-and-center",
    "bisschen": "A cute 3D measuring spoon holding a single, glowing golden grain or tiny drop of nectar, representing a tiny amount, floating in mid-air, front-and-center",
    "bitte": "A pair of cute, stylized 3D glossy hands held together in a warm, polite praying or pleading gesture, surrounded by soft self-illuminating sparkles, floating in mid-air, front-and-center",
    "bitten": "A pair of cute, stylized 3D glossy hands held together in a warm, polite praying or pleading gesture, surrounded by soft self-illuminating sparkles, floating in mid-air, front-and-center",
    "die bitte": "A cute, glowing 3D paper scroll containing a sparkling golden star and a clean checkmark symbol, floating in mid-air, front-and-center, completely wordless, representing a polite request",
    "bitter": "A giant, shiny dark brown 3D coffee bean floating in a spectacular splash of rich black espresso coffee, completely wordless, representing bitter flavor, floating in mid-air, front-and-center",
    "bleiben": "A spectacular 3D metallic blue anchor firmly holding onto the sandy sea floor with a glowing gold chain, representing remaining or staying in place, completely wordless, floating in mid-air, front-and-center",
    "bleistift": "A single, oversized, highly-detailed 3D yellow pencil with a pink eraser tip and a sharp graphite point, floating in mid-air at an angle, capturing 100% pencil essence, front-and-center",
    "blick": "A beautiful 3D digital window floating in mid-air, looking out onto a spectacular glowing sunset and rolling green hills, representing a scenic view, front-and-center",
    "blume": "A giant, highly-detailed 3D flower blooming beautifully with large vibrant pink petals and a glossy gold center, floating in mid-air, front-and-center, 100% flower essence",
    "bogen": "A pristine white 3D document sheet with glowing lines, a metallic silver clipboard, and a floating green pen, representing a sheet of paper or form, front-and-center",
    "brauchen": "A beautiful 3D wooden puzzle heart with one vital shining golden piece floating right next to its empty slot, representing a strong need or necessity, front-and-center",
    "breit": "A sleek, stylized 3D bridge expanding beautifully wide across two glowing platforms, highlighting the broad width, front-and-center",
    "brief": "A highly-detailed, ultra-premium 3D envelope sealed with a red wax heart seal, floating in mid-air, with subtle glowing sparkles around it, front-and-center, 100% letter essence",
    "briefmarke": "A giant, beautifully perforated 3D postage stamp depicting a miniature golden crown, floating in mid-air, front-and-center, 100% postage stamp essence",
    "bringen": "A cute, stylized 3D tray carried by a metallic silver robotic hand, delivering a steaming cup of tea, representing bringing or presenting something, front-and-center",
    "brot": "A fresh, warm, golden-brown 3D loaf of sliced bread with realistic glossy textures, floating in mid-air, front-and-center, 100% bread essence",
    "bruder": "Two cute, stylized 3D boy characters standing side-by-side with arms around each other's shoulders, smiling warmly, representing brotherhood, front-and-center",
    "brötchen": "A pair of highly detailed, crispy golden-brown 3D bread rolls or buns, with a soft dusted texture, floating in mid-air, front-and-center, 100% bun essence",
    "buch": "A giant, magnificent 3D open book with thick, creamy-white blank pages slightly fluttering, bound in an ultra-glossy blue cover with gold metallic corners, floating suspended, front-and-center, capturing 100% book essence",
    "buchstabe": "A giant, colorful 3D capital letter 'A' made of ultra-glossy pink enamel and metallic gold edges, floating suspended in mid-air, completely wordless and front-and-center",
    "buchstabieren": "Three beautiful 3D blocks with letters A, B, C made of polished wood and glossy plastic, neatly lined up side-by-side in mid-air, representing spelling, front-and-center",
    "bus": "A stunning, highly-detailed bright yellow 3D bus with glossy glass windows and chrome wheels, floating slightly tilted, capturing 100% bus essence, front-and-center",
    "butter": "A block of rich, creamy golden 3D butter resting beautifully on a polished glass plate, with a small slice melting on top, floating in mid-air, front-and-center, 100% butter essence",
    "bäckerei": "A highly stylized 3D bakery storefront with a striped awning and a completely wordless blank sign, warm glowing display windows showing miniature pastries and breads, absolutely no text, letters, or words on the sign, floating suspended, front-and-center",
    "böse": "A vibrant, cute red 3D emoji character with angry expressions, subtle smoke puffs coming out of its ears, floating in mid-air, front-and-center",
    "café": "A warm, stylized 3D ceramic coffee cup emitting elegant glossy steam curls, sitting on a glowing saucer in a mini cozy café corner setup, floating suspended, front-and-center",
    "cd": "An ultra-glossy 3D compact disc (CD) showing iridescent rainbow reflections, floating in mid-air next to a sleek jewel case, front-and-center, 100% CD essence",
    "chef": "A sleek, professional 3D golden nameplate with a luxury fountain pen, resting next to an elegant leather executive chair icon, representing the boss, front-and-center",
    "computer": "A super-sleek, modern 3D desktop computer with a glowing glass-like curved monitor, a translucent neon-rimmed keyboard and mouse, floating in mid-air, front-and-center, 100% computer essence",
    "da": "A glowing 3D location pin icon hovering and pointing down directly onto a tiny golden star on a glass grid floor, representing 'here' or 'there', front-and-center",
    "dame": "A sophisticated, stylized 3D silhouette of an elegant lady wearing a chic glossy hat and a high-collar jacket, surrounded by beautiful floating pearl accents, front-and-center",
    "daneben": "A bright red 3D toy sphere floating snugly directly beside a slightly larger green 3D toy sphere on a glowing baseline grid, illustrating 'next to it', front-and-center",
    "dank": "A spectacular 3D pink glass heart with gold metallic ribbon wrapping around it, surrounded by glowing warm fairy lights, representing heartfelt thanks, front-and-center",
    "danke": "A beautiful, stylized 3D golden trophy cup with a warm smiling face emoji, surrounded by colorful confetti, representing gratitude, front-and-center",
    "danken": "A spectacular, warm 3D handshake between a glowing blue hand and a glowing pink hand, floating in mid-air, representing thanking someone, front-and-center",
    "dann": "A glowing green arrow linking one polished 3D block to another in a timeline sequence, representing logical next step or sequential transition, front-and-center",
    "datum": "A magnificent 3D desk calendar with pages turning, showing a big glossy red circle around a single date, with floating golden stars, front-and-center",
    "dauern": "A beautiful, translucent 3D clock face with glowing golden hands spinning slowly, trailing a soft trail of golden dust in a pitch-black studio void, representing duration and time elapsed, front-and-center",
    "dein-": "A cute 3D hand warmly presenting or gifting a beautifully wrapped blue present with a big bow to the viewer, representing ownership or gift, front-and-center",
    "denn": "Two beautiful interlocking, glowing neon gear wheels rotating in perfect harmony, representing causal connection, front-and-center",
    "dich": "A glowing 3D arrow pointing directly at a beautiful, smiling 3D character, highlighting 'you', front-and-center",
    "dies-": "A cute, glossy 3D hand with a pointing finger indicating a specific, brightly glowing red block among several grey blocks, representing 'this one', front-and-center",
    "dir": "A beautiful, stylized 3D gift box floating forward, open with glowing star shapes flowing towards the viewer, representing giving or offering to you, front-and-center",
    "disco": "A gorgeous, highly-detailed 3D disco ball with shimmering glass mirror facets reflecting bright pink and cyan neon spotlights, floating suspended, front-and-center, 100% disco essence",
    "doktor": "A stylized 3D medical stethoscope with a glowing heartbeat pattern in the center, and a tiny red medical cross icon next to it, front-and-center, 100% doctor essence",
    "doppelzimmer": "A beautifully arranged modern hotel room with two identical luxury single beds side-by-side, decorated with cozy pink duvets, floating in mid-air, front-and-center",
    "dorf": "A charming miniature 3D village scene with small warm cottages with smoking chimneys, green trees, and tiny cobbled paths, floating suspended, front-and-center, 100% village essence",
    "draußen": "A beautiful 3D park bench sitting under a leafy green tree with glowing sunshine and small white clouds, representing being outdoors, front-and-center",
    "drucken": "A sleek 3D computer printer dynamically sliding out a freshly printed document showing a beautiful colorful bar chart, with glowing accents, front-and-center",
    "drucker": "An elegant, highly-detailed 3D desk printer made of glossy white and chrome plastic, with a neat stack of paper loaded and a glowing status light, front-and-center, 100% printer essence",
    "drücken": "A bold, bright red 3D button made of glossy enamel, being pressed down by a cute, polished 3D hand, representing pressing or pushing, front-and-center",
    "durchsage": "A spectacular 3D megaphone loudspeaker made of polished chrome and bright pink plastic, emitting glowing neon soundwaves, floating suspended, front-and-center",
    "durst": "A single, highly detailed 3D glass cup containing crystal-clear water with a giant splash, surrounded by small glowing water drop accents, representing refreshing thirst-quenching, front-and-center",
    "dusche": "A modern, sleek 3D chrome showerhead spraying crystal-clear water drops downward, with floating translucent soap bubbles, front-and-center, 100% shower essence",
    "dürfen": "A giant, bright green 3D checkmark symbol inside a translucent glossy circular badge, representing permission or being allowed, front-and-center",
    "ecke": "A sharp, modern 3D geometric corner where two glossy pink and blue glass walls meet at an angle, with a glowing neon ball sitting right at the apex point, front-and-center",
    "ehefrau": "A beautiful 3D glossy wedding ring with a sparkling diamond, resting next to a stylish stylized female figure silhouette, representing a wife, front-and-center",
    "ehemann": "A beautiful 3D glossy wedding ring with a polished gold finish, resting next to a handsome stylized male figure silhouette, representing a husband, front-and-center",
    "ei": "A giant, perfect white 3D chicken egg with a pristine smooth shell, resting snugly in a tiny, glowing silver egg cup, floating in mid-air, front-and-center, 100% egg essence",
    "eilig": "A vibrant 3D alarm clock with small glowing wings attached to its sides, speeding forward in mid-air, leaving a trail of glowing motion lines, representing being in a hurry, front-and-center",
    "ein-": "A single, towering 3D digit '1' made of glowing neon glass and polished gold base, standing proud and isolated in mid-air, representing 'one', front-and-center",
    "einfach": "A giant green 3D puzzle with only two huge, extremely simple pieces that slide together effortlessly, representing simple and easy, front-and-center",
    "eingang": "A beautiful, glowing green 3D open archway with a prominent arrow pointing inward, representing entrance, front-and-center",
    "einkaufen": "A stylized 3D shopping cart overflowing with colorful, glossy groceries like a red apple, green bottle, and yellow bread box, front-and-center, 100% grocery shopping essence",
    "einladen": "A beautiful, open 3D invitation card made of glossy paper with golden sparkles and warm stars shooting out, representing an active invitation gesture, front-and-center",
    "einladung": "A premium 3D envelope with a stylish invitation card sliding out, decorated with a warm golden bow and sparkles, front-and-center, 100% invitation essence",
    "einmal": "A stylized 3D clock dial showing a single big golden star highlight at the 12 o'clock position, representing a single occurrence or 'once', front-and-center",
    "einsteigen": "A futuristic glossy 3D passenger train doorway sliding open with a glowing warm interior light, and a stylized shoe stepping inside, front-and-center",
    "eintritt": "A highly-detailed, glossy golden 3D admission ticket with perforated edges and a sparkling star icon, floating in mid-air, front-and-center, 100% admission ticket essence",
    "einzelzimmer": "A beautifully arranged modern hotel room with a single luxury bed decorated with a cozy pink duvet, floating in mid-air, front-and-center",
    "eltern": "A cute, stylized 3D representation of a happy father and mother standing side-by-side, smiling warmly and waving, representing parents, front-and-center",
    "e-mail": "A highly-detailed, ultra-premium 3D envelope with a giant glossy neon-blue '@' sign symbol floating above it, representing an email, front-and-center",
    "empfehlen": "A spectacular golden 3D thumbs-up badge with glowing golden sparkles and ribbons around it, representing a high recommendation, front-and-center",
    "empfänger": "A cute 3D character smiling warmly as it happily catches a floating pink package from the sky, representing the recipient, front-and-center",
    "ende": "A sleek black 3D checkered flag waving proudly, representing the finish line and end of a race, front-and-center",
    "enden": "A stylized 3D theater stage with a massive, high-gloss crimson curtain completely closed, representing the end of a performance, completely wordless, front-and-center",
    "entschuldigen": "A pair of cute 3D hands clasped together in a polite, apologetic bowing gesture, surrounded by soft self-illuminating golden light, front-and-center",
    "entschuldigung": "A beautiful, stylized 3D pink glass heart with a tiny white band-aid on it, representing a sincere apology and healing, front-and-center",
    "er": "A single, cute boy character pointing smilingly at himself, front-and-center",
    "ergebnis": "A highly-detailed 3D digital scoreboard displaying a spectacular gold star and a green checkmark, representing an excellent test result, front-and-center",
    "erklären": "A glowing 3D lightbulb above a stylized chalkboard depicting a clear, simple arrow-diagram connecting ideas, representing explaining, front-and-center",

    # SOTA 3D assets for Cards 166 to 195 (erlauben through fleisch)
    "erlauben": "A spectacular glowing 3D green shield adorned with a highly polished metallic gold checkmark, representing permission, floating in mid-air, front-and-center",
    "erwachsene": "A sophisticated, modern 3D character in stylish executive attire, wearing a sleek watch, looking confident and smiling, representing adulthood, front-and-center",
    "erzählen": "A cozy 3D campfire setup with a stylized glowing open book and floating stars or speech bubbles rising up, symbolizing storytelling and narrating, front-and-center",
    "essen": "A spectacular 3D plate with a delicious warm slice of pie and a glossy fork and knife, with tiny sparkle effects, front-and-center",
    "das essen": "A gorgeous, mouth-watering gourmet 3D feast consisting of a glossy silver cloche dome plate opening to reveal a steaming delicious burger and crispy fries, capturing the ultimate food essence, front-and-center",
    "euer": "A cute 3D gift box with two glowing hands pointing warmly towards it, indicating 'yours', front-and-center",
    "fahren": "A modern, ultra-glossy blue sports car speeding forward along a tiny stylized floating road track, capturing driving speed, front-and-center",
    "fahrer": "A cute 3D character with a stylized leather jacket and a polished chrome steering wheel in hand, looking forward excitedly, front-and-center",
    "fahrkarte": "An ultra-premium, shiny gold-gilded 3D train passenger ticket with a glowing circular punch-hole, floating suspended, front-and-center",
    "fahrrad": "A beautiful, modern 3D bicycle painted in high-gloss neon orange, with silver chrome spokes and handles, floating slightly tilted, 100% bicycle essence, front-and-center",
    "falsch": "A giant, glowing red 3D 'X' symbol made of glossy enamel, floating in a dark studio void, casting a soft red glow, front-and-center",
    "familie": "A heartwarming, stylized 3D grouping of a mother, father, and a cute child holding hands, surrounded by a glowing pink heart silhouette, front-and-center",
    "familienname": "A beautiful 3D coat of arms shield with a blank elegant glowing scroll draped across it, representing lineage and family name, front-and-center",
    "familienstand": "A beautiful 3D balance scale holding two interlocking gold wedding rings on one side and a single gold star on the other side, representing marital status, front-and-center",
    "farbe": "A spectacular, highly-detailed 3D artist paint palette overflowing with vibrant glossy dollops of rainbow colors (pink, blue, yellow, green) and a polished silver paintbrush resting on it, front-and-center",
    "fax": "A retro-futuristic 3D fax machine made of glossy white and pink plastic, with a printed page with a line graph half-emerging from it, front-and-center",
    "fehlen": "A beautiful 3D puzzle sphere with one crucial glowing golden puzzle piece floating right next to its empty slot, symbolizing a missing piece, front-and-center",
    "fehler": "A giant 3D eraser rubbing away a glowing red pencil scribble on a clean glass block, representing correcting a mistake, front-and-center",
    "feiern": "A spectacular, exploding 3D party popper releasing a beautiful burst of glossy colorful confetti, stars, and streamers, front-and-center",
    "fernsehen": "A retro-chic 3D television set with a curved glowing screen displaying a colorful cartoon scene, with cute antenna on top, front-and-center",
    "fertig": "A giant glowing green 3D racing finish-line checkered archway, with a golden ribbon being cut, representing completion, front-and-center",
    "feuer": "A gorgeous, stylized 3D roaring campfire made of glossy translucent orange and yellow flame crystals resting on polished dark wood logs, front-and-center",
    "fieber": "A spectacular 3D glass medical thermometer showing a bright glowing red mercury line rising to the very top, with small floating warm sparkle dots, front-and-center",
    "film": "A giant, stylized 3D film reel made of polished metallic silver and black, with a strip of celluloid ribbon looping elegantly around it, front-and-center",
    "finden": "A sleek 3D magnifying glass hovering over a hidden glowing golden star on a high-contrast glass grid, representing finding, front-and-center",
    "firma": "A modern, elegant 3D skyscraper office building made of glowing glassmorphism windows and steel frames, floating suspended, front-and-center",
    "fisch": "A beautiful, highly detailed 3D orange clownfish with white stripes, swimming gracefully in a splash of translucent water drops, 100% fish essence, front-and-center",
    "flasche": "A sleek, translucent 3D green glass bottle with a warm cork stopper, containing sparkling water bubbles, floating in mid-air, front-and-center",
    "fleisch": "A rich, highly detailed 3D prime cut of T-bone steak with perfect marbled texture and a glossy sheen, resting on a rustic chopping board, front-and-center",

    # SOTA 3D assets for Cards 196 to 225 (fliegen through gehören)
    "fliegen": "A stylized, high-gloss 3D white dove with elegant translucent wings, flying gracefully upward in mid-air with soft golden sparkles behind it, front-and-center",
    "flughafen": "A futuristic 3D control tower with glowing glass panels, a curved airport terminal roof, and a sleek miniature airplane taking off, floating suspended in a pitch-black studio void, front-and-center",
    "flugzeug": "An ultra-glossy white and blue 3D commercial jet airliner, tilted upward as if climbing, with silver chrome engines, front-and-center, 100% airplane essence",
    "formular": "A crisp white 3D page displaying a clean checklist with three glowing green checkmark icons, next to a floating shiny gold pen, front-and-center",
    "foto": "A vintage-style 3D instant polaroid camera made of glossy white and pink enamel, actively sliding out a glossy colorful print of a beautiful rainbow landscape, front-and-center",
    "frage": "A giant, spectacular 3D question mark made of translucent glowing pink glass, reflecting warm studio lights, floating suspended in mid-air, front-and-center",
    "fragen": "A cute 3D character raising its hand excitedly with a bright glowing yellow question mark bubble floating above its head, front-and-center",
    "frau": "A sophisticated 3D character of a smiling woman with stylish hair, wearing a sleek modern jacket, looking warm and welcoming, front-and-center",
    "frei": "A beautiful, wide-open 3D golden birdcage with a tiny glossy bird flying happily outside it, symbolizing freedom and availability, front-and-center",
    "freizeit": "A beautiful, relaxing hammock tied between two small 3D palm trees, with a glossy red sunset in the background, representing leisure time, front-and-center",
    "fremd": "A glowing 3D alien space-saucer hovering over a classic green park bench, representing something foreign or strange, front-and-center",
    "freund": "Two smiling 3D boys high-fiving each other with giant, high-gloss expressions of joy, representing a close friend, front-and-center",
    "früher": "A stylized 3D pocket watch with its hands spinning backwards, trailing a glowing dust trail toward a faded retro photo frame, symbolizing the past, front-and-center",
    "frühstück": "A gorgeous, premium 3D breakfast set consisting of a hot cup of coffee with steam spirals, a sunny-side-up egg on a plate, and a crispy croissant, front-and-center",
    "frühstücken": "A cute 3D character holding a glossy silver fork and knife, smiling in front of a giant warm croissant and a steaming mug, front-and-center",
    "fuß": "A sleek, anatomical 3D artistic model of a foot wearing a modern translucent athletic shoe, walking on a glowing grid path, front-and-center",
    "fußball": "A classic black-and-white soccer ball made of ultra-glossy leather patches, flying forward inside a spectacular splash of bright green grass particles, front-and-center, 100% football essence",
    "führung": "A stylized 3D tour guide character wearing a cute hat, holding up a bright red flag with a golden star, leading a path of glowing arrow signs, front-and-center",
    "für": "A beautiful 3D red gift box with a giant, glossy golden ribbon bow, tilted forward as if being presented to someone, representing 'for you', front-and-center",
    "garten": "A beautiful, miniature 3D garden plot filled with blooming pink and yellow flowers, a small white picket fence, and a tiny glossy watering can, front-and-center",
    "gast": "A welcoming, open 3D house door with a bright red carpet rolling out towards the viewer, welcoming a guest, front-and-center",
    "geben": "A pair of warm 3D hands gently offering a glowing, glowing golden heart to the viewer, representing giving, front-and-center",
    "geboren": "A beautiful, stylized 3D baby cradle or stork carrying a small glowing bundle wrapped in a golden bow, floating among soft clouds, front-and-center",
    "geburtsjahr": "A giant, glowing 3D baby pacifier resting on top of a classic calendar block showing a gold ribbon, representing birth year, front-and-center",
    "geburtsort": "A spectacular 3D glowing location pin hovering over a miniature model of a hospital or birthplace with a tiny golden baby footprints icon, front-and-center",
    "geburtstag": "A giant, spectacular 3D birthday cake with glossy pink icing, colorful sprinkles, and a single burning candle with a glowing flame, front-and-center, 100% birthday essence",
    "gefallen": "A spectacular 3D glossy pink heart icon surrounded by shooting stars and a big golden thumbs-up badge, representing liking something, front-and-center",
    "gehen": "A pair of high-gloss pink running shoes walking forward on a stylized, winding glass pathway with glowing direction arrows, front-and-center",
    "gehören": "A glowing gold crown resting perfectly inside a high-gloss luxury jewelry case, with a key representing ownership and belonging, front-and-center",

    # SOTA 3D assets for Cards 226 to 255 (geld through gruppe)
    "geld": "A beautiful, overflowing 3D money bag made of high-gloss fabric, bursting with shining golden coins and sparkling bills floating suspended, front-and-center, 100% money essence",
    "gemüse": "A spectacular, colorful grouping of stylized 3D vegetables, including a glossy red tomato, a bright orange carrot with green leaves, and a fresh green broccoli stalk, front-and-center, 100% vegetable essence",
    "gepäck": "A highly detailed, luxury 3D suitcase in vibrant pink, with glowing chrome wheels, leather straps, and miniature floating travel tags, front-and-center, 100% luggage essence",
    "gerade": "A high-gloss golden 3D precision target board with a single red dart hitting perfectly and exactly in the absolute dead-center bullseye, front-and-center",
    "geradeaus": "A bold, shining 3D glassmorphism direction arrow pointing straight ahead, hovering over a sleek grid line, front-and-center",
    "geschenk": "An ultra-premium, gorgeous 3D gift box wrapped in metallic gold wrapping paper and tied with a massive, glossy pink satin ribbon bow, front-and-center, 100% present essence",
    "geschlossen": "A beautiful, stylized 3D vintage metal padlock securely closed with a massive gold key chain, completely wordless, front-and-center",
    "geschwister": "Three cute, smiling 3D siblings (a boy and two girls) happily hugging each other under a soft glowing rainbow, front-and-center",
    "geschäft": "A highly detailed 3D boutique shop storefront with a striped pink awning, glassmorphism display windows showing tiny luxury items, and a cozy entrance, front-and-center",
    "gespräch": "Two large, glowing 3D speech bubbles (one translucent pink, one translucent blue) overlapping beautifully, representing active conversation, front-and-center",
    "gestern": "A stylized 3D pocket watch with its hands pointing backward, hovering next to a translucent calendar sheet labeled with a glowing backward-pointing arrow, front-and-center",
    "gestorben": "A peaceful, stylized 3D wilted flower with a single falling petal, surrounded by a gentle, glowing halo of soft starlight in a dark void, front-and-center",
    "getränk": "A spectacular 3D glowing cocktail glass with a pink slice of lemon, a green straw, and sparkling translucent liquid with floating ice cubes, front-and-center, 100% drink essence",
    "gewicht": "A heavy, classic 3D iron dumbbell or kettlebell weight with a highly polished black lacquer surface and a metallic gold handle, front-and-center, 100% weight essence",
    "gewinnen": "A towering, magnificent 3D golden trophy cup with glowing blue stars shooting out, surrounded by a shower of gold coins, front-and-center",
    "geöffnet": "A beautiful, open 3D shop door with a glowing green checkmark emblem and a friendly open door frame, front-and-center",
    "glas": "A high-gloss, crystal-clear 3D drinking glass made of spectacular translucent glassmorphism material, filled with sparkling water and bubbles, front-and-center, 100% glass essence",
    "glauben": "A cute, stylized 3D character sitting on a glowing cloud, looking upward at a magnificent shining golden star, representing faith and belief, front-and-center",
    "gleich": "A sleek, highly polished 3D equals sign (=) made of glowing pink enamel and gold metallic edges, floating suspended in a pitch-black studio void, front-and-center",
    "gleis": "A highly detailed 3D railway track segment extending forward into a glowing neon portal, with chrome rails and polished wooden ties, front-and-center, 100% railway track essence",
    "glück": "A giant, magnificent 3D four-leaf clover made of glowing translucent green glass, with sparkling golden dust floating around it, front-and-center, 100% luck essence",
    "glücklich": "A giant, radiant 3D yellow smiling face emoji with glistening starlit eyes, surrounded by colorful sparkles and a mini golden crown, front-and-center",
    "glückwunsch": "A spectacular 3D greeting card opening up to reveal a burst of golden stars, colorful balloons, and sparkling confetti, front-and-center",
    "gratulieren": "Two friendly 3D characters joyfully shaking hands while a burst of colorful confetti and a golden medal floats above them, front-and-center",
    "grillen": "A spectacular, sleek red 3D barbecue grill kettle, with a glossy metal grate showing realistic glowing orange fire charcoal embers and a tiny steak sizzling, front-and-center",
    "groß": "A towering, giant 3D elephant standing proud and majestic next to a tiny, miniature mouse, beautifully demonstrating the contrast of size, front-and-center",
    "großeltern": "A heartwarming 3D portrait of a sweet, smiling grandmother and grandfather standing together arm-in-arm, wearing cute cozy sweaters, front-and-center",
    "großmutter": "A sweet, gentle 3D grandmother character with glasses and silver hair in a neat bun, smiling warmly while knitting a colorful scarf, front-and-center",
    "großvater": "A kind, smiling 3D grandfather character with silver hair, wearing classic round glasses and a cozy tweed vest, holding a pocket watch, front-and-center",
    "gruppe": "A beautifully arranged, tight-knit cluster of five colorful 3D star-shaped icons sitting snugly together on a glowing glass platform, representing a cohesive group, front-and-center",

    # SOTA 3D assets for Cards 256 to 285 (gruß through hinten)
    "gruß": "A cheerful, high-gloss 3D smiling emoji character waving its hand in a warm, welcoming greeting, surrounded by small glowing stars, front-and-center",
    "größe": "A beautiful 3D comparative display showing three high-gloss t-shirts (small, medium, giant) neatly lined up, beautifully showing the concept of sizes, front-and-center",
    "gut": "A massive, ultra-glossy golden thumbs-up icon reflecting glowing soft-touch pink and cyan studio lights, representing excellent and good, front-and-center",
    "gültig": "A highly detailed, glossy white 3D ticket with a prominent bright green checkmark stamp and glowing sparkles, representing validity, front-and-center",
    "günstig": "A bright orange 3D sale tag showing a large percentage symbol (%) next to a neat stack of golden coins, representing favorable price, front-and-center",
    "haar": "A beautiful, stylized 3D hair-care silhouette showing flowing, glossy golden locks of hair styled elegantly, with glowing star accents, front-and-center",
    "haben": "A pair of warm 3D hands securely holding a giant, glowing golden key, representing possession and having, front-and-center",
    "halbpension": "A sleek 3D dinner plate with a cloche dome half-opened to reveal a croissant on one side and a savory dish on the other, representing breakfast and dinner, front-and-center",
    "halle": "A magnificent, spacious 3D exhibition hall interior with giant high-gloss pillars, an arched ceiling, and glowing glassmorphic exhibition floors, front-and-center",
    "halten": "A giant 3D open hand gesture (palm facing forward) glowing with a soft pink hazard barrier sign, representing stop, front-and-center",
    "haltestelle": "A beautiful 3D modern glass bus stop shelter with a glossy red bench and a glowing timetable signpost, front-and-center, 100% bus stop essence",
    "hand": "A highly detailed, stylized 3D human hand made of soft-touch matte pink resin with polished gold nails, fingers open, front-and-center, 100% hand essence",
    "handy": "A sleek, ultra-modern 3D smartphone with a curved glassmorphism screen displaying a warm pink heart icon and floating bubbles, front-and-center, 100% mobile phone essence",
    "haus": "A cozy, highly detailed 3D cottage house with a warm glowing chimney, white fence, and a tiny green tree, capturing 100% house essence, front-and-center",
    "hausaufgabe": "A highly detailed, open 3D school notebook with neat rows of colorful pencil sketches, a glossy red apple, and a yellow pencil resting on it, front-and-center, 100% homework essence",
    "hausfrau": "A cheerful 3D female character wearing a cozy apron, holding a fresh tray of warm cookies in one hand and a glossy feather duster in the other, front-and-center",
    "hausmann": "A cheerful 3D male character wearing a stylish apron, holding a clean frying pan with a golden spatula and a glossy spray bottle, front-and-center",
    "heimat": "A heartwarming 3D landscape of rolling green hills, a small cozy house with a flying flag showing a golden heart outline, representing homeland, front-and-center",
    "heiraten": "Two spectacular, interlocking 3D wedding rings made of polished gold and sparkling diamonds, hovering over a shower of pink rose petals, front-and-center",
    "heißen": "A stylish, glossy 3D name tag badge with a glowing golden border and a cute star icon in the center, representing name and calling, front-and-center",
    "helfen": "A heartwarming 3D scene of a friendly character extending a warm hand to pull another character up onto a glowing golden ledge, representing help, front-and-center",
    "hell": "A magnificent, radiant 3D lightbulb bursting with dazzling, warm golden sunbeam rays that light up the entire frame with brilliant energy, front-and-center",
    "herd": "A spectacular, modern 3D kitchen stove cooker in sleek chrome and white enamel, with realistic glowing blue gas fire hobs and a steaming glossy pot, front-and-center",
    "herr": "An elegant, highly detailed 3D gentleman's set consisting of a black top hat, a glossy pink bow tie, and a polished gold-handled cane, front-and-center",
    "herzlich": "A gorgeous, radiant 3D pink glass heart radiating waves of soft-touch warm golden light, representing cordiality and sincere warmth, front-and-center",
    "heute": "A magnificent 3D desk calendar showing the current calendar page being highlighted by a glowing gold circle and sparkles, representing today, front-and-center",
    "hier": "A giant, glowing 3D location pin icon pointing directly down onto a single sparkling gold star on a glass grid floor, representing here, front-and-center",
    "hilfe": "A vibrant 3D lifesaver ring buoy painted in high-gloss red and white stripes, floating suspended, representing safety and rescue help, front-and-center",
    "hinten": "A cute 3D character smilingly peeking out from directly behind a giant, high-gloss 3D wooden storage box, representing behind or in the back, front-and-center",

    # Handcrafted premium SOTA metaphors for Cards 286 to 315 (hobby through kein)
    "hobby": "A stylized, premium 3D composition of miniature leisure items: a high-gloss colorful soccer ball, a shiny artist paintbrush with rainbow paint, and a glossy acoustic guitar, floating beautifully together in mid-air, front-and-center",
    "hoch": "A spectacular, ultra-glossy 3D tower of stacked colorful building blocks reaching high into the air, with a cute little bird perched happily on the very top block under a tiny fluffy cloud, front-and-center",
    "hochzeit": "Two beautiful, interlocking 3D wedding rings made of highly polished gold, floating in mid-air surrounded by gentle pink rose petals and glowing warm fairy lights, front-and-center",
    "holen": "A cute 3D puppy dog running happily towards the viewer, holding a bright-red high-gloss toy ball gently in its mouth, representing fetching, front-and-center",
    "hotel": "A majestic 3D miniature luxury hotel building with a curved glossy glass facade, a tiny glowing revolving entrance door, and a sleek modern 'H' flag fluttering on the roof, front-and-center",
    "hund": "A beautiful, highly detailed 3D golden retriever puppy sitting happily, looking up with big cute glossy eyes, capturing 100% dog essence, front-and-center",
    "hunger": "A cute 3D character looking with wide eyes at a delicious, steaming plate of spaghetti with a giant glossy meatball on top, surrounded by floating pink hearts of anticipation, front-and-center",
    "hähnchen": "A perfectly golden-brown, crispy 3D roasted chicken served on an elegant glossy white ceramic platter, with tiny steam curls rising from it, front-and-center",
    "hören": "A sleek, modern set of high-gloss white and pink wireless headphones, floating in mid-air with vibrant, colorful 3D music notes dancing around them, front-and-center",
    "ich": "A single cute, friendly 3D character smiling warmly and pointing its thumb towards its own chest with a happy expression, front-and-center",
    "immer": "A beautiful 3D infinity loop symbol made of smooth, glowing pink and blue glass, with tiny golden stars gliding perpetually along its track, front-and-center",
    "in": "A bright-red high-gloss toy sphere resting snugly nestled inside a transparent glass jar, clearly showcasing the concept of being inside, front-and-center",
    "information": "An ultra-glossy blue 3D information desk booth with a large, glowing warm-yellow lower-case 'i' symbol floating elegantly above it, front-and-center",
    "international": "A spectacular glowing 3D holographic globe of planet Earth, surrounded by miniature colorful paper airplanes flying in glowing circular orbits, representing global connections, front-and-center",
    "internet": "A sleek, glowing 3D ethernet globe made of translucent blue glass with glowing neon data lines connecting nodes across its surface, front-and-center",
    "ja": "A vibrant, ultra-glossy green 3D speech bubble containing a giant, glowing golden checkmark inside, floating in mid-air, front-and-center",
    "jacke": "A stylish, puffy 3D winter jacket in vibrant glossy pink and teal, floating in mid-air as if worn by an invisible figure, front-and-center",
    "jed-": "A row of five identical, neat 3D red apples on a glass shelf, with each apple having its own glowing golden star sticker on top, representing every one, front-and-center",
    "jetzt": "A beautiful 3D stopwatch with a bright-red ticking hand pointing exactly to the top, with a glowing neon ring highlighting the present moment, front-and-center",
    "job": "A professional, stylized arrangement of 3D executive items: a sleek leather briefcase, a polished silver fountain pen, and a glowing digital tablet showing progress charts, front-and-center",
    "jugendliche": "A cool, stylized 3D teenager character with a backward baseball cap and high-gloss sneakers, happily holding a skateboard under one arm, front-and-center",
    "jung": "A vibrant, tiny green seedling plant happily sprouting out from a cracked brown seed in rich soil, with a single sparkling dewdrop on its leaf, front-and-center",
    "junge": "A cute, smiling 3D boy character with wavy brown hair, wearing a glossy blue hoodie, waving happily towards the viewer, front-and-center",
    "kaffee": "A classic white 3D ceramic coffee mug overflowing with rich dark-brown coffee, casting a beautiful splash of liquid with a few floating glossy coffee beans, front-and-center",
    "kaputt": "A gorgeous, high-gloss pink 3D ceramic heart cleanly cracked into two neat halves, with a tiny golden band-aid trying to hold them together, front-and-center",
    "karte": "A neat fan of three highly detailed 3D playing cards, displaying a red heart, a blue spade, and a gold star symbol, completely wordless, front-and-center",
    "kartoffel": "A pair of cute, rustic-brown 3D potatoes with realistic bumpy textures, resting on a bed of fresh green leaves, floating in mid-air, front-and-center",
    "kasse": "A vintage-style 3D cash register made of glossy teal and chrome, with its drawer popped open to show sparkling golden coins inside, front-and-center",
    "kaufen": "A cute, glossy 3D shopping bag in pastel pink, with a pair of hands happily handing a shiny gold credit card to the bag, front-and-center",
    "kein": "A bright-red 3D circle with a diagonal slash (prohibition symbol) floating in front of an empty, clean glass pedestal, representing none or nothing, front-and-center",
    "kulturell": "A spectacular, highly-detailed 3D miniature model of a historic museum temple with glowing marble columns and floating cultural mask relics, front-and-center, premium SOTA asset",
    "kunde": "An adorable 3D cartoon character holding a glossy shopping bag and a receipt, receiving a warm handshake, front-and-center, premium SOTA asset",
    "kurs": "A majestic 3D graduation cap resting on a stack of colorful textbooks, surrounded by floating golden stars, front-and-center, premium SOTA asset",
    "können": "An adorable, muscular 3D cartoon character lifting a giant glossy gold dumbbell with a single finger, smiling with supreme confidence, front-and-center, premium SOTA asset",
    "kühlschrank": "A spectacular 3D retro-style refrigerator in high-gloss pastel blue with chrome handles, open to reveal colorful glossy food and glowing interior light, front-and-center, premium SOTA asset",
    "lächeln": "A giant, radiant 3D yellow smiling face emoji with beautiful glistening starlit eyes and a warm glossy smile, surrounded by colorful sparkles, front-and-center, premium SOTA asset",
    "laden": "A highly-detailed, cozy 3D brick shop storefront with a striped pink awning, glass display window showing tiny colorful items, and a glowing welcoming open door, front-and-center, premium SOTA asset",
    "lampe": "An elegant, modern 3D designer desk lamp with a high-gloss pink shade, casting a warm glowing cone of yellow light onto a small green succulent plant, front-and-center, premium SOTA asset",
    "landen": "A beautiful, glossy 3D white passenger airplane touching down smoothly on a mini high-contrast runway segment, with a small green checkmark flag waving, front-and-center, premium SOTA asset",
    "land": "A stunning, stylized 3D miniature landscape segment of rolling green hills, a winding blue river, and a tiny rustic cottage with a flying heart-shaped flag, front-and-center, premium SOTA asset",
    "lang": "A sleek, incredibly long 3D limousine in ultra-glossy hot pink, stretching across a glass baseline grid, illustrating extreme length, front-and-center, premium SOTA asset",
    "lange": "A beautiful 3D pocket watch with glowing golden clock hands spinning slowly, trailing a soft trail of golden dust, front-and-center, premium SOTA asset",
    "langsam": "An adorable, high-gloss 3D claymation snail crawling slowly along a shiny green leaf, leaving a trail of sparkling silver glitter, front-and-center, premium SOTA asset",
    "laufen": "A pair of highly-detailed, ultra-glossy 3D athletic running shoes in hot pink and glowing cyan, dynamically running forward on a glowing glass path, front-and-center, premium SOTA asset",
    "laut": "A vibrant, glossy pink 3D megaphone loudspeaker with glowing golden soundwaves radiating outward in a dark studio void, front-and-center, premium SOTA asset",
    "leben": "An adorable, high-gloss 3D character watering a vibrant, glowing green seedling plant with a small pink heart floating over it, front-and-center, premium SOTA asset",
    "das leben": "A majestic 3D tree of life with glowing golden roots, translucent green glass leaves, and floating star sparkles, front-and-center, premium SOTA asset",
    "das lebensmittel": "A spectacular 3D grocery basket overflowing with high-gloss colorful fruits, vegetables, bread, and a carton of milk, front-and-center, premium SOTA asset",
    "ledig": "An adorable single 3D puzzle piece with a little smiling face and tiny sparkles, standing proudly alone, representing single independence, front-and-center, premium SOTA asset",
    "legen": "A gentle, stylized 3D hand carefully laying a beautiful glowing golden egg into a cozy, soft-blue bird nest, representing the action of laying or putting down, front-and-center, premium SOTA asset",
    "leicht": "An elegant, glowing pink helium balloon floating gracefully in mid-air, with a tiny golden feather tied to its string, representing being lightweight and easy, front-and-center, premium SOTA asset",
    "leider": "An adorable, sad 3D character looking downcast while a tiny, fluffy blue raincloud floats right above its head, dropping a single glistening blue raindrop, representing unfortunately, front-and-center, premium SOTA asset",
    "leise": "An adorable, quiet 3D character with a finger pressed gently to its lips in a 'shh' gesture, next to a soft, glowing pink feather floating in mid-air, representing quietness, front-and-center, premium SOTA asset",
    "lernen": "A cute, smiling 3D character wearing thick round specs, sitting happily at a modern desk and writing in a high-gloss notebook, with glowing yellow lightbulbs and gold stars of knowledge floating around, representing learning, front-and-center, premium SOTA asset",
    "lesen": "A massive, open 3D book with bright glossy illustrations, with a beautiful pair of translucent pink-rimmed reading glasses floating gracefully above its pages, representing reading, front-and-center, premium SOTA asset",
    "letzt": "A magnificent 3D hourglass with the very last grain of golden sand poised to fall through its glass neck, next to a sleek black checkered finish-line flag, representing the final or last moment, front-and-center, premium SOTA asset",
    "leute": "A vibrant, cheerful group of diverse 3D claymation characters standing together, smiling, waving, and holding hands on a glossy pink circular stage, representing people, front-and-center, premium SOTA asset",
    "licht": "A majestic 3D light bulb made of translucent glassmorphism layers, with a tiny, glowing yellow sun shining brightly inside as its filament, radiating soft-yellow light waves, front-and-center, premium SOTA asset",
    "lieb": "An adorable, smiling 3D pink teddy bear holding a big glowing gold heart to its chest, representing kindness and dearness, front-and-center, premium SOTA asset",
    "lieben": "Two cute 3D claymation characters sitting side-by-side on a bench, holding hands, with a giant glowing translucent pink glass heart floating above them, representing love, front-and-center, premium SOTA asset",
    "lieber": "A beautiful 3D split path with a cute character happily choosing a glowing golden path over a grey path, representing preference or rather, front-and-center, premium SOTA asset",
    "lied": "A spectacular, shiny 3D golden vinyl record spinning gracefully on a modern pink turntable, with beautiful glowing neon-teal music notes floating up from it, representing a song, front-and-center, premium SOTA asset",
    "liegen": "A cozy, stylized 3D character lying comfortably asleep on a fluffy pink cloud-like mattress, with a small glowing golden crescent moon and twinkling stars floating above, representing lying down, front-and-center, premium SOTA asset",
    "links": "A stylized, high-gloss 3D highway sign with a bright-green board featuring a bold, glowing neon-pink arrow pointing sharply to the left, decorated with sparkling gold stars, floating in mid-air, front-and-center, premium SOTA 3D icon",
    "lkw": "A magnificent, high-gloss 3D cargo truck painted in vibrant royal blue and metallic silver, with huge detailed rubber wheels and glowing headlights, speeding forward on a tiny curving road, front-and-center, premium SOTA asset",
    "lokal": "A highly stylized, cozy 3D pub storefront with a colorful striped awning, warm glowing windows showing mini tables and mugs of beer, and a completely wordless hanging wooden sign, front-and-center, premium SOTA asset",
    "löffel": "A glossy, chrome and pastel-pink 3D soup spoon, perfectly polished with bright studio reflections, holding a giant, cute smiling 3D honey drop with tiny sparkling stars around it, floating in mid-air, front-and-center, premium SOTA asset",
    "lücke": "A highly-stylized, high-gloss 3D row of blue puzzle pieces aligned perfectly on a glass tray, with exactly one missing piece in the center creating a clean, cute glowing gap, surrounded by subtle questioning sparkles, front-and-center, premium SOTA asset",
    "lösung": "A beautiful 3D puzzle sphere with its final glowing golden puzzle piece fitting perfectly into its slot, with golden stars and light rays shooting out, representing a brilliant solution, front-and-center, premium SOTA asset",
    "lustig": "An adorable, ultra-glossy 3D yellow emoji face laughing so hard it is crying happy blue crystal tears, slightly tilted in mid-air and surrounded by floating pink musical notes and colorful confetti bursts, front-and-center, premium SOTA asset",
    "machen": "A cute 3D character with bright blue overalls, holding a gleaming wooden hammer, happily building a small, beautiful pink toy birdhouse on a modern glass workbench, with tiny golden sparks of creativity, front-and-center, premium SOTA asset",
    "man": "A beautiful, abstract 3D stylized circular human silhouette surrounded by a soft pink glowing ring, representing 'one' or 'someone' in general, front-and-center, premium SOTA asset",
    "mann": "A stylish, highly-polished 3D professional male character in a sharp modern blue suit, looking confident and smiling, representing a man, front-and-center, premium SOTA asset",
    "maschine": "A highly-stylized, high-tech 3D factory machine made of glossy white panels and chrome gears, with a glowing green status bar and tiny floating sparkles of efficiency, front-and-center, premium SOTA asset",
    "meer": "A beautiful, premium 3D beach shore with stylized blue translucent clay ocean waves washing onto golden clay sand, with a tiny glossy pink umbrella and a shiny starfish, front-and-center, premium SOTA asset",
    "mehr": "An ultra-premium, cute 3D glossy yellow bar chart where the columns grow taller from left to right, topped with a glowing golden plus sign and sparkling stars, representing 'more', front-and-center, premium SOTA asset",
    "mein": "An adorable, highly-polished 3D hand holding a sparkling, translucent pink heart closely to a stylized chest, representing personal ownership or 'my', surrounded by soft gold sparkles, front-and-center, premium SOTA asset",
    "meist": "A stunning, modern 3D circle chart with a huge, glossy blue section representing the majority, flanked by a tiny pastel pink section, with elegant gold stars floating around representing 'most', front-and-center, premium SOTA asset",
    "mensch": "A cute, highly-polished 3D clay human figure standing confidently with open arms, featuring a warm friendly smile and a soft, pastel-colored circular halo background, representing humanity, front-and-center, premium SOTA asset",
    "miete": "A beautiful 3D model of a glossy small house being handed over with a sparkling gold coin and a tiny glowing document with a key on it, representing paying rent, front-and-center, premium SOTA asset",
    "mieten": "A cute 3D glossy yellow car with a large, shiny tag reading 'RENTED' next to a smiling key character floating in mid-air, representing renting, front-and-center, premium SOTA asset",
    "milch": "A highly-stylized 3D milk glass bottle with a cute light-blue cow spot pattern label and a beautiful splash of white liquid pouring out with small glossy stars around, front-and-center, premium SOTA asset",
    "mit": "Two adorable, different colored 3D puzzle pieces fitting perfectly together, with a golden ring of connection and sparkling stars, representing being together or 'with', front-and-center, premium SOTA asset",
    "mitbringen": "An adorable 3D character carrying a beautifully wrapped pink gift box with a glossy yellow ribbon while walking happily, representing bringing along, front-and-center, premium SOTA asset",
    "mitkommen": "An adorable 3D character waving happily to another character, inviting them to walk together on a winding golden path, representing coming along, front-and-center, premium SOTA asset",
    "mitmachen": "A group of cute, smiling 3D clay characters placing their colorful hands together in a circle, with tiny golden sparks of team spirit floating around, representing participating, front-and-center, premium SOTA asset",
    "mitnehmen": "An adorable 3D character walking with a cute little rolling pink suitcase and holding a smiling puppy under their arm, representing taking things along, front-and-center, premium SOTA asset",
    "mitte": "A glossy, modern 3D archery target board with a glowing golden arrow hitting exactly in the absolute center bullseye, with shiny star sparkles, representing the middle, front-and-center, premium SOTA asset",
    "moment": "A magnificent, glowing 3D pocket watch with a cute stylized clock face, where a tiny, glossy golden camera flash goes off, capturing a single precious moment, front-and-center, premium SOTA asset",
    "morgen": "A beautiful, premium 3D rising sun over rolling green hills, next to a cute glossy calendar page flipping to the next day, representing tomorrow, front-and-center, premium SOTA asset",
    "mund": "An adorable, highly-stylized 3D glossy pink mouth smiling warmly and happily, with clean white teeth and a tiny sparkle on the side, front-and-center, premium SOTA asset",
    "mutter": "An adorable 3D claymother character with warm, smiling eyes, tenderly hugging her small smiling child, surrounded by glowing golden hearts of love, front-and-center, premium SOTA asset",
    "mädchen": "A cute, highly-polished 3D clay girl character with bright pink hair in twin pigtails, wearing a cheerful blue dress and a warm friendly smile, front-and-center, premium SOTA asset",
    "männlich": "A stylish, highly-polished 3D glossy blue shield icon with a bold, glowing golden male gender symbol in the center, representing masculinity, front-and-center, premium SOTA asset",
    "möbel": "A cozy and stylish 3D modern living room furniture set, featuring a cute pink clay armchair, a small light-wood coffee table with a steaming cup of tea, and a sleek green potted plant, front-and-center, premium SOTA asset",
    "möchten": "A delightful 3D representation of wishing or wanting, showing a cute clay character looking dreamily at a soft pink thinking bubble containing a golden star and a wrapped gift box, front-and-center, premium SOTA asset",
    "mögen": "A beautiful 3D representation of liking something, featuring a vibrant glossy red heart icon surrounded by bright yellow spark stars and a golden thumbs-up emblem, front-and-center, premium SOTA asset",
    "möglich": "A sleek 3D representation of possibility, displaying a glowing green road sign with an arrow pointing upward to a sunny sky, with a golden checkmark on the side, representing a path of potential, front-and-center, premium SOTA asset",
    "müde": "An adorable, sleepy 3D crescent moon wearing a cozy nightcap, resting gently on a soft, fluffy white cloud with tiny floating 'Zzz' sleep symbols, representing tired, front-and-center, premium SOTA asset",
    "müssen": "A bold 3D representation of necessity and obligation, featuring a bright orange traffic warning sign carrying a bold exclamation mark (!) beside a polished chrome ticking clock, representing urgent priority and duty, front-and-center, premium SOTA asset",
    "name": "A beautiful and elegant 3D glossy white name tag badge with a gold border, featuring a gold star in the center and a shiny gold cursive signature scroll hovering above it, representing name, front-and-center, premium SOTA asset",
    "nehmen": "An adorable and dynamic 3D clay hand reaching down and gently grasping a glowing, golden star from a dark rounded base, representing taking or selecting something, front-and-center, premium SOTA asset",
    "nein": "A giant, sleek 3D red stop sign with a polished glossy finish, carrying a bold white hand palm-forward gesture in the center, symbolizing a clear and friendly 'no', front-and-center, premium SOTA asset",
    "neu": "A magnificent 3D gift box painted in ultra-glossy turquoise, bursting open to reveal a glowing, self-illuminating golden star rising up in a cloud of colorful sparkling confetti, representing something brand new, front-and-center, premium SOTA asset",
    "nicht": "A giant, bold red 3D crossed-out circle symbol made of polished glossy plastic, hovering over a translucent blue checkmark to negate it, representing 'not' or negation, front-and-center, premium SOTA asset",
    "nichts": "An elegant, empty 3D transparent glass jar with a polished golden lid, showing absolute empty space inside with just a tiny floating sparkle of light, representing 'nothing', front-and-center, premium SOTA asset",
    "nie": "A magnificent 3D clock face with no clock-hands, featuring a giant, high-gloss red crossed-out circle symbol over the dial, representing 'never' or timeless impossibility, front-and-center, premium SOTA asset",
    "noch": "A beautiful 3D hourglass made of translucent glassmorphism, with golden sand still actively flowing down from the top bulb, representing 'still' or 'yet' in progress, front-and-center, premium SOTA asset",
    "normal": "A sleek 3D gauge meter with its glowing pointer perfectly centered on the green 'normal' status zone, with a gentle soft-green ambient glow, representing normal or standard state, front-and-center, premium SOTA asset",
    "die nummer": "A towering, highly polished 3D arrangement of the numbers '1', '2', and '3' made of vibrant pink and blue enamel and gold trim, neatly floating together as a single block, representing numbers, front-and-center, premium SOTA asset",
    "nummer": "A towering, highly polished 3D arrangement of the numbers '1', '2', and '3' made of vibrant pink and blue enamel and gold trim, neatly floating together as a single block, representing numbers, front-and-center, premium SOTA asset",
    "nur": "A single, beautiful 3D pink rose resting in a minimalist, transparent glass vase, perfectly highlighted under a soft golden spotlight in a dark void, representing 'only' or 'just one', front-and-center, premium SOTA asset",
    "nächst-": "A sleek 3D queue of glossy spheres on a track, with a glowing green arrow pointing sharply to the very next sphere in line which is illuminated in bright gold, representing 'next', front-and-center, premium SOTA asset",
    "nächst": "A sleek 3D queue of glossy spheres on a track, with a glowing green arrow pointing sharply to the very next sphere in line which is illuminated in bright gold, representing 'next', front-and-center, premium SOTA asset",
    "oben": "An elegant 3D model of a spiral staircase made of white polished wood, with a bold, glowing neon-pink arrow pointing sharply upwards to a cozy glowing light above, representing 'above' or 'upstairs', front-and-center, premium SOTA asset",
    "das obst": "A premium, highly-detailed 3D arrangement of fresh, glossy fruits such as a beautiful bunch of purple grapes, a sliced shiny orange, and a glossy red apple sitting beautifully together, representing fruit, front-and-center, premium SOTA asset",
    "obst": "A premium, highly-detailed 3D arrangement of fresh, glossy fruits such as a beautiful bunch of purple grapes, a sliced shiny orange, and a glossy red apple sitting beautifully together, representing fruit, front-and-center, premium SOTA asset",
    "oft": "A stylized 3D desk calendar showing a week where almost every single day is marked with a beautiful, glowing golden checkmark sticker, representing high frequency or doing something often, front-and-center, premium SOTA asset",
    "die oma": "An adorable, smiling 3D claymation grandmother character wearing cute round glasses, a cozy hand-knitted lavender cardigan, and her silver hair tied in a neat bun, with glowing golden hearts around her, representing grandma, front-and-center, premium SOTA asset",
    "oma": "An adorable, smiling 3D claymation grandmother character wearing cute round glasses, a cozy hand-knitted lavender cardigan, and her silver hair tied in a neat bun, with glowing golden hearts around her, representing grandma, front-and-center, premium SOTA asset",
    "der opa": "An adorable, smiling 3D claymation grandfather character with a friendly face, wearing cute wire-rimmed glasses, a warm tweed-green waistcoat over a white collar shirt, and his neat white hair combed back, with glowing golden stars of warmth around him, representing grandpa, front-and-center, premium SOTA asset",
    "opa": "An adorable, smiling 3D claymation grandfather character with a friendly face, wearing cute wire-rimmed glasses, a warm tweed-green waistcoat over a white collar shirt, and his neat white hair combed back, with glowing golden stars of warmth around him, representing grandpa, front-and-center, premium SOTA asset",
    "die ordnung": "A pristine and beautiful 3D stack of perfectly folded pastel-colored t-shirts sitting next to a neat desk organizer containing perfectly arranged glossy pens, representing absolute order, tidiness, and cleanliness, front-and-center, premium SOTA asset",
    "ordnung": "A pristine and beautiful 3D stack of perfectly folded pastel-colored t-shirts sitting next to a neat desk organizer containing perfectly arranged glossy pens, representing absolute order, tidiness, and cleanliness, front-and-center, premium SOTA asset",
    "der ort": "A giant, glowing neon-pink 3D location map pin hovering over a beautifully detailed miniature model of a clean, cozy European town with tiny houses, trees, and small paths, representing place or town, front-and-center, premium SOTA asset",
    "ort": "A giant, glowing neon-pink 3D location map pin hovering over a beautifully detailed miniature model of a clean, cozy European town with tiny houses, trees, and small paths, representing place or town, front-and-center, premium SOTA asset",
    "das papier": "A highly stylized 3D ream of pure white glossy paper, with the top sheet elegant and curling upward slightly to show exquisite paper texture, reflecting warm studio lights, representing paper, front-and-center, premium SOTA asset",
    "papier": "A highly stylized 3D ream of pure white glossy paper, with the top sheet elegant and curling upward slightly to show exquisite paper texture, reflecting warm studio lights, representing paper, front-and-center, premium SOTA asset",
    "die papiere": "An ultra-premium, elegant 3D leather portfolio case standing open, revealing a neat stack of formal white document sheets with golden official wax seals and neat signatures, representing official documents/papers, front-and-center, premium SOTA asset",
    "papiere": "An ultra-premium, elegant 3D leather portfolio case standing open, revealing a neat stack of formal white document sheets with golden official wax seals and signatures, representing official documents/papers, front-and-center, premium SOTA asset",
    "der partner": "An adorable, high-gloss 3D claymation male character wearing a neat blue suit, standing next to and smiling towards his female counterpart, with small golden stars of companionship, representing partner, front-and-center, premium SOTA asset",
    "partner": "An adorable, high-gloss 3D claymation male character wearing a neat blue suit, standing next to and smiling towards his female counterpart, with small golden stars of companionship, representing partner, front-and-center, premium SOTA asset",
    "die partnerin": "An adorable, high-gloss 3D claymation female character wearing a cozy lavender jacket, standing next to and smiling towards her male counterpart, with small golden stars of companionship, representing partner, front-and-center, premium SOTA asset",
    "partnerin": "An adorable, high-gloss 3D claymation female character wearing a cozy lavender jacket, standing next to and smiling towards her male counterpart, with small golden stars of companionship, representing partner, front-and-center, premium SOTA asset",
    "die party": "A spectacular, festive 3D arrangement featuring a large high-gloss disco ball reflecting pink and blue laser lights, surrounded by colorful floating balloons and sparkling gold confetti, representing party or celebration, front-and-center, premium SOTA asset",
    "party": "A spectacular, festive 3D arrangement featuring a large high-gloss disco ball reflecting pink and blue laser lights, surrounded by colorful floating balloons and sparkling gold confetti, representing party or celebration, front-and-center, premium SOTA asset",
    "der pass": "A beautiful 3D passport booklet made of deep navy-blue textured leather with an elegant gold-embossed seal on the cover, standing slightly open to reveal a glossy visa stamp page, representing passport, front-and-center, premium SOTA asset",
    "pass": "A beautiful 3D passport booklet made of deep navy-blue textured leather with an elegant gold-embossed seal on the cover, standing slightly open to reveal a glossy visa stamp page, representing passport, front-and-center, premium SOTA asset",
    "die pause": "An elegant, cozy 3D representation of taking a break, displaying a steaming cup of coffee in a pastel-pink mug sitting next to a polished silver stopwatch showing a paused state, with small floating musical notes, representing pause or break, front-and-center, premium SOTA asset",
    "pause": "An elegant, cozy 3D representation of taking a break, displaying a steaming cup of coffee in a pastel-pink mug sitting next to a polished silver stopwatch showing a paused state, with small floating musical notes, representing pause or break, front-and-center, premium SOTA asset",

    # Hand-curated SOTA 3D metaphors for Cards 441 to 461
    "die postleitzahl": "A magnificent 3D envelope floating in mid-air, with a giant glowing neon-pink stamp showing a bold, glowing numerical zip-code pattern 12345, surrounded by glowing golden spark stars, completely wordless, representing a postal code, front-and-center, premium SOTA asset",
    "postleitzahl": "A magnificent 3D envelope floating in mid-air, with a giant glowing neon-pink stamp showing a bold, glowing numerical zip-code pattern 12345, surrounded by glowing golden spark stars, completely wordless, representing a postal code, front-and-center, premium SOTA asset",
    "das praktikum": "A cute 3D character of a smiling young intern wearing a neat orange lanyard badge, happily carrying a shiny silver laptop and a stack of colorful textbooks, floating in mid-air, completely wordless, representing an internship, front-and-center, premium SOTA asset",
    "praktikum": "A cute 3D character of a smiling young intern wearing a neat orange lanyard badge, happily carrying a shiny silver laptop and a stack of colorful textbooks, floating in mid-air, completely wordless, representing an internship, front-and-center, premium SOTA asset",
    "die praxis": "A beautiful 3D model of a doctor's clinic office with a polished wood door, a glowing red cross medical sign, a sleek silver stethoscope, and a small green potted plant beside it, floating in mid-air, completely wordless, representing a medical practice, front-and-center, premium SOTA asset",
    "praxis": "A beautiful 3D model of a doctor's clinic office with a polished wood door, a glowing red cross medical sign, a sleek silver stethoscope, and a small green potted plant beside it, floating in mid-air, completely wordless, representing a medical practice, front-and-center, premium SOTA asset",
    "der preis": "A giant, vibrant pink 3D price tag with a golden string, adorned with a large glossy dollar symbol ($) and a trail of sparkling gold coins, floating suspended in a dark studio void, completely wordless, representing price, front-and-center, premium SOTA asset",
    "preis": "A giant, vibrant pink 3D price tag with a golden string, adorned with a large glossy dollar symbol ($) and a trail of sparkling gold coins, floating suspended in a dark studio void, completely wordless, representing price, front-and-center, premium SOTA asset",
    "das problem": "A beautiful 3D representation of a problem, featuring a giant, tangled knot of glowing pink and blue glass cords with a tiny cute lightbulb at its center representing finding a way out, floating in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "problem": "A beautiful 3D representation of a problem, featuring a giant, tangled knot of glowing pink and blue glass cords with a tiny cute lightbulb at its center representing finding a way out, floating in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "der prospekt": "A beautifully folded, high-gloss 3D travel brochure displaying vibrant colorful graphics of palm trees and a sunny beach, standing slightly open in mid-air, completely wordless, representing a pamphlet, front-and-center, premium SOTA asset",
    "prospekt": "A beautifully folded, high-gloss 3D travel brochure displaying vibrant colorful graphics of palm trees and a sunny beach, standing slightly open in mid-air, completely wordless, representing a pamphlet, front-and-center, premium SOTA asset",
    "die prüfung": "A magnificent 3D exam paper with an A+ grade written inside a glowing red circle, next to a shiny gold pen and floating gold stars, representing a successful test, completely wordless, front-and-center, premium SOTA asset",
    "prüfung": "A magnificent 3D exam paper with an A+ grade written inside a glowing red circle, next to a shiny gold pen and floating gold stars, representing a successful test, completely wordless, front-and-center, premium SOTA asset",
    "pünktlich": "A vibrant 3D clock with cute little wings, pointing precisely to 12 o'clock, with a green checkmark next to it, representing being perfectly on time, floating in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "rauchen": "A stylized, high-gloss 3D warning sign displaying a crossed-out grey cigarette icon with a clean, red diagonal line, representing a no-smoking zone, completely wordless, front-and-center, premium SOTA asset",
    "der raum": "A beautiful 3D isometric cutaway model of a clean, cozy modern room, with a soft-touch pink armchair, a small bookshelf, and a warm glowing floor lamp, floating suspended, completely wordless, front-and-center, premium SOTA asset",
    "raum": "A beautiful 3D isometric cutaway model of a clean, cozy modern room, with a soft-touch pink armchair, a small bookshelf, and a warm glowing floor lamp, floating suspended, completely wordless, front-and-center, premium SOTA asset",
    "die rechnung": "A highly-detailed 3D paper bill receipt with a neat row of items, a giant shiny green checkmark stamp on it, and several floating golden coins, representing payment, completely wordless, front-and-center, premium SOTA asset",
    "rechnung": "A highly-detailed 3D paper bill receipt with a neat row of items, a giant shiny green checkmark stamp on it, and several floating golden coins, representing payment, completely wordless, front-and-center, premium SOTA asset",
    "rechts": "A stylized 3D highway sign with a bright-green board featuring a bold, glowing neon-pink arrow pointing sharply to the right, decorated with sparkling gold stars, floating in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "der regen": "A beautiful 3D dark-blue raincloud with realistic fluffy textures, dropping crystal-clear, translucent blue water drops onto a small glowing green leaf, floating suspended, completely wordless, front-and-center, premium SOTA asset",
    "regen": "A beautiful 3D dark-blue raincloud with realistic fluffy textures, dropping crystal-clear, translucent blue water drops onto a small glowing green leaf, floating suspended, completely wordless, front-and-center, premium SOTA asset",
    "regnen": "A cute, glossy 3D pastel-pink umbrella opened in mid-air, with beautiful crystal-clear blue raindrops splashing gently off its curved canopy, representing active raining, completely wordless, front-and-center, premium SOTA asset",
    "der reis": "A gorgeous 3D steaming white porcelain bowl filled to the brim with fluffy, pearl-white cooked rice, with a pair of polished dark wood chopsticks resting across the top, completely wordless, front-and-center, 100% rice essence, premium SOTA asset",
    "reis": "A gorgeous 3D steaming white porcelain bowl filled to the brim with fluffy, pearl-white cooked rice, with a pair of polished dark wood chopsticks resting across the top, completely wordless, front-and-center, 100% rice essence, premium SOTA asset",
    "die reise": "A beautiful 3D suitcase in pastel pink next to a mini glowing model of an airplane orbiting a small globe, representing travel and journey, completely wordless, front-and-center, premium SOTA asset",
    "reise": "A beautiful 3D suitcase in pastel pink next to a mini glowing model of an airplane orbiting a small globe, representing travel and journey, completely wordless, front-and-center, premium SOTA asset",
    "das reisebüro": "A stylish 3D travel agency storefront with a large glowing airplane icon above the entrance, tropical palm trees in pots, and a completely blank glowing display board, completely wordless, front-and-center, premium SOTA asset",
    "reisebüro": "A stylish 3D travel agency storefront with a large glowing airplane icon above the entrance, tropical palm trees in pots, and a completely blank glowing display board, completely wordless, front-and-center, premium SOTA asset",
    "der reiseführer": "An elegant 3D travel guidebook bound in textured teal leather, standing open to show a colorful miniature model of a compass and map, completely wordless, front-and-center, premium SOTA asset",
    "reiseführer": "An elegant 3D travel guidebook bound in textured teal leather, standing open to show a colorful miniature model of a compass and map, completely wordless, front-and-center, premium SOTA asset",
    "reisen": "A cute 3D explorer character happily carrying a camera and walking on a tiny floating model of a world map, representing traveling, completely wordless, front-and-center, premium SOTA asset",
    "die reparatur": "A detailed 3D composition showing a golden gear being repaired by a shiny silver wrench, with small sparkles of restoration, completely wordless, front-and-center, premium SOTA asset",
    "reparatur": "A detailed 3D composition showing a golden gear being repaired by a shiny silver wrench, with small sparkles of restoration, completely wordless, front-and-center, premium SOTA asset",
    "reparieren": "A cute 3D mechanic character wearing a cap, happily fixing a high-tech glowing gear with a chrome screwdriver, completely wordless, front-and-center, premium SOTA asset",
    "repariert": "A cute 3D mechanic character wearing a cap, happily fixing a high-tech glowing gear with a chrome screwdriver, completely wordless, front-and-center, premium SOTA asset",
    "das restaurant": "A gorgeous 3D isometric restaurant storefront with a warm glowing interior, stylish red-and-white striped canopy, a tiny outdoor dinner table with a candle and plates, and miniature potted plants, completely wordless, front-and-center, premium SOTA asset",
    "restaurant": "A gorgeous 3D isometric restaurant storefront with a warm glowing interior, stylish red-and-white striped canopy, a tiny outdoor dinner table with a candle and plates, and miniature potted plants, completely wordless, front-and-center, premium SOTA asset",
    "die rezeption": "A premium 3D hotel reception desk with a smooth dark-wood counter, a polished bronze service bell, a tiny glowing desk lamp, and a small key rack with dangling brass keys behind it, completely wordless, front-and-center, premium SOTA asset",
    "rezeption": "A premium 3D hotel reception desk with a smooth dark-wood counter, a polished bronze service bell, a tiny glowing desk lamp, and a small key rack with dangling brass keys behind it, completely wordless, front-and-center, premium SOTA asset",
    "richtig": "A bold, high-gloss 3D green checkmark symbol with a glossy circular badge and glittering gold stars floating around it, representing correct/right, completely wordless, front-and-center, premium SOTA asset",
    "riechen": "An elegant 3D porcelain bottle of pink perfume standing slightly open, with gorgeous stylized, semi-translucent pink-and-gold scent swirls and small flowers drifting into the air, representing smell, completely wordless, front-and-center, premium SOTA asset",
    "ruhig": "A gorgeous 3D sleeping moon character resting on a soft-touch fluffy white cloud, wearing a cozy blue nightcap, with small golden stars slowly floating around, representing peaceful quietness, completely wordless, front-and-center, premium SOTA asset",
    "der saft": "A vibrant, high-gloss 3D glass of orange juice with a retro pink-and-white striped straw, a fresh glossy orange slice on the rim, and beautiful splashing juice droplets, completely wordless, front-and-center, premium SOTA asset",
    "saft": "A vibrant, high-gloss 3D glass of orange juice with a retro pink-and-white striped straw, a fresh glossy orange slice on the rim, and beautiful splashing juice droplets, completely wordless, front-and-center, premium SOTA asset",
    "sagen": "A cute, friendly 3D speech bubble character in warm yellow enamel, with a smiling face and animated speed marks indicating active speaking, completely wordless, front-and-center, premium SOTA asset",
    "der salat": "A spectacular, glossy 3D white ceramic bowl filled to the brim with highly-detailed, fresh green lettuce leaves, glossy red cherry tomatoes, and cucumber slices, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "salat": "A spectacular, glossy 3D white ceramic bowl filled to the brim with highly-detailed, fresh green lettuce leaves, glossy red cherry tomatoes, and cucumber slices, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "das salz": "An elegant 3D glass shaker with a polished chrome cap, filled with sparkling white salt crystals, with a small pinch of salt spilling gently, completely wordless, front-and-center, premium SOTA asset",
    "salz": "An elegant 3D glass shaker with a polished chrome cap, filled with sparkling white salt crystals, with a small pinch of salt spilling gently, completely wordless, front-and-center, premium SOTA asset",
    "die s-bahn": "A cute, ultra-modern 3D high-speed suburban train in high-gloss white and red enamel, traveling on a small curved segment of glossy silver tracks, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "s-bahn": "A cute, ultra-modern 3D high-speed suburban train in high-gloss white and red enamel, traveling on a small curved segment of glossy silver tracks, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "der schalter": "A sleek 3D customer counter in glossy turquoise and light wood, with a small silver call bell and a tiny glowing glass screen displaying an arrow pointing forward, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "schalter": "A sleek 3D customer counter in glossy turquoise and light wood, with a small silver call bell and a tiny glowing glass screen displaying an arrow pointing forward, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "scheinen": "A cheerful, warm-yellow 3D sun character smiling gently, casting stylized solid golden light rays that illuminate a tiny glossy green leaf floating below, completely wordless, front-and-center, premium SOTA asset",
    "schicken": "A cute 3D parcel wrapped in bright brown paper with a glossy red ribbon and bow, flying through the air with a pair of tiny white wings, completely wordless, front-and-center, premium SOTA asset",
    "das schild": "An elegant, stylized 3D wooden street signpost standing in a tiny green grassy base, holding a glossy blank turquoise metal sign, completely wordless, front-and-center, premium SOTA asset",
    "schild": "An elegant, stylized 3D wooden street signpost standing in a tiny green grassy base, holding a glossy blank turquoise metal sign, completely wordless, front-and-center, premium SOTA asset",
    "der schinken": "A delicious 3D dry-cured ham leg with a glossy dark-brown outer skin, sliced open to reveal marbled dark-pink meat, resting on an elegant, small light-wood carving rack, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "schinken": "A delicious 3D dry-cured ham leg with a glossy dark-brown outer skin, sliced open to reveal marbled dark-pink meat, resting on an elegant, small light-wood carving rack, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "schlafen": "A sleeping cute 3D star character with a peaceful smile and closed eyes, nestled snugly under a soft-touch pastel-blue blanket, floating suspended in mid-air with small glowing golden sparkles around it, completely wordless, front-and-center, premium SOTA asset",
    "schlecht": "A funny, sick-looking green 3D emoji character with a thermometer in its mouth, a cold wet compress sitting on its head, and swirly dizzy eyes, representing feeling bad or sick, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "schließen": "A sleek 3D key turning inside a polished silver padlock that is snapping shut with a satisfying metallic action-effect sparkle, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "der schluss": "A beautiful 3D crimson theater stage curtain drawn completely closed, illuminated by a warm spotlight beam, with tiny golden confetti sparkles floating in the air, representing the end of a show, completely wordless, front-and-center, premium SOTA asset",
    "schluss": "A beautiful 3D crimson theater stage curtain drawn completely closed, illuminated by a warm spotlight beam, with tiny golden confetti sparkles floating in the air, representing the end of a show, completely wordless, front-and-center, premium SOTA asset",
    "der schlüssel": "A polished, bright-golden 3D antique skeleton key with an ornate heart-shaped bow, floating suspended in mid-air with elegant golden sparkles around it, completely wordless, front-and-center, premium SOTA asset",
    "schlüssel": "A polished, bright-golden 3D antique skeleton key with an ornate heart-shaped bow, floating suspended in mid-air with elegant golden sparkles around it, completely wordless, front-and-center, premium SOTA asset",
    "schmecken": "A cute 3D star-shaped character with closed eyes, licking its lips with a happy pink tongue, floating next to a delicious, glossy slice of strawberry cake with fluffy white whipped cream and a cherry, representing tasting delicious food, completely wordless, front-and-center, premium SOTA asset",
    "schnell": "A sleek, ultra-modern 3D athletic sneaker in electric-blue and neon-yellow enamel, with stylized white wind-streak smoke trails behind it indicating high-speed motion, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "schon": "A sleek, high-gloss 3D pocket watch with spinning hands, standing next to a giant glossy green checkmark symbol, representing already completed, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "der schrank": "A stylish, cozy 3D wooden wardrobe closet with soft pastel-pink doors, slightly open to reveal neatly folded colorful clothes and hangers inside, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "schrank": "A stylish, cozy 3D wooden wardrobe closet with soft pastel-pink doors, slightly open to reveal neatly folded colorful clothes and hangers inside, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "schreiben": "A beautiful 3D antique fountain pen with a shiny silver nib, writing elegant, flowing cursive loops on a smooth white paper scroll, floating in mid-air with tiny ink splash droplets, completely wordless, front-and-center, premium SOTA asset",
    "der schuh": "A classic, high-end 3D leather wingtip dress shoe in rich glossy chestnut brown, with detailed stitching and shiny polished finish, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "schuh": "A classic, high-end 3D leather wingtip dress shoe in rich glossy chestnut brown, with detailed stitching and shiny polished finish, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "die schule": "A classic, charming 3D red-brick schoolhouse with a small clock tower, a small golden bell on top, neat green bushes, and a winding stone pathway leading to double front doors, completely wordless, front-and-center, premium SOTA asset",
    "schule": "A classic, charming 3D red-brick schoolhouse with a small clock tower, a small golden bell on top, neat green bushes, and a winding stone pathway leading to double front doors, completely wordless, front-and-center, premium SOTA asset",
    "schwer": "A massive 3D cracked granite stone boulder wrapped securely in a thick, heavy-duty iron chain, with a straining, bent golden metallic crane hook pulling at the top, representing immense heaviness and difficulty, completely wordless, front-and-center, premium SOTA asset",
    "die schwester": "Two cute, smiling 3D claymation girls with warm-colored hair, wearing matching pastel dresses, holding hands and standing close together with tiny floating pink hearts around them, completely wordless, front-and-center, premium SOTA asset",
    "schwester": "Two cute, smiling 3D claymation girls with warm-colored hair, wearing matching pastel dresses, holding hands and standing close together with tiny floating pink hearts around them, completely wordless, front-and-center, premium SOTA asset",
    "das schwimmbad": "A gorgeous, sparkling 3D swimming pool cutaway model, filled with crystal-clear turquoise water, with a polished silver ladder, a red-and-white striped lifebuoy, and a bright yellow diving board, completely wordless, front-and-center, premium SOTA asset",
    "schwimmbad": "A gorgeous, sparkling 3D swimming pool cutaway model, filled with crystal-clear turquoise water, with a polished silver ladder, a red-and-white striped lifebuoy, and a bright yellow diving board, completely wordless, front-and-center, premium SOTA asset",
    "schwimmen": "A cute, smiling 3D starfish character wearing retro red-and-white striped swim trunks and blue goggles, happily doing a breaststroke kick inside a translucent water splash sphere, floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "schön": "A gorgeous, glowing 3D blooming rose flower with silky scarlet-red petals, a vibrant green leaf, and tiny shimmering golden dust particles swirling around it in a beautiful spiral, completely wordless, front-and-center, premium SOTA asset",
    "der schüler": "A cute, smiling 3D boy character with a blue backpack, wearing a school uniform, holding a notebook and a yellow pencil under his arm, walking happily, completely wordless, front-and-center, premium SOTA asset",
    "schüler": "A cute, smiling 3D boy character with a blue backpack, wearing a school uniform, holding a notebook and a yellow pencil under his arm, walking happily, completely wordless, front-and-center, premium SOTA asset",
    "der see": "A breathtaking 3D miniature landscape showing a peaceful, crystal-clear blue lake surrounded by cute rounded pine trees, with a tiny wooden rowboat floating on the calm water surface, completely wordless, front-and-center, premium SOTA asset",
    "see": "A breathtaking 3D miniature landscape showing a peaceful, crystal-clear blue lake surrounded by cute rounded pine trees, with a tiny wooden rowboat floating on the calm water surface, completely wordless, front-and-center, premium SOTA asset",
    "sehen": "A stylized 3D human eye with a bright-cyan glowing iris, looking through a pair of transparent, rounded spectacles, with golden sparkle effects, completely wordless, front-and-center, premium SOTA asset",
    "die sehenswürdigkeit": "A beautiful, miniature 3D model of the Berlin Brandenburg Gate with its classic columns and quadriga chariot on top, crafted in cream-colored clay, sitting on a tiny green lawn base under a shiny golden map pin, completely wordless, front-and-center, premium SOTA asset",
    "sehenswürdigkeit": "A beautiful, miniature 3D model of the Berlin Brandenburg Gate with its classic columns and quadriga chariot on top, crafted in cream-colored clay, sitting on a tiny green lawn base under a shiny golden map pin, completely wordless, front-and-center, premium SOTA asset",
    "sehr": "A stylized 3D red thermometer with a glowing liquid line shooting way past the top safety scale, causing a burst of miniature golden star particles at the apex, completely wordless, front-and-center, premium SOTA asset",
    "sein": "A cute, smiling 3D star character looking into a polished silver vanity mirror, where its own perfect, glowing golden reflection smiles back, completely wordless, front-and-center, premium SOTA asset",
    "seit": "An elegant 3D hourglass tilted slightly, with glowing golden sand flowing smoothly down, next to a small retro desk calendar showing pages turning back, completely wordless, front-and-center, premium SOTA asset",
    "selbstständig": "A smiling 3D business-minded star character wearing a tiny professional dark-blue suit, standing proudly in front of its own miniature storefront desk with a blank sign, completely wordless, front-and-center, premium SOTA asset",
    "sich": "A sleek 3D silver mirror standing in mid-air, with a glowing pink light trail looping from a cute star character, pointing at its own mirror reflection, completely wordless, front-and-center, premium SOTA asset",
    "sich kümmern": "A heartwarming 3D scene of a pair of large, protective hands cradling a tiny, fragile green sprout growing in a small clump of rich brown soil, with a small watering can floating next to it, completely wordless, front-and-center, premium SOTA asset",
    "sie / Sie": "Three cute, smiling 3D star characters of different pastel colors (pink, blue, yellow) standing together, with the central star wearing a stylish polished black top hat and bowing politely, completely wordless, front-and-center, premium SOTA asset",
    "sie": "Three cute, smiling 3D star characters of different pastel colors (pink, blue, yellow) standing together, with the central star wearing a stylish polished black top hat and bowing politely, completely wordless, front-and-center, premium SOTA asset",
    "Sie": "Three cute, smiling 3D star characters of different pastel colors (pink, blue, yellow) standing together, with the central star wearing a stylish polished black top hat and bowing politely, completely wordless, front-and-center, premium SOTA asset",
    "sitzen": "A stylish, modern 3D armchair in vibrant turquoise enamel and light wood, standing floating suspended in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "so": "A cute, smiling 3D star character pointing one hand forward along a curving neon-pink light path, representing the direct path or 'this way', completely wordless, front-and-center, premium SOTA asset",
    "das sofa": "A stylish, cozy 3D mid-century modern sofa in pastel pink velvet with light wood legs, sitting floating in mid-air, with a tiny, fluffy white pillow resting on it, completely wordless, front-and-center, premium SOTA asset",
    "sofa": "A stylish, cozy 3D mid-century modern sofa in pastel pink velvet with light wood legs, sitting floating in mid-air, with a tiny, fluffy white pillow resting on it, completely wordless, front-and-center, premium SOTA asset",
    "sofort": "A sleek 3D lightning bolt made of glowing yellow glassmorphic material, striking next to a small classic retro desk clock with hands in rapid motion, completely wordless, front-and-center, premium SOTA asset",
    "der sohn": "A heartwarming, stylized 3D claymation scene of a tall, proud star character with its arm gently around a smaller, smiling little boy star character wearing a tiny red cap, standing together, completely wordless, front-and-center, premium SOTA asset",
    "sohn": "A heartwarming, stylized 3D claymation scene of a tall, proud star character with its arm gently around a smaller, smiling little boy star character wearing a tiny red cap, standing together, completely wordless, front-and-center, premium SOTA asset",
    "sollen": "A cute, thoughtful 3D star character looking at a miniature golden scales balance, with a green checkmark on one side representing duty and a small grey stone on the other, completely wordless, front-and-center, premium SOTA asset",
    "die sonne": "A vibrant, smiling 3D golden-yellow sun character with high-gloss surface, wearing cute round black sunglasses, emitting warm orange glowing rays, completely wordless, front-and-center, premium SOTA asset",
    "sonne": "A vibrant, smiling 3D golden-yellow sun character with high-gloss surface, wearing cute round black sunglasses, emitting warm orange glowing rays, completely wordless, front-and-center, premium SOTA asset",
    "die speisekarte": "An elegant 3D menu folder bound in rich crimson leather with gold-embossed filigree on the corners, slightly open to reveal beautifully illustrated icons of a fork, knife, and a chef's hat inside, completely wordless, front-and-center, premium SOTA asset",
    "speisekarte": "An elegant 3D menu folder bound in rich crimson leather with gold-embossed filigree on the corners, slightly open to reveal beautifully illustrated icons of a fork, knife, and a chef's hat inside, completely wordless, front-and-center, premium SOTA asset",
    "spielen": "A cheerful 3D star character happily holding a glossy red-and-blue game controller in its hands, with floating golden stars and bubbles around it, completely wordless, front-and-center, premium SOTA asset",
    "der sport": "A beautiful, dynamic 3D collage of sport assets: a high-gloss orange basketball, a gleaming white-and-black soccer ball, and a metallic silver whistle, floating together, completely wordless, front-and-center, premium SOTA asset",
    "sport": "A beautiful, dynamic 3D collage of sport assets: a high-gloss orange basketball, a gleaming white-and-black soccer ball, and a metallic silver whistle, floating together, completely wordless, front-and-center, premium SOTA asset",
    "die sprache": "Two vibrant 3D speech bubbles (one pastel blue, one pastel pink) interlocking in mid-air, with a tiny, glowing golden musical note and a heart floating between them, representing speech and understanding, completely wordless, front-and-center, premium SOTA asset",
    "sprache": "Two vibrant 3D speech bubbles (one pastel blue, one pastel pink) interlocking in mid-air, with a tiny, glowing golden musical note and a heart floating between them, representing speech and understanding, completely wordless, front-and-center, premium SOTA asset",
    "sprechen": "A cute, smiling 3D star character with an open mouth, emitting smooth glowing golden soundwave rings that ripple outward, completely wordless, front-and-center, premium SOTA asset",
    "spät": "A classic 3D retro alarm clock with its metal bells, showing the time near midnight, with a glowing crescent moon floating in the background to represent lateness, completely wordless, front-and-center, premium SOTA asset",
    "später": "A beautifully polished 3D hourglass tilted slightly, next to a curved neon-pink arrow pointing forward to represent time passing or later, completely wordless, front-and-center, premium SOTA asset",
    "die stadt": "A gorgeous miniature 3D isometric cutaway model of a clean modern city, with tiny colorful glass skyscrapers, green trees, and glowing streetlights, completely wordless, front-and-center, premium SOTA asset",
    "stadt": "A gorgeous miniature 3D isometric cutaway model of a clean modern city, with tiny colorful glass skyscrapers, green trees, and glowing streetlights, completely wordless, front-and-center, premium SOTA asset",
    "stehen": "A cute, proud 3D star character standing tall and perfectly straight on a tiny polished marble pedestal, completely wordless, front-and-center, premium SOTA asset",
    "die stelle": "A beautiful 3D map pin in glowing yellow enamel, marking a clean, sparkling spot on a curved pastel-blue surface, representing a specific position or place, completely wordless, front-and-center, premium SOTA asset",
    "stelle": "A beautiful 3D map pin in glowing yellow enamel, marking a clean, sparkling spot on a curved pastel-blue surface, representing a specific position or place, completely wordless, front-and-center, premium SOTA asset",
    "stellen": "A cute 3D star character carefully putting a glossy red coffee mug down onto a polished glass table surface, representing the action of placing something down, completely wordless, front-and-center, premium SOTA asset",
    "der stock": "A beautiful 3D cutaway model of a modern three-story building, with the second floor glowing in vibrant neon-blue light to represent a specific floor or story, completely wordless, front-and-center, premium SOTA asset",
    "stock": "A beautiful 3D cutaway model of a modern three-story building, with the second floor glowing in vibrant neon-blue light to represent a specific floor or story, completely wordless, front-and-center, premium SOTA asset",
    "die straße": "A beautifully curving 3D asphalt road with clean white lane markings, bordered by tiny green grass patches and a miniature glassmorphic guardrail, completely wordless, front-and-center, premium SOTA asset",
    "straße": "A beautifully curving 3D asphalt road with clean white lane markings, bordered by tiny green grass patches and a miniature glassmorphic guardrail, completely wordless, front-and-center, premium SOTA asset",
    "die straßenbahn": "A sleek, modern 3D electric tram in glossy yellow and white enamel, sitting on tiny metal tracks with overhead power cables, completely wordless, front-and-center, premium SOTA asset",
    "straßenbahn": "A sleek, modern 3D electric tram in glossy yellow and white enamel, sitting on tiny metal tracks with overhead power cables, completely wordless, front-and-center, premium SOTA asset",
    "der student": "A cute, smiling 3D star character wearing a black academic mortarboard cap with a golden tassel, holding a large diploma scroll wrapped in a red ribbon under its arm, completely wordless, front-and-center, premium SOTA asset",
    "student": "A cute, smiling 3D star character wearing a black academic mortarboard cap with a golden tassel, holding a large diploma scroll wrapped in a red ribbon under its arm, completely wordless, front-and-center, premium SOTA asset",
    "studieren": "A cute 3D star character sitting behind a massive stack of thick, colorful hardcover textbooks, eagerly examining a small glowing book using a miniature magnifying glass, completely wordless, front-and-center, premium SOTA asset",
    "das studium": "A beautiful 3D composition representing academic success: a large open book with glowing pages, a classic mortarboard graduation cap floating above it, and golden sparkles circling in a beautiful spiral, completely wordless, front-and-center, premium SOTA asset",
    "studium": "A beautiful 3D composition representing academic success: a large open book with glowing pages, a classic mortarboard graduation cap floating above it, and golden sparkles circling in a beautiful spiral, completely wordless, front-and-center, premium SOTA asset",
    "die stunde": "A classic 3D hourglass filled with glowing golden sand running down, standing next to a stylized retro wall clock showing a blank dark face with only golden clock hands and simple tick marks for hours, with absolutely no numbers, letters, or words, completely wordless, front-and-center, premium SOTA asset",
    "stunde": "A classic 3D hourglass filled with glowing golden sand running down, standing next to a stylized retro wall clock showing a blank dark face with only golden clock hands and simple tick marks for hours, with absolutely no numbers, letters, or words, completely wordless, front-and-center, premium SOTA asset",
    "suchen": "A cute 3D star character holding a giant, glossy magnifying glass with a chrome handle, leaning forward and looking through it, with golden sparkles indicating search, completely wordless, front-and-center, premium SOTA asset",
    "tanzen": "A couple of cute, smiling 3D star characters hand-in-hand, dancing dynamically on a glossy pastel-blue circular platform with glowing pink musical notes and golden sparkles floating in the air, completely wordless, front-and-center, premium SOTA asset",
    "die tasche": "A chic, retro 3D leather handbag in rich brown and pastel pink with golden metallic buckles and clasp, floating suspended and slightly open, completely wordless, front-and-center, premium SOTA asset",
    "tasche": "A chic, retro 3D leather handbag in rich brown and pastel pink with golden metallic buckles and clasp, floating suspended and slightly open, completely wordless, front-and-center, premium SOTA asset",
    "das taxi": "A cute, stylized retro 3D yellow taxi cab with high-gloss enamel material, black-and-white checkered side stripes, and a blank glowing yellow roof sign, completely wordless with no letters, floating suspended, front-and-center, premium SOTA asset",
    "taxi": "A cute, stylized retro 3D yellow taxi cab with high-gloss enamel material, black-and-white checkered side stripes, and a blank glowing yellow roof sign, completely wordless with no letters, floating suspended, front-and-center, premium SOTA asset",
    "der tee": "A beautiful 3D porcelain teacup with a delicate floral pattern on a matching saucer, filled with hot amber tea showing gentle steam wisps, with a fresh green tea leaf floating next to it, completely wordless, front-and-center, premium SOTA asset",
    "tee": "A beautiful 3D porcelain teacup with a delicate floral pattern on a matching saucer, filled with hot amber tea showing gentle steam wisps, with a fresh green tea leaf floating next to it, completely wordless, front-and-center, premium SOTA asset",
    "der teil": "A brilliant 3D jigsaw puzzle piece in glossy yellow enamel, floating slightly separated from the rest of the semi-completed, grey-shaded circular puzzle base, clearly showing it as a missing part, completely wordless, front-and-center, premium SOTA asset",
    "teil": "A brilliant 3D jigsaw puzzle piece in glossy yellow enamel, floating slightly separated from the rest of the semi-completed, grey-shaded circular puzzle base, clearly showing it as a missing part, completely wordless, front-and-center, premium SOTA asset",
    "das telefon": "A charming, glossy 3D retro rotary dial telephone in bright cherry-red enamel with smooth chrome metal accents, floating suspended, completely wordless, front-and-center, premium SOTA asset",
    "telefon": "A charming, glossy 3D retro rotary dial telephone in bright cherry-red enamel with smooth chrome metal accents, floating suspended, completely wordless, front-and-center, premium SOTA asset",
    "telefonieren": "A cute, smiling 3D star character happily holding a glossy turquoise retro telephone receiver up to its ear, with glowing yellow concentric ring soundwaves radiating outward, completely wordless, front-and-center, premium SOTA asset",
    "der termin": "An elegant 3D wall calendar showing a glossy white page with a vibrant red circular ring highlighting a specific date, standing next to a small golden map pin, completely wordless and numberless, front-and-center, premium SOTA asset",
    "termin": "An elegant 3D wall calendar showing a glossy white page with a vibrant red circular ring highlighting a specific date, standing next to a small golden map pin, completely wordless and numberless, front-and-center, premium SOTA asset",
    "der test": "A pristine 3D white test sheet showing neat rows of lines and small green checkmark circles next to them, topped with a beautiful, glossy 3D golden star badge, completely wordless and characterless, front-and-center, premium SOTA asset",
    "test": "A pristine 3D white test sheet showing neat rows of lines and small green checkmark circles next to them, topped with a beautiful, glossy 3D golden star badge, completely wordless and characterless, front-and-center, premium SOTA asset",
    "teuer": "A luxury 3D leather wallet overflowing with glowing golden coins and sparkling gems, with a glossy red price tag floating next to it showing a golden sparkling crown symbol instead of numbers, completely wordless, front-and-center, premium SOTA asset",
    "der text": "A stylized 3D open book or parchment sheet displaying rows of neat, generic horizontal lines representing text paragraphs, with a floating gold pencil circling it, completely wordless, front-and-center, premium SOTA asset",
    "text": "A stylized 3D open book or parchment sheet displaying rows of neat, generic horizontal lines representing text paragraphs, with a floating gold pencil circling it, completely wordless, front-and-center, premium SOTA asset",
    "das thema": "A polished 3D lightbulb in vibrant neon-blue representing a topic or idea, with several smaller, stylized gray speech bubbles floating around it, completely wordless, front-and-center, premium SOTA asset",
    "thema": "A polished 3D lightbulb in vibrant neon-blue representing a topic or idea, with several smaller, stylized gray speech bubbles floating around it, completely wordless, front-and-center, premium SOTA asset",
    "das ticket": "A premium retro 3D transit or cinema ticket in glossy pastel pink and gold, with stylized perforated edges, a tiny golden star symbol on it, completely wordless and numberless, front-and-center, premium SOTA asset",
    "ticket": "A premium retro 3D transit or cinema ticket in glossy pastel pink and gold, with stylized perforated edges, a tiny golden star symbol on it, completely wordless and numberless, front-and-center, premium SOTA asset",
    "der tisch": "A gorgeous, stylized mid-century modern 3D wooden dining table with a rich, polished woodgrain texture and elegant tapered legs, standing floating in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "tisch": "A gorgeous, stylized mid-century modern 3D wooden dining table with a rich, polished woodgrain texture and elegant tapered legs, standing floating in mid-air, completely wordless, front-and-center, premium SOTA asset",
    "die tochter": "A heartwarming, stylized 3D claymation scene of a tall, proud star character with its arm gently around a smaller, smiling little girl star character wearing a cute pink hair bow, standing together, completely wordless, front-and-center, premium SOTA asset",
    "tochter": "A heartwarming, stylized 3D claymation scene of a tall, proud star character with its arm gently around a smaller, smiling little girl star character wearing a cute pink hair bow, standing together, completely wordless, front-and-center, premium SOTA asset"
}

def remove_black_background(img, threshold=50, feather=True):
    """
    Applies high-speed chroma-keying to convert solid black backgrounds to transparent.
    Uses an advanced floodfill-based seed extraction to protect internal black pixels 
    (e.g., eyes, shadows, black objects) from becoming transparent.
    """
    img = img.convert("RGBA")
    width, height = img.size
    
    # 1. Split channels
    r, g, b, _ = img.split()
    
    # 2. Find near-black pixels (all channels < threshold)
    r_mask = r.point(lambda p: 255 if p < threshold else 0)
    g_mask = g.point(lambda p: 255 if p < threshold else 0)
    b_mask = b.point(lambda p: 255 if p < threshold else 0)
    
    # Bitwise AND to find pixels that are dark in R, G, AND B
    near_black = ImageChops.multiply(r_mask, g_mask)
    near_black = ImageChops.multiply(near_black, b_mask)
    
    # 3. Use flood fill from the 4 corners to isolate connected external background
    # 3. Use flood fill from all four borders to isolate connected external background.
    # Spacing seeds along edges ensures we clear ground/reflection islands touching the borders.
    flood_img = near_black.copy()
    
    edge_seeds = []
    # Add corners
    edge_seeds.extend([(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)])
    # Add spaced points along top and bottom edges
    for x in range(0, width, max(1, width // 10)):
        edge_seeds.append((x, 0))
        edge_seeds.append((x, height - 1))
    # Add spaced points along left and right edges
    for y in range(0, height, max(1, height // 10)):
        edge_seeds.append((0, y))
        edge_seeds.append((width - 1, y))
        
    for seed in edge_seeds:
        try:
            if flood_img.getpixel(seed) == 255:
                ImageDraw.floodfill(flood_img, seed, value=128)
        except IndexError:
            continue
            
    # Pixels marked with 128 are confirmed external background. 
    bg_alpha = flood_img.point(lambda p: 0 if p == 128 else 255)
    
    if feather:
        bg_alpha = bg_alpha.filter(ImageFilter.GaussianBlur(radius=1.2))
        
    img.putalpha(bg_alpha)
    return img

def wipe_disconnected_shadows(img, min_gap_rows=3):
    """
    Scans the image from bottom to top to find any disconnected shadow islands.
    If it finds non-transparent pixels at the bottom separated from the main subject
    by a horizontal gap of pure transparency (at least min_gap_rows tall), it
    completely wipes out everything below that gap.
    """
    img = img.convert("RGBA")
    width, height = img.size
    
    alpha = img.getchannel('A')
    alpha_data = list(alpha.getdata())
    
    def is_row_transparent(y):
        start_idx = y * width
        for x in range(width):
            if alpha_data[start_idx + x] > 0:
                return False
        return True

    y = height - 1
    has_seen_pixels = False
    gap_counter = 0
    gap_start_y = None
    
    while y >= 0:
        if is_row_transparent(y):
            if has_seen_pixels:
                gap_counter += 1
                if gap_counter >= min_gap_rows:
                    gap_start_y = y + gap_counter
                    break
            else:
                pass
        else:
            has_seen_pixels = True
            gap_counter = 0
        y -= 1
        
    if gap_start_y is not None:
        # Safety cutoff: Only wipe if the gap starts in the bottom part of the image
        if gap_start_y >= int(height * 0.55):
            print(f"  🧹 Dynamic Shadow Wiper: Detected floor shadow island at y >= {gap_start_y}. Clearing!")
            pixels = img.load()
            for y_to_clear in range(gap_start_y, height):
                for x_to_clear in range(width):
                    r, g, b, a = pixels[x_to_clear, y_to_clear]
                    pixels[x_to_clear, y_to_clear] = (r, g, b, 0)
        else:
            print(f"  ⚠️ Dynamic Shadow Wiper: Ignored high-up gap at y = {gap_start_y} (above safety cutoff of {int(height * 0.55)})")
                
    return img

def trim_and_center(img, target_size=(256, 256), padding_percent=0.05):
    """
    Trims fully transparent boundary pixels using getbbox(), and rescales/centers 
    the active object with a clean, high-impact padding margin.
    """
    bbox = img.getbbox()
    if not bbox:
        return img.resize(target_size, Image.Resampling.LANCZOS)
        
    cropped = img.crop(bbox)
    cw, ch = cropped.size
    
    canvas = Image.new("RGBA", target_size, (0, 0, 0, 0))
    tw, th = target_size
    
    max_w = int(tw * (1.0 - 2 * padding_percent))
    max_h = int(th * (1.0 - 2 * padding_percent))
    
    scale = min(max_w / cw, max_h / ch)
    new_w = max(1, int(cw * scale))
    new_h = max(1, int(ch * scale))
    
    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    px = (tw - new_w) // 2
    py = (th - new_h) // 2
    
    canvas.paste(resized, (px, py), resized)
    return canvas

def generate_metaphor_prompt(word_de, word_en, word_class):
    """
    Resolves the German word class and details to build a highly descriptive 
    visual prompt tailored for SOTA Cutting-Edge 3D Glossy and Tactile assets.
    """
    # Try exact match with lowercase original word (retaining articles)
    de_exact = word_de.lower().strip()
    de_clean = re.sub(r'^(der|die|das)\s+', '', word_de.lower()).strip()
    
    metaphor = None
    for item in [de_exact, de_clean]:
        if item in METAPHOR_MAP:
            metaphor = METAPHOR_MAP[item]
            break
            
    if not metaphor:
        de_exact_strip = de_exact.rstrip('-')
        de_clean_strip = de_clean.rstrip('-')
        for item in [de_exact_strip, de_clean_strip]:
            if item in METAPHOR_MAP:
                metaphor = METAPHOR_MAP[item]
                break
                
    # If still not found, use dynamic fallback prompts based on word classes
    if not metaphor:
        if word_class == "Nomen":
            metaphor = f"a spectacular, highly-detailed 3D digital art model representing the object {word_en}"
        elif word_class == "Verb":
            clean_verb = re.sub(r'^to\s+', '', word_en.lower()).strip()
            metaphor = f"a vibrant, stylized 3D icon dynamically representing the action of {clean_verb} with creative visual elements"
        elif word_class == "Adjektiv" or "adjective" in word_class.lower():
            metaphor = f"a high-contrast, premium 3D digital art graphic visually demonstrating the concept of {word_en}"
        else:
            metaphor = f"a beautiful, stylized 3D digital art symbol representing the concept of {word_en}"

    # State-of-the-art-ify any legacy references to clay in the metaphor dynamically
    metaphor = re.sub(r'\b(claymation|clay character|clay model|clay doll|clay)\b', 'state-of-the-art glossy 3D character', metaphor, flags=re.I)
    metaphor = re.sub(r'\b(clay kitten)\b', 'state-of-the-art glossy 3D kitten', metaphor, flags=re.I)
    metaphor = re.sub(r'\b(clay cottage)\b', 'state-of-the-art glossy 3D cottage', metaphor, flags=re.I)
    metaphor = re.sub(r'\b(clay envelope)\b', 'state-of-the-art glossy 3D envelope', metaphor, flags=re.I)
    metaphor = re.sub(r'\b(clay globe)\b', 'state-of-the-art glossy 3D globe', metaphor, flags=re.I)
    metaphor = re.sub(r'\b(clay desk booth)\b', 'state-of-the-art glossy 3D desk booth', metaphor, flags=re.I)
    metaphor = re.sub(r'\b(clay ball|clay balls)\b', 'glowing 3D sphere', metaphor, flags=re.I)
    metaphor = re.sub(r'\b(clay mug|clay coffee mug)\b', 'state-of-the-art glossy 3D coffee mug', metaphor, flags=re.I)
    metaphor = re.sub(r'\b(clay box|clay boxes)\b', 'glowing 3D block', metaphor, flags=re.I)

    # Base prompt wrapping the metaphor in our ultra-premium state-of-the-art style
    prompt = (
        f"A masterfully rendered, ultra-premium 3D digital art toy illustration of: {metaphor}. "
        f"The subject is huge, front-and-center, occupying 85% of the frame, capturing the pure essence of the concept. "
        f"Crafted from premium state-of-the-art materials: vibrant glossy enamel, translucent glowing glassmorphism layers, metallic chrome accents, and polished soft-touch matte resin. "
        f"Isolated asset floating suspended in a pitch-black studio void. Pure black backdrop, clean edges. "
        f"Completely wordless, zero text, zero letters, zero characters. "
        f"Premium state-of-the-art 3D game asset style, spectacular cinematic studio lighting with soft self-illuminating ambient glow, octane render, 8k, raytracing."
    )
    return prompt

def main():
    parser = argparse.ArgumentParser(description="A1-B1 German SOTA 3D Claymation Image Generator (Imagen 3)")
    parser.add_argument("--level", type=str, default="a1", choices=["a1", "a2", "b1"], help="Target CEFR level")
    parser.add_argument("--limit", type=int, default=10, help="Batch limit (number of images to generate)")
    parser.add_argument("--delay", type=int, default=12, help="Pacing delay (seconds) between successful generations")
    parser.add_argument("--skip", type=str, default="", help="Comma-separated card IDs to skip")
    parser.add_argument("--force", action="store_true", help="Force overwrite existing WebP images")
    args = parser.parse_args()

    print("=========================================================")
    print("💎 SOTA 3D CLAYMATION WEB-IMAGE GENERATOR STARTED 💎")
    print(f"Target Level: {args.level.upper()}")
    print(f"Batch Limit:  {args.limit}")
    print(f"Pacing Delay: {args.delay}s")
    if args.skip:
        print(f"Skipping Card IDs: {args.skip}")
    print(f"Force Overwrite: {args.force}")
    print("=========================================================")

    if not GENAI_AVAILABLE:
        print("❌ Error: 'google-genai' library is not available. Please install it first.")
        sys.exit(1)

    # Try to load keys from .env in the project root if not in environment
    env_path = os.path.join(PROJECT_ROOT, ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if not os.environ.get(k):
                            os.environ[k] = v
        except Exception as e:
            print(f"⚠️ Warning: Could not read .env file: {e}")

    # Check if we should use Google Cloud Vertex AI or Google AI Studio
    gac = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if gac and not os.path.isabs(gac):
        gac_abs = os.path.abspath(os.path.join(PROJECT_ROOT, gac))
        if os.path.exists(gac_abs):
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = gac_abs

    use_vertex = bool(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"))
    
    if use_vertex:
        gcp_project = os.environ.get("GCP_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT")
        if not gcp_project:
            print("❌ Error: GCP_PROJECT is not set in environment or .env file when using Vertex AI.")
            print("Please define GCP_PROJECT inside your .env configuration.")
            sys.exit(1)
        gcp_location = os.environ.get("GCP_LOCATION") or "us-central1"
        print("=========================================================")
        print(f"📡 Integration Path: Google Cloud Vertex AI Mode")
        print(f"   Project:  {gcp_project}")
        print(f"   Location: {gcp_location}")
        print(f"   Key File: {os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')}")
        print("=========================================================")
        client = genai.Client(vertexai=True, project=gcp_project, location=gcp_location)
    else:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            print("❌ Error: Neither GEMINI_API_KEY nor GOOGLE_APPLICATION_CREDENTIALS is set in environment or .env file.")
            print("Please create a .env file in the project root with either:")
            print("  GEMINI_API_KEY=your_gemini_api_key_here")
            print("Or to use Google Cloud Vertex AI (with your GCP Credits):")
            print("  GOOGLE_APPLICATION_CREDENTIALS=gcp-key.json")
            print("  GCP_PROJECT=your_gcp_project_id_here")
            sys.exit(1)
        
        print("=========================================================")
        print("📡 Integration Path: Google AI Studio Mode")
        print("=========================================================")
        client = genai.Client()

    # Paths
    level_dir = os.path.join(PROJECT_ROOT, args.level)
    json_path = os.path.join(level_dir, "wordlist.json")
    images_dir = os.path.join(level_dir, "images")
    os.makedirs(images_dir, exist_ok=True)

    if not os.path.exists(json_path):
        print(f"❌ Error: Wordlist json not found at {json_path}!")
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        wordlist = json.load(f)

    # Filter items that need generation
    skip_ids = [s.strip() for s in args.skip.split(",") if s.strip()]
    to_generate = []
    for item in wordlist:
        card_id = item.get("id")
        if not card_id:
            continue
        
        # Skip specific card IDs if requested
        if str(card_id) in skip_ids:
            continue
            
        webp_filename = f"card_{card_id}.webp"
        webp_path = os.path.join(images_dir, webp_filename)

        # Generate if file does not exist, or if we force overwrite
        if not os.path.exists(webp_path) or args.force:
            to_generate.append(item)

    print(f"Found {len(to_generate)} total items requiring image generation.")
    
    # Process only up to the specified limit
    slice_to_generate = to_generate[:args.limit]
    print(f"Slicing batch to generate: {len(slice_to_generate)} items in this run.")

    if not slice_to_generate:
        print("🎉 No images need to be generated! All items already have local WebP assets.")
        sys.exit(0)

    generated_count = 0
    updated_wordlist = False

    for index, item in enumerate(slice_to_generate):
        card_id = item["id"]
        german = item["german"]
        english = item["english"]
        word_class = item.get("word_class", "Andere")
        
        webp_filename = f"card_{card_id}.webp"
        output_webp_path = os.path.join(images_dir, webp_filename)

        prompt = generate_metaphor_prompt(german, english, word_class)
        
        # Add a pacing delay before we generate (if we have successfully generated some cards)
        if index > 0 and generated_count > 0:
            pacing_delay = getattr(args, "delay", 12)
            if pacing_delay > 0:
                print(f"  Pacing delay: waiting {pacing_delay}s to respect Vertex AI quotas...")
                time.sleep(pacing_delay)

        print(f"\n[{index+1}/{len(slice_to_generate)}] Generating card_{card_id} for '{german}' -> '{english}'")
        print(f"  Prompt: \"{prompt}\"")

        try:
            # Query SOTA Imagen 3 model via google-genai with exponential backoff on 429
            max_retries = 4
            backoff_base = 15
            response = None
            
            for attempt in range(max_retries):
                try:
                    response = client.models.generate_images(
                        model="imagen-3.0-generate-002",
                        prompt=prompt,
                        config=types.GenerateImagesConfig(
                            number_of_images=1,
                            output_mime_type="image/png",
                            aspect_ratio="1:1",
                            person_generation="ALLOW_ALL",
                            safety_filter_level="BLOCK_ONLY_HIGH",
                            include_rai_reason=True
                        )
                    )
                    break  # Success!
                except Exception as e:
                    err_str = str(e).lower()
                    if "429" in err_str or "resource_exhausted" in err_str or "quota" in err_str:
                        # Exponential backoff
                        sleep_time = backoff_base * (2 ** attempt)
                        print(f"  ⚠️ Rate limited (429/Quota). Retrying in {sleep_time}s... (Attempt {attempt+1}/{max_retries})")
                        time.sleep(sleep_time)
                    else:
                        raise e
            else:
                # If we exhausted retries and didn't get a response
                print(f"  ❌ Error: Exhausted all {max_retries} retries for card_{card_id} due to rate limits.")
                continue

            if not response or not response.generated_images:
                print(f"  ⚠️ Warning: Imagen returned empty response for card_{card_id}.")
                continue

            generated_image_obj = response.generated_images[0]
            if not generated_image_obj.image or not generated_image_obj.image.image_bytes:
                filter_reason = getattr(generated_image_obj, "rai_filtered_reason", "No reason provided")
                print(f"  ⚠️ Warning: Imagen image was filtered/blocked for card_{card_id}. Reason: {filter_reason}")
                continue

            # Load image bytes
            img_bytes = generated_image_obj.image.image_bytes
            raw_img = Image.open(BytesIO(img_bytes))

            # 1. Apply robust connected chroma-key masking
            transparent_img = remove_black_background(raw_img, threshold=50, feather=True)

            # 1b. Apply dynamic shadow island wiper to remove disconnected shadows/reflections
            clean_img = wipe_disconnected_shadows(transparent_img, min_gap_rows=3)

            # 2. Trim empty transparent border pixels & center with 5% padding
            final_img = trim_and_center(clean_img, target_size=(256, 256), padding_percent=0.05)

            # 3. Compress and save as SOTA WebP
            final_img.save(output_webp_path, "WEBP", quality=82)
            print(f"  ✅ Saved and compressed: {webp_filename} ({os.path.getsize(output_webp_path)} bytes)")

            # 4. Update the word list item schema
            item["image_tier"] = "B"
            item["image_path"] = f"images/{webp_filename}"
            item["image"] = f"images/{webp_filename}"  # Backwards compatibility
            
            generated_count += 1
            updated_wordlist = True

        except Exception as e:
            print(f"  ❌ Error generating card_{card_id}: {e}")
            continue

    if updated_wordlist:
        # Overwrite database with updated schema properties
        print(f"\nUpdating {json_path} wordlist database with generated image paths...")
        # To avoid saving partial dictionary updates if anything got corrupted, we read/write carefully
        with open(json_path, "r", encoding="utf-8") as f:
            full_db = json.load(f)

        # Merge changes back into full database
        db_by_id = {x["id"]: x for x in full_db}
        for item in slice_to_generate:
            if item["id"] in db_by_id and "image_path" in item:
                db_by_id[item["id"]]["image_tier"] = item["image_tier"]
                db_by_id[item["id"]]["image_path"] = item["image_path"]
                db_by_id[item["id"]]["image"] = item["image"]

        # Save back cleanly
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(full_db, f, indent=2, ensure_ascii=False)

    print(f"\n🎉 Batch run complete! Successfully generated {generated_count} SOTA 3D Claymation cards.")

if __name__ == "__main__":
    main()
