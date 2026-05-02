require("dotenv").config({ path: ".env.local" });
async function main() {
  const { IS24ApiDriver } = require("../src/lib/is24-api-driver");
  const d = new IS24ApiDriver();
  const r = await d.publish({
    title: "TEST Expose Render - ETW Gaggenau",
    description: "Testbeschreibung für Sandbox-Rendering.",
    price: 300000,
    propertyType: "ETW",
    livingArea: 95,
    plotArea: null,
    rooms: 3,
    bathrooms: 1,
    floor: 1,
    yearBuilt: 1999,
    condition: "GEPFLEGT",
    attributes: [],
    city: "Gaggenau",
    postcode: "76571",
    street: "Marktstraße",
    houseNumber: "12",
    photos: [],
    energyClass: null,
    energyValue: 70.2,
    energyCertType: "VERBRAUCH",
    energyPrimarySource: "Gas",
    sellerFirstName: "Sagar",
    sellerLastName: "Kapase",
    sellerEmail: "test@test.com",
    sellerPhone: null,
  });
  console.log("\nID:", r.externalListingId);
  console.log("URL:", r.externalUrl);
}
main();
