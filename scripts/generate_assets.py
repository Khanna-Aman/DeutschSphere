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
    "bäckerei": "A highly stylized 3D bakery storefront with striped awning, warm glowing display windows showing miniature pastries and breads, floating suspended, front-and-center",
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
    "enden": "A large red 3D STOP sign symbol made of glossy enamel, floating in mid-air, representing ending and stopping, front-and-center",
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
    "hinten": "A cute 3D character smilingly peeking out from directly behind a giant, high-gloss 3D wooden storage box, representing behind or in the back, front-and-center"
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
    # Try exact match with lowercase original word (retaining articles) or stripped hyphen
    de_exact = word_de.lower().strip().rstrip('-')
    de_clean = re.sub(r'^(der|die|das)\s+', '', word_de.lower()).strip().rstrip('-')
    
    # Check if we have a hand-curated metaphorical prompt
    if de_exact in METAPHOR_MAP:
        metaphor = METAPHOR_MAP[de_exact]
    elif de_clean in METAPHOR_MAP:
        metaphor = METAPHOR_MAP[de_clean]
    else:
        # Dynamic fallback prompts based on word classes (using the new SOTA glossy style)
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
        gcp_project = os.environ.get("GCP_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT") or "antigravity-sandbox-500206"
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
            print("  GCP_PROJECT=antigravity-sandbox-500206")
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
