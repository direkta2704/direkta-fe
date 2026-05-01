export interface Notary {
  name: string;
  address: string;
  phone: string;
  email?: string;
}

const NOTARIES: Record<string, Notary[]> = {
  "Baden-Württemberg": [
    { name: "Dr. Stefan Müller", address: "Königstraße 28, 70173 Stuttgart", phone: "+49 711 123456", email: "mueller@notar-stuttgart.de" },
    { name: "Karin Weber", address: "Leopoldstraße 1, 76133 Karlsruhe", phone: "+49 721 234567" },
    { name: "Thomas Fischer", address: "Hauptstraße 55, 69117 Heidelberg", phone: "+49 6221 345678" },
    { name: "Anna Bauer", address: "Marienstraße 12, 79098 Freiburg", phone: "+49 761 456789" },
    { name: "Michael Schmidt", address: "Friedrichstraße 8, 68161 Mannheim", phone: "+49 621 567890" },
  ],
  "Bayern": [
    { name: "Dr. Hans Wagner", address: "Maximilianstraße 35, 80539 München", phone: "+49 89 123456" },
    { name: "Claudia Hofmann", address: "Königstraße 10, 90402 Nürnberg", phone: "+49 911 234567" },
    { name: "Peter Braun", address: "Maximilianstraße 2, 86150 Augsburg", phone: "+49 821 345678" },
    { name: "Elisabeth Hartmann", address: "Obere Königstraße 4, 96052 Bamberg", phone: "+49 951 456789" },
    { name: "Georg Maier", address: "Residenzplatz 1, 97070 Würzburg", phone: "+49 931 567890" },
  ],
  "Berlin": [
    { name: "Dr. Sabine Richter", address: "Kurfürstendamm 195, 10707 Berlin", phone: "+49 30 123456" },
    { name: "Frank Neumann", address: "Friedrichstraße 100, 10117 Berlin", phone: "+49 30 234567" },
    { name: "Julia Schwarz", address: "Kantstraße 150, 10623 Berlin", phone: "+49 30 345678" },
    { name: "Markus Zimmermann", address: "Bundesallee 23, 10717 Berlin", phone: "+49 30 456789" },
    { name: "Petra Krüger", address: "Karl-Marx-Allee 1, 10178 Berlin", phone: "+49 30 567890" },
  ],
  "Hessen": [
    { name: "Dr. Jürgen Wolf", address: "Bockenheimer Landstraße 51, 60325 Frankfurt", phone: "+49 69 123456" },
    { name: "Monika Berger", address: "Luisenplatz 2, 64283 Darmstadt", phone: "+49 6151 234567" },
    { name: "Andreas Koch", address: "Obere Königstraße 1, 34117 Kassel", phone: "+49 561 345678" },
    { name: "Susanne Lang", address: "Wilhelmstraße 10, 65183 Wiesbaden", phone: "+49 611 456789" },
    { name: "Christian Werner", address: "Bahnhofstraße 5, 35037 Marburg", phone: "+49 6421 567890" },
  ],
  "Nordrhein-Westfalen": [
    { name: "Dr. Ralf Peters", address: "Königsallee 60, 40212 Düsseldorf", phone: "+49 211 123456" },
    { name: "Birgit Möller", address: "Domkloster 3, 50667 Köln", phone: "+49 221 234567" },
    { name: "Stefan Schulte", address: "Friedensplatz 1, 44135 Dortmund", phone: "+49 231 345678" },
    { name: "Martina Kaiser", address: "Rathausplatz 2, 45127 Essen", phone: "+49 201 456789" },
    { name: "Oliver Vogt", address: "Prinzipalmarkt 10, 48143 Münster", phone: "+49 251 567890" },
  ],
  "Niedersachsen": [
    { name: "Dr. Anja Lorenz", address: "Georgstraße 11, 30159 Hannover", phone: "+49 511 123456" },
    { name: "Bernd Schäfer", address: "Kohlmarkt 1, 38100 Braunschweig", phone: "+49 531 234567" },
    { name: "Katrin Friedrich", address: "Große Straße 20, 49074 Osnabrück", phone: "+49 541 345678" },
  ],
  "Sachsen": [
    { name: "Dr. Uwe Krause", address: "Augustusplatz 9, 04109 Leipzig", phone: "+49 341 123456" },
    { name: "Heike Scholz", address: "Prager Straße 10, 01069 Dresden", phone: "+49 351 234567" },
    { name: "Matthias Fuchs", address: "Markt 1, 09111 Chemnitz", phone: "+49 371 345678" },
  ],
};

