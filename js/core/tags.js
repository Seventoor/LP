// Lost Radar – OSM-Wissen: Kategorien, Lifecycle-Präfixe, welche Werte zählen, welche nicht, und deutsche Bezeichnungen
// Kernlogik ohne DOM, läuft auch in Node (Tests unter tests/).

export const CATS = {
  mil:   { name: 'Militär & Bunker',       col: '#d4a017' },
  ind:   { name: 'Industrie & Technik',    col: '#c2410c' },
  pub:   { name: 'Kliniken, Hotels & Co.', col: '#0e8ad6' },
  bahn:  { name: 'Bahn',                   col: '#7c4ddb' },
  bau:   { name: 'Gebäude & Höfe',         col: '#db2777' },
  ruin:  { name: 'Ruinen',                 col: '#9c7b52' },
  brach: { name: 'Brachflächen',           col: '#6b7f73' }
};
export const ORDER = ['mil', 'ind', 'pub', 'bahn', 'bau', 'ruin', 'brach'];
export const LIFE = ['abandoned', 'disused', 'ruins'];
export const KEYS = ['military', 'railway', 'aeroway', 'amenity', 'tourism', 'leisure', 'power', 'man_made', 'industrial',
  'craft', 'shop', 'office', 'historic', 'place', 'landuse', 'building'];
