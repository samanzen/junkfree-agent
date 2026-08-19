// AI VISIBILITY — geographic reference data.
//
// Why this exists: brands.service_area is free text ("Beltline, Calgary,
// Alberta"), and a report cannot group by city if the city was never
// identified as a city. Position alone is not enough to classify a comma part —
// "Calgary, Alberta" and "Calgary, Canada" have the same shape and different
// meanings — so the parser in ./locales.ts classifies by LOOKUP first and only
// falls back to position for parts it does not recognise.
//
// Scope of the data below:
//  * COUNTRIES covers every ISO-3166-1 country and the widely used territories,
//    because a platform sold to businesses anywhere must not silently mangle an
//    address it has never seen.
//  * `languages` lists the languages an assistant would plausibly be asked in
//    for that country, most widely used first. It is used ONLY when a caller
//    opts into multilingual expansion — never to guess a brand's language.
//  * REGIONS covers the first-level subdivisions of the markets where "city,
//    region" is the normal way people write an address. For a country not
//    listed, an unrecognised part is treated as a place name rather than being
//    mislabelled as a region, which is the safe failure.
//
// Nothing here is inferred at runtime. Adding a country or a subdivision is a
// data edit, not a code change.

export type CountryEntry = {
  /** ISO-3166-1 alpha-2. */
  code: string;
  name: string;
  /** Alternative spellings and short forms seen in real address text. */
  aliases?: string[];
  /** Plausible prompt languages, most widely used first. */
  languages: string[];
};

export type RegionEntry = {
  /** Subdivision code as locals write it ("AB", "CA", "NSW"). */
  code: string;
  name: string;
  aliases?: string[];
};

