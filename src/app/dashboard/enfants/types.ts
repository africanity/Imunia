export type AgeUnit = "WEEKS" | "MONTHS" | "YEARS";

export type VaccineWindow = {
  unit: AgeUnit | null;
  specificAge: number | null;
  min: number | null;
  max: number | null;
};

export type VaccineDue = {
  name: string;
  scheduledFor: string | null;
  ageWindow: VaccineWindow;
  dose: number;
};

export type VaccineScheduled = {
  name: string;
  scheduledFor: string | null;
  plannerId?: string | null;
  plannerName?: string | null;
  dose: number;
};

export type VaccineLate = {
  name: string;
  dueDate: string | null;
  dose: number;
};

export type VaccineCompleted = {
  name: string;
  administeredAt: string | null;
  administeredById?: string | null;
  administeredByName?: string | null;
  dose: number;
};

export type Child = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  gender: "M" | "F";
  birthDate: string;
  region: string;
  district: string;
  healthCenter: string;
  parentName: string;
  parentPhone: string;
  address: string;
  status: "A_JOUR" | "PAS_A_JOUR" | string;
  nextAppointment: string | null;
  isActive?: boolean;
  photosRequested?: boolean;
  vaccinesDue: VaccineDue[];
  vaccinesScheduled: VaccineScheduled[];
  vaccinesLate: VaccineLate[];
  vaccinesOverdue: VaccineLate[];
  vaccinesCompleted: VaccineCompleted[];
  createdAt: string;
  updatedAt: string;
};

export type VaccinationDetail = {
  child: {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    gender: "M" | "F";
    birthDate: string;
    status: string;
    parentName: string;
    parentPhone: string;
    address: string | null;
    region: string;
    district: string;
    healthCenter: string;
  };
  vaccinations: {
    due: Array<{
      id: string;
      vaccineId: string;
      vaccineName: string;
      scheduledFor: string | null;
      calendarId: string | null;
      calendarDescription?: string | null;
      ageUnit: AgeUnit | null;
      specificAge: number | null;
      minAge: number | null;
      maxAge: number | null;
      dose: number;
    }>;
    scheduled: Array<{
      id: string;
      vaccineId: string;
      vaccineName: string;
      scheduledFor: string | null;
      plannerId?: string | null;
      plannerName?: string | null;
      calendarId: string | null;
      dose: number;
    }>;
    late: Array<{
      id: string;
      vaccineId: string;
      vaccineName: string;
      dueDate: string | null;
      calendarId: string | null;
      calendarDescription?: string | null;
      dose: number;
    }>;
    overdue: Array<{
      id: string;
      vaccineId: string;
      vaccineName: string;
      dueDate: string | null;
      calendarId: string | null;
      calendarDescription?: string | null;
      dose: number;
    }>;
    completed: Array<{
      id: string;
      vaccineId: string;
      vaccineName: string;
      administeredAt: string | null;
      administeredById?: string | null;
      administeredByName?: string | null;
      calendarId: string | null;
      dose: number;
    }>;
  };
};

export type ParentChild = {
  id: string;
  firstName: string;
  lastName: string;
  gender: "M" | "F";
  status: string;
  region: string;
  healthCenter: string;
  nextAppointment: string | null;
  birthDate: string;
};

export type ParentOverview = {
  parentPhone: string;
  parentName: string;
  childrenCount: number;
  children: ParentChild[];
  regions: string[];
  healthCenters: string[];
};

