"use client";

import { MapPin, ChevronRight, Users, Activity, TrendingUp, Building2 } from "lucide-react";

interface RegionPerformance {
  region: string;
  totalChildren: number;
  vaccinations: number;
  coverage: number;
}

interface RegionsTabProps {
  regionPerformance: RegionPerformance[];
  onRegionClick: (regionName: string) => void;
}

export default function RegionsTab({ regionPerformance, onRegionClick }: RegionsTabProps) {
  const maxVaccinations = Math.max(...regionPerformance.map((r) => r.vaccinations), 1);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <MapPin className="h-6 w-6 text-blue-600" />
          Analyse Détaillée par Région
        </h2>
        <p className="text-gray-600">
          Cliquez sur une région pour voir les statistiques par district et agents de santé
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {regionPerformance.map((region, idx) => (
          <div
            key={idx}
            onClick={() => onRegionClick(region.region)}
            className="bg-white rounded-xl shadow-md p-6 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:scale-105 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <MapPin className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{region.region}</h3>
                  <div className="text-sm text-gray-500">Cliquer pour explorer</div>
                </div>
              </div>
              <ChevronRight className="h-6 w-6 text-blue-600" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Enfants</span>
                </div>
                <span className="font-bold text-gray-900">{region.totalChildren.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Vaccinations</span>
                </div>
                <span className="font-bold text-gray-900">{region.vaccinations.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Couverture</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">{region.coverage.toFixed(1)}%</span>
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        region.coverage >= 90
                          ? "bg-green-500"
                          : region.coverage >= 75
                          ? "bg-blue-500"
                          : region.coverage >= 60
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(region.coverage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}