// ── Countries ───────────────────────────────────────────────────────────────
export const COUNTRIES: CountryEntry[] = [
  { code: "AD", name: "Andorra", languages: ["ca", "es"] },
  { code: "AE", name: "United Arab Emirates", aliases: ["uae"], languages: ["ar", "en"] },
  { code: "AF", name: "Afghanistan", languages: ["fa", "ps"] },
  { code: "AG", name: "Antigua and Barbuda", languages: ["en"] },
  { code: "AL", name: "Albania", languages: ["sq"] },
  { code: "AM", name: "Armenia", languages: ["hy", "ru"] },
  { code: "AO", name: "Angola", languages: ["pt"] },
  { code: "AR", name: "Argentina", languages: ["es"] },
  { code: "AT", name: "Austria", languages: ["de"] },
  { code: "AU", name: "Australia", languages: ["en"] },
  { code: "AZ", name: "Azerbaijan", languages: ["az", "ru"] },
  { code: "BA", name: "Bosnia and Herzegovina", languages: ["bs", "hr", "sr"] },
  { code: "BB", name: "Barbados", languages: ["en"] },
  { code: "BD", name: "Bangladesh", languages: ["bn", "en"] },
  { code: "BE", name: "Belgium", languages: ["nl", "fr", "de"] },
  { code: "BF", name: "Burkina Faso", languages: ["fr"] },
  { code: "BG", name: "Bulgaria", languages: ["bg"] },
  { code: "BH", name: "Bahrain", languages: ["ar", "en"] },
  { code: "BI", name: "Burundi", languages: ["fr", "en"] },
  { code: "BJ", name: "Benin", languages: ["fr"] },
  { code: "BN", name: "Brunei", languages: ["ms", "en"] },
  { code: "BO", name: "Bolivia", languages: ["es"] },
  { code: "BR", name: "Brazil", languages: ["pt"] },
  { code: "BS", name: "Bahamas", languages: ["en"] },
  { code: "BT", name: "Bhutan", languages: ["dz", "en"] },
  { code: "BW", name: "Botswana", languages: ["en"] },
  { code: "BY", name: "Belarus", languages: ["be", "ru"] },
  { code: "BZ", name: "Belize", languages: ["en", "es"] },
  { code: "CA", name: "Canada", languages: ["en", "fr"] },
  { code: "CD", name: "Democratic Republic of the Congo", aliases: ["dr congo", "drc"], languages: ["fr"] },
  { code: "CF", name: "Central African Republic", languages: ["fr"] },
  { code: "CG", name: "Republic of the Congo", aliases: ["congo"], languages: ["fr"] },
  { code: "CH", name: "Switzerland", languages: ["de", "fr", "it"] },
  { code: "CI", name: "Ivory Coast", aliases: ["cote d'ivoire", "côte d'ivoire"], languages: ["fr"] },
  { code: "CL", name: "Chile", languages: ["es"] },
  { code: "CM", name: "Cameroon", languages: ["fr", "en"] },
  { code: "CN", name: "China", languages: ["zh"] },
  { code: "CO", name: "Colombia", languages: ["es"] },
  { code: "CR", name: "Costa Rica", languages: ["es"] },
  { code: "CU", name: "Cuba", languages: ["es"] },
  { code: "CV", name: "Cape Verde", aliases: ["cabo verde"], languages: ["pt"] },
  { code: "CY", name: "Cyprus", languages: ["el", "en", "tr"] },
  { code: "CZ", name: "Czechia", aliases: ["czech republic"], languages: ["cs"] },
  { code: "DE", name: "Germany", aliases: ["deutschland"], languages: ["de"] },
  { code: "DJ", name: "Djibouti", languages: ["fr", "ar"] },
  { code: "DK", name: "Denmark", languages: ["da"] },
  { code: "DO", name: "Dominican Republic", languages: ["es"] },
  { code: "DZ", name: "Algeria", languages: ["ar", "fr"] },
  { code: "EC", name: "Ecuador", languages: ["es"] },
  { code: "EE", name: "Estonia", languages: ["et", "ru"] },
  { code: "EG", name: "Egypt", languages: ["ar", "en"] },
  { code: "ER", name: "Eritrea", languages: ["ti", "ar", "en"] },
  { code: "ES", name: "Spain", aliases: ["españa", "espana"], languages: ["es", "ca"] },
  { code: "ET", name: "Ethiopia", languages: ["am", "en"] },
  { code: "FI", name: "Finland", languages: ["fi", "sv"] },
  { code: "FJ", name: "Fiji", languages: ["en"] },
  { code: "FR", name: "France", languages: ["fr"] },
  { code: "GA", name: "Gabon", languages: ["fr"] },
  { code: "GB", name: "United Kingdom", aliases: ["uk", "great britain", "britain", "england", "scotland", "wales", "northern ireland"], languages: ["en"] },
  { code: "GE", name: "Georgia", languages: ["ka", "ru"] },
  { code: "GH", name: "Ghana", languages: ["en"] },
  { code: "GM", name: "Gambia", languages: ["en"] },
  { code: "GN", name: "Guinea", languages: ["fr"] },
  { code: "GQ", name: "Equatorial Guinea", languages: ["es", "fr"] },
  { code: "GR", name: "Greece", languages: ["el"] },
  { code: "GT", name: "Guatemala", languages: ["es"] },
  { code: "GY", name: "Guyana", languages: ["en"] },
  { code: "HK", name: "Hong Kong", languages: ["zh", "en"] },
  { code: "HN", name: "Honduras", languages: ["es"] },
  { code: "HR", name: "Croatia", languages: ["hr"] },
  { code: "HT", name: "Haiti", languages: ["fr", "ht"] },
  { code: "HU", name: "Hungary", languages: ["hu"] },
  { code: "ID", name: "Indonesia", languages: ["id"] },
  { code: "IE", name: "Ireland", languages: ["en", "ga"] },
  { code: "IL", name: "Israel", languages: ["he", "ar", "en"] },
  { code: "IN", name: "India", languages: ["en", "hi"] },
  { code: "IQ", name: "Iraq", languages: ["ar", "ku"] },
  { code: "IR", name: "Iran", languages: ["fa"] },
  { code: "IS", name: "Iceland", languages: ["is"] },
  { code: "IT", name: "Italy", aliases: ["italia"], languages: ["it"] },
  { code: "JM", name: "Jamaica", languages: ["en"] },
  { code: "JO", name: "Jordan", languages: ["ar", "en"] },
  { code: "JP", name: "Japan", languages: ["ja"] },
  { code: "KE", name: "Kenya", languages: ["en", "sw"] },
  { code: "KG", name: "Kyrgyzstan", languages: ["ky", "ru"] },
  { code: "KH", name: "Cambodia", languages: ["km"] },
  { code: "KR", name: "South Korea", aliases: ["korea"], languages: ["ko"] },
  { code: "KW", name: "Kuwait", languages: ["ar", "en"] },
  { code: "KZ", name: "Kazakhstan", languages: ["kk", "ru"] },
  { code: "LA", name: "Laos", languages: ["lo"] },
  { code: "LB", name: "Lebanon", languages: ["ar", "fr"] },
  { code: "LK", name: "Sri Lanka", languages: ["si", "ta", "en"] },
  { code: "LR", name: "Liberia", languages: ["en"] },
  { code: "LT", name: "Lithuania", languages: ["lt"] },
  { code: "LU", name: "Luxembourg", languages: ["fr", "de", "lb"] },
  { code: "LV", name: "Latvia", languages: ["lv", "ru"] },
  { code: "LY", name: "Libya", languages: ["ar"] },
  { code: "MA", name: "Morocco", languages: ["ar", "fr"] },
  { code: "MD", name: "Moldova", languages: ["ro", "ru"] },
  { code: "ME", name: "Montenegro", languages: ["sr"] },
  { code: "MG", name: "Madagascar", languages: ["fr", "mg"] },
  { code: "MK", name: "North Macedonia", languages: ["mk"] },
  { code: "ML", name: "Mali", languages: ["fr"] },
  { code: "MM", name: "Myanmar", languages: ["my"] },
  { code: "MN", name: "Mongolia", languages: ["mn"] },
  { code: "MO", name: "Macau", languages: ["zh", "pt"] },
  { code: "MT", name: "Malta", languages: ["mt", "en"] },
  { code: "MU", name: "Mauritius", languages: ["en", "fr"] },
  { code: "MV", name: "Maldives", languages: ["dv", "en"] },
  { code: "MW", name: "Malawi", languages: ["en"] },
  { code: "MX", name: "Mexico", aliases: ["méxico"], languages: ["es"] },
  { code: "MY", name: "Malaysia", languages: ["ms", "en"] },
  { code: "MZ", name: "Mozambique", languages: ["pt"] },
  { code: "NA", name: "Namibia", languages: ["en"] },
  { code: "NE", name: "Niger", languages: ["fr"] },
  { code: "NG", name: "Nigeria", languages: ["en"] },
  { code: "NI", name: "Nicaragua", languages: ["es"] },
  { code: "NL", name: "Netherlands", aliases: ["holland"], languages: ["nl"] },
  { code: "NO", name: "Norway", languages: ["no"] },
  { code: "NP", name: "Nepal", languages: ["ne"] },
  { code: "NZ", name: "New Zealand", languages: ["en"] },
  { code: "OM", name: "Oman", languages: ["ar", "en"] },
  { code: "PA", name: "Panama", languages: ["es"] },
  { code: "PE", name: "Peru", languages: ["es"] },
  { code: "PH", name: "Philippines", languages: ["en", "tl"] },
  { code: "PK", name: "Pakistan", languages: ["ur", "en"] },
  { code: "PL", name: "Poland", aliases: ["polska"], languages: ["pl"] },
  { code: "PR", name: "Puerto Rico", languages: ["es", "en"] },
  { code: "PT", name: "Portugal", languages: ["pt"] },
  { code: "PY", name: "Paraguay", languages: ["es"] },
  { code: "QA", name: "Qatar", languages: ["ar", "en"] },
  { code: "RO", name: "Romania", languages: ["ro"] },
  { code: "RS", name: "Serbia", languages: ["sr"] },
  { code: "RU", name: "Russia", languages: ["ru"] },
  { code: "RW", name: "Rwanda", languages: ["en", "fr", "rw"] },
  { code: "SA", name: "Saudi Arabia", languages: ["ar", "en"] },
  { code: "SD", name: "Sudan", languages: ["ar", "en"] },
  { code: "SE", name: "Sweden", languages: ["sv"] },
  { code: "SG", name: "Singapore", languages: ["en", "zh", "ms", "ta"] },
  { code: "SI", name: "Slovenia", languages: ["sl"] },
  { code: "SK", name: "Slovakia", languages: ["sk"] },
  { code: "SN", name: "Senegal", languages: ["fr"] },
  { code: "SO", name: "Somalia", languages: ["so", "ar"] },
  { code: "SR", name: "Suriname", languages: ["nl"] },
  { code: "SV", name: "El Salvador", languages: ["es"] },
  { code: "SY", name: "Syria", languages: ["ar"] },
  { code: "SZ", name: "Eswatini", aliases: ["swaziland"], languages: ["en"] },
  { code: "TD", name: "Chad", languages: ["fr", "ar"] },
  { code: "TG", name: "Togo", languages: ["fr"] },
  { code: "TH", name: "Thailand", languages: ["th"] },
  { code: "TJ", name: "Tajikistan", languages: ["tg", "ru"] },
  { code: "TN", name: "Tunisia", languages: ["ar", "fr"] },
  { code: "TR", name: "Turkey", aliases: ["türkiye", "turkiye"], languages: ["tr"] },
  { code: "TT", name: "Trinidad and Tobago", languages: ["en"] },
  { code: "TW", name: "Taiwan", languages: ["zh"] },
  { code: "TZ", name: "Tanzania", languages: ["sw", "en"] },
  { code: "UA", name: "Ukraine", languages: ["uk"] },
  { code: "UG", name: "Uganda", languages: ["en", "sw"] },
  { code: "US", name: "United States", aliases: ["usa", "u.s.", "u.s.a.", "america", "united states of america"], languages: ["en", "es"] },
  { code: "UY", name: "Uruguay", languages: ["es"] },
  { code: "UZ", name: "Uzbekistan", languages: ["uz", "ru"] },
  { code: "VE", name: "Venezuela", languages: ["es"] },
  { code: "VN", name: "Vietnam", languages: ["vi"] },
  { code: "YE", name: "Yemen", languages: ["ar"] },
  { code: "ZA", name: "South Africa", languages: ["en", "af", "zu"] },
  { code: "ZM", name: "Zambia", languages: ["en"] },
  { code: "ZW", name: "Zimbabwe", languages: ["en"] },
];