export const EHEM = /(^|[\s(\/-])(ehem\.|ehemalig)/i;

function set(s) { var o = {}; s.split(/\s+/).forEach(function (x) { if (x) o[x] = 1; }); return o; }

// Werte, die nichts über die frühere Nutzung sagen: weitersuchen
export const SKIP = {
  building: set('yes'),
  tourism: set('attraction viewpoint information artwork picnic_site yes'),
  historic: set('yes building heritage')
};
// Werte, die das Objekt uninteressant machen: verwerfen
export const DROPV = {
  amenity: set('bench waste_basket vending_machine post_box telephone recycling parking parking_space parking_entrance ' +
    'bicycle_parking motorcycle_parking drinking_water fountain toilets atm shelter charging_station car_wash hunting_stand bbq ' +
    'clock grit_bin letter_box waste_disposal water_point feeding_place game_feeding parcel_locker taxi compressed_air ' +
    'public_bookcase photo_booth dog_toilet table smoking_area give_box lounger watering_place ticket_validator ' +
    'device_charging_station payment_terminal water_tap kneipp_water_cure bicycle_repair_station bicycle_rental car_sharing ' +
    'car_rental loading_dock trolley_bay'),
  man_made: set('survey_point pipeline mast antenna flagpole monitoring_station street_cabinet cairn cross manhole pole ' +
    'utility_pole petroleum_well water_well well borehole beacon embankment dyke groyne breakwater clearcut cutline planter ' +
    'lamp street_lamp surveillance video_wall water_tap spring_box snow_fence insect_hotel nesting_site carpet_hanger ' +
    'guard_stone wildlife_crossing yes'),
  leisure: set('picnic_table playground pitch firepit bleachers outdoor_seating fitness_station slipway bird_hide wildlife_hide ' +
    'dog_park garden park nature_reserve common fishing swimming_area bandstand schoolyard track sunbathing yes'),
  historic: set('boundary_stone wayside_cross wayside_shrine memorial milestone marker stone tomb grave cross monument ' +
    'charcoal_pile district_marker tree_shrine highwater_mark bomb_crater rune_stone archaeological_site gallows pillory ' +
    'citywalls city_gate border_stone stolperstein'),
  military: set('danger_area checkpoint'),
  railway: set('rail tram light_rail narrow_gauge subway platform switch signal level_crossing crossing buffer_stop miniature ' +
    'preserved razed construction proposed milestone derail railway_crossing abandoned disused funicular monorail platform_edge ' +
    'stop tram_stop')
};
export const KEEPV = {
  power: set('plant substation'),
  aeroway: set('aerodrome airstrip hangar terminal control_tower heliport'),
  landuse: set('industrial military quarry landfill railway commercial retail farmyard brownfield')
};
export const SMALLB = set('garage garages shed carport roof hut cabin kiosk toilets container tent allotment_house greenhouse service ' +
  'static_caravan shelter');

// Gegencheck: Nutzungen, an denen man erkennt, dass auf einem Gelände heute wieder Betrieb ist
export const ACT = {
  amenity: set('restaurant cafe fast_food bar pub biergarten ice_cream food_court nightclub cinema theatre arts_centre ' +
    'community_centre events_venue conference_centre school kindergarten childcare college university research_institute ' +
    'library doctors dentist clinic hospital pharmacy nursing_home social_facility bank post_office police fire_station ' +
    'townhall courthouse place_of_worship fuel car_wash marketplace veterinary prison music_school language_school ' +
    'driving_school training coworking_space casino studio'),
  tourism: set('hotel motel guest_house hostel apartment museum gallery attraction camp_site caravan_site zoo theme_park aquarium'),
  leisure: set('fitness_centre sports_centre sports_hall bowling_alley escape_game trampoline_park indoor_play dance ' +
    'amusement_arcade adult_gaming_centre sauna water_park ice_rink hackerspace climbing horse_riding stadium marina')
};
// Notizen in OSM, die auf Umbau, Sanierung oder Abriss hindeuten
export const CHG = /umbau|umgebaut|umgenutzt|umnutzung|nachnutzung|saniert|sanierung|renoviert|renovierung|abriss|rückbau|zurückgebaut|neubau|baustelle|bauarbeiten|wieder ?(er|ge)?öffnet|wiedereröffn|wieder in betrieb|renovat|redevelop|refurbish|under construction|converted/i;
export const GONE = /abgerissen|abgetragen|nicht mehr vorhanden|existiert nicht mehr|demolished|torn down/i;
// Kleine Läden und Lokale: mit disused: steht nur das Ladenlokal leer, das Haus ist meist in Betrieb
export const SMALLA = set('bank pharmacy cafe restaurant fast_food ice_cream bar pub post_office doctors dentist veterinary internet_cafe ' +
  'driving_school car_rental bureau_de_change money_transfer');

export const LAB = {
  military: { bunker: 'Bunker', barracks: 'Kaserne', airfield: 'Militärflugplatz', range: 'Schießstand',
    training_area: 'Truppenübungsplatz', ammunition: 'Munitionsdepot', naval_base: 'Marinestützpunkt', base: 'Militärbasis',
    trench: 'Schützengraben', office: 'Militärgebäude', obstacle_course: 'Hindernisbahn', launchpad: 'Raketenstellung',
    depot: 'Militärdepot', shelter: 'Schutzraum', school: 'Militärschule', fuel: 'Treibstofflager' },
  railway: { station: 'Bahnhof', halt: 'Haltepunkt', roundhouse: 'Ringlokschuppen', signal_box: 'Stellwerk',
    workshop: 'Bahnwerkstatt', depot: 'Betriebswerk', turntable: 'Drehscheibe', engine_shed: 'Lokschuppen', tunnel: 'Bahntunnel' },
  aeroway: { aerodrome: 'Flugplatz', airstrip: 'Landebahn', hangar: 'Hangar', terminal: 'Terminal',
    control_tower: 'Kontrollturm', heliport: 'Hubschrauberlandeplatz' },
  amenity: { hospital: 'Krankenhaus', clinic: 'Klinik', doctors: 'Arztpraxis', school: 'Schule', kindergarten: 'Kindergarten',
    university: 'Uni-Gebäude', college: 'Hochschule', cinema: 'Kino', theatre: 'Theater', nightclub: 'Disco', pub: 'Kneipe',
    bar: 'Bar', restaurant: 'Restaurant', cafe: 'Café', fast_food: 'Imbiss', biergarten: 'Biergarten', ice_cream: 'Eisdiele',
    place_of_worship: 'Kirche', monastery: 'Kloster', prison: 'Gefängnis', police: 'Polizeiwache', fire_station: 'Feuerwache',
    townhall: 'Rathaus', community_centre: 'Gemeindezentrum', social_facility: 'Heim', nursing_home: 'Pflegeheim',
    post_office: 'Postamt', bank: 'Bankfiliale', fuel: 'Tankstelle', swimming_pool: 'Schwimmbad', public_bath: 'Badeanstalt',
    courthouse: 'Gericht', library: 'Bibliothek', arts_centre: 'Kulturzentrum', events_venue: 'Veranstaltungshalle',
    marketplace: 'Markthalle', casino: 'Spielbank', crematorium: 'Krematorium', mortuary: 'Leichenhalle',
    conference_centre: 'Tagungszentrum', ferry_terminal: 'Fähranleger', bus_station: 'Busbahnhof', stripclub: 'Nachtclub',
    animal_shelter: 'Tierheim', veterinary: 'Tierarztpraxis', dentist: 'Zahnarztpraxis', pharmacy: 'Apotheke',
    research_institute: 'Forschungsinstitut', childcare: 'Kita', youth_centre: 'Jugendzentrum', grave_yard: 'Friedhof' },
  tourism: { hotel: 'Hotel', motel: 'Motel', guest_house: 'Pension', hostel: 'Herberge', camp_site: 'Campingplatz',
    caravan_site: 'Wohnmobilplatz', chalet: 'Ferienhaus', theme_park: 'Freizeitpark', zoo: 'Zoo', museum: 'Museum',
    alpine_hut: 'Berghütte', apartment: 'Ferienwohnung', wilderness_hut: 'Schutzhütte', aquarium: 'Aquarium', gallery: 'Galerie' },
  leisure: { sports_centre: 'Sportzentrum', stadium: 'Stadion', water_park: 'Spaßbad', swimming_pool: 'Schwimmbecken',
    ice_rink: 'Eishalle', bowling_alley: 'Bowlingcenter', dance: 'Tanzsaal', resort: 'Ferienanlage', summer_camp: 'Ferienlager',
    miniature_golf: 'Minigolfanlage', amusement_arcade: 'Spielhalle', adult_gaming_centre: 'Spielhalle', sauna: 'Sauna',
    marina: 'Jachthafen', horse_riding: 'Reitanlage', golf_course: 'Golfplatz', sports_hall: 'Sporthalle',
    fitness_centre: 'Fitnessstudio', beach_resort: 'Strandbad', water_slide: 'Wasserrutsche' },
  power: { plant: 'Kraftwerk', substation: 'Umspannwerk' },
  man_made: { works: 'Fabrik', chimney: 'Schornstein', water_tower: 'Wasserturm', mineshaft: 'Schacht', adit: 'Stollen',
    kiln: 'Brennofen', silo: 'Silo', gasometer: 'Gasometer', storage_tank: 'Tank', tower: 'Turm', bunker_silo: 'Fahrsilo',
    wastewater_plant: 'Klärwerk', water_works: 'Wasserwerk', windmill: 'Windmühle', watermill: 'Wassermühle',
    lighthouse: 'Leuchtturm', observatory: 'Sternwarte', telescope: 'Teleskop', crane: 'Kran', bridge: 'Brücke',
    goods_conveyor: 'Förderband', pumping_station: 'Pumpwerk', reservoir_covered: 'Hochbehälter',
    ventilation_shaft: 'Lüftungsschacht', tunnel: 'Tunnel', pier: 'Steg' },
  industrial: { brewery: 'Brauerei', sawmill: 'Sägewerk', brickyard: 'Ziegelei', brickworks: 'Ziegelei', mine: 'Bergwerk',
    slaughterhouse: 'Schlachthof', factory: 'Fabrik', dairy: 'Molkerei', distillery: 'Brennerei', gas: 'Gaswerk',
    oil: 'Ölanlage', depot: 'Depot', warehouse: 'Lager', mill: 'Mühle', grinding_mill: 'Mühle', scrap_yard: 'Schrottplatz',
    shipyard: 'Werft', concrete_plant: 'Betonwerk', steelmaking: 'Stahlwerk', heating_station: 'Heizwerk',
    cooling: 'Kühlhaus', chemical: 'Chemiewerk', port: 'Hafenanlage', agriculture: 'Agrarbetrieb', logistics: 'Logistikgelände' },
  craft: { brewery: 'Brauerei', carpenter: 'Tischlerei', joiner: 'Tischlerei', sawmill: 'Sägewerk', blacksmith: 'Schmiede',
    winery: 'Weinkellerei', distillery: 'Brennerei', metal_construction: 'Metallbau', stonemason: 'Steinmetz', pottery: 'Töpferei' },
  shop: { supermarket: 'Supermarkt', department_store: 'Kaufhaus', mall: 'Einkaufszentrum', doityourself: 'Baumarkt',
    hardware: 'Baumarkt', car: 'Autohaus', garden_centre: 'Gartencenter', furniture: 'Möbelhaus', wholesale: 'Großmarkt',
    car_repair: 'Autowerkstatt' },
  historic: { ruins: 'Ruine', castle: 'Burg', manor: 'Gutshaus', mine: 'Bergwerk', mine_shaft: 'Schacht', mine_adit: 'Stollen',
    bunker: 'Bunker', fort: 'Festung', church: 'Kirche', monastery: 'Kloster', chapel: 'Kapelle', factory: 'Fabrik',
    railway_station: 'Bahnhof', tower: 'Turm', aircraft: 'Flugzeugwrack', locomotive: 'Lok', tank: 'Panzer',
    ship: 'Schiffswrack', wreck: 'Wrack', mill: 'Mühle', watermill: 'Wassermühle', windmill: 'Windmühle',
    technical_monument: 'Technisches Denkmal', kiln: 'Brennofen', lime_kiln: 'Kalkofen', farm: 'Hof', house: 'Haus',
    palace: 'Palast' },
  place: { village: 'Wüstung (Dorf)', hamlet: 'Wüstung (Weiler)', isolated_dwelling: 'Verlassenes Gehöft',
    farm: 'Verlassener Hof', town: 'Verlassener Ort', locality: 'Wüstung', neighbourhood: 'Verlassenes Viertel' },
  landuse: { brownfield: 'Brachfläche', industrial: 'Industriegelände', military: 'Militärgelände', railway: 'Bahngelände',
    commercial: 'Gewerbegelände', retail: 'Handelsfläche', quarry: 'Steinbruch', landfill: 'Deponie', farmyard: 'Hofstelle' },
  building: { house: 'Haus', detached: 'Einfamilienhaus', residential: 'Wohnhaus', apartments: 'Wohnblock',
    farm: 'Bauernhaus', farm_auxiliary: 'Wirtschaftsgebäude', barn: 'Scheune', stable: 'Stall', cowshed: 'Kuhstall',
    sty: 'Schweinestall', industrial: 'Industriegebäude', factory: 'Fabrikgebäude', warehouse: 'Lagerhalle',
    manufacture: 'Werkhalle', commercial: 'Gewerbegebäude', retail: 'Ladengebäude', supermarket: 'Supermarkt',
    office: 'Bürogebäude', hotel: 'Hotel', hospital: 'Klinikgebäude', school: 'Schulgebäude', church: 'Kirche',
    chapel: 'Kapelle', cathedral: 'Dom', religious: 'Gotteshaus', monastery: 'Kloster', train_station: 'Bahnhofsgebäude',
    bunker: 'Bunker', hangar: 'Hangar', ruins: 'Ruine', villa: 'Villa', castle: 'Schloss', mansion: 'Herrenhaus',
    manor: 'Gutshaus', palace: 'Palast', public: 'Öffentliches Gebäude', civic: 'Öffentliches Gebäude',
    government: 'Behördengebäude', kindergarten: 'Kita', university: 'Uni-Gebäude', college: 'Hochschulgebäude',
    sports_hall: 'Sporthalle', stadium: 'Stadion', silo: 'Silo', water_tower: 'Wasserturm', tower: 'Turm',
    transformer_tower: 'Trafoturm', greenhouse: 'Gewächshaus', garage: 'Garage', garages: 'Garagen', shed: 'Schuppen',
    hut: 'Hütte', cabin: 'Hütte', service: 'Technikgebäude', yes: 'Gebäude', abandoned: 'Gebäude',
    collapsed: 'Eingestürztes Gebäude', damaged: 'Beschädigtes Gebäude', semidetached_house: 'Doppelhaushälfte',
    terrace: 'Reihenhaus', bungalow: 'Bungalow', dormitory: 'Wohnheim', military: 'Militärgebäude', barracks: 'Kaserne',
    boathouse: 'Bootshaus', cinema: 'Kino', storage_tank: 'Tank', kiosk: 'Kiosk', pavilion: 'Pavillon',
    gatehouse: 'Torhaus', fire_station: 'Feuerwache', prison: 'Gefängnis', digester: 'Biogas-Fermenter', roof: 'Überdachung' }
};
export const GEN = { military: 'Militäranlage', railway: 'Bahnanlage', aeroway: 'Flugplatzanlage', amenity: 'Einrichtung',
  tourism: 'Unterkunft', leisure: 'Freizeitanlage', power: 'Energieanlage', man_made: 'Technische Anlage',
  industrial: 'Industrieanlage', craft: 'Werkstatt', shop: 'Ladenlokal', office: 'Bürogebäude',
  historic: 'Historisches Objekt', place: 'Wüstung', landuse: 'Gelände', building: 'Gebäude' };
