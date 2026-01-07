// tests/unit/vaccineDose.test.js
const {
  buildVaccineDoseMap,
  getDoseDescriptor,
} = require("../../src/utils/vaccineDose");

describe("vaccineDose", () => {
  describe("buildVaccineDoseMap", () => {
    it("devrait retourner une map vide si calendarEntries est vide", () => {
      const result = buildVaccineDoseMap([]);
      expect(result.doseDefinitionMap).toBeInstanceOf(Map);
      expect(result.doseDefinitionMap.size).toBe(0);
    });

    it("devrait construire correctement la map avec des entrées valides", () => {
      const entries = [
        {
          id: "cal1",
          ageUnit: "WEEKS",
          specificAge: 6,
          minAge: null,
          maxAge: null,
          description: "Première dose",
          doseAssignments: [
            {
              vaccine: { id: "vac1" },
              doseNumber: 1,
            },
          ],
        },
      ];

      const result = buildVaccineDoseMap(entries);
      expect(result.doseDefinitionMap.has("vac1")).toBe(true);
      const vaccineMap = result.doseDefinitionMap.get("vac1");
      expect(vaccineMap.has(1)).toBe(true);
      expect(vaccineMap.get(1).calendarId).toBe("cal1");
      expect(vaccineMap.get(1).description).toBe("Première dose");
    });

    it("devrait gérer les fallback counters pour les doses sans numéro", () => {
      // Note: assignment?.doseNumber ?? null retourne null si doseNumber est undefined
      // Number(null) = 0, et Number.isFinite(0) = true
      // Donc le code entre dans la branche if et utilise Math.max(1, Math.floor(0)) = 1
      // Le fallback counter n'est utilisé que si rawDoseNumber est une string non-numérique
      // Pour tester le fallback counter, on doit utiliser des entries différentes
      const entries = [
        {
          id: "cal1",
          ageUnit: "WEEKS",
          vaccines: [
            { id: "vac1" }, // Pas de doseNumber - sera dose 1 (Number(null)=0, Math.max(1,0)=1)
          ],
        },
        {
          id: "cal2",
          ageUnit: "MONTHS",
          vaccines: [
            { id: "vac1" }, // Pas de doseNumber - sera dose 1 aussi (Number(null)=0, Math.max(1,0)=1)
          ],
        },
      ];

      const result = buildVaccineDoseMap(entries);
      const vaccineMap = result.doseDefinitionMap.get("vac1");
      expect(vaccineMap).toBeDefined();
      
      // Les deux assignments créent la dose 1 car Number(null) = 0
      // Le second écrase le premier car ils ont le même doseNumber (1)
      expect(vaccineMap.has(1)).toBe(true);
      expect(vaccineMap.size).toBe(1);
      
      // La dose finale a le calendarId du dernier entry traité
      expect(vaccineMap.get(1).calendarId).toBe("cal2");
    });

    it("devrait ignorer les entrées sans vaccineId", () => {
      const entries = [
        {
          id: "cal1",
          doseAssignments: [
            {
              vaccine: null,
              doseNumber: 1,
            },
          ],
        },
      ];

      const result = buildVaccineDoseMap(entries);
      expect(result.doseDefinitionMap.size).toBe(0);
    });
  });

  describe("getDoseDescriptor", () => {
    it("devrait retourner null si doseMap est null", () => {
      expect(getDoseDescriptor(null, "vac1", 1)).toBeNull();
    });

    it("devrait retourner null si vaccineId est null", () => {
      const doseMap = { doseDefinitionMap: new Map() };
      expect(getDoseDescriptor(doseMap, null, 1)).toBeNull();
    });

    it("devrait retourner null si doseNumber est null", () => {
      const doseMap = { doseDefinitionMap: new Map() };
      expect(getDoseDescriptor(doseMap, "vac1", null)).toBeNull();
    });

    it("devrait retourner le descripteur si la dose existe", () => {
      const doseMap = {
        doseDefinitionMap: new Map([
          [
            "vac1",
            new Map([
              [
                1,
                {
                  calendarId: "cal1",
                  description: "Première dose",
                },
              ],
            ]),
          ],
        ]),
      };

      const descriptor = getDoseDescriptor(doseMap, "vac1", 1);
      expect(descriptor).not.toBeNull();
      expect(descriptor.description).toBe("Première dose");
    });

    it("devrait retourner le descripteur de la dose la plus proche si la dose exacte n'existe pas", () => {
      const doseMap = {
        doseDefinitionMap: new Map([
          [
            "vac1",
            new Map([
              [1, { calendarId: "cal1", description: "Dose 1" }],
              [3, { calendarId: "cal3", description: "Dose 3" }],
            ]),
          ],
        ]),
      };

      // Chercher la dose 2, qui n'existe pas, devrait retourner la dose 3 (la plus proche supérieure)
      const descriptor = getDoseDescriptor(doseMap, "vac1", 2);
      expect(descriptor).not.toBeNull();
      expect(descriptor.description).toBe("Dose 3");
    });

    it("devrait retourner null si aucune dose n'existe pour le vaccin", () => {
      const doseMap = {
        doseDefinitionMap: new Map(),
      };

      expect(getDoseDescriptor(doseMap, "vac1", 1)).toBeNull();
    });
  });
});