// ── First-level subdivisions ────────────────────────────────────────────────
// Only for markets where "city, region" is the normal written form. A country
// absent from this map simply never classifies a part as a region, which leaves
// it as a place name — the safe failure, not a wrong label.
export const REGIONS: Record<string, RegionEntry[]> = {
  CA: [
    { code: "AB", name: "Alberta" },
    { code: "BC", name: "British Columbia" },
    { code: "MB", name: "Manitoba" },
    { code: "NB", name: "New Brunswick" },
    { code: "NL", name: "Newfoundland and Labrador", aliases: ["newfoundland"] },
    { code: "NS", name: "Nova Scotia" },
    { code: "NT", name: "Northwest Territories" },
    { code: "NU", name: "Nunavut" },
    { code: "ON", name: "Ontario" },
    { code: "PE", name: "Prince Edward Island" },
    { code: "QC", name: "Quebec", aliases: ["québec"] },
    { code: "SK", name: "Saskatchewan" },
    { code: "YT", name: "Yukon" },
  ],
  US: [
    { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
    { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
    { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
    { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
    { code: "DC", name: "District of Columbia", aliases: ["washington dc"] },
    { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" },
    { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
    { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
    { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" },
    { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
    { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
    { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" },
    { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
    { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
    { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" },
    { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
    { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
    { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" },
    { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
    { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
    { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" },
    { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
    { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
    { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" },
    { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
    { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
  ],
  AU: [
    { code: "ACT", name: "Australian Capital Territory" },
    { code: "NSW", name: "New South Wales" },
    { code: "NT", name: "Northern Territory" },
    { code: "QLD", name: "Queensland" },
    { code: "SA", name: "South Australia" },
    { code: "TAS", name: "Tasmania" },
    { code: "VIC", name: "Victoria" },
    { code: "WA", name: "Western Australia" },
  ],
  GB: [
    { code: "ENG", name: "England" },
    { code: "SCT", name: "Scotland" },
    { code: "WLS", name: "Wales" },
    { code: "NIR", name: "Northern Ireland" },
  ],
  IE: [
    { code: "D", name: "Dublin" }, { code: "CK", name: "Cork" },
    { code: "G", name: "Galway" }, { code: "LK", name: "Limerick" },
    { code: "WD", name: "Waterford" },
  ],
  NZ: [
    { code: "AUK", name: "Auckland" }, { code: "CAN", name: "Canterbury" },
    { code: "WGN", name: "Wellington" }, { code: "WKO", name: "Waikato" },
    { code: "BOP", name: "Bay of Plenty" }, { code: "OTA", name: "Otago" },
  ],
  DE: [
    { code: "BW", name: "Baden-Württemberg" }, { code: "BY", name: "Bavaria", aliases: ["bayern"] },
    { code: "BE", name: "Berlin" }, { code: "BB", name: "Brandenburg" },
    { code: "HB", name: "Bremen" }, { code: "HH", name: "Hamburg" },
    { code: "HE", name: "Hesse", aliases: ["hessen"] }, { code: "NI", name: "Lower Saxony", aliases: ["niedersachsen"] },
    { code: "MV", name: "Mecklenburg-Vorpommern" }, { code: "NW", name: "North Rhine-Westphalia", aliases: ["nordrhein-westfalen"] },
    { code: "RP", name: "Rhineland-Palatinate", aliases: ["rheinland-pfalz"] }, { code: "SL", name: "Saarland" },
    { code: "SN", name: "Saxony", aliases: ["sachsen"] }, { code: "ST", name: "Saxony-Anhalt" },
    { code: "SH", name: "Schleswig-Holstein" }, { code: "TH", name: "Thuringia", aliases: ["thüringen"] },
  ],
  ES: [
    { code: "AN", name: "Andalusia", aliases: ["andalucía"] }, { code: "AR", name: "Aragon" },
    { code: "AS", name: "Asturias" }, { code: "IB", name: "Balearic Islands" },
    { code: "PV", name: "Basque Country", aliases: ["país vasco"] }, { code: "CN", name: "Canary Islands" },
    { code: "CB", name: "Cantabria" }, { code: "CL", name: "Castile and León" },
    { code: "CM", name: "Castilla-La Mancha" }, { code: "CT", name: "Catalonia", aliases: ["cataluña", "catalunya"] },
    { code: "EX", name: "Extremadura" }, { code: "GA", name: "Galicia" },
    { code: "RI", name: "La Rioja" }, { code: "MD", name: "Madrid" },
    { code: "MC", name: "Murcia" }, { code: "NC", name: "Navarre" },
    { code: "VC", name: "Valencia", aliases: ["comunidad valenciana"] },
  ],
  FR: [
    { code: "ARA", name: "Auvergne-Rhône-Alpes" }, { code: "BFC", name: "Bourgogne-Franche-Comté" },
    { code: "BRE", name: "Brittany", aliases: ["bretagne"] }, { code: "CVL", name: "Centre-Val de Loire" },
    { code: "GES", name: "Grand Est" }, { code: "HDF", name: "Hauts-de-France" },
    { code: "IDF", name: "Île-de-France", aliases: ["ile-de-france"] }, { code: "NOR", name: "Normandy", aliases: ["normandie"] },
    { code: "NAQ", name: "Nouvelle-Aquitaine" }, { code: "OCC", name: "Occitanie" },
    { code: "PDL", name: "Pays de la Loire" }, { code: "PAC", name: "Provence-Alpes-Côte d'Azur" },
    { code: "COR", name: "Corsica", aliases: ["corse"] },
  ],
  IT: [
    { code: "ABR", name: "Abruzzo" }, { code: "BAS", name: "Basilicata" },
    { code: "CAL", name: "Calabria" }, { code: "CAM", name: "Campania" },
    { code: "EMR", name: "Emilia-Romagna" }, { code: "FVG", name: "Friuli-Venezia Giulia" },
    { code: "LAZ", name: "Lazio" }, { code: "LIG", name: "Liguria" },
    { code: "LOM", name: "Lombardy", aliases: ["lombardia"] }, { code: "MAR", name: "Marche" },
    { code: "MOL", name: "Molise" }, { code: "PIE", name: "Piedmont", aliases: ["piemonte"] },
    { code: "PUG", name: "Apulia", aliases: ["puglia"] }, { code: "SAR", name: "Sardinia", aliases: ["sardegna"] },
    { code: "SIC", name: "Sicily", aliases: ["sicilia"] }, { code: "TOS", name: "Tuscany", aliases: ["toscana"] },
    { code: "TAA", name: "Trentino-Alto Adige" }, { code: "UMB", name: "Umbria" },
    { code: "VDA", name: "Aosta Valley" }, { code: "VEN", name: "Veneto" },
  ],
  IN: [
    { code: "AP", name: "Andhra Pradesh" }, { code: "AS", name: "Assam" },
    { code: "BR", name: "Bihar" }, { code: "CT", name: "Chhattisgarh" },
    { code: "DL", name: "Delhi" }, { code: "GA", name: "Goa" },
    { code: "GJ", name: "Gujarat" }, { code: "HR", name: "Haryana" },
    { code: "HP", name: "Himachal Pradesh" }, { code: "JH", name: "Jharkhand" },
    { code: "KA", name: "Karnataka" }, { code: "KL", name: "Kerala" },
    { code: "MP", name: "Madhya Pradesh" }, { code: "MH", name: "Maharashtra" },
    { code: "OR", name: "Odisha" }, { code: "PB", name: "Punjab" },
    { code: "RJ", name: "Rajasthan" }, { code: "TN", name: "Tamil Nadu" },
    { code: "TG", name: "Telangana" }, { code: "UP", name: "Uttar Pradesh" },
    { code: "UT", name: "Uttarakhand" }, { code: "WB", name: "West Bengal" },
  ],
  BR: [
    { code: "AC", name: "Acre" }, { code: "AL", name: "Alagoas" },
    { code: "AM", name: "Amazonas" }, { code: "BA", name: "Bahia" },
    { code: "CE", name: "Ceará" }, { code: "DF", name: "Distrito Federal" },
    { code: "ES", name: "Espírito Santo" }, { code: "GO", name: "Goiás" },
    { code: "MA", name: "Maranhão" }, { code: "MG", name: "Minas Gerais" },
    { code: "MS", name: "Mato Grosso do Sul" }, { code: "MT", name: "Mato Grosso" },
    { code: "PA", name: "Pará" }, { code: "PB", name: "Paraíba" },
    { code: "PE", name: "Pernambuco" }, { code: "PR", name: "Paraná" },
    { code: "RJ", name: "Rio de Janeiro" }, { code: "RN", name: "Rio Grande do Norte" },
    { code: "RS", name: "Rio Grande do Sul" }, { code: "SC", name: "Santa Catarina" },
    { code: "SP", name: "São Paulo" }, { code: "SE", name: "Sergipe" },
  ],
  MX: [
    { code: "AGU", name: "Aguascalientes" }, { code: "BCN", name: "Baja California" },
    { code: "CHH", name: "Chihuahua" }, { code: "CMX", name: "Mexico City", aliases: ["ciudad de méxico", "cdmx"] },
    { code: "COA", name: "Coahuila" }, { code: "GUA", name: "Guanajuato" },
    { code: "JAL", name: "Jalisco" }, { code: "MEX", name: "State of Mexico" },
    { code: "NLE", name: "Nuevo León" }, { code: "PUE", name: "Puebla" },
    { code: "QUE", name: "Querétaro" }, { code: "SON", name: "Sonora" },
    { code: "VER", name: "Veracruz" }, { code: "YUC", name: "Yucatán" },
  ],
  ZA: [
    { code: "EC", name: "Eastern Cape" }, { code: "FS", name: "Free State" },
    { code: "GP", name: "Gauteng" }, { code: "KZN", name: "KwaZulu-Natal" },
    { code: "LP", name: "Limpopo" }, { code: "MP", name: "Mpumalanga" },
    { code: "NC", name: "Northern Cape" }, { code: "NW", name: "North West" },
    { code: "WC", name: "Western Cape" },
  ],
  NL: [
    { code: "DR", name: "Drenthe" }, { code: "FL", name: "Flevoland" },
    { code: "FR", name: "Friesland" }, { code: "GE", name: "Gelderland" },
    { code: "GR", name: "Groningen" }, { code: "LI", name: "Limburg" },
    { code: "NB", name: "North Brabant" }, { code: "NH", name: "North Holland" },
    { code: "OV", name: "Overijssel" }, { code: "UT", name: "Utrecht" },
    { code: "ZE", name: "Zeeland" }, { code: "ZH", name: "South Holland" },
  ],
};

/** Lowercase, accent-stripped, punctuation-tolerant key for lookups. */
export function geoKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Built once at module load: every spelling of a country mapped to its entry.
const COUNTRY_INDEX: Map<string, CountryEntry> = (() => {
  const m = new Map<string, CountryEntry>();
  for (const c of COUNTRIES) {
    m.set(geoKey(c.name), c);
    m.set(geoKey(c.code), c);
    for (const a of c.aliases || []) m.set(geoKey(a), c);
  }
  return m;
})();

export function lookupCountry(raw: string): CountryEntry | null {
  return COUNTRY_INDEX.get(geoKey(raw)) || null;
}

/**
 * Find a first-level subdivision by name or code.
 *
 * `countryCode` narrows the search when the country is already known, which
 * matters because subdivision codes collide across countries — "WA" is both
 * Washington and Western Australia, "SA" is both South Australia and South
 * Africa's abbreviation in casual use. With no country known, a two-letter code
 * is deliberately NOT matched: guessing between those is worse than leaving the
 * part as a place name.
 */
export function lookupRegion(raw: string, countryCode?: string | null): { region: RegionEntry; countryCode: string } | null {
  const key = geoKey(raw);
  const search = countryCode && REGIONS[countryCode] ? { [countryCode]: REGIONS[countryCode] } : REGIONS;
  const ambiguousShortCode = !countryCode && key.length <= 3;

  for (const [cc, regions] of Object.entries(search)) {
    for (const r of regions) {
      if (geoKey(r.name) === key) return { region: r, countryCode: cc };
      for (const a of r.aliases || []) if (geoKey(a) === key) return { region: r, countryCode: cc };
      if (!ambiguousShortCode && geoKey(r.code) === key) return { region: r, countryCode: cc };
    }
  }
  return null;
}

/** Plausible prompt languages for a country, most widely used first. */
export function languagesForCountry(countryCode: string | null | undefined): string[] {
  if (!countryCode) return [];
  return lookupCountry(countryCode)?.languages || [];
}