// Map postcode prefixes to Bundesland
const POSTCODE_MAP: Record<string, string> = {
  "01": "Sachsen", "02": "Sachsen", "03": "Brandenburg", "04": "Sachsen",
  "06": "Sachsen-Anhalt", "07": "Thüringen", "08": "Sachsen", "09": "Sachsen",
  "10": "Berlin", "12": "Berlin", "13": "Berlin", "14": "Brandenburg",
  "15": "Brandenburg", "16": "Brandenburg", "17": "Mecklenburg-Vorpommern",
  "18": "Mecklenburg-Vorpommern", "19": "Mecklenburg-Vorpommern",
  "20": "Hamburg", "21": "Niedersachsen", "22": "Hamburg", "23": "Schleswig-Holstein",
  "24": "Schleswig-Holstein", "25": "Schleswig-Holstein", "26": "Niedersachsen",
  "27": "Niedersachsen", "28": "Bremen", "29": "Niedersachsen",
  "30": "Niedersachsen", "31": "Niedersachsen", "32": "Nordrhein-Westfalen",
  "33": "Nordrhein-Westfalen", "34": "Hessen", "35": "Hessen",
  "36": "Hessen", "37": "Niedersachsen", "38": "Niedersachsen",
  "39": "Sachsen-Anhalt",
  "40": "Nordrhein-Westfalen", "41": "Nordrhein-Westfalen", "42": "Nordrhein-Westfalen",
  "44": "Nordrhein-Westfalen", "45": "Nordrhein-Westfalen", "46": "Nordrhein-Westfalen",
  "47": "Nordrhein-Westfalen", "48": "Nordrhein-Westfalen", "49": "Niedersachsen",
  "50": "Nordrhein-Westfalen", "51": "Nordrhein-Westfalen", "52": "Nordrhein-Westfalen",
  "53": "Nordrhein-Westfalen", "54": "Rheinland-Pfalz", "55": "Rheinland-Pfalz",
  "56": "Rheinland-Pfalz", "57": "Nordrhein-Westfalen", "58": "Nordrhein-Westfalen",
  "59": "Nordrhein-Westfalen",
  "60": "Hessen", "61": "Hessen", "63": "Hessen", "64": "Hessen",
  "65": "Hessen", "66": "Saarland", "67": "Rheinland-Pfalz",
  "68": "Baden-Württemberg", "69": "Baden-Württemberg",
  "70": "Baden-Württemberg", "71": "Baden-Württemberg", "72": "Baden-Württemberg",
  "73": "Baden-Württemberg", "74": "Baden-Württemberg", "75": "Baden-Württemberg",
  "76": "Baden-Württemberg", "77": "Baden-Württemberg", "78": "Baden-Württemberg",
  "79": "Baden-Württemberg",
  "80": "Bayern", "81": "Bayern", "82": "Bayern", "83": "Bayern",
  "84": "Bayern", "85": "Bayern", "86": "Bayern", "87": "Bayern",
  "88": "Baden-Württemberg", "89": "Bayern",
  "90": "Bayern", "91": "Bayern", "92": "Bayern", "93": "Bayern",
  "94": "Bayern", "95": "Bayern", "96": "Bayern", "97": "Bayern",
  "98": "Thüringen", "99": "Thüringen",
};

export function getNotariesByPostcode(postcode: string): { bundesland: string; notaries: Notary[] } {
  const prefix = postcode.slice(0, 2);
  const bundesland = POSTCODE_MAP[prefix] || "Unbekannt";
  const notaries = NOTARIES[bundesland] || NOTARIES["Baden-Württemberg"] || [];
  return { bundesland, notaries };
}
